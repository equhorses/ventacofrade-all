import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import Layout from '@/components/Layout';
import { client } from '@/lib/api';
import { MapPin, Heart, Share2, MessageCircle, Eye, ArrowLeft, Church, User, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Review } from '@/lib/api';

interface SellerProfile {
  id: number;
  shop_name: string;
  rating?: number;
}

interface Product {
  id: number;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category_id: number;
  condition: string;
  location_province: string;
  location_city: string;
  images: string;
  status: string;
  is_featured: boolean;
  views_count: number;
  created_at: string;
}

const conditionLabels: Record<string, string> = {
  nuevo: 'Nuevo',
  usado: 'Usado',
  restaurado: 'Restaurado',
};

const QUICK_MESSAGES = [
  'Hola, ¿sigue disponible?',
  'Me interesa, ¿aceptas envío?',
  '¿Es negociable el precio?',
];

export default function ProductoPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const loadSellerAndReviews = async () => {
      try {
        const sellerRes = await client.entities.seller_profiles.query({
          query: { user_id: product.user_id },
          limit: 1,
        });
        const sellerProfile = sellerRes?.data?.items?.[0];
        if (!sellerProfile) return;
        setSeller(sellerProfile);

        const reviewsRes = await client.reviews.list(sellerProfile.id);
        setReviews(reviewsRes.data.items);
        setAvgRating(reviewsRes.data.average_rating);
        const mine = reviewsRes.data.items.find((r) => r.reviewer_user_id === user?.id);
        if (mine) {
          setMyRating(mine.rating);
          setMyComment(mine.comment || '');
        }
      } catch (err) {
        console.error('Error loading seller/reviews:', err);
      }
    };
    loadSellerAndReviews();
  }, [product, user?.id]);

  const handleSubmitReview = async () => {
    if (!seller || myRating === 0) return;
    setSubmittingReview(true);
    try {
      await client.reviews.submit(seller.id, myRating, myComment.trim() || undefined);
      const reviewsRes = await client.reviews.list(seller.id);
      setReviews(reviewsRes.data.items);
      setAvgRating(reviewsRes.data.average_rating);
      toast.success('¡Gracias por tu valoración!');
    } catch (err: unknown) {
      console.error('Error submitting review:', err);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo enviar la valoración.';
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const loadProduct = async () => {
    try {
      const res = await client.entities.products.get({ id: id! });
      setProduct(res?.data || null);
    } catch (err) {
      console.error('Error loading product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    try {
      if (isFavorite) {
        setIsFavorite(false);
        toast.success('Eliminado de favoritos');
      } else {
        await client.entities.favorites.create({ data: { product_id: product!.id } });
        setIsFavorite(true);
        toast.success('Añadido a favoritos');
      }
    } catch {
      toast.error('Inicia sesión para guardar favoritos');
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !product) return;
    setSending(true);
    try {
      await client.entities.messages.create({
        data: {
          receiver_id: product.user_id,
          product_id: product.id,
          content: message.trim(),
        },
      });
      toast.success('Mensaje enviado al vendedor');
      window.dispatchEvent(new Event('messages:updated'));
      setMessage('');
    } catch {
      toast.error('Inicia sesión para enviar mensajes');
    } finally {
      setSending(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Enlace copiado al portapapeles');
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-muted rounded-lg" />
              <div className="space-y-4">
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-10 bg-muted rounded w-1/3" />
                <div className="h-20 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Church className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Anuncio no encontrado</h2>
          <p className="text-muted-foreground mb-6">Este anuncio puede haber sido eliminado o no existe.</p>
          <Link to="/explorar">
            <Button className="cursor-pointer">Volver a explorar</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const images = product.images ? product.images.split(',').filter(Boolean) : [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link to="/explorar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          Volver a anuncios
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Images */}
          <div className="lg:col-span-3">
            <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              {images.length > 0 ? (
                <img src={images[0]} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Church className="h-20 w-20 text-muted-foreground/30" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {images.slice(1, 5).map((img, i) => (
                  <div key={i} className="aspect-square bg-muted rounded overflow-hidden">
                    <img src={img} alt={`${product.title} ${i + 2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize">{conditionLabels[product.condition]}</Badge>
                {product.is_featured && <Badge className="bg-secondary text-secondary-foreground">Destacado</Badge>}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
              <p className="text-3xl font-bold text-primary mt-3">{product.price.toFixed(2)} €</p>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {product.location_city ? `${product.location_city}, ${product.location_province}` : product.location_province}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {product.views_count} visitas
              </span>
            </div>

            <Separator />

            {product.description && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Descripción</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleFavorite}
                variant={isFavorite ? 'default' : 'outline'}
                className="flex-1 cursor-pointer"
              >
                <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? 'Guardado' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={handleShare} className="cursor-pointer">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Contact Seller */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">Contactar vendedor</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_MESSAGES.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => setMessage((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                      className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hola, me interesa este artículo..."
                  rows={3}
                  className="resize-none"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sending}
                  className="w-full bg-primary hover:bg-primary/90 cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {sending ? 'Enviando...' : 'Enviar mensaje'}
                </Button>
              </CardContent>
            </Card>

            {/* Seller rating + reviews */}
            {seller && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Link to={`/vendedor/${seller.id}`} className="font-medium text-sm hover:text-primary cursor-pointer">
                      {seller.shop_name}
                    </Link>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-medium">
                        {avgRating > 0 ? avgRating.toFixed(1) : 'Sin valoraciones'}
                      </span>
                      {reviews.length > 0 && (
                        <span className="text-xs text-muted-foreground">({reviews.length})</span>
                      )}
                    </div>
                  </div>

                  {reviews.length > 0 && (
                    <div className="space-y-3 max-h-52 overflow-y-auto">
                      {reviews.map((r) => (
                        <div key={r.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                          <div className="flex items-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`h-3.5 w-3.5 ${
                                  n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                                }`}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">{r.reviewer_name || 'Usuario'}</span>
                          </div>
                          {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {user && product && user.id !== product.user_id && (
                    <div className="border-t border-border pt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {myRating > 0 ? 'Tu valoración' : 'Deja tu valoración'}
                      </p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setMyRating(n)}
                            className="cursor-pointer"
                            aria-label={`${n} estrellas`}
                          >
                            <Star
                              className={`h-5 w-5 ${
                                n <= myRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      {myRating > 0 && (
                        <>
                          <Textarea
                            value={myComment}
                            onChange={(e) => setMyComment(e.target.value)}
                            placeholder="Comparte tu experiencia (opcional)"
                            rows={2}
                            className="resize-none text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            disabled={submittingReview}
                            onClick={handleSubmitReview}
                          >
                            Guardar valoración
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
