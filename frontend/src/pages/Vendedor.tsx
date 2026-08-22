import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import Layout from '@/components/Layout';
import { client } from '@/lib/api';
import { Store, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Review } from '@/lib/api';

interface SellerProfile {
  id: number;
  user_id: string;
  shop_name: string;
  shop_description?: string;
  province: string;
  rating?: number;
}

interface Product {
  id: number;
  title: string;
  price: number;
  images: string;
}

export default function VendedorPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const sellerRes = await client.entities.seller_profiles.query({ query: { id: Number(id) }, limit: 1 });
        const sellerProfile = sellerRes?.data?.items?.[0];
        if (!sellerProfile) {
          setLoading(false);
          return;
        }
        setSeller(sellerProfile);

        const [productsRes, reviewsRes] = await Promise.all([
          client.entities.products.query({
            query: { user_id: sellerProfile.user_id, status: 'active' },
            sort: '-created_at',
            limit: 50,
          }),
          client.reviews.list(sellerProfile.id),
        ]);
        setProducts(productsRes?.data?.items || []);
        setReviews(reviewsRes.data.items);
        setAvgRating(reviewsRes.data.average_rating);

        const mine = reviewsRes.data.items.find((r) => r.reviewer_user_id === user?.id);
        if (mine) {
          setMyRating(mine.rating);
          setMyComment(mine.comment || '');
        }
      } catch (err) {
        console.error('Error loading seller profile:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user?.id]);

  const handleSubmitReview = async () => {
    if (!seller || myRating === 0) return;
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center text-muted-foreground">Cargando...</div>
      </Layout>
    );
  }

  if (!seller) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center text-muted-foreground">
          Vendedor no encontrado.
        </div>
      </Layout>
    );
  }

  const isOwnProfile = user?.id === seller.user_id;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Cabecera del vendedor */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{seller.shop_name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {seller.province}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {avgRating > 0 ? avgRating.toFixed(1) : 'Sin valoraciones'}
                {reviews.length > 0 && ` (${reviews.length})`}
              </span>
            </div>
            {seller.shop_description && (
              <p className="text-sm text-muted-foreground mt-2">{seller.shop_description}</p>
            )}
          </div>
        </div>

        {/* Anuncios activos */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Anuncios activos</h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <Link key={p.id} to={`/producto/${p.id}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <div className="aspect-square bg-muted">
                      {p.images && (
                        <img
                          src={p.images.split(',')[0]}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                      <p className="text-primary font-semibold text-sm">{p.price?.toFixed(2)} €</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Este vendedor no tiene anuncios activos ahora mismo.</p>
          )}
        </div>

        {/* Valoraciones */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Valoraciones</h2>

          {!isOwnProfile && user && (
            <Card className="mb-4">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {myRating > 0 ? 'Tu valoración' : '¿Has tenido trato con este vendedor? Cuéntanos qué tal fue'}
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
                        className={`h-6 w-6 ${
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
                    <Button size="sm" disabled={submitting} onClick={handleSubmitReview} className="cursor-pointer">
                      Guardar valoración
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Este vendedor todavía no tiene valoraciones.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
