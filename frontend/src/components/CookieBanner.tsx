import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getConsent, setConsent, loadTrackingScripts } from '@/lib/consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  const handleAccept = () => {
    setConsent('accepted');
    loadTrackingScripts();
    setVisible(false);
  };

  const handleReject = () => {
    setConsent('rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground border-t border-primary-foreground/20 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3">
        <p className="text-sm flex-1 text-center sm:text-left">
          Usamos cookies técnicas necesarias para el funcionamiento de la web y, si nos das
          permiso, cookies de analítica y publicidad (Google, Meta) para medir y mejorar
          nuestras campañas. Consulta nuestra{' '}
          <Link to="/cookies" className="underline hover:text-secondary">
            Política de Cookies
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            onClick={handleReject}
            variant="outline"
            className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 cursor-pointer"
          >
            Rechazar
          </Button>
          <Button
            onClick={handleAccept}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 cursor-pointer"
          >
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
