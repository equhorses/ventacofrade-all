import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { client, type AdminConversation } from '@/lib/api';
import { Search, MessageSquare } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

export default function AdminMensajesPage() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadConversations = async (query?: string) => {
    setLoading(true);
    try {
      const { data } = await client.admin.listConversationsAdmin(query);
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
      toast.error('No se pudieron cargar las conversaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadConversations(search.trim() || undefined);
  };

  return (
    <>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Mensajes
          </h1>
          <p className="text-muted-foreground">
            Supervisión de conversaciones entre compradores y vendedores, para soporte.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <Input
            placeholder="Buscar por anuncio o email..."
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
              {loading ? 'Cargando...' : `${conversations.length} conversación(es)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anuncio</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Último mensaje</TableHead>
                  <TableHead>Mensajes</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((c, idx) => (
                  <TableRow key={`${c.product_id}-${idx}`}>
                    <TableCell className="font-medium max-w-[160px] truncate">{c.product_title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.buyer_email || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.seller_email || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{c.last_message}</TableCell>
                    <TableCell className="text-sm">{c.message_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('es-ES') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && conversations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay conversaciones todavía.
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
