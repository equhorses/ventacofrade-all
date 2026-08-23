import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { client, type ProfessionalProfile } from '@/lib/api';
import { Briefcase, Upload, X, Trash2 } from 'lucide-react';

const MAX_FILE_SIZE_MB = 5;
const MAX_IMAGES = 6;

const PROVINCES = [
  'Sevilla', 'Málaga', 'Córdoba', 'Granada', 'Cádiz', 'Huelva', 'Jaén', 'Almería',
];

export default function PerfilProfesionalPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    client.professionalProfiles
      .getSpecialties()
      .then(({ data }) => setSpecialties(data))
      .catch((err) => console.error('Error loading specialties:', err));

    client.professionalProfiles
      .getMine()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setBusinessName(data.business_name);
          setSpecialty(data.specialty);
          setDescription(data.description || '');
          setProvince(data.province);
          setCity(data.city || '');
          setPhone(data.phone || '');
          setWhatsapp(data.whatsapp || '');
          setImageUrls(data.portfolio_images ? data.portfolio_images.split(',').filter(Boolean) : []);
        }
      })
      .catch((err) => console.error('Error loading my professional profile:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (imageUrls.length + files.length > MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} fotos de portafolio`);
      return;
    }
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} no es una imagen válida`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} pesa demasiado (máx. ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }
      setUploadingCount((c) => c + 1);
      try {
        const publicUrl = await client.storage.uploadImage(file, 'avatars');
        setImageUrls((prev) => [...prev, publicUrl]);
      } catch (err) {
        console.error('Error uploading image:', err);
        toast.error(`No se pudo subir ${file.name}`);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  };

  const handleRemoveImage = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const handleSave = async () => {
    if (!businessName.trim() || !specialty || !province) {
      toast.error('Rellena al menos el nombre, la especialidad y la provincia');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        specialty,
        description: description.trim() || undefined,
        province,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        portfolio_images: imageUrls.join(','),
      };
      if (profile) {
        const { data } = await client.professionalProfiles.update(profile.id, payload);
        setProfile(data);
        toast.success('Perfil profesional actualizado');
      } else {
        const { data } = await client.professionalProfiles.create(payload);
        setProfile(data);
        toast.success('¡Perfil profesional creado! Ya apareces en la Red Profesional.');
      }
    } catch (err: unknown) {
      console.error('Error saving professional profile:', err);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo guardar el perfil.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;
    if (!confirm('¿Eliminar tu perfil profesional? Dejará de verse en la Red Profesional.')) return;
    try {
      await client.professionalProfiles.remove(profile.id);
      toast.success('Perfil profesional eliminado');
      navigate('/red-profesional');
    } catch (err) {
      console.error('Error deleting professional profile:', err);
      toast.error('No se pudo eliminar el perfil.');
    }
  };

  if (loading) {
    return (
      <AccountLayout title="Mi perfil profesional">
        <p className="text-center text-muted-foreground py-12">Cargando...</p>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout title="Mi perfil profesional">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> Mi perfil profesional
          </h1>
          <p className="text-muted-foreground mt-1">
            Aparece en la Red Profesional para que otros cofrades encuentren tus servicios. Gratis, sin suscripción.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del negocio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre del negocio / taller</label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ej: Taller Bordados San José" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Especialidad</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecciona una especialidad</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cuéntanos qué haces, tu experiencia, especialidades..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Provincia</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Selecciona</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ciudad (opcional)</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej: Sevilla" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Teléfono (opcional)</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="600 000 000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">WhatsApp (opcional)</label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="600 000 000" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Portafolio (fotos de trabajos, opcional)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {imageUrls.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-md" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(url)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={uploadingCount > 0 || imageUrls.length >= MAX_IMAGES}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploadingCount > 0 ? 'Subiendo...' : 'Añadir fotos'}
              </Button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button disabled={saving} onClick={handleSave} className="cursor-pointer">
                {profile ? 'Guardar cambios' : 'Crear mi perfil'}
              </Button>
              {profile && (
                <Button variant="ghost" className="text-destructive cursor-pointer" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar perfil
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AccountLayout>
  );
}
