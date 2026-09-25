import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import SellerBadge from '@/components/SellerBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { client, type LandingPage, type LandingProduct, type LandingSummary } from '@/lib/api';
import { Church, MapPin, Plus, Search } from 'lucide-react';

// Páginas de búsqueda para Google, tipo Milanuncios: /venta/paso-de-misterio, /venta/tunicas-de-nazareno...
// El contenido (texto y anuncios) viene del backend: services/seo_landings.py.

const SITE = 'https://www.ventacofrade.com';
const conditionLabels: Record<string, string> = { nuevo: 'Nuevo', usado: 'Usado', restaurado: 'Restaurado' };

function useSeo(title: string, description: string, path: string, noindex = false) {
  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = title;

    const set = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      const created = !el;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      const previous = el.getAttribute(attr);
      el.setAttribute(attr, value);
      return () => (created ? el?.remove() : previous !== null && el?.setAttribute(attr, previous));
    };
    const meta = (name: string) => () => {
      const m = document.createElement('meta');
      m.setAttribute('name', name);
      return m;
    };
    const undo = [
      set('meta[name="description"]', meta('description'), 'content', description),
      set('meta[name="robots"]', meta('robots'), 'content', noindex ? 'noindex, follow' : 'index, follow'),
      set(
        'link[rel="canonical"]',
        () => {
          const l = document.createElement('link');
          l.setAttribute('rel', 'canonical');
          return l;
        },
        'href',
        `${SITE}${path}`,
      ),
    ];
    return () => {
      document.title = previousTitle;
      undo.forEach((fn) => fn());
    };
  }, [title, description, path, noindex]);
}

function ProductCard({ product }: { product: LandingProduct }) {
  return (
    <Link to={`/producto/${product.id}`} className="group cursor-pointer">
      <Card className="overflow-hidden border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 h-full">
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {product.images ? (
            <img
              src={product.images.split(',')[0]}
              alt={product.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Church className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs">Destacado</Badge>
          )}
          <Badge variant="outline" className="absolute top-2 right-2 bg-white/90 text-xs">
            {conditionLabels[product.condition] || product.condition}
          </Badge>
        </div>
        <CardContent className="p-4">
          <SellerBadge tier={product.seller_tier} className="mb-2" />
          <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {product.title}
          </h3>
          <p className="text-xl font-bold text-primary">{product.price.toFixed(2)} €</p>
          {(product.location_city || product.location_province) && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{product.location_city || product.location_province}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Grid({ products }: { products: LandingProduct[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function Chips({ items, title }: { items: LandingSummary[]; title: string }) {
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Link
            key={i.slug}
            to={`/venta/${i.slug}`}
            className="px-4 py-2 rounded-full text-sm bg-muted text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {i.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function VentaIndexPage() {
  const [items, setItems] = useState<LandingSummary[]>([]);
  useSeo(
    'Artículos cofrades en venta por tipo | VentaCofrade',
    'Encuentra pasos, túnicas de nazareno, orfebrería, bordados, imágenes y enseres cofrades en venta.',
    '/venta',
  );
  useEffect(() => {
    client.landings
      .list()
      .then(({ data }) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);
  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground mb-3">Qué buscar en VentaCofrade</h1>
        <p className="text-muted-foreground mb-8">
          Todas las búsquedas de artículos cofrades y religiosos: pasos, túnicas, orfebrería, bordados, imágenes, cera,
          medallas, instrumentos de banda y mucho más.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items
            .filter((i) => !i.parent)
            .map((i) => {
              const children = items.filter((c) => c.parent === i.slug);
              return (
                <div key={i.slug} className="rounded-lg border border-border p-4">
                  <Link to={`/venta/${i.slug}`} className="flex items-center gap-2 group">
                    <Search className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-foreground group-hover:text-primary">{i.name} en venta</span>
                  </Link>
                  {children.length > 0 && (
                    <ul className="mt-2 ml-6 space-y-1 text-sm">
                      {children.map((c) => (
                        <li key={c.slug}>
                          <Link to={`/venta/${c.slug}`} className="text-muted-foreground hover:text-primary">
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </Layout>
  );
}

export default function VentaPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [data, setData] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSeo(data?.title || '', data?.description || '', `/venta/${slug}`, data ? !data.indexable : false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    client.landings
      .get(slug)
      .then(({ data }) => setData(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-muted-foreground">Cargando…</div>
      </Layout>
    );
  }

  if (notFound || !data) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground">Esta búsqueda no existe.</p>
          <Button asChild variant="outline">
            <Link to="/venta">Ver todas las búsquedas</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const lower = data.name.toLowerCase();

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <nav className="text-xs text-muted-foreground mb-4" aria-label="Migas de pan">
          <Link to="/" className="hover:text-foreground">
            Inicio
          </Link>{' '}
          ›{' '}
          <Link to="/venta" className="hover:text-foreground">
            Búsquedas
          </Link>{' '}
          › <span className="text-foreground">{data.name}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{data.name} en venta</h1>
        <div className="max-w-3xl space-y-3 text-muted-foreground mb-8">
          {data.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        {data.matches.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {data.matches.length} {data.matches.length === 1 ? 'anuncio' : 'anuncios'} de {lower}
            </h2>
            <Grid products={data.matches} />
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
            <p className="text-foreground font-medium">Ahora mismo no hay anuncios de {lower}.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vuelve pronto o mira otros anuncios parecidos más abajo.
            </p>
          </div>
        )}

        <div className="mt-8 rounded-lg bg-muted/60 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-foreground flex-1">
            ¿Tienes {lower} que ya no usas? <strong>Publicar es gratis</strong> y lo ven cofrades de toda España.
          </p>
          <Button asChild>
            <Link to="/publicar">
              <Plus className="h-4 w-4 mr-1" /> Publicar anuncio
            </Link>
          </Button>
        </div>

        {data.related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-foreground mb-4">Otros anuncios que te pueden interesar</h2>
            <Grid products={data.related} />
          </section>
        )}

        <Chips items={data.children} title="Búsquedas más concretas" />
        <Chips items={data.related_landings} title="Búsquedas relacionadas" />
      </div>
    </Layout>
  );
}
