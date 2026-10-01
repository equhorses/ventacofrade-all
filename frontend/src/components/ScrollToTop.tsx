import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Cada página se abre arriba del todo: al entrar, al recargar (F5) y al pulsar enlaces.
// Solo al volver atrás con el navegador se vuelve a donde estabas en la página anterior.
const savedPositions = new Map<string, number>();

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  // El navegador ya no recoloca la página por su cuenta (lo hacemos nosotros).
  window.history.scrollRestoration = 'manual';
}

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const firstLoad = useRef(true);

  useEffect(() => {
    const key = location.key;
    const saved = savedPositions.get(key);
    if (!firstLoad.current && navigationType === 'POP' && saved !== undefined) {
      // Volver atrás: esperamos a que la página pinte su contenido y recolocamos.
      const timer = window.setTimeout(() => window.scrollTo(0, saved), 250);
      firstLoad.current = false;
      return () => {
        window.clearTimeout(timer);
        savedPositions.set(key, window.scrollY);
      };
    }
    firstLoad.current = false;
    window.scrollTo(0, 0);
    return () => {
      savedPositions.set(key, window.scrollY);
    };
  }, [location.key, navigationType]);

  return null;
}
