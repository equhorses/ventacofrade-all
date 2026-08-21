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
import { client, type AdminUser, type AdminChatMessage } from '@/lib/api';
import { Search, Ban, RotateCcw, MessageCircle, Send } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-green-100 text-green-700' },
  suspended: { label: 'Pausada por el usuario', className: 'bg-amber-100 text-amber-700' },
  banned: { label: 'Baneada', className: 'bg-red-100 text-red-700' },
  pending_deletion: { label: 'Pendiente de borrado', className: 'bg-muted text-muted-foreground' },
};

const ROLE_LABELS: Record<string, string> = {
  user: 'Usuario',
  admin: 'Super admin',
  marketing: 'Marketing',
  seguridad: 'Seguridad',
  moderacion: 'Moderación',
  soporte: 'Soporte',
};

const PAGE_SIZE = 50;

export default function AdminUsuariosPage() {
  const { user, isSuperAdmin } = useAuth();
  const canModerate = isSuperAdmin || user?.role === 'seguridad';
  const canChat = isSuperAdmin || user?.role === 'soporte';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [chatUser, setChatUser] = useState<AdminUser | null>(null);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadUsers = async (query?: string, offset = 0) => {
    setLoading(true);
    try {
      const { data } = await client.admin.listUsers({ search: query, skip: offset, limit: PAGE_SIZE });
      setUsers(data.items);
      setTotal(data.total);
      setSkip(offset);
    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('No se pudo cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(search.trim() || undefined, 0);
  };

  const handleBan = async (user: AdminUser) => {
    if (!confirm(`¿Seguro que quieres banear a ${user.email}? No podrá volver a iniciar sesión.`)) return;
    setActingId(user.id);
    try {
      const { data } = await client.admin.banUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data : u)));
      toast.success(`${user.email} ha sido baneado`);
    } catch (err: unknown) {
      console.error('Error banning user:', err);
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'No se pudo banear.';
      toast.error(message);
    } finally {
      setActingId(null);
    }
  };

  const handleUnban = async (user: AdminUser) => {
    setActingId(user.id);
    try {
      const { data } = await client.admin.unbanUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data : u)));
      toast.success(`${user.email} ya puede volver a iniciar sesión`);
    } catch (err: unknown) {
      console.error('Error unbanning user:', err);
      toast.error('No se pudo quitar el baneo.');
    } finally {
      setActingId(null);
    }
  };

  const openChat = async (targetUser: AdminUser) => {
    setChatUser(targetUser);
    setChatLoading(true);
    try {
      const { data } = await client.admin.getSupportThread(targetUser.id);
      setChatMessages(data);
    } catch (err) {
      console.error('Error loading support thread:', err);
      toast.error('No se pudo cargar la conversación');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatUser || !chatInput.trim()) return;
    setSending(true);
    try {
      const { data } = await client.admin.sendSupportMessage(chatUser.id, chatInput.trim());
      setChatMessages((prev) => [...prev, data]);
      setChatInput('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Usuarios</h1>
          <p className="text-muted-foreground">Todas las cuentas registradas, sean o no vendedoras.</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <Input
            placeholder="Buscar por email o nombre..."
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
              {loading ? 'Cargando...' : `${total} usuario(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{ROLE_LABELS[u.role] || u.role}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_LABELS[u.account_status]?.className || 'bg-muted'}>
                        {STATUS_LABELS[u.account_status]?.label || u.account_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {canChat && u.role === 'user' && (
                          <Button size="sm" variant="ghost" onClick={() => openChat(u)}>
                            <MessageCircle className="h-3 w-3 mr-1" /> Mensaje
                          </Button>
                        )}
                        {u.role !== 'user' ? (
                          <span className="text-xs text-muted-foreground">Cuenta de equipo</span>
                        ) : !canModerate ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : u.account_status === 'banned' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actingId === u.id}
                            onClick={() => handleUnban(u)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Quitar baneo
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={actingId === u.id}
                            onClick={() => handleBan(u)}
                          >
                            <Ban className="h-3 w-3 mr-1" /> Banear
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No se encontraron usuarios.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={skip === 0 || loading}
                  onClick={() => loadUsers(search.trim() || undefined, Math.max(0, skip - PAGE_SIZE))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={skip + PAGE_SIZE >= total || loading}
                  onClick={() => loadUsers(search.trim() || undefined, skip + PAGE_SIZE)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!chatUser} onOpenChange={(open) => !open && setChatUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{chatUser?.name || chatUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="h-80 overflow-y-auto border rounded-md p-3 space-y-2 bg-muted/30">
            {chatLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!chatLoading && chatMessages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">
                Todavía no hay mensajes con esta persona.
              </p>
            )}
            {chatMessages.map((m) => (
              <div key={m.id} className={`flex ${m.is_from_staff ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.is_from_staff ? 'bg-primary text-primary-foreground' : 'bg-background border'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Escribe un mensaje..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && handleSendMessage()}
            />
            <Button onClick={handleSendMessage} disabled={sending || !chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
