import { useState } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { client } from '@/lib/api';
import { toggleFavorite, useIsFavorite } from '@/lib/favorites';

// Corazón para guardar un anuncio en favoritos. Va encima de la foto de la tarjeta (que es un enlace),
// así que el clic no abre el anuncio.
export default function FavoriteButton({ productId, className = '' }: { productId: number; className?: string }) {
  const isFav = useIsFavorite(productId);
  const [busy, setBusy] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const saved = await toggleFavorite(productId);
      toast.success(saved ? 'Guardado en favoritos' : 'Quitado de favoritos');
    } catch (err) {
      if (err instanceof Error && err.message === 'login') {
        toast.info('Inicia sesión para guardar favoritos');
        client.auth.toLogin();
      } else {
        toast.error('No se pudo guardar. Inténtalo de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      aria-pressed={isFav}
      title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className={`h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${className}`}
    >
      <Heart className={`h-5 w-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-foreground/70'}`} />
    </button>
  );
}
