import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminNav from '@/components/admin/AdminNav';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { client, type StuckUser } from '@/lib/api';
import { LifeBuoy, Loader2, Mail, RefreshCw } from 'lucide-react';

const REASON_COLORS: Record<string, string> = {
  publish_failed: 'bg-red-100 text-red-700',
  upload_failed: 'bg-red-100 text-red-700',
  api_error: 'bg-red-100 text-red-700',
  publish_abandoned: 'bg-amber-100 text-amber-800',
  login_failed: 'bg-amber-100 text-amber-800',
  reset_unfinished: 'bg-amber-100 text-amber-800',
  google_age: 'bg-amber-100 text-amber-800',
  no_listing: 'bg-muted text-muted-foreground',
};

function fmt(value: string | null) {
  return value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export default function AdminAtascadosPage() {
  const [items, setItems] = useState<StuckUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.admin.listStuck();
      setItems(data.items);
    } catch {
      toast.error('No se pudo cargar la lista');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const help = async (row: StuckUser) => {
    setSending(row.email);
    try {
      await client.admin.sendHelp(row.email, row.reason);
      toast.success(`Mensaje de ayuda enviado a ${row.email}`);
      setItems((prev) =>
        prev.map((r) => (r.email === row.email ? { ...r, last_help_at: new Date().toISOString() } : r)),
      );
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'No se pudo enviar');
    } finally {
      setSending(null);
    }
  };

  const urgent = items.filter((i) => i.reason !== 'no_listing').length;

  return (
    <>
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" /> Atascados
            </h1>
            <p className="text-sm text-muted-foreground">
              Gente que se ha quedado a medias en los últimos 30 días. {urgent} con un problema concreto, el resto
              registrados sin publicar.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="cursor-pointer">
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground">Nadie atascado ahora mismo. 🎉</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((row) => (
              <Card key={row.email}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground break-all">{row.email}</span>
                      {row.name && <span className="text-sm text-muted-foreground">({row.name})</span>}
                      <Badge variant="outline" className="text-xs">
                        {row.origin}
                      </Badge>
                      {!row.has_account && (
                        <Badge variant="outline" className="text-xs">
                          sin cuenta
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <Badge className={REASON_COLORS[row.reason] || ''}>{row.reason_label}</Badge>
                      <span className="text-muted-foreground">{fmt(row.when)}</span>
                    </div>
                    {row.detail && <p className="text-xs text-muted-foreground break-words">{row.detail}</p>}
                    {row.last_help_at && (
                      <p className="text-xs text-green-700">Ya se le escribió el {fmt(row.last_help_at)}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={row.last_help_at ? 'outline' : 'default'}
                    disabled={sending === row.email}
                    onClick={() => help(row)}
                    className="cursor-pointer shrink-0"
                  >
                    {sending === row.email ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-1" />
                    )}
                    {row.last_help_at ? 'Escribir otra vez' : 'Mandar ayuda'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
