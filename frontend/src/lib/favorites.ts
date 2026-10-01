import { useEffect, useState } from 'react';
import { client } from '@/lib/api';
import { getStoredToken } from '@/lib/auth';

// Favoritos del usuario, compartidos por toda la web (tarjetas, ficha del anuncio, Mis favoritos).
// Se cargan una vez y se actualizan al pulsar el corazón en cualquier sitio.

const EVENT = 'favorites:updated';
let favorites: Map<number, number> | null = null; // product_id -> id del favorito
let loading: Promise<Map<number, number>> | null = null;

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

export function loadFavorites(force = false): Promise<Map<number, number>> {
  if (!getStoredToken()) {
    favorites = new Map();
    return Promise.resolve(favorites);
  }
  if (favorites && !force) return Promise.resolve(favorites);
  if (loading && !force) return loading;
  loading = client.entities.favorites
    .mine({ limit: 2000 })
    .then((res) => {
      const map = new Map<number, number>();
      for (const fav of (res?.data?.items || []) as { id: number; product_id: number }[]) {
        map.set(fav.product_id, fav.id);
      }
      favorites = map;
      emit();
      return map;
    })
    .catch(() => {
      favorites = new Map();
      return favorites;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Guarda o quita un favorito. Devuelve el estado final, o lanza 'login' si no hay sesión. */
export async function toggleFavorite(productId: number): Promise<boolean> {
  if (!getStoredToken()) throw new Error('login');
  const map = await loadFavorites();
  const existing = map.get(productId);
  if (existing) {
    map.delete(productId);
    emit();
    try {
      await client.entities.favorites.delete({ id: existing });
    } catch (err) {
      map.set(productId, existing);
      emit();
      throw err;
    }
    return false;
  }
  map.set(productId, -1); // se pinta lleno al momento
  emit();
  try {
    const { data } = await client.entities.favorites.create({ data: { product_id: productId } });
    map.set(productId, (data as { id: number }).id);
    emit();
    return true;
  } catch (err) {
    map.delete(productId);
    emit();
    throw err;
  }
}

export function useIsFavorite(productId: number): boolean {
  const [isFav, setIsFav] = useState(() => Boolean(favorites?.has(productId)));
  useEffect(() => {
    const update = () => setIsFav(Boolean(favorites?.has(productId)));
    window.addEventListener(EVENT, update);
    loadFavorites().then(update);
    return () => window.removeEventListener(EVENT, update);
  }, [productId]);
  return isFav;
}
