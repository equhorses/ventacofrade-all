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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { client, type AdminConversation, type AdminThreadMessage, type AdminChatMessage } from '@/lib/api';
import { Search, MessageSquare, Send } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

export default function AdminMensajesPage() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Read-only thread for a buyer-seller conversation about a listing.
  const [openThread, setOpenThread] = useState<AdminConversation | null>(null);
  const [threadMessages, setThreadMessages] = useState<AdminThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // Reply-capable chat for support conversations (product_id === 0).
  const [chatConversation, setChatConversation] = useState<AdminConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleOpenConversation = async (c: AdminConversation) => {
    if (c.product_id === 0) {
      // Support conversation: open the reply-capable chat, keyed by the
      // regular user's id (the other side is always staff).
      if (!c.buyer_user_id) {
        toast.error('No se pudo identificar a la persona de esta conversación.');
        return;
      }
      setChatConversation(c);
      setChatLoading(true);
      try {
        const { data } = await client.admin.getSupportThread(c.buyer_user_id);
        setChatMessages(data);
      } catch (err) {
        console.error('Error loading support thread:', err);
        toast.error('No se pudo cargar la conversación');
      } finally {
        setChatLoading(false);
      }
      return;
    }

    // Regular buyer-seller conversation about a listing: read-only view.
    if (!c.buyer_user_id || !c.seller_user_id) {
      toast.error('No se pudo identificar a los participantes de esta conversación.');
      return;
    }
    setOpenThread(c);
    setThreadLoading(true);
    try {
      const { data } = await client.admin.getConversationThread(c.product_id, c.buyer_user_id, c.seller_user_id);
      setThreadMessages(data);
    } catch (err) {
      console.error('Error loading conversation thread:', err);
      toast.error('No se pudo cargar la conversación');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatConversation?.buyer_user_id || !chatInput.trim()) return;
    setSending(true);
    try {
      const { data } = await client.admin.sendSupportMessage(chatConversation.buyer_user_id, chatInput.trim());
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
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Mensajes
          </h1>
          <p className="text-muted-foreground">
            Supervisión de conversaciones entre compradores y vendedores, para soporte. Haz clic en una fila
            para ver la conversación completa.
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
                  <TableRow
                    key={`${c.product_id}-${idx}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenConversation(c)}
                  >
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

      {/* Read-only thread: buyer-seller conversation about a listing */}
      <Dialog open={!!openThread} onOpenChange={(open) => !open && setOpenThread(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{openThread?.product_title}</DialogTitle>
          </DialogHeader>
          <div className="h-80 overflow-y-auto border rounded-md p-3 space-y-2 bg-muted/30">
            {threadLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!threadLoading && threadMessages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">Sin mensajes.</p>
            )}
            {threadMessages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.user_id === openThread?.seller_user_id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.user_id === openThread?.seller_user_id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border'
                  }`}
                >
                  <div className="text-[10px] opacity-70 mb-0.5">{m.sender_email}</div>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Vista de solo lectura, para supervisión. Si necesitas intervenir, contacta directamente con la
            persona desde la pestaña Usuarios.
          </p>
        </DialogContent>
      </Dialog>

      {/* Reply-capable chat: support conversation */}
      <Dialog open={!!chatConversation} onOpenChange={(open) => !open && setChatConversation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{chatConversation?.buyer_email || 'Soporte'}</DialogTitle>
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
              placeholder="Escribe una respuesta..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button disabled={sending || !chatInput.trim()} onClick={handleSendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
