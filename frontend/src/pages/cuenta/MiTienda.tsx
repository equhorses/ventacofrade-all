import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { client, type ShopSettings } from '@/lib/api';
import { Camera, CheckCircle2, Crown, ExternalLink, ImagePlus, Loader2, Store, Trash2, XCircle } from 'lucide-react';

const SITE = 'ventacofrade.com';

function errorDetail(err: unknown, fallback: string) {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 50);
}

export default function MiTiendaPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    client.shops
      .mine()
      .then(({ data }) => {
        setSettings(data);
        setSlug(data.shop_slug || data.suggested_slug || '');
        setLogo(data.shop_logo_url);
        setCover(data.shop_cover_url);
        setDescription(data.shop_long_description || '');
      })
      .catch(() => toast.error('No se pudo cargar tu tienda'))
      .finally(() => setLoading(false));
  }, []);

  // Comprueba la dirección mientras se escribe (con una pequeña espera).
  useEffect(() => {
    if (!settings?.can_use || !slug || slug === settings.shop_slug) {
      setSlugStatus(null);
      return;
    }
    const t = setTimeout(() => {
      client.shops
        .checkSlug(slug)
        .then(({ data }) => setSlugStatus({ available: data.available, reason: data.reason }))
        .catch(() => setSlugStatus(null));
    }, 400);
    return () => clearTimeout(t);
  }, [slug, settings]);

  const upload = async (file: File | undefined, kind: 'logo' | 'cover') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Elige una imagen');
    if (file.size > 5 * 1024 * 1024) return toast.error('La imagen no puede pesar más de 5 MB');
    setUploading(kind);
    try {
      const url = await client.storage.uploadImage(file, 'shops');
      if (kind === 'logo') setLogo(url);
      else setCover(url);
      toast.info('Imagen subida. Pulsa «Guardar tienda» para aplicarla.');
    } catch {
      toast.error('No se pudo subir la imagen');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!slug) return toast.error('Elige la dirección de tu tienda');
    setSaving(true);
    try {
      const { data } = await client.shops.update({
        shop_slug: slug,
        shop_logo_url: logo,
        shop_cover_url: cover,
        shop_long_description: description,
      });
      setSettings(data);
      setSlugStatus(null);
      toast.success('Tienda guardada');
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo guardar la tienda'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AccountLayout title="Mi tienda">
        <p className="text-muted-foreground">Cargando…</p>
      </AccountLayout>
    );
  }

  if (!settings?.can_use) {
    return (
      <AccountLayout title="Mi tienda" description="Tu escaparate propio dentro de VentaCofrade">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Crown className="h-6 w-6 text-primary shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">La tienda propia está incluida en el plan Profesional</p>
                <p className="text-sm text-muted-foreground">
                  Consigue una dirección propia para compartir ({SITE}/tienda/tu-nombre), con tu logo, una portada y
                  una descripción larga de tu taller o tienda, además de todos tus anuncios en un solo escaparate.
                </p>
              </div>
            </div>
            <Button asChild className="cursor-pointer">
              <Link to="/cuenta/suscripcion">Ver plan Profesional</Link>
            </Button>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (!settings.has_profile) {
    return (
      <AccountLayout title="Mi tienda">
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">Antes de montar tu tienda, completa tus datos de vendedor.</p>
            <Button asChild>
              <Link to="/cuenta/perfil">Ir a Mi perfil</Link>
            </Button>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  const publicUrl = settings.shop_slug ? `/tienda/${settings.shop_slug}` : null;
  const max = settings.long_description_max;

  return (
    <AccountLayout title="Mi tienda" description="Personaliza tu escaparate y compártelo con tus clientes">
      <div className="space-y-6">
        {publicUrl && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Store className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-foreground break-all">
              {SITE}
              {publicUrl}
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  navigator.clipboard?.writeText(`https://${SITE}${publicUrl}`);
                  toast.success('Enlace copiado');
                }}
              >
                Copiar enlace
              </Button>
              <Button size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  Ver tienda <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dirección de tu tienda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center rounded-md border border-input overflow-hidden">
              <span className="px-3 text-sm text-muted-foreground bg-muted h-10 flex items-center whitespace-nowrap">
                {SITE}/tienda/
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlug(cleanSlug(e.target.value))}
                className="border-0 rounded-none focus-visible:ring-0"
                placeholder="mi-tienda"
                maxLength={50}
              />
            </div>
            {slugStatus && (
              <p
                className={`text-xs flex items-center gap-1 ${
                  slugStatus.available ? 'text-green-700' : 'text-destructive'
                }`}
              >
                {slugStatus.available ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {slugStatus.available ? 'Disponible' : slugStatus.reason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Minúsculas, números y guiones. Si la cambias, el enlace antiguo dejará de funcionar.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Logo y portada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Portada (recomendado 1600 × 500 px)</Label>
              <div className="relative h-36 sm:h-44 rounded-lg overflow-hidden bg-gradient-to-r from-[#5B21B6] to-[#6D28D9]">
                {cover && <img src={cover} alt="Portada" className="w-full h-full object-cover" />}
                <div className="absolute bottom-2 right-2 flex gap-2">
                  {cover && (
                    <Button size="sm" variant="secondary" onClick={() => setCover(null)} className="cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={uploading === 'cover'}
                    onClick={() => coverInput.current?.click()}
                    className="cursor-pointer"
                  >
                    {uploading === 'cover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                    {cover ? 'Cambiar' : 'Subir portada'}
                  </Button>
                </div>
              </div>
              <input
                ref={coverInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  upload(e.target.files?.[0], 'cover');
                  e.target.value = '';
                }}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <Store className="h-10 w-10 text-primary" />}
              </div>
              <div className="space-y-2">
                <Label>Logo (cuadrado, mínimo 300 × 300 px)</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploading === 'logo'}
                    onClick={() => logoInput.current?.click()}
                    className="cursor-pointer"
                  >
                    {uploading === 'logo' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
                    {logo ? 'Cambiar logo' : 'Subir logo'}
                  </Button>
                  {logo && (
                    <Button size="sm" variant="ghost" onClick={() => setLogo(null)} className="cursor-pointer">
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={logoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  upload(e.target.files?.[0], 'logo');
                  e.target.value = '';
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sobre tu tienda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, max))}
              rows={10}
              placeholder="Cuenta la historia de tu taller o tienda: desde cuándo trabajas, qué haces, con qué hermandades has trabajado, cómo envías, si aceptas encargos…"
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length} / {max}
            </p>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving || uploading !== null || slugStatus?.available === false} className="cursor-pointer">
          {saving ? 'Guardando…' : 'Guardar tienda'}
        </Button>
      </div>
    </AccountLayout>
  );
}
