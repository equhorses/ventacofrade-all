import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import SellerBadge from '@/components/SellerBadge';
import SellerContactLinks from '@/components/SellerContactLinks';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { client, type PublicShop } from '@/lib/api';
import { MapPin, Search, Sparkles, Star, Store } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

// Tienda propia del vendedor Profesional: /tienda/<slug>
export default function TiendaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    Promise.all([client.shops.publicBySlug(slug), client.entities.categories.query({ limit: 50 })])
      .then(([shopRes, catRes]) => {
        setShop(shopRes.data);
        setCategories(catRes?.data?.items || []);
        if (shopRes.data.active && shopRes.data.seller) {
          client.reviews
            .list(shopRes.data.seller.id)
            .then((r) => setRating({ avg: r.data.average_rating, count: r.data.items.length }))
            .catch(() => undefined);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (shop?.seller) document.title = `${shop.seller.shop_name} · Tienda en VentaCofrade`;
  }, [shop]);

  const products = useMemo(() => shop?.products ?? [], [shop]);
  const shopCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products],
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (!categoryId || p.category_id === categoryId) && (!q || p.title.toLowerCase().includes(q)),
    );
  }, [products, search, categoryId]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-muted-foreground">Cargando tienda…</div>
      </Layout>
    );
  }

  // La tienda existe pero el vendedor ya no tiene plan Profesional: a su perfil normal.
  if (shop && !shop.active && shop.seller_id) {
    return <Navigate to={`/vendedor/${shop.seller_id}`} replace />;
  }

  if (notFound || !shop?.seller) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground">Esta tienda no existe.</p>
          <Button asChild variant="outline">
            <Link to="/explorar">Explorar anuncios</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const seller = shop.seller;
  const longText = seller.shop_long_description || '';
  const isLong = longText.length > 600;

  return (
    <Layout>
      {/* Portada */}
      <div className="relative h-44 sm:h-64 bg-gradient-to-r from-[#5B21B6] to-[#6D28D9]">
        {seller.shop_cover_url && (
          <img src={seller.shop_cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Cabecera */}
        <div className="-mt-12 sm:-mt-16 relative flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-background bg-background shadow-md overflow-hidden flex items-center justify-center shrink-0">
            {seller.shop_logo_url ? (
              <img src={seller.shop_logo_url} alt={`Logo de ${seller.shop_name}`} className="w-full h-full object-cover" />
            ) : (
              <Store className="h-12 w-12 text-primary" />
            )}
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              {seller.shop_name}
              <SellerBadge tier={seller.tier} />
              {seller.is_founder && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3" /> Fundador
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-muted-foreground">
              {(seller.city || seller.province) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {[seller.city, seller.province].filter(Boolean).join(', ')}
                </span>
              )}
              <Link to={`/vendedor/${seller.id}`} className="flex items-center gap-1 hover:text-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {rating.count > 0 ? `${rating.avg.toFixed(1)} (${rating.count} valoraciones)` : 'Ver valoraciones'}
              </Link>
              <span>{products.length} {products.length === 1 ? 'anuncio' : 'anuncios'}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <SellerContactLinks contact={seller} tier={seller.tier} />
        </div>

        {/* Descripción */}
        {(longText || seller.shop_description) && (
          <div className="mt-6 max-w-3xl">
            <p
              className={`text-sm leading-relaxed text-foreground/90 whitespace-pre-line ${
                isLong && !expanded ? 'line-clamp-6' : ''
              }`}
            >
              {longText || seller.shop_description}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-sm text-primary font-medium mt-1 cursor-pointer"
              >
                {expanded ? 'Ver menos' : 'Leer más'}
              </button>
            )}
          </div>
        )}

        {/* Catálogo */}
        <div className="mt-8 pb-16">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en esta tienda"
                className="pl-9"
              />
            </div>
            {shopCategories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  size="sm"
                  variant={categoryId === null ? 'default' : 'outline'}
                  onClick={() => setCategoryId(null)}
                  className="cursor-pointer shrink-0"
                >
                  Todo
                </Button>
                {shopCategories.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={categoryId === c.id ? 'default' : 'outline'}
                    onClick={() => setCategoryId(c.id)}
                    className="cursor-pointer shrink-0"
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {visible.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {visible.map((p) => (
                <Link key={p.id} to={`/producto/${p.id}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
                    <div className="aspect-square bg-muted relative">
                      {p.images && (
                        <img
                          src={p.images.split(',')[0]}
                          alt={p.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {p.is_featured && (
                        <span className="absolute top-2 left-2 text-[11px] font-semibold bg-[#D4AF37] text-white px-2 py-0.5 rounded-full">
                          Destacado
                        </span>
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
            <p className="text-sm text-muted-foreground">
              {products.length ? 'No hay anuncios que coincidan con tu búsqueda.' : 'Esta tienda no tiene anuncios activos ahora mismo.'}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
