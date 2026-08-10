import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { client } from '@/lib/api';
import { MessageCircle } from 'lucide-react';

interface Message {
  id: number;
  receiver_id: string;
  product_id: number;
  content: string;
  is_read: boolean;
  created_at?: string;
}

export default function MensajesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.entities.messages.mine({ sort: '-created_at', limit: 100 });
        setMessages(res?.data?.items || []);
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <AccountLayout title="Mensajes" description="Conversaciones con compradores y vendedores">
      {loading ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground text-sm">Cargando mensajes…</CardContent>
        </Card>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No tienes mensajes todavía</h3>
            <p className="text-sm text-muted-foreground">
              Cuando alguien te escriba sobre uno de tus anuncios, aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Link key={msg.id} to={`/producto/${msg.product_id}`}>
              <Card className={`hover:border-primary/30 transition-colors cursor-pointer ${!msg.is_read ? 'border-primary/40' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      Sobre el anuncio #{msg.product_id}
                    </span>
                    {!msg.is_read && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-primary">Nuevo</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{msg.content}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
