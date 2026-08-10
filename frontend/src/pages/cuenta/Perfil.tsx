import { useState } from 'react';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';

export default function PerfilPage() {
  const { user, refetch } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      await client.users.updateProfile({ name: name.trim() });
      await refetch();
      toast.success('Perfil actualizado');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('No se pudo guardar el perfil. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountLayout title="Mi perfil" description="Gestiona tu información personal">
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-5 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" value={user?.email || ''} disabled />
              <p className="text-xs text-muted-foreground">
                El correo no se puede modificar por ahora.
              </p>
            </div>
            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AccountLayout>
  );
}
