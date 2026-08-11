import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';
import { Store, ShieldCheck } from 'lucide-react';

const provinces = [
  'Almería',
  'Cádiz',
  'Córdoba',
  'Granada',
  'Huelva',
  'Jaén',
  'Málaga',
  'Sevilla',
];

interface SellerProfile {
  id: number;
  shop_name: string;
  shop_description?: string;
  province: string;
  city?: string;
  phone?: string;
  is_active?: boolean;
  subscription_status?: string;
}

export default function PerfilPage() {
  const { user, refetch } = useAuth();

  // Basic account info
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  // Seller / shop info
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [savingSeller, setSavingSeller] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const loadSellerProfile = async () => {
      try {
        const res = await client.entities.seller_profiles.mine({ limit: 1 });
        const profile: SellerProfile | undefined = res?.data?.items?.[0];
        if (profile) {
          setSellerProfile(profile);
          setShopName(profile.shop_name || '');
          setShopDescription(profile.shop_description || '');
          setProvince(profile.province || '');
          setCity(profile.city || '');
          setPhone(profile.phone || '');
        }
      } catch (err) {
        console.error('Error loading seller profile:', err);
      } finally {
        setLoadingSeller(false);
      }
    };
    loadSellerProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      await client.users.updateProfile({ name: name.trim() });
      await refetch();
      toast.success('Perfil actualizado');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('No se pudo guardar el perfil. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !province) {
      toast.error('El nombre de la tienda y la provincia son obligatorios');
      return;
    }
    setSavingSeller(true);
    try {
      const data = {
        shop_name: shopName.trim(),
        shop_description: shopDescription.trim() || undefined,
        province,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      if (sellerProfile) {
        await client.entities.seller_profiles.update({ id: sellerProfile.id, data });
      } else {
        const res = await client.entities.seller_profiles.create({ data });
        setSellerProfile(res.data);
      }
      toast.success('Datos de vendedor guardados');
    } catch (err) {
      console.error('Error saving seller profile:', err);
      toast.error('No se pudieron guardar los datos de vendedor');
    } finally {
      setSavingSeller(false);
    }
  };

  return (
    <AccountLayout title="Mi perfil" description="Gestiona tu información personal">
      <div className="space-y-6">
        {/* Basic account info */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="space-y-5 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" value={user?.email || ''} disabled />
                <p className="text-xs text-muted-foreground">
                  El correo no se puede modificar por ahora.
                </p>
              </div>
              <Button type="submit" disabled={saving} className="cursor-pointer">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Seller / shop info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5 text-primary" />
                Datos de vendedor
              </CardTitle>
              {sellerProfile?.is_active ? (
                <Badge className="bg-green-100 text-green-700 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Tienda activa
                </Badge>
              ) : (
                <Badge variant="outline">Sin activar</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground pt-1">
              Estos datos aparecerán en tus anuncios y mejoran la confianza de los compradores.
              Complétalos ahora; se usarán al activar tu plan de vendedor en{' '}
              <span className="font-medium text-foreground">Suscripción</span>.
            </p>
          </CardHeader>
          <CardContent>
            {loadingSeller ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <form onSubmit={handleSaveSeller} className="space-y-5 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Nombre de la tienda</Label>
                  <Input
                    id="shopName"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Ej. Orfebrería Hermanos García"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shopDescription">Descripción</Label>
                  <Textarea
                    id="shopDescription"
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    placeholder="Cuenta a qué te dedicas, tu experiencia, especialidad…"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">Provincia</Label>
                    <Select value={province} onValueChange={setProvince}>
                      <SelectTrigger id="province">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej. Écija"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono de contacto</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="600 000 000"
                  />
                </div>
                <Button type="submit" disabled={savingSeller} className="cursor-pointer">
                  {savingSeller ? 'Guardando…' : 'Guardar datos de vendedor'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AccountLayout>
  );
}
