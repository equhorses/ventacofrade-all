import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { client, type SellerPlanSummary, type SellerProductStats } from '@/lib/api';
import { Church, Plus, Eye, Trash2, Sparkles, Heart, MessageCircle, Crown, RefreshCw, Palmtree } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Product {
  id: number;
  title: string;
  price: number;
  images: string;
  status: string;
  views_count: number;
  is_featured?: boolean;
  featured_until?: string | null;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-700' },
  sold: { label: 'Vendido', className: 'bg-muted text-muted-foreground' },
  paused: { label: 'Pausado', className: 'bg-amber-100 text-amber-700' },
};

export default function MisAnunciosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [featuringId, setFeaturingId] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<SellerPlanSummary | null>(null);
  const [stats, setStats] = useState<Record<number, SellerProductStats>>({});
  const [busyVacation, setBusyVacation] = useState(false);
  const [bumpingId, setBumpingId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const feature = searchParams.get('feature');
    if (feature === 'success') {
      toast.success('¡Anuncio destacado! Puede tardar unos segundos en reflejarse.');
      setSearchParams({}, { replace: true });
      setTimeout(load, 2000);
    } else if (feature === 'cancelled') {
      toast.info('Has cancelado el pago para destacar el anuncio.');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadPlan = async () => {
    try {
      const [{ data: summary }, { data: statsData }] = await Promise.all([
        client.sellerPlans.me(),
        client.sellerPlans.stats(),
      ]);
      setPlan(summary);
      setStats(Object.fromEntries(statsData.items.map((item) => [item.product_id, item])));
    } catch (err) {
      console.error('Error loading seller plan:', err);
    }
  };

  const load = async () => {
    setLoading(true);
    loadPlan();
    try {
      const res = await client.entities.products.mine({ sort: '-created_at', limit: 100 });
      setProducts(res?.data?.items || []);
    } catch (err) {
      console.error('Error loading my products:', err);
      toast.error('No se pudieron cargar tus anuncios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    client.payments
      .getFeaturePrices()
      .then(({ data }) => setPrices(data))
      .catch((err) => console.error('Error loading feature prices:', err));
  }, []);

  const handleFeature = async (productId: number, days: 3 | 7 | 30) => {
    setFeaturingId(productId);
    try {
      const { data } = await client.payments.featureListing(productId, days);
      window.location.href = data.url;
    } catch (err: unknown) {
      console.error('Error starting feature checkout:', err);
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo iniciar el pago.';
      toast.error(message);
      setFeaturingId(null);
    }
  };

  const handleIncludedFeature = async (productId: number) => {
    setFeaturingId(productId);
    try {
      const { data } = await client.sellerPlans.featureWithIncluded(productId);
      toast.success(
        `Anuncio destacado ${plan?.included_feature_days ?? 7} días. Te quedan ${data.included_features_left} destacados este mes.`,
      );
      await load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo destacar el anuncio.';
      toast.error(message);
    } finally {
      setFeaturingId(null);
    }
  };

  const errorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;

  const handleVacation = async (enabled: boolean) => {
    if (enabled && !confirm('Se pausarán todos tus anuncios activos hasta que desactives el modo vacaciones. ¿Continuar?')) return;
    setBusyVacation(true);
    try {
      const { data } = await client.sellerPlans.setVacation(enabled);
      toast.success(
        enabled
          ? `Modo vacaciones activado: ${data.products_changed} anuncios pausados.`
          : `Modo vacaciones desactivado: ${data.products_changed} anuncios reactivados.`,
      );
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo cambiar el modo vacaciones.'));
    } finally {
      setBusyVacation(false);
    }
  };

  const handleBump = async (productId: number) => {
    setBumpingId(productId);
    try {
      await client.sellerPlans.bump(productId);
      toast.success('Anuncio renovado: vuelve a aparecer arriba como recién publicado.');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo renovar el anuncio.'));
    } finally {
      setBumpingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar este anuncio? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      await client.entities.products.delete({ id });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Anuncio eliminado');
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('No se pudo eliminar el anuncio');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AccountLayout title="Mis anuncios" description="Gestiona los artículos que has publicado">
      <div className="flex justify-end mb-4">
        <Link to="/publicar">
          <Button size="sm" className="gap-1 cursor-pointer">
            <Plus className="h-4 w-4" />
            Publicar anuncio
          </Button>
        </Link>
      </div>

      {plan && (
        <Card className="mb-4 border-primary/30">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            {plan.tier === 'gratis' ? (
              <>
                <div>
                  <p className="font-semibold text-foreground">Plan gratuito</p>
                  <p className="text-sm text-muted-foreground">
                    Publica todos los anuncios que quieras. Con un plan, tus anuncios aparecen antes, llevan insignia e
                    incluyen destacados cada mes.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {plan.vacation_mode && (
                    <Button
                      size="sm"
                      className="gap-1 cursor-pointer"
                      disabled={busyVacation}
                      onClick={() => handleVacation(false)}
                    >
                      <Palmtree className="h-4 w-4" /> Volver de vacaciones
                    </Button>
                  )}
                  <Link to="/cuenta/suscripcion">
                    <Button size="sm" className="gap-1 cursor-pointer">
                      <Crown className="h-4 w-4" /> Ver planes
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-semibold text-foreground">
                    Plan {plan.tier === 'profesional' ? 'Profesional' : 'Básico'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Destacados incluidos este mes: <strong>{plan.included_features_left}</strong> de{' '}
                    {plan.included_features_total} disponibles ({plan.included_feature_days} días cada uno). Se renuevan
                    el {new Date(plan.resets_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.auto_bump
                      ? 'Renovar un anuncio lo vuelve a poner arriba como recién publicado. Tus anuncios se renuevan solos cada semana y además puedes renovar uno al día.'
                      : 'Renovar un anuncio lo vuelve a poner arriba como recién publicado. Puedes renovar uno a la semana.'}
                    {plan.next_bump_at &&
                      ` Próxima renovación disponible: ${new Date(plan.next_bump_at).toLocaleString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}.`}
                  </p>
                </div>
                {plan.can_use_vacation && (
                  <Button
                    size="sm"
                    variant={plan.vacation_mode ? 'default' : 'outline'}
                    className="gap-1 cursor-pointer shrink-0"
                    disabled={busyVacation}
                    onClick={() => handleVacation(!plan.vacation_mode)}
                  >
                    <Palmtree className="h-4 w-4" />
                    {plan.vacation_mode ? 'Volver de vacaciones' : 'Modo vacaciones'}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Church className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Aún no tienes anuncios</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Publica tu primer artículo y llegará a toda la comunidad cofrade.
            </p>
            <Link to="/publicar">
              <Button className="cursor-pointer">Publicar mi primer anuncio</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const status = statusLabels[product.status || 'active'] || statusLabels.active;
            return (
              <Card key={product.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-md bg-muted overflow-hidden shrink-0">
                    {product.images ? (
                      <img
                        src={product.images.split(',')[0]}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Church className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/producto/${product.id}`}
                      className="font-medium text-foreground truncate block hover:text-primary cursor-pointer"
                    >
                      {product.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-primary font-semibold text-sm">
                        {product.price?.toFixed(2)} €
                      </span>
                      <Badge className={`text-xs font-normal ${status.className}`}>{status.label}</Badge>
                      {product.is_featured && (
                        <Badge className="text-xs font-normal bg-amber-100 text-amber-700 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Destacado
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {product.views_count ?? 0}
                      </span>
                      {stats[product.id]?.favorites !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Favoritos">
                          <Heart className="h-3 w-3" />
                          {stats[product.id].favorites}
                        </span>
                      )}
                      {stats[product.id]?.contacts !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Compradores que te han escrito">
                          <MessageCircle className="h-3 w-3" />
                          {stats[product.id].contacts}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer gap-1"
                          disabled={featuringId === product.id}
                        >
                          <Sparkles className="h-3 w-3" />
                          {product.is_featured ? 'Ampliar' : 'Destacar'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {plan && plan.included_features_left > 0 && (product.status || 'active') === 'active' && (
                          <DropdownMenuItem
                            className="cursor-pointer font-medium text-primary"
                            onClick={() => handleIncludedFeature(product.id)}
                          >
                            {plan.included_feature_days} días — incluido en tu plan ({plan.included_features_left} restantes)
                          </DropdownMenuItem>
                        )}
                        {[3, 7, 30].map((days) => (
                          <DropdownMenuItem
                            key={days}
                            className="cursor-pointer"
                            onClick={() => handleFeature(product.id, days as 3 | 7 | 30)}
                          >
                            {days} días — {prices[String(days)]?.toFixed(2) ?? '…'} €
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {plan?.can_bump && (product.status || 'active') === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        title={
                          plan.next_bump_at
                            ? 'Aún no puedes renovar otro anuncio'
                            : 'Vuelve a ponerlo arriba como recién publicado'
                        }
                        disabled={bumpingId === product.id || Boolean(plan.next_bump_at)}
                        onClick={() => handleBump(product.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Renovar
                      </Button>
                    )}
                    <Link to={`/producto/${product.id}`}>
                      <Button variant="ghost" size="icon" className="cursor-pointer" title="Ver anuncio">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      title="Eliminar anuncio"
                      disabled={deletingId === product.id}
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccountLayout>
  );
}
