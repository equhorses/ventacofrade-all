import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';
import { client } from '@/lib/api';
import { Upload, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: number;
  name: string;
  slug: string;
}

const provinces = [
  'Sevilla', 'Málaga', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Almería',
  'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Otra',
];

export default function PublicarPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<unknown>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    condition: '',
    location_province: '',
    location_city: '',
    images: '',
  });

  useEffect(() => {
    checkAuth();
    loadCategories();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
      }
    } catch {
      // Not logged in
    } finally {
      setAuthLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await client.entities.categories.query({ sort: 'order_index', limit: 20 });
      setCategories(res?.data?.items || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Debes iniciar sesión para publicar');
      client.auth.toLogin();
      return;
    }

    if (!form.title || !form.price || !form.category_id || !form.condition || !form.location_province) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      await client.entities.products.create({
        data: {
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category_id: parseInt(form.category_id),
          condition: form.condition,
          location_province: form.location_province,
          location_city: form.location_city,
          images: form.images,
          status: 'active',
          views_count: 0,
          is_featured: false,
        },
      });
      toast.success('¡Anuncio publicado con éxito!');
      navigate('/explorar');
    } catch (err) {
      console.error('Error creating product:', err);
      toast.error('Error al publicar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Upload className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Inicia sesión para publicar</h2>
          <p className="text-muted-foreground mb-6">Necesitas una cuenta para publicar anuncios en VentaCofrade</p>
          <Button onClick={() => client.auth.toLogin()} className="bg-primary hover:bg-primary/90 cursor-pointer">
            Iniciar sesión
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Publicar anuncio</h1>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del artículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Candelabro de plata labrada siglo XIX"
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe el artículo con detalle: estado, medidas, historia..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoría *</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="usado">Usado</SelectItem>
                    <SelectItem value="restaurado">Restaurado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provincia *</Label>
                  <Select value={form.location_province} onValueChange={(v) => setForm({ ...form, location_province: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={form.location_city}
                    onChange={(e) => setForm({ ...form, location_city: e.target.value })}
                    placeholder="Ej: Sevilla"
                  />
                </div>
              </div>

              {/* Images URL */}
              <div className="space-y-2">
                <Label htmlFor="images">URL de imágenes</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Introduce URLs de imágenes separadas por coma</p>
                  <Input
                    id="images"
                    value={form.images}
                    onChange={(e) => setForm({ ...form, images: e.target.value })}
                    placeholder="https://ejemplo.com/foto1.jpg, https://ejemplo.com/foto2.jpg"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base cursor-pointer"
              >
                {loading ? 'Publicando...' : 'Publicar anuncio'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </Layout>
  );
}