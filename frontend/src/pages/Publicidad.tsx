import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { client, type AdSlotAvailability, type MyAdBooking } from '@/lib/api';
import { Megaphone, Upload, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const SLOT_LABELS: Record<string, string> = {
  home_top: 'Portada (debajo del buscador principal)',
  explorar_top: 'Explorar (encima de los resultados)',
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: 'Pago pendiente', className: 'bg-muted text-muted-foreground' },
  pending_approval: { label: 'En revisión', className: 'bg-amber-100 text-amber-700' },
  queued: { label: 'En cola, esperando hueco', className: 'bg-blue-100 text-blue-700' },
  active: { label: 'Publicado', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-700' },
  expired: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
};

export default function PublicidadPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<unknown>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [slots, setSlots] = useState<AdSlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [myBookings, setMyBookings] = useState<MyAdBooking[]>([]);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [advertiserName, setAdvertiserName] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const booking = searchParams.get('booking');
    if (booking === 'success') {
      toast.success('¡Pago recibido! Tu anuncio queda pendiente de revisión antes de publicarse.');
      setSearchParams({}, { replace: true });
    } else if (booking === 'cancelled') {
      toast.info('Has cancelado la compra del hueco publicitario.');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    checkAuth();
    loadSlots();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
        loadMyBookings();
      }
    } catch {
      // Not logged in
    } finally {
      setAuthLoading(false);
    }
  };

  const loadSlots = async () => {
    setLoadingSlots(true);
    try {
      const { data } = await client.houseAds.listSlots();
      setSlots(data);
    } catch (err) {
      console.error('Error loading ad slots:', err);
      toast.error('No se pudieron cargar los huecos disponibles');
    } finally {
      setLoadingSlots(false);
    }
  };

  const loadMyBookings = async () => {
    try {
      const { data } = await client.houseAds.myBookings();
      setMyBookings(data);
    } catch (err) {
      console.error('Error loading my ad bookings:', err);
    }
  };

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

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Inicia sesión para comprar un hueco publicitario');
      client.auth.toLogin();
      return;
    }
    if (!selectedSlot || !advertiserName.trim() || !title.trim() || !imageUrl || !linkUrl.trim()) {
      toast.error('Completa todos los campos, incluida la imagen');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await client.houseAds.book({
        slot: selectedSlot,
        advertiser_name: advertiserName.trim(),
        title: title.trim(),
        image_url: imageUrl,
        link_url: linkUrl.trim(),
      });
      window.location.href = data.url;
    } catch (err: unknown) {
      console.error('Error booking ad slot:', err);
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo iniciar el pago.';
      toast.error(message);
      setSubmitting(false);
    }
  };

  const selectedSlotInfo = slots.find((s) => s.slot === selectedSlot);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" /> Anúnciate en VentaCofrade
          </h1>
          <p className="text-muted-foreground">
            Reserva un hueco publicitario destacado en la web durante 30 días. El pago se procesa al
            momento, y tu anuncio se publica en cuanto lo revisemos (normalmente en menos de 24-48h).
          </p>
        </div>

        {loadingSlots ? (
          <p className="text-sm text-muted-foreground">Cargando huecos disponibles...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {slots.map((slot) => {
              const isFree = !slot.occupied_until;
              const isSelected = selectedSlot === slot.slot;
              return (
                <Card
                  key={slot.slot}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'border-primary ring-1 ring-primary' : ''
                  } ${!slot.self_service_enabled ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => slot.self_service_enabled && setSelectedSlot(slot.slot)}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{SLOT_LABELS[slot.slot] || slot.slot}</CardTitle>
                    <CardDescription>{(slot.price_cents / 100).toFixed(2)} € / 30 días</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!slot.self_service_enabled ? (
                      <Badge className="bg-muted text-muted-foreground">No disponible</Badge>
                    ) : isFree ? (
                      <Badge className="bg-green-100 text-green-700">Libre ahora</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge className="bg-amber-100 text-amber-700">
                          Ocupado hasta {new Date(slot.occupied_until as string).toLocaleDateString('es-ES')}
                        </Badge>
                        {slot.queue_length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {slot.queue_length} anunciante(s) ya en cola — puedes reservar igualmente y
                            esperar tu turno.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedSlot && (
          <Card className="mb-10">
            <CardHeader>
              <CardTitle className="text-lg">
                Reservar: {SLOT_LABELS[selectedSlot] || selectedSlot} — {selectedSlotInfo
                  ? (selectedSlotInfo.price_cents / 100).toFixed(2)
                  : '…'}{' '}
                €
              </CardTitle>
              <CardDescription>
                {selectedSlotInfo && !selectedSlotInfo.occupied_until
                  ? 'Se publicará en cuanto lo aprobemos.'
                  : 'El hueco está ocupado ahora mismo: tu anuncio quedará en cola y se publicará automáticamente en cuanto se libere, sin que tengas que hacer nada más.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="advertiser_name">Nombre de tu negocio</Label>
                <Input
                  id="advertiser_name"
                  value={advertiserName}
                  onChange={(e) => setAdvertiserName(e.target.value)}
                  placeholder="Ej: Orfebrería García"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Título del anuncio</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Restauración de orfebrería — presupuesto sin compromiso"
                />
              </div>
              <div className="space-y-2">
                <Label>Imagen del banner</Label>
                {imageUrl && (
                  <img src={imageUrl} alt="Vista previa" className="w-full max-h-32 object-cover rounded-md mb-2" />
                )}
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
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Subiendo...' : 'Subir imagen'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link_url">Enlace al hacer clic</Label>
                <Input
                  id="link_url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {authLoading ? (
                <p className="text-sm text-muted-foreground">Comprobando tu sesión...</p>
              ) : !user ? (
                <Button className="w-full" onClick={() => client.auth.toLogin()}>
                  Inicia sesión para continuar
                </Button>
              ) : (
                <Button className="w-full" disabled={submitting || uploading} onClick={handleSubmit}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Pagar y reservar hueco
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {user && myBookings.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Tus reservas</h2>
            <div className="space-y-2">
              {myBookings.map((b) => {
                const statusInfo = STATUS_LABELS[b.status] || { label: b.status, className: 'bg-muted' };
                return (
                  <Card key={b.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium">{b.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {SLOT_LABELS[b.slot] || b.slot} · {(b.amount_cents / 100).toFixed(2)} €
                        </div>
                        {b.status === 'rejected' && b.rejected_reason && (
                          <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> {b.rejected_reason}
                          </div>
                        )}
                        {b.status === 'active' && b.ends_at && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Publicado hasta{' '}
                            {new Date(b.ends_at).toLocaleDateString('es-ES')}
                          </div>
                        )}
                        {b.status === 'queued' && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Esperando a que se libere el hueco
                          </div>
                        )}
                      </div>
                      <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
