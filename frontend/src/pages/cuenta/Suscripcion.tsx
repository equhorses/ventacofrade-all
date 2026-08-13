import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/api';
import { Check, Zap, Crown, CreditCard, ShieldCheck } from 'lucide-react';

interface SellerProfile {
  id: number;
  shop_name: string;
  province: string;
  is_active?: boolean;
  subscription_status?: string;
  activation_paid?: boolean;
  rating?: number;
  total_sales?: number;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pendiente de activación', className: 'bg-amber-100 text-amber-700' },
  inactive: { label: 'Inactiva', className: 'bg-muted text-muted-foreground' },
};

export default function SuscripcionPage() {
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<'basico' | 'profesional' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const loadProfile = async () => {
    try {
      const res = await client.entities.seller_profiles.mine({ limit: 1 });
      setSellerProfile(res?.data?.items?.[0] || null);
    } catch (err) {
      console.error('Error loading seller profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast.success('¡Pago completado! Estamos activando tu plan…');
      // Give the Stripe webhook a moment to land before refetching.
      setTimeout(loadProfile, 2500);
    } else if (checkout === 'cancelled') {
      toast.info('Pago cancelado. No se te ha cobrado nada.');
    }
    if (checkout) {
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async (plan: 'basico' | 'profesional') => {
    if (!sellerProfile) {
      toast.error('Completa primero tus datos de vendedor en Mi perfil');
      navigate('/cuenta/perfil');
      return;
    }
    setCheckoutLoading(plan);
    try {
      const res = await client.payments.createCheckout(plan);
      window.location.href = res.data.url;
    } catch (err: unknown) {
      console.error('Error creating checkout:', err);
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo iniciar el pago. Inténtalo de nuevo.';
      toast.error(message);
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <AccountLayout title="Suscripción" description="Gestiona tu plan en VentaCofrade">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AccountLayout>
    );
  }

  const isActive = sellerProfile?.subscription_status === 'active';

  return (
    <AccountLayout title="Suscripción" description="Gestiona tu plan en VentaCofrade">
      <div className="space-y-6">
        {/* Current status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {sellerProfile ? sellerProfile.shop_name : 'Plan gratuito'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sellerProfile ? 'Tu tienda' : 'Puedes comprar y publicar sin coste'}
                  </p>
                </div>
              </div>
              {sellerProfile ? (
                <Badge className={statusLabels[sellerProfile.subscription_status || 'inactive'].className}>
                  {statusLabels[sellerProfile.subscription_status || 'inactive'].label}
                </Badge>
              ) : (
                <Badge variant="outline">Sin suscripción</Badge>
              )}
            </div>

            {sellerProfile && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{sellerProfile.rating?.toFixed(1) ?? '0.0'}</p>
                  <p className="text-xs text-muted-foreground">Valoración</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{sellerProfile.total_sales ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Ventas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{sellerProfile.province}</p>
                  <p className="text-xs text-muted-foreground">Provincia</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{sellerProfile.activation_paid ? 'Sí' : 'No'}</p>
                  <p className="text-xs text-muted-foreground">Activación pagada</p>
                </div>
              </div>
            )}

            {!sellerProfile && (
              <div className="mt-5 pt-5 border-t border-border">
                <Link to="/cuenta/perfil">
                  <Button variant="ghost" className="cursor-pointer gap-1.5">
                    Completar datos de vendedor primero
                  </Button>
                </Link>
              </div>
            )}

            {isActive && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Para cancelar o cambiar de tarjeta, escríbenos a hola@ventacofrade.com — la gestión
                  automática desde aquí llegará pronto.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border p-5 flex items-center gap-3 text-muted-foreground">
              <CreditCard className="h-5 w-5 shrink-0" />
              <span className="text-sm">
                El pago se gestiona de forma segura a través de Stripe — nunca guardamos los datos de tu
                tarjeta en nuestros servidores. Al elegir un plan te llevaremos a una pantalla de pago
                segura de Stripe.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {sellerProfile ? 'Planes disponibles' : 'Planes para vendedores'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Puedes revisar todos los detalles en la página de{' '}
            <Link to="/vender" className="text-primary hover:underline">
              Vender
            </Link>
            .
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 border-border">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Zap className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Plan Básico</CardTitle>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">4,99€</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">+ 10€ activación única</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {[
                    'Hasta 10 anuncios activos',
                    'Fotos ilimitadas por anuncio',
                    'Mensajería con compradores',
                    'Perfil de vendedor',
                    'Soporte por email',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSubscribe('basico')}
                  disabled={checkoutLoading !== null || isActive}
                  className="w-full mt-4 bg-primary hover:bg-primary/90 cursor-pointer"
                >
                  {checkoutLoading === 'basico'
                    ? 'Redirigiendo…'
                    : isActive
                    ? 'Ya tienes un plan activo'
                    : 'Suscribirme'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-secondary relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-secondary text-secondary-foreground">Más popular</Badge>
              </div>
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary/20 text-secondary flex items-center justify-center">
                  <Crown className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Plan Profesional</CardTitle>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">9,99€</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">+ 10€ activación única</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {[
                    'Anuncios ilimitados',
                    'Anuncios destacados (x3/mes)',
                    'Estadísticas avanzadas',
                    'Prioridad en búsquedas',
                    'Soporte prioritario',
                    'Badge de vendedor verificado',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <ShieldCheck className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSubscribe('profesional')}
                  disabled={checkoutLoading !== null || isActive}
                  className="w-full mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/90 cursor-pointer"
                >
                  {checkoutLoading === 'profesional'
                    ? 'Redirigiendo…'
                    : isActive
                    ? 'Ya tienes un plan activo'
                    : 'Suscribirme'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
