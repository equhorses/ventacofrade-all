import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';
import { client } from '@/lib/api';
import { Upload, ImagePlus, X, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
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

const MAX_IMAGES = 6;
const MAX_FILE_SIZE_MB = 5;

export default function PublicarPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<unknown>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [publishedProductId, setPublishedProductId] = useState<number | null>(null);
  const [featurePrices, setFeaturePrices] = useState<Record<string, number>>({});
  const [featuringDays, setFeaturingDays] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    condition: '',
    location_province: '',
    location_city: '',
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

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - imageUrls.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes por anuncio`);
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`Solo se subirán ${remainingSlots} imagen(es) más (máximo ${MAX_IMAGES})`);
    }

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} no es una imagen válida`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} pesa demasiado (máx. ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }

      setUploadingCount((c) => c + 1);
      try {
        const publicUrl = await client.storage.uploadImage(file, 'products');
        setImageUrls((prev) => [...prev, publicUrl]);
      } catch (err) {
        console.error('Error uploading image:', err);
        toast.error(`No se pudo subir ${file.name}`);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  };

  const handleRemoveImage = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
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

    if (imageUrls.length === 0) {
      toast.error('Añade al menos una foto del artículo');
      return;
    }

    setLoading(true);
    try {
      const { data: created } = await client.entities.products.create({
        data: {
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category_id: parseInt(form.category_id),
          condition: form.condition,
          location_province: form.location_province,
          location_city: form.location_city,
          images: imageUrls.join(','),
          status: 'active',
          views_count: 0,
          is_featured: false,
        },
      });
      toast.success('¡Anuncio publicado con éxito!');
      const newId = (created as { id?: number })?.id;
      if (newId) {
        setPublishedProductId(newId);
        client.payments
          .getFeaturePrices()
          .then(({ data }) => setFeaturePrices(data))
          .catch((err) => console.error('Error loading feature prices:', err));
      } else {
        navigate('/explorar');
      }
    } catch (err) {
      console.error('Error creating product:', err);
      const backendMessage = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(backendMessage || 'Error al publicar. Inténtalo de nuevo.');
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

  const handleFeatureAfterPublish = async (days: 3 | 7 | 30) => {
    if (!publishedProductId) return;
    setFeaturingDays(days);
    try {
      const { data } = await client.payments.featureListing(publishedProductId, days);
      window.location.href = data.url;
    } catch (err) {
      console.error('Error starting feature checkout:', err);
      toast.error('No se pudo iniciar el pago para destacar el anuncio.');
      setFeaturingDays(null);
    }
  };

  if (publishedProductId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-14 w-14 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">¡Anuncio publicado!</h2>
              <p className="text-muted-foreground mb-6">
                Ya está visible en VentaCofrade. Si quieres que se vea antes que los demás, puedes
                destacarlo ahora:
              </p>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {[3, 7, 30].map((days) => (
                  <Button
                    key={days}
                    variant="outline"
                    disabled={featuringDays !== null}
                    onClick={() => handleFeatureAfterPublish(days as 3 | 7 | 30)}
                    className="flex flex-col h-auto py-3 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 mb-1 text-amber-500" />
                    <span className="text-sm font-medium">{days} días</span>
                    <span className="text-xs text-muted-foreground">
                      {featurePrices[String(days)] !== undefined
                        ? `${featurePrices[String(days)].toFixed(2)} €`
                        : '…'}
                    </span>
                  </Button>
                ))}
              </div>

              <Button
                variant="ghost"
                className="cursor-pointer"
                disabled={featuringDays !== null}
                onClick={() => navigate('/explorar')}
              >
                No, gracias — ver mi anuncio
              </Button>
            </CardContent>
          </Card>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Descripción</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        description:
                          f.description ||
                          'Estado: [nuevo/usado/restaurado]. Medidas aproximadas: [alto x ancho x fondo]. Material: [plata, madera, tela...]. Motivo de venta: [opcional]. Envío: a convenir con el comprador.',
                      }))
                    }
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Usar plantilla
                  </button>
                </div>
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

              {/* Images */}
              <div className="space-y-2">
                <Label>Fotos *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                {(imageUrls.length > 0 || uploadingCount > 0) && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                    {imageUrls.map((url) => (
                      <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                        <img src={url} alt="Foto del artículo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 cursor-pointer transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {Array.from({ length: uploadingCount }).map((_, i) => (
                      <div
                        key={`uploading-${i}`}
                        className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/50"
                      >
                        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                      </div>
                    ))}
                  </div>
                )}

                {imageUrls.length < MAX_IMAGES && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Toca para elegir fotos desde tu dispositivo
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      JPG, PNG o WEBP · máx. {MAX_FILE_SIZE_MB}MB cada una · hasta {MAX_IMAGES} fotos
                    </p>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || uploadingCount > 0}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base cursor-pointer"
              >
                {loading ? 'Publicando...' : uploadingCount > 0 ? 'Subiendo fotos...' : 'Publicar anuncio'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </Layout>
  );
}
