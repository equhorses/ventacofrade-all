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
import { Gift, Search, XCircle, Mail, Send } from 'lucide-react';
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
  const [sendingInvite, setSendingInvite] = useState(false);

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      const { data } = await client.admin.createInvitation(inviteEmail.trim(), inviteMonths);
      setInvitations((prev) => [data, ...prev]);
      setInviteEmail('');
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

      {/* Invitaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Invitar por email
          </CardTitle>
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
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Meses</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.months}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        inv.status === 'redeemed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }
                    >
                      {inv.status === 'redeemed' ? 'Canjeada' : 'Pendiente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString('es-ES') : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!loadingInvitations && invitations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
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
