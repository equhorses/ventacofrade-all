import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';
import AdSlot from '@/components/AdSlot';
import { client } from '@/lib/api';
import { Search, MapPin, Church, SlidersHorizontal } from 'lucide-react';

interface Product {
  id: number;
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
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

const conditionLabels: Record<string, string> = {
  nuevo: 'Nuevo',
  usado: 'Usado',
  restaurado: 'Restaurado',
};

export default function ExplorarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoria') || 'todas');
  const [selectedCondition, setSelectedCondition] = useState('todas');
  const [sortBy, setSortBy] = useState('-created_at');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, selectedCondition, sortBy, searchParams]);

  const loadCategories = async () => {
    try {
      const res = await client.entities.categories.query({ sort: 'order_index', limit: 20 });
      const cats = res?.data?.items || [];
      setCategories(cats.length > 0 ? cats : defaultCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
      setCategories(defaultCategories);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const query: Record<string, unknown> = { status: 'active' };
      
      if (selectedCategory && selectedCategory !== 'todas') {
        const cat = categories.find(c => c.slug === selectedCategory);
        if (cat) query.category_id = cat.id;
      }
      if (selectedCondition && selectedCondition !== 'todas') {
        query.condition = selectedCondition;
      }

      const res = await client.entities.products.query({
        query,
        sort: sortBy,
        limit: 20,
      });
      
      let items = res?.data?.items || [];
      
      // Client-side text search filter
      const q = searchParams.get('q');
      if (q) {
        const lower = q.toLowerCase();
        items = items.filter((p: Product) =>
          p.title.toLowerCase().includes(lower) ||
          (p.description && p.description.toLowerCase().includes(lower))
        );
      }
      
      setProducts(items);
    } catch (err) {
      console.error('Error loading products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug);
    const params = new URLSearchParams(searchParams);
    if (slug === 'todas') {
      params.delete('categoria');
    } else {
      params.set('categoria', slug);
    }
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Todos los anuncios</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{products.length}</span> anuncios disponibles
          </p>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar orfebrería, bordados, cirios..."
                className="pl-10 h-11"
              />
            </div>
            <Button type="submit" className="h-11 bg-primary hover:bg-primary/90 cursor-pointer">
              Buscar
            </Button>
          </form>

          <div className="flex flex-wrap gap-3 items-center">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCondition} onValueChange={setSelectedCondition}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                <SelectItem value="nuevo">Nuevo</SelectItem>
                <SelectItem value="usado">Usado</SelectItem>
                <SelectItem value="restaurado">Restaurado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-created_at">Más recientes</SelectItem>
                <SelectItem value="price">Precio: menor</SelectItem>
                <SelectItem value="-price">Precio: mayor</SelectItem>
                <SelectItem value="-views_count">Más vistos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <AdSlot slot="explorar_top" />

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => handleCategoryChange('todas')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              selectedCategory === 'todas'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-6 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link key={product.id} to={`/producto/${product.id}`} className="group cursor-pointer">
                <Card className="overflow-hidden border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 group-hover:-translate-y-1">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {product.images ? (
                      <img
                        src={product.images.split(',')[0]}
                        alt={product.title}
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
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/30 rounded-lg border border-border">
            <Church className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Sin resultados</h3>
            <p className="text-muted-foreground mb-4">No hay anuncios que coincidan con tu búsqueda.</p>
            <Button variant="outline" onClick={() => { setSearchQuery(''); handleCategoryChange('todas'); }} className="cursor-pointer">
              Ver todos
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

const defaultCategories: Category[] = [
  { id: 1, name: 'Túnicas y Capirotes', slug: 'tunicas-capirotes' },
  { id: 2, name: 'Cirios y Velas', slug: 'cirios-velas' },
  { id: 3, name: 'Orfebrería', slug: 'orfebreria' },
  { id: 4, name: 'Bordados', slug: 'bordados' },
  { id: 5, name: 'Imágenes y Figuras', slug: 'imagenes-figuras' },
  { id: 6, name: 'Insignias y Medallas', slug: 'insignias-medallas' },
  { id: 7, name: 'Instrumentos Musicales', slug: 'instrumentos-musicales' },
  { id: 8, name: 'Complementos', slug: 'complementos' },
];

