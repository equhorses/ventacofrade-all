import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { client, type HouseAdAdmin, type AdSlotAvailability, type AdBookingAdmin } from '@/lib/api';
import { Megaphone, Upload, Trash2, Euro, Check, X, Clock } from 'lucide-react';
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

function SlotConfigEditor({ config, onSaved }: { config: AdSlotAvailability; onSaved: (updated: AdSlotAvailability) => void }) {
  const [priceEuros, setPriceEuros] = useState((config.price_cents / 100).toFixed(2));
  const [enabled, setEnabled] = useState(config.self_service_enabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cents = Math.round(parseFloat(priceEuros.replace(',', '.')) * 100);
    if (isNaN(cents) || cents < 0) {
      toast.error('Introduce un precio válido');
      return;
    }
    setSaving(true);
    try {
      const { data } = await client.admin.updateAdSlot(config.slot, {
        price_cents: cents,
        self_service_enabled: enabled,
      });
      onSaved(data);
      toast.success('Configuración guardada');
    } catch (err) {
      console.error('Error updating ad slot config:', err);
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{SLOT_LABELS[config.slot] || config.slot}</span>
          {config.occupied_until ? (
            <Badge className="bg-amber-100 text-amber-700">
              Ocupado hasta {new Date(config.occupied_until).toLocaleDateString('es-ES')}
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-700">Libre</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Precio mensual (30 días)</label>
          <div className="flex items-center gap-1">
            <Euro className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={priceEuros}
              onChange={(e) => setPriceEuros(e.target.value)}
              className="max-w-[120px]"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Permitir compra en autoservicio
        </label>
        {config.queue_length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {config.queue_length} anunciante(s) en cola esperando este hueco
          </p>
        )}
        <Button size="sm" disabled={saving} onClick={handleSave} className="cursor-pointer">
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}

function PendingBookingCard({ booking, onResolved }: { booking: AdBookingAdmin; onResolved: (id: number) => void }) {
  const [acting, setActing] = useState(false);

  const handleApprove = async () => {
    setActing(true);
    try {
      await client.admin.approveAdBooking(booking.id);
      onResolved(booking.id);
      toast.success(`Anuncio de ${booking.advertiser_name} aprobado`);
    } catch (err) {
      console.error('Error approving ad booking:', err);
      toast.error('No se pudo aprobar');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt(`¿Por qué rechazas el anuncio de ${booking.advertiser_name}?`);
    if (!reason) return;
    setActing(true);
    try {
      await client.admin.rejectAdBooking(booking.id, reason);
      onResolved(booking.id);
      toast.success('Anuncio rechazado');
    } catch (err) {
      console.error('Error rejecting ad booking:', err);
      toast.error('No se pudo rechazar');
    } finally {
      setActing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <img src={booking.image_url} alt={booking.title} className="h-16 w-28 object-cover rounded-md shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{booking.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {booking.advertiser_name} · {booking.advertiser_email} · {SLOT_LABELS[booking.slot] || booking.slot}
          </div>
          <a
            href={booking.link_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline underline-offset-2"
          >
            {booking.link_url}
          </a>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" disabled={acting} onClick={handleApprove} className="cursor-pointer">
            <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={acting}
            onClick={handleReject}
            className="text-destructive hover:text-destructive cursor-pointer"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Rechazar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPublicidadPage() {
  const [ads, setAds] = useState<HouseAdAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotConfigs, setSlotConfigs] = useState<AdSlotAvailability[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [pendingBookings, setPendingBookings] = useState<AdBookingAdmin[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

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

  const loadSlotConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const { data } = await client.admin.listAdSlots();
      setSlotConfigs(data);
    } catch (err) {
      console.error('Error loading ad slot configs:', err);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const loadPendingBookings = async () => {
    setLoadingPending(true);
    try {
      const { data } = await client.admin.listAdBookings('pending_approval');
      setPendingBookings(data);
    } catch (err) {
      console.error('Error loading pending ad bookings:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    load();
    loadSlotConfigs();
    loadPendingBookings();
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

        {/* Reservas de anunciantes externos pendientes de aprobación */}
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Pendientes de aprobación {pendingBookings.length > 0 && `(${pendingBookings.length})`}
          </h2>
          {loadingPending ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : pendingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ninguna reserva esperando revisión.</p>
          ) : (
            <div className="space-y-2">
              {pendingBookings.map((b) => (
                <PendingBookingCard
                  key={b.id}
                  booking={b}
                  onResolved={(id) => {
                    setPendingBookings((prev) => prev.filter((p) => p.id !== id));
                    loadSlotConfigs();
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Precio y disponibilidad de autoservicio por hueco */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Autoservicio (precio y disponibilidad)</h2>
          {loadingConfigs ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slotConfigs.map((config) => (
                <SlotConfigEditor
                  key={config.slot}
                  config={config}
                  onSaved={(updated) =>
                    setSlotConfigs((prev) => prev.map((c) => (c.slot === updated.slot ? updated : c)))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Banners gestionados a mano */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Contenido actual de cada hueco</h2>
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
      </div>
    </>
  );
}
