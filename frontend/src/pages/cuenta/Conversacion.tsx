import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { client } from '@/lib/api';
import { ArrowLeft, Send, Church } from 'lucide-react';

interface ThreadMessage {
  id: number;
  content: string;
  is_mine: boolean;
  created_at: string | null;
}

interface ThreadProduct {
  id: number;
  title: string;
  image: string | null;
  user_id: string;
}

interface ThreadOtherUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

const QUICK_REPLIES = [
  '¿Sigue disponible?',
  '¿Aceptas envío?',
  '¿Es negociable el precio?',
];

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ConversacionPage() {
  const { productId, otherUserId } = useParams<{ productId: string; otherUserId: string }>();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [product, setProduct] = useState<ThreadProduct | null>(null);
  const [otherUser, setOtherUser] = useState<ThreadOtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = async () => {
    if (!productId || !otherUserId) return;
    try {
      const res = await client.conversations.getThread(productId, otherUserId);
      setMessages(res?.data?.messages || []);
      setProduct(res?.data?.product || null);
      setOtherUser(res?.data?.other_user || null);
      // Opening a thread marks unread messages as read on the backend,
      // so refresh the header's unread badge right away.
      window.dispatchEvent(new Event('messages:updated'));
    } catch (err) {
      console.error('Error loading thread:', err);
      toast.error('No se pudo cargar la conversación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!content.trim() || !productId || !otherUserId) return;
    setSending(true);
    try {
      await client.entities.messages.create({
        data: {
          receiver_id: otherUserId,
          product_id: parseInt(productId),
          content: content.trim(),
        },
      });
      setContent('');
      await loadThread();
      window.dispatchEvent(new Event('messages:updated'));
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AccountLayout title="Conversación" description="">
      <Link
        to="/cuenta/mensajes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a mensajes
      </Link>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Cargando conversación…</CardContent>
        </Card>
      ) : (
        <Card className="flex flex-col overflow-hidden" style={{ height: '65vh' }}>
          {/* Header: who + which product */}
          <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={otherUser?.avatar_url || undefined} alt={otherUser?.name} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {(otherUser?.name || '?').slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{otherUser?.name || 'Usuario'}</p>
              {product && (
                <Link
                  to={`/producto/${product.id}`}
                  className="text-xs text-muted-foreground hover:text-primary truncate block cursor-pointer"
                >
                  Sobre: {product.title}
                </Link>
              )}
            </div>
            {product?.image && (
              <img src={product.image} alt={product.title} className="h-10 w-10 rounded-md object-cover shrink-0" />
            )}
            {!product?.image && (
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Church className="h-4 w-4 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    m.is_mine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${m.is_mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-border shrink-0 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setContent((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                  className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
                >
                  {phrase}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje…"
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={handleSend}
                disabled={!content.trim() || sending}
                size="icon"
                className="h-10 w-10 shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </AccountLayout>
  );
}
