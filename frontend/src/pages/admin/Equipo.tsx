import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { client, type StaffMember } from '@/lib/api';
import { UserCog, Send } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Super admin' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'moderacion', label: 'Moderación' },
  { value: 'soporte', label: 'Soporte' },
];

const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  marketing: 'bg-pink-100 text-pink-700',
  seguridad: 'bg-red-100 text-red-700',
  moderacion: 'bg-blue-100 text-blue-700',
  soporte: 'bg-green-100 text-green-700',
};

export default function AdminEquipoPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('marketing');
  const [assigning, setAssigning] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const { data } = await client.admin.listStaff();
      setStaff(data);
    } catch (err) {
      console.error('Error loading staff:', err);
      toast.error('No se pudo cargar el equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAssigning(true);
    try {
      const { data } = await client.admin.assignRole(email.trim(), role);
      setStaff((prev) => {
        const withoutThis = prev.filter((s) => s.email !== data.email);
        return [...withoutThis, data].sort((a, b) => a.email.localeCompare(b.email));
      });
      setEmail('');
      toast.success(`${data.email} ahora tiene el rol "${data.role_label}"`);
    } catch (err: unknown) {
      console.error('Error assigning role:', err);
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo asignar el rol.';
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (member: StaffMember) => {
    setAssigning(true);
    try {
      await client.admin.assignRole(member.email, 'user');
      setStaff((prev) => prev.filter((s) => s.email !== member.email));
      toast.success(`${member.email} ya no tiene acceso al panel`);
    } catch (err: unknown) {
      console.error('Error revoking role:', err);
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo quitar el acceso.';
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Equipo y roles</h1>
        <p className="text-muted-foreground">
          Da acceso al panel interno a otras personas del equipo, según su función.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Asignar rol
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAssign} className="flex flex-wrap gap-2 items-center mb-2">
            <Input
              type="email"
              required
              placeholder="email@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={assigning}>
              <Send className="h-4 w-4 mr-1" /> Asignar
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            La persona debe haber iniciado sesión al menos una vez en la web para poder asignarle un rol.
            El cambio se aplica la próxima vez que esa persona inicie sesión.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? 'Cargando...' : `${staff.length} persona(s) con acceso al panel`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="font-medium">{member.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGE_CLASSES[member.role] || 'bg-muted text-muted-foreground'}>
                      {member.role_label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={assigning}
                      onClick={() => handleRevoke(member)}
                    >
                      Quitar acceso
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Solo tú tienes acceso al panel por ahora.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
