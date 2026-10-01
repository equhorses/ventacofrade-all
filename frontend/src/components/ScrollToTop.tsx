import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Al entrar en otra página (un anuncio, una categoría…) se empieza arriba del todo.
// Con el botón "atrás" del navegador se respeta donde estabas.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
