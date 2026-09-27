import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/auth';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';

export default function RecuperarContrasenaPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setSent(await authApi.forgotPassword(email.trim()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>¿Has olvidado tu contraseña?</CardTitle>
            <CardDescription>Escribe el email de tu cuenta y te mandamos un enlace para crear una nueva.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-sm">
                <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
                  <MailCheck className="h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p>{sent}</p>
                    <p className="text-green-800/80">
                      Mira también en la carpeta de spam o promociones. El enlace caduca en 1 hora.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setSent(null)}>
                  No me ha llegado, enviar otra vez
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando…' : 'Enviarme el enlace'}
                </Button>
              </form>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline underline-offset-2">
                Volver a iniciar sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
