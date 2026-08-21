import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { client, type AuditLogEntry } from '@/lib/api';
import { ClipboardList } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

const ACTION_LABELS: Record<string, string> = {
  ban_user: 'Baneó a un usuario',
  unban_user: 'Quitó un baneo',
  remove_product: 'Retiró un anuncio',
  restore_product: 'Restauró un anuncio',
  delete_product: 'Eliminó un anuncio',
  grant_free_access: 'Concedió acceso gratis',
  create_invitation: 'Envió una invitación',
  assign_role: 'Cambió un rol',
  send_support_message: 'Envió un mensaje de soporte',
};

const ACTION_COLORS: Record<string, string> = {
  ban_user: 'bg-red-100 text-red-700',
  delete_product: 'bg-red-100 text-red-700',
  remove_product: 'bg-amber-100 text-amber-700',
  unban_user: 'bg-green-100 text-green-700',
  restore_product: 'bg-green-100 text-green-700',
  grant_free_access: 'bg-blue-100 text-blue-700',
  create_invitation: 'bg-blue-100 text-blue-700',
  assign_role: 'bg-purple-100 text-purple-700',
  send_support_message: 'bg-muted text-muted-foreground',
};

export default function AdminAuditoriaPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.admin.getAuditLog();
        setEntries(data);
      } catch (err) {
        console.error('Error loading audit log:', err);
        toast.error('No se pudo cargar el registro de auditoría');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Auditoría
          </h1>
          <p className="text-muted-foreground">Quién hizo qué, y cuándo. Solo visible para el super admin.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? 'Cargando...' : `${entries.length} acción(es) recientes`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quién</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Sobre qué</TableHead>
                  <TableHead>Detalles</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{e.actor_email || '—'}</TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[e.action] || 'bg-muted text-muted-foreground'}>
                        {ACTION_LABELS[e.action] || e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {e.target || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {e.details || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.created_at ? new Date(e.created_at).toLocaleString('es-ES') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Todavía no hay acciones registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
