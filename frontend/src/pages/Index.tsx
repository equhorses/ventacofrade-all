import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import SellerBadge from '@/components/SellerBadge';
import { getPlaceholders, PlaceholderCard } from '@/components/PlaceholderListings';
import WelcomeModal from '@/components/WelcomeModal';
import AdSlot from '@/components/AdSlot';
import { client } from '@/lib/api';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shirt,
  Flame,
  Crown,
  Scissors,
  Church,
  Medal,
  Music,
  Gem,
  Package,
  Landmark,
  MapPin,
  MessageCircle,
  Users,
  Star,
} from 'lucide-react';
import FavoriteButton from '@/components/FavoriteButton';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order_index: number;
}

interface Product {
  id: number;
  title: string;
  price: number;
  category_id: number;
  condition: string;
  location_province: string;
  location_city: string;
  images: string;
  is_featured: boolean;
  views_count: number;
  seller_tier?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  shirt: <Shirt className="h-6 w-6" />,
  flame: <Flame className="h-6 w-6" />,
  crown: <Crown className="h-6 w-6" />,
  scissors: <Scissors className="h-6 w-6" />,
  church: <Church className="h-6 w-6" />,
  medal: <Medal className="h-6 w-6" />,
  music: <Music className="h-6 w-6" />,
  gem: <Gem className="h-6 w-6" />,
  package: <Package className="h-6 w-6" />,
  landmark: <Landmark className="h-6 w-6" />,
};

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (dir: 1 | -1) => {
    const el = carouselRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  // El carrusel avanza solo (una tarjeta); al llegar al final vuelve al principio.
  // Se para mientras el usuario lo toca o pasa el ratón por encima, y si la pestaña no está visible.
  const pausedUntil = useRef(0);
  const pauseCarousel = (ms = 8000) => {
    pausedUntil.current = Date.now() + ms;
  };
  useEffect(() => {
    if (loading) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const tick = () => {
      const el = carouselRef.current;
      if (!el || document.hidden || Date.now() < pausedUntil.current) return;
      const card = el.firstElementChild as HTMLElement | null;
      const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else el.scrollBy({ left: step, behavior: 'smooth' });
    };
    // Primer movimiento enseguida (para que se note que es un carrusel) y luego cada 3,5 s.
    const first = window.setTimeout(tick, 1500);
    const id = window.setInterval(tick, 3500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [loading]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        client.entities.categories.query({ sort: 'order_index', limit: 12 }),
        // El servidor ya los ordena: destacados primero, luego por plan del vendedor y después lo más
        // reciente (publicado o renovado).
        client.entities.products.query({ query: { status: 'active' }, sort: '-created_at', limit: 24 }),
      ]);
      const cats = catRes?.data?.items || [];
      const prods = prodRes?.data?.items || [];
      setCategories(cats.length > 0 ? cats : defaultCategories);
      setFeaturedProducts(prods);
    } catch (err) {
      console.error('Error loading data:', err);
      setCategories(defaultCategories);
      setFeaturedProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explorar?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explorar');
    }
  };
  return (
    <Layout>
      <WelcomeModal />
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-secondary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/50 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4 bg-secondary/20 text-secondary border-secondary/30 hover:bg-secondary/30">
              🕯️ Arte sacro, antigüedades y artículos religiosos
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Compra y vende artículos{' '}
              <span className="text-secondary">religiosos</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Imaginería, orfebrería, bordados, antigüedades y arte sacro.
              Si es religioso, está aquí.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="flex gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar imágenes, orfebrería, antigüedades..."
                  className="flex-1 bg-white text-foreground border-0 h-12 text-base placeholder:text-muted-foreground"
                />
                <Button type="submit" size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 px-6 cursor-pointer">
                  <Search className="h-5 w-5 mr-2" />
                  Buscar
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap justify-center gap-2 mt-4 text-sm text-primary-foreground/60">
              <span>Popular:</span>
              <Link to="/explorar?q=imagen" className="hover:text-primary-foreground underline cursor-pointer">Imágenes</Link>
              <Link to="/explorar?q=antiguo" className="hover:text-primary-foreground underline cursor-pointer">Antigüedades</Link>
              <Link to="/explorar?q=candelabro" className="hover:text-primary-foreground underline cursor-pointer">Candelabros</Link>
              <Link to="/explorar?q=bordado+oro" className="hover:text-primary-foreground underline cursor-pointer">Bordados en oro</Link>
              <Link to="/explorar?q=insignia" className="hover:text-primary-foreground underline cursor-pointer">Insignias</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdSlot slot="home_top" />
      </div>

      {/* Categories Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Categorías</h2>
            <p className="text-muted-foreground mt-2">Encuentra lo que buscas por tipo de artículo</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {(categories.length > 0 ? categories : defaultCategories).map((cat) => (
              <Link
                key={cat.slug}
                to={`/explorar?categoria=${cat.slug}`}
                className="group cursor-pointer"
              >
                <Card className="h-full border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 group-hover:-translate-y-0.5">
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      {iconMap[cat.icon] || <Gem className="h-6 w-6" />}
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Descubre piezas únicas</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                aria-label="Anteriores"
                onClick={() => {
                  pauseCarousel();
                  scrollCarousel(-1);
                }}
                className="hidden md:inline-flex cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Siguientes"
                onClick={() => {
                  pauseCarousel();
                  scrollCarousel(1);
                }}
                className="hidden md:inline-flex cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Link to="/explorar">
                <Button variant="outline" className="cursor-pointer">
                  Ver todos
                </Button>
              </Link>
            </div>
          </div>

          {!loading ? (
            <div
              ref={carouselRef}
              onMouseEnter={() => pauseCarousel(60_000)}
              onMouseLeave={() => pauseCarousel(1500)}
              onTouchStart={() => pauseCarousel(10_000)}
              onWheel={() => pauseCarousel(10_000)}
              className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:thin]"
            >
              {featuredProducts.map((product) => (
                <div key={product.id} className="snap-start shrink-0 w-[78%] sm:w-[45%] lg:w-[31.5%]">
                  <ProductCard product={product} />
                </div>
              ))}
              {getPlaceholders(null, featuredProducts.length, 6).map((item) => (
                <div key={item.key} className="snap-start shrink-0 w-[78%] sm:w-[45%] lg:w-[31.5%]">
                  <PlaceholderCard item={item} />
                </div>
              ))}
              {featuredProducts.length > 0 && (
                <Link
                  to="/explorar"
                  className="snap-start shrink-0 w-[60%] sm:w-[30%] lg:w-[20%] rounded-lg border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <span className="text-lg font-semibold">Ver todos</span>
                  <ChevronRight className="h-6 w-6" />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex gap-6 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="shrink-0 w-[78%] sm:w-[45%] lg:w-[31.5%] aspect-[4/3] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">¿Por qué VentaCofrade?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <MessageCircle className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Trato directo</h3>
              <p className="text-sm text-muted-foreground">Contacta con la persona vendedora y acordad el pago y la entrega entre vosotros</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Para todo el mundo</h3>
              <p className="text-sm text-muted-foreground">Coleccionistas, anticuarios, hermandades y particulares de toda España</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Star className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Artículos únicos</h3>
              <p className="text-sm text-muted-foreground">Imaginería, orfebrería, bordados, antigüedades y más</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">¿Tienes artículos religiosos o antigüedades para vender?</h2>
          <p className="text-primary-foreground/80 mb-6 max-w-xl mx-auto">
            Publica gratis todo lo que tengas guardado: sin límite de anuncios y sin comisiones por venta.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/vender">
              <Button size="lg" variant="secondary" className="cursor-pointer font-semibold">
                Empezar a vender
              </Button>
            </Link>
            <Link to="/documentacion">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 cursor-pointer">
                Ver documentación
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function ProductCard({ product }: { product: Product }) {
  const imageUrl = product.images ? product.images.split(',')[0] : '';
  
  return (
    <Link to={`/producto/${product.id}`} className="group cursor-pointer">
      <Card className="overflow-hidden border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 group-hover:-translate-y-1">
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Church className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs">Destacado</Badge>
          )}
          <Badge variant="outline" className="absolute bottom-2 left-2 bg-white/90 text-xs capitalize">
            {product.condition}
          </Badge>
          <FavoriteButton productId={product.id} className="absolute top-2 right-2" />
        </div>
        <CardContent className="p-4">
          <SellerBadge tier={product.seller_tier} className="mb-2" />
          <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {product.title}
          </h3>
          <p className="text-xl font-bold text-primary">{product.price.toFixed(2)} €</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{product.location_city || product.location_province}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const defaultCategories: Category[] = [
  { id: 1, name: 'Túnicas y Capirotes', slug: 'tunicas-capirotes', description: 'Vestimenta procesional', icon: 'shirt', order_index: 1 },
  { id: 2, name: 'Cirios y Velas', slug: 'cirios-velas', description: 'Cera para procesiones', icon: 'flame', order_index: 2 },
  { id: 3, name: 'Orfebrería', slug: 'orfebreria', description: 'Piezas de plata y oro', icon: 'crown', order_index: 3 },
  { id: 4, name: 'Bordados', slug: 'bordados', description: 'Bordados en oro y sedas', icon: 'scissors', order_index: 4 },
  { id: 5, name: 'Imágenes y Figuras', slug: 'imagenes-figuras', description: 'Esculturas religiosas', icon: 'church', order_index: 5 },
  { id: 6, name: 'Insignias y Medallas', slug: 'insignias-medallas', description: 'Distintivos de hermandades', icon: 'medal', order_index: 6 },
  { id: 7, name: 'Instrumentos Musicales', slug: 'instrumentos-musicales', description: 'Bandas cofrades', icon: 'music', order_index: 7 },
  { id: 8, name: 'Complementos', slug: 'complementos', description: 'Fajines, guantes y más', icon: 'gem', order_index: 8 },
];

