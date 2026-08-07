import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { client } from '@/lib/api';
import {
  Search,
  Shirt,
  Flame,
  Crown,
  Scissors,
  Church,
  Medal,
  Music,
  Gem,
  MapPin,
  Shield,
  Users,
  Star,
} from 'lucide-react';

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
};

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        client.entities.categories.query({ sort: 'order_index', limit: 8 }),
        client.entities.products.query({ query: { status: 'active' }, sort: '-created_at', limit: 6 }),
      ]);
      const cats = catRes?.data?.items || [];
      const prods = prodRes?.data?.items || [];
      setCategories(cats.length > 0 ? cats : defaultCategories);
      setFeaturedProducts(prods.length > 0 ? prods : defaultProducts);
    } catch (err) {
      console.error('Error loading data:', err);
      setCategories(defaultCategories);
      setFeaturedProducts(defaultProducts);
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
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-secondary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/50 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4 bg-secondary/20 text-secondary border-secondary/30 hover:bg-secondary/30">
              🕯️ El marketplace cofrade de referencia
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Compra y vende artículos{' '}
              <span className="text-secondary">cofrades</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Orfebrería, bordados, túnicas, cirios y todo lo que necesitas para tu hermandad. 
              El punto de encuentro del mundo cofrade en Andalucía.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="flex gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar orfebrería, bordados, cirios..."
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
              <Link to="/explorar?q=candelabro" className="hover:text-primary-foreground underline cursor-pointer">Candelabros</Link>
              <Link to="/explorar?q=tunica" className="hover:text-primary-foreground underline cursor-pointer">Túnicas</Link>
              <Link to="/explorar?q=bordado+oro" className="hover:text-primary-foreground underline cursor-pointer">Bordados en oro</Link>
              <Link to="/explorar?q=insignia" className="hover:text-primary-foreground underline cursor-pointer">Insignias</Link>
            </div>
          </div>
        </div>
      </section>

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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Anuncios destacados</h2>
              <p className="text-muted-foreground mt-1">Los últimos artículos publicados</p>
            </div>
            <Link to="/explorar">
              <Button variant="outline" className="cursor-pointer">Ver todos</Button>
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-background rounded-lg border border-border">
              <Church className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aún no hay anuncios</h3>
              <p className="text-muted-foreground mb-4">Sé el primero en publicar un artículo cofrade</p>
              <Link to="/publicar">
                <Button className="bg-primary hover:bg-primary/90 cursor-pointer">Publicar anuncio</Button>
              </Link>
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
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Compra segura</h3>
              <p className="text-sm text-muted-foreground">Verificamos vendedores y protegemos tus transacciones</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Comunidad cofrade</h3>
              <p className="text-sm text-muted-foreground">Miles de cofrades conectados en toda Andalucía</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Star className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Artículos únicos</h3>
              <p className="text-sm text-muted-foreground">Piezas exclusivas de orfebrería, bordados y más</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">¿Tienes artículos cofrades para vender?</h2>
          <p className="text-primary-foreground/80 mb-6 max-w-xl mx-auto">
            Únete a la comunidad de vendedores cofrades. Activa tu tienda desde 10€ y llega a miles de compradores.
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
          <Badge variant="outline" className="absolute top-2 right-2 bg-white/90 text-xs capitalize">
            {product.condition}
          </Badge>
        </div>
        <CardContent className="p-4">
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

const defaultProducts: Product[] = [
  {
    id: 1,
    title: 'Túnica nazarena morada - Hermandad del Silencio',
    price: 120.00,
    category_id: 1,
    condition: 'usado',
    location_province: 'Sevilla',
    location_city: 'Sevilla',
    images: 'https://mgx-backend-cdn.metadl.com/generate/images/1410088/2026-07-11/siu5q6qcai2a/tunica-nazarena-morada-sevilla.png',
    is_featured: true,
    views_count: 45,
  },
  {
    id: 2,
    title: 'Candelabro de cola bañado en plata',
    price: 850.00,
    category_id: 3,
    condition: 'usado',
    location_province: 'Sevilla',
    location_city: 'Dos Hermanas',
    images: 'https://mgx-backend-cdn.metadl.com/generate/images/1410088/2026-07-11/siuzeoacai2q/candelabro-plata-barroco.png',
    is_featured: true,
    views_count: 128,
  },
  {
    id: 3,
    title: 'Manto bordado en oro fino - Virgen de los Dolores',
    price: 4500.00,
    category_id: 4,
    condition: 'restaurado',
    location_province: 'Córdoba',
    location_city: 'Córdoba',
    images: 'https://mgx-backend-cdn.metadl.com/generate/images/1410088/2026-07-11/siuze2ycaizq/manto-bordado-oro-terciopelo.png',
    is_featured: true,
    views_count: 230,
  },
  {
    id: 4,
    title: 'Corona de espinas en plata cincelada',
    price: 1200.00,
    category_id: 3,
    condition: 'nuevo',
    location_province: 'Córdoba',
    location_city: 'Lucena',
    images: 'https://mgx-backend-cdn.metadl.com/generate/images/1410088/2026-07-11/siuzhlicaiza/corona-espinas-plata.png',
    is_featured: true,
    views_count: 156,
  },
  {
    id: 5,
    title: 'Imagen del Cristo de la Buena Muerte - 40cm',
    price: 680.00,
    category_id: 5,
    condition: 'nuevo',
    location_province: 'Málaga',
    location_city: 'Antequera',
    images: 'https://mgx-backend-cdn.metadl.com/generate/images/1410088/2026-07-11/siuzfwicaizq/cristo-buena-muerte-talla.png',
    is_featured: true,
    views_count: 89,
  },
  {
    id: 6,
    title: 'Fajín de terciopelo con bordado en oro',
    price: 280.00,
    category_id: 8,
    condition: 'nuevo',
    location_province: 'Sevilla',
    location_city: 'Sevilla',
    images: 'https://mgx-backend-cdn.metadl.com/generate/images/1410088/2026-07-11/siuzg6qcaiyq/fajin-terciopelo-bordado-oro.png',
    is_featured: true,
    views_count: 42,
  },
];