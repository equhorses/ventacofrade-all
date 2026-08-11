import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { client } from '@/lib/api';
import { MessageCircle, Church } from 'lucide-react';

interface Conversation {
  product_id: number;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  product_title: string;
  product_image: string | null;
  last_message: string;
  last_message_at: string | null;
  last_message_is_mine: boolean;
  unread_count: number;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return date.toLocaleDateString('es-ES');
}

export default function MensajesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.conversations.list();
        setConversations(res?.data || []);
      } catch (err) {
        console.error('Error loading conversations:', err);
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
      ) : conversations.length === 0 ? (
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
        <div className="space-y-2">
          {conversations.map((c) => (
            <Link key={`${c.product_id}-${c.other_user_id}`} to={`/cuenta/mensajes/${c.product_id}/${c.other_user_id}`}>
              <Card
                className={`hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer ${
                  c.unread_count > 0 ? 'border-primary/40 bg-primary/[0.02]' : ''
                }`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={c.other_user_avatar || undefined} alt={c.other_user_name} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {c.other_user_name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">{c.other_user_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-0.5">Sobre: {c.product_title}</p>
                    <p className={`text-sm truncate ${c.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {c.last_message_is_mine && <span className="text-muted-foreground">Tú: </span>}
                      {c.last_message}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="h-10 w-10 rounded-md bg-muted overflow-hidden">
                      {c.product_image ? (
                        <img src={c.product_image} alt={c.product_title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Church className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    {c.unread_count > 0 && (
                      <Badge className="bg-primary text-primary-foreground h-5 min-w-5 px-1.5 justify-center">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
