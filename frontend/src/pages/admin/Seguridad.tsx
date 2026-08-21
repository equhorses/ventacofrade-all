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
import { client, type SecurityOverview } from '@/lib/api';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

export default function AdminSeguridadPage() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.admin.getSecurityOverview();
        setOverview(data);
      } catch (err) {
        console.error('Error loading security overview:', err);
        toast.error('No se pudo cargar la información de seguridad');
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
            <ShieldAlert className="h-5 w-5" /> Seguridad
          </h1>
          <p className="text-muted-foreground">Actividad de inicio de sesión, para detectar accesos sospechosos.</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {overview && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-2xl font-bold">{overview.failed_last_24h}</p>
                  <p className="text-xs text-muted-foreground">Intentos fallidos en las últimas 24h</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-2xl font-bold">{overview.suspicious_emails.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Emails con 3+ fallos en 24h (posible ataque)
                  </p>
                </CardContent>
              </Card>
            </div>

            {overview.suspicious_emails.length > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" /> Actividad sospechosa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {overview.suspicious_emails.map((email) => (
                      <li key={email} className="text-red-700">{email}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos 100 intentos de inicio de sesión</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.recent_attempts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">{a.method}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              a.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }
                          >
                            {a.success ? 'Éxito' : 'Fallo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.reason || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.ip_address || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.created_at ? new Date(a.created_at).toLocaleString('es-ES') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {overview.recent_attempts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Todavía no hay actividad registrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
