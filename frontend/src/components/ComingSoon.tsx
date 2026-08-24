import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { client } from '@/lib/api';
import { Church, Mail, CheckCircle2, Shirt, Flame, Crown, Scissors } from 'lucide-react';

export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Introduce un email válido');
      return;
    }
    setLoading(true);
    try {
      await client.waitlist.join(email.trim());
      setJoined(true);
      toast.success('¡Te avisaremos en cuanto abramos!');
    } catch (err) {
      toast.error('No se pudo completar el registro. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary/20 flex items-center justify-center">
          <Church className="h-8 w-8 text-secondary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">VentaCofrade</h1>
        <p className="text-lg text-primary-foreground/80 mb-2">
          El marketplace cofrade de referencia
        </p>
        <p className="text-2xl md:text-3xl font-semibold text-secondary mb-6">¡Muy pronto!</p>
        <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">
          Estamos preparando el punto de encuentro para comprar y vender todo lo que necesita
          un cofrade. Déjanos tu email y serás de los primeros en saberlo.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {[
            { icon: Shirt, label: 'Túnicas' },
            { icon: Flame, label: 'Cirios' },
            { icon: Crown, label: 'Orfebrería' },
            { icon: Scissors, label: 'Bordados' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20"
            >
              <Icon className="h-4 w-4 text-secondary" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>

        {joined ? (
          <div className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
            <p className="text-sm">¡Ya estás en la lista! Te avisaremos por email.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-lg px-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="border-0 text-foreground h-12 focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 px-6 cursor-pointer"
            >
              {loading ? 'Enviando…' : 'Avísame'}
            </Button>
          </form>
        )}

        <p className="text-xs text-primary-foreground/50 mt-8">
          <a href="mailto:contacto@ventacofrade.com" className="underline hover:text-primary-foreground">
            contacto@ventacofrade.com
          </a>
          {' · '}
          <a href="/legal/bases-sorteo" className="underline hover:text-primary-foreground">
            Bases del sorteo
          </a>
        </p>
      </div>
    </div>
  );
}
