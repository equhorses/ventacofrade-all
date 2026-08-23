import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { client, type ProfessionalProfile } from '@/lib/api';
import { MapPin, Phone, MessageCircle, ArrowLeft } from 'lucide-react';

export default function ProfesionalDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    client.professionalProfiles
      .get(Number(id))
      .then(({ data }) => setProfile(data))
      .catch((err) => console.error('Error loading professional profile:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center text-muted-foreground">Cargando...</div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center text-muted-foreground">
          Perfil profesional no encontrado.
        </div>
      </Layout>
    );
  }

  const images = profile.portfolio_images ? profile.portfolio_images.split(',').filter(Boolean) : [];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/red-profesional" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> Volver a Red Profesional
        </Link>

        <Badge className="mb-3 bg-primary/10 text-primary">{profile.specialty}</Badge>
        <h1 className="text-3xl font-bold text-foreground mb-2">{profile.business_name}</h1>
        <p className="text-muted-foreground flex items-center gap-1 mb-6">
          <MapPin className="h-4 w-4" /> {profile.city ? `${profile.city}, ` : ''}{profile.province}
        </p>

        {profile.description && (
          <p className="text-foreground mb-8 whitespace-pre-line">{profile.description}</p>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {images.map((url, i) => (
              <img key={i} src={url} alt={`Trabajo ${i + 1}`} className="w-full aspect-square object-cover rounded-md" />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {profile.phone && (
            <a href={`tel:${profile.phone}`}>
              <Button variant="outline" className="cursor-pointer">
                <Phone className="h-4 w-4 mr-2" /> {profile.phone}
              </Button>
            </a>
          )}
          {profile.whatsapp && (
            <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              <Button className="cursor-pointer bg-green-600 hover:bg-green-700">
                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
              </Button>
            </a>
          )}
        </div>
      </div>
    </Layout>
  );
}
