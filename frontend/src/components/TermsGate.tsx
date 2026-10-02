import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

// A quien tenga cuenta y no haya aceptado la versión vigente de los Términos y el Aviso Legal
// (cuentas antiguas, o cuando se actualizan) se le pide que los acepte antes de seguir.
// Las páginas legales se pueden leer sin aceptar.
export default function TermsGate() {
  const { user, setUser, logout } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const pending = !!user && !!user.terms_required_version && user.terms_version !== user.terms_required_version;
  if (!pending || location.pathname.startsWith('/legal/') || location.pathname.startsWith('/auth/')) return null;

  const accept = async () => {
    setSaving(true);
    try {
      const updated = await authApi.acceptTerms();
      setUser(updated);
      toast.success('¡Gracias! Ya puedes seguir');
    } catch {
      toast.error('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <ScrollText className="h-5 w-5" />
          <h2 id="terms-gate-title" className="text-lg font-semibold text-foreground">
            Hemos actualizado nuestras condiciones
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para seguir usando VentaCofrade necesitamos que aceptes los Términos y el Aviso Legal. Lo más importante:
          podremos usar las fotos y textos de tus anuncios para promocionarlos en la web, redes sociales y
          publicidad (así llegan a más compradores).
        </p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          <span>
            Acepto los{' '}
            <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              Términos y Condiciones
            </a>{' '}
            y el{' '}
            <a href="/legal/aviso-legal" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              Aviso Legal
            </a>
            , y he leído la{' '}
            <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              Política de Privacidad
            </a>
            .
          </span>
        </label>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => logout().then(() => (window.location.href = '/'))} className="cursor-pointer">
            Cerrar sesión
          </Button>
          <Button onClick={accept} disabled={!checked || saving} className="cursor-pointer">
            {saving ? 'Guardando…' : 'Aceptar y continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
