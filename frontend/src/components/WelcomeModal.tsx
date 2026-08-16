import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper } from 'lucide-react';

export default function WelcomeModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      setOpen(true);
    }
  }, [searchParams]);

  const handleClose = () => {
    setOpen(false);
    searchParams.delete('welcome');
    setSearchParams(searchParams, { replace: true });
  };

  const handleGoToVender = () => {
    handleClose();
    navigate('/vender');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <PartyPopper className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">¡Bienvenido a VentaCofrade!</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Tu cuenta ya está lista. Explora orfebrería, bordados, túnicas y mucho más, o activa
            tu tienda de vendedor para empezar a publicar tus propios anuncios.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={handleClose}>
            Seguir explorando
          </Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90 cursor-pointer" onClick={handleGoToVender}>
            Ver planes de vendedor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
