import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/auth';
import { toast } from 'sonner';

export default function RestablecerContrasenaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== repeat) {
      toast.error('Las dos contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      toast.success('Contraseña cambiada. ¡Ya estás dentro!');
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Crea una contraseña nueva</CardTitle>
            <CardDescription>Elige una contraseña de al menos 8 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            {!token || error ? (
              <div className="space-y-4 text-sm">
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
                  {error || 'Falta el enlace. Pide uno nuevo.'}
                </p>
                <Button asChild className="w-full">
                  <Link to="/recuperar-contrasena">Pedir un enlace nuevo</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña nueva</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeat">Repite la contraseña</Label>
                  <Input
                    id="repeat"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Guardando…' : 'Guardar y entrar'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
