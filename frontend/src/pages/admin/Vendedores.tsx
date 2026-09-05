import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { client, type AdminSeller, type AdminInvitation } from '@/lib/api';
import { Gift, Search, XCircle, Mail, Send, Rocket, Sparkles, Trash2 } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

const MONTH_OPTIONS = [1, 3, 6, 12];

export default function AdminVendedoresPage() {
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMonths, setInviteMonths] = useState(3);
  const [isRaffleWinner, setIsRaffleWinner] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [bulkInviting, setBulkInviting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ invited: number; skipped_already_invited: number; failed_emails: string[] } | null>(null);

  const [launchAt, setLaunchAt] = useState<string | null>(null);
  const [launchAtInput, setLaunchAtInput] = useState('');
  const [loadingLaunch, setLoadingLaunch] = useState(true);
  const [savingLaunch, setSavingLaunch] = useState(false);

  const loadLaunchSettings = async () => {
    setLoadingLaunch(true);
    try {
      const { data } = await client.admin.getPlatformSettings();
      setLaunchAt(data.launch_at);
      setLaunchAtInput(data.launch_at ? data.launch_at.slice(0, 16) : '');
    } catch (err) {
      console.error('Error loading platform settings:', err);
    } finally {
      setLoadingLaunch(false);
    }
  };

  const handleSaveLaunch = async () => {
    setSavingLaunch(true);
    try {
      const isoValue = launchAtInput ? new Date(launchAtInput).toISOString() : null;
      const { data } = await client.admin.setPlatformLaunchAt(isoValue);
      setLaunchAt(data.launch_at);
      toast.success(
        data.launch_at
          ? 'Fecha de lanzamiento guardada. Los ganadores del sorteo pendientes ya han sido activados.'
          : 'Fecha de lanzamiento borrada.'
      );
    } catch (err) {
      console.error('Error saving launch date:', err);
      toast.error('No se pudo guardar la fecha de lanzamiento');
    } finally {
      setSavingLaunch(false);
    }
  };

  const loadSellers = async (query?: string) => {
    setLoadingSellers(true);
    try {
      const { data } = await client.admin.listSellers(query);
      setSellers(data);
    } catch (err) {
      console.error('Error loading sellers:', err);
      toast.error('No se pudo cargar la lista de vendedores');
    } finally {
      setLoadingSellers(false);
    }
  };

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const { data } = await client.admin.listInvitations();
      setInvitations(data);
    } catch (err) {
      console.error('Error loading invitations:', err);
      toast.error('No se pudieron cargar las invitaciones');
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    loadSellers();
    loadInvitations();
    loadLaunchSettings();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadSellers(search.trim() || undefined);
  };

  const handleGrant = async (seller: AdminSeller, months: number | null) => {
    setSavingId(seller.id);
    try {
      const { data } = await client.admin.grantFreeAccess(seller.id, months);
      setSellers((prev) => prev.map((s) => (s.id === seller.id ? data : s)));
      toast.success(
        months
          ? `Acceso gratis concedido a ${seller.shop_name} durante ${months} mes(es)`
          : `Acceso gratis retirado a ${seller.shop_name}`
      );
    } catch (err) {
      console.error('Error granting free access:', err);
      toast.error('No se pudo actualizar el acceso gratis');
    } finally {
      setSavingId(null);
    }
  };

  const [deletingInviteId, setDeletingInviteId] = useState<number | null>(null);

  const handleDeleteInvitation = async (inv: AdminInvitation) => {
    if (!confirm(`¿Borrar la invitación de prueba enviada a ${inv.email}?`)) return;
    setDeletingInviteId(inv.id);
    try {
      await client.admin.deleteInvitation(inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      toast.success('Invitación borrada');
    } catch (err) {
      console.error('Error deleting invitation:', err);
      toast.error('No se pudo borrar la invitación');
    } finally {
      setDeletingInviteId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      const { data } = await client.admin.createInvitation(
        inviteEmail.trim(),
        inviteMonths,
        isRaffleWinner ? 'sorteo_instagram' : undefined
      );
      setInvitations((prev) => [data, ...prev]);
      setInviteEmail('');
      setIsRaffleWinner(false);
      toast.success(`Invitación enviada a ${data.email}`);
    } catch (err) {
      console.error('Error sending invitation:', err);
      toast.error('No se pudo enviar la invitación');
    } finally {
      setSendingInvite(false);
    }
  };

  const isComplimentary = (seller: AdminSeller) =>
    !!seller.free_access_until && new Date(seller.free_access_until) > new Date();

  return (
    <>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Vendedores</h1>
        <p className="text-muted-foreground">
          Invita a vendedores antes del lanzamiento y concede acceso gratuito para publicar sin suscripción.
        </p>
      </div>

      {/* Fecha real de lanzamiento (afecta a cuándo empiezan a contar los 3 meses de los ganadores del sorteo) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Fecha de lanzamiento de la plataforma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Ponla el día real en que VentaCofrade abra al público. Hasta entonces, los ganadores del
            sorteo pueden registrarse pero su acceso gratis no empieza a contar. En cuanto guardes esta
            fecha por primera vez, se activan automáticamente todos los ganadores pendientes y reciben
            su email de "premio activado" con el plazo de 15 días para publicar.
          </p>
          {loadingLaunch ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                type="datetime-local"
                value={launchAtInput}
                onChange={(e) => setLaunchAtInput(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleSaveLaunch} disabled={savingLaunch}>
                Guardar fecha
              </Button>
              {launchAt && (
                <Badge className="bg-green-100 text-green-700">
                  Lanzada el {new Date(launchAt).toLocaleString('es-ES')}
                </Badge>
              )}
              {!launchAt && (
                <Badge className="bg-amber-100 text-amber-700">Todavía sin fecha de lanzamiento</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Invitar por email
          </CardTitle>
          {(() => {
            const raffleCount = invitations.filter((inv) => inv.source === 'sorteo_instagram').length;
            const overLimit = raffleCount >= 25;
            return (
              <p className={`text-xs mt-1 ${overLimit ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {raffleCount} / 25 ganadores del sorteo invitados hasta ahora
                {overLimit && ' — las bases prometen "hasta 25 premios", revisa antes de invitar a más'}
              </p>
            );
          })()}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-center mb-6">
            <Input
              type="email"
              required
              placeholder="email@ejemplo.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={inviteMonths}
              onChange={(e) => setInviteMonths(Number(e.target.value))}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? 'mes' : 'meses'} gratis
                </option>
              ))}
            </select>
            <Button type="submit" disabled={sendingInvite}>
              <Send className="h-4 w-4 mr-1" /> Enviar invitación
            </Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRaffleWinner}
                onChange={(e) => setIsRaffleWinner(e.target.checked)}
                className="cursor-pointer"
              />
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Es ganador del sorteo de Instagram
            </label>
          </form>

          <div className="border-t pt-4 mb-6">
            <p className="text-sm font-medium mb-1">Invitar a toda la lista de espera</p>
            <p className="text-xs text-muted-foreground mb-3">
              Invita de golpe a todos los emails apuntados en la landing, con 12 meses de acceso
              gratis cada uno. Si ya invitaste a alguien antes (de esta lista o a mano), se salta
              automáticamente — puedes darle varias veces si llegan nuevos emails.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={bulkInviting}
              onClick={async () => {
                if (!confirm('¿Invitar ya a toda la lista de espera actual? Se enviará un email a cada persona nueva.')) return;
                setBulkInviting(true);
                setBulkResult(null);
                try {
                  const { data } = await client.admin.bulkInviteWaitlist(12);
                  setBulkResult(data);
                  await loadInvitations();
                  toast.success(`${data.invited} personas invitadas`);
                } catch (err) {
                  console.error('Error en la invitación masiva:', err);
                  toast.error('No se pudo completar la invitación masiva');
                } finally {
                  setBulkInviting(false);
                }
              }}
            >
              <Rocket className="h-4 w-4 mr-1" />
              {bulkInviting ? 'Invitando...' : 'Invitar a toda la lista de espera'}
            </Button>
            {bulkResult && (
              <p className="text-sm text-muted-foreground mt-2">
                {bulkResult.invited} invitados nuevos, {bulkResult.skipped_already_invited} ya estaban invitados
                {bulkResult.failed_emails.length > 0 && `, ${bulkResult.failed_emails.length} fallaron: ${bulkResult.failed_emails.join(', ')}`}
              </p>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Meses</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviada</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.months}</TableCell>
                  <TableCell>
                    {inv.source === 'sorteo_instagram' ? (
                      <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                        <Sparkles className="h-3 w-3" /> Sorteo
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        inv.revoked_at
                          ? 'bg-red-100 text-red-700'
                          : inv.status === 'redeemed'
                          ? inv.source === 'sorteo_instagram' && !inv.activated_at
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }
                    >
                      {inv.revoked_at
                        ? 'Revocada'
                        : inv.status === 'redeemed'
                        ? inv.source === 'sorteo_instagram' && !inv.activated_at
                          ? 'Canjeada (esperando lanzamiento)'
                          : 'Canjeada y activa'
                        : 'Pendiente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString('es-ES') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.status !== 'redeemed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingInviteId === inv.id}
                        onClick={() => handleDeleteInvitation(inv)}
                        title="Borrar invitación de prueba"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loadingInvitations && invitations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Todavía no has enviado ninguna invitación.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendedores existentes */}
      <div>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-md">
          <Input
            placeholder="Buscar por email, nombre o tienda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loadingSellers ? 'Cargando...' : `${sellers.length} vendedor(es)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Suscripción</TableHead>
                  <TableHead>Acceso gratis</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell className="font-medium">{seller.shop_name}</TableCell>
                    <TableCell>
                      <div>{seller.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{seller.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          seller.subscription_status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {seller.subscription_status === 'active' ? 'Activa' : 'Sin suscripción'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isComplimentary(seller) ? (
                        <Badge className="bg-blue-100 text-blue-700">
                          Hasta {new Date(seller.free_access_until as string).toLocaleDateString('es-ES')}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No concedido</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {MONTH_OPTIONS.map((months) => (
                          <Button
                            key={months}
                            size="sm"
                            variant="outline"
                            disabled={savingId === seller.id}
                            onClick={() => handleGrant(seller, months)}
                          >
                            <Gift className="h-3 w-3 mr-1" />
                            {months}m
                          </Button>
                        ))}
                        {isComplimentary(seller) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={savingId === seller.id}
                            onClick={() => handleGrant(seller, null)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Quitar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loadingSellers && sellers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No se encontraron vendedores.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}
