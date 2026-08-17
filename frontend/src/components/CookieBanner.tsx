import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'vc_cookies_accepted';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground border-t border-primary-foreground/20 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3">
        <p className="text-sm flex-1 text-center sm:text-left">
          Usamos cookies técnicas necesarias para el funcionamiento de la web y para procesar
          pagos de forma segura. Consulta nuestra{' '}
          <Link to="/cookies" className="underline hover:text-secondary">
            Política de Cookies
          </Link>
          .
        </p>
        <Button
          onClick={handleAccept}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/90 cursor-pointer shrink-0"
        >
          Entendido
        </Button>
      </div>
    </div>
  );
}
