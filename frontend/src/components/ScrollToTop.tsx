import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Cada página se abre arriba del todo (al entrar, al pulsar enlaces y al recargar).
// Al volver atrás con el navegador o el móvil, se vuelve exactamente a donde estabas.
//
// La posición de cada página se guarda mientras se usa y en el momento de pulsar un enlace,
// antes de que cargue la página siguiente (si se leyera después, la página nueva, más corta
// mientras carga, ya la habría recortado).

const STORAGE_KEY = 'vc_scroll_positions';
const MAX_WAIT_MS = 5000;

let currentKey = '';
let frozen = false; // mientras se cambia de página no se apunta nada
let firstRun = true;

// Al recargar (F5) se empieza arriba; solo se recoloca al volver con "atrás" desde otra web.
function cameBackFromOtherSite(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}

function readStore(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

const positions: Record<string, number> = typeof window !== 'undefined' ? readStore() : {};

function save(key: string, y: number) {
  if (!key) return;
  positions[key] = Math.max(0, Math.round(y));
  try {
    const keys = Object.keys(positions);
    if (keys.length > 60) delete positions[keys[0]];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // sin almacenamiento: se guarda solo en memoria
  }
}

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  window.addEventListener(
    'scroll',
    () => {
      if (!frozen) save(currentKey, window.scrollY);
    },
    { passive: true },
  );
  // Justo al pulsar un enlace (antes de cambiar de página) se apunta dónde estabas.
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (link && !frozen) save(currentKey, window.scrollY);
    },
    true,
  );
}

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    currentKey = location.key;
    frozen = true;
    const isBack = navigationType === 'POP' && (!firstRun || cameBackFromOtherSite());
    firstRun = false;
    const target = isBack ? positions[location.key] : undefined;

    if (!target) {
      window.scrollTo(0, 0);
      const t = window.setTimeout(() => {
        frozen = false;
      }, 50);
      return () => window.clearTimeout(t);
    }

    // Volver atrás: la lista puede tardar en pintarse; se reintenta hasta llegar a la posición.
    let stopped = false;
    const started = Date.now();
    const stop = () => {
      stopped = true;
      frozen = false;
    };
    const userMoved = () => stop();
    window.addEventListener('touchstart', userMoved, { passive: true, once: true });
    window.addEventListener('wheel', userMoved, { passive: true, once: true });

    const tick = () => {
      if (stopped) return;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(target, Math.max(0, maxY)));
      if (maxY >= target - 2 || Date.now() - started > MAX_WAIT_MS) {
        stop();
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();

    return () => {
      stopped = true;
      window.removeEventListener('touchstart', userMoved);
      window.removeEventListener('wheel', userMoved);
    };
  }, [location.key, navigationType]);

  return null;
}
