import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { client, type HouseAdAdmin } from '@/lib/api';
import { Megaphone, Upload, Trash2 } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

const SLOT_LABELS: Record<string, string> = {
  home_top: 'Portada (debajo del buscador principal)',
  explorar_top: 'Explorar (encima de los resultados)',
};

function SlotEditor({ ad, onSaved }: { ad: HouseAdAdmin; onSaved: (updated: HouseAdAdmin) => void }) {
  const [title, setTitle] = useState(ad.title || '');
  const [imageUrl, setImageUrl] = useState(ad.image_url || '');
  const [linkUrl, setLinkUrl] = useState(ad.link_url || '');
  const [active, setActive] = useState(ad.active);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen válido');
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await client.storage.uploadImage(file, 'ads');
      setImageUrl(publicUrl);
    } catch (err) {
      console.error('Error uploading ad image:', err);
      toast.error('No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !imageUrl.trim() || !linkUrl.trim()) {
      toast.error('Rellena título, imagen y enlace antes de guardar');
      return;
    }
    setSaving(true);
    try {
      const { data } = await client.admin.upsertHouseAd(ad.slot, {
        title: title.trim(),
        image_url: imageUrl.trim(),
        link_url: linkUrl.trim(),
        active,
      });
      onSaved(data);
      toast.success('Anuncio guardado');
    } catch (err) {
      console.error('Error saving house ad:', err);
      toast.error('No se pudo guardar el anuncio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Quitar el anuncio de "${SLOT_LABELS[ad.slot] || ad.slot}"?`)) return;
    try {
      await client.admin.deleteHouseAd(ad.slot);
      setTitle('');
      setImageUrl('');
      setLinkUrl('');
      setActive(false);
      onSaved({ slot: ad.slot, active: false });
      toast.success('Anuncio eliminado');
    } catch (err) {
      console.error('Error deleting house ad:', err);
      toast.error('No se pudo eliminar el anuncio');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{SLOT_LABELS[ad.slot] || ad.slot}</span>
          {ad.id && (
            <Badge className={active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
              {active ? 'Activo' : 'Inactivo'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Título / texto alternativo</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Descuento en cirios" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Imagen del banner</label>
          {imageUrl && (
            <img src={imageUrl} alt="Vista previa" className="w-full max-h-32 object-cover rounded-md mb-2" />
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Subiendo...' : 'Subir imagen'}
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Enlace al hacer clic</label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Mostrar este anuncio en la web
        </label>

        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={saving} onClick={handleSave} className="cursor-pointer">
            Guardar
          </Button>
          {ad.id && (
            <Button size="sm" variant="ghost" className="text-destructive cursor-pointer" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPublicidadPage() {
  const [ads, setAds] = useState<HouseAdAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.admin.listHouseAds();
      setAds(data);
    } catch (err) {
      console.error('Error loading house ads:', err);
      toast.error('No se pudieron cargar los anuncios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Publicidad
          </h1>
          <p className="text-muted-foreground">
            Gestiona los banners propios que aparecen en la web. Si activas AdSense más adelante, estos
            anuncios propios siempre tienen prioridad sobre los de Google.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ads.map((ad) => (
              <SlotEditor
                key={ad.slot}
                ad={ad}
                onSaved={(updated) => setAds((prev) => prev.map((a) => (a.slot === ad.slot ? { ...a, ...updated } : a)))}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
