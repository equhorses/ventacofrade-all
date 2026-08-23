import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { client, type ProfessionalProfile } from '@/lib/api';
import { Search, MapPin, Briefcase, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function firstImage(images?: string | null): string | null {
  if (!images) return null;
  const first = images.split(',').map((s) => s.trim()).filter(Boolean)[0];
  return first || null;
}

export default function RedProfesionalPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const selectedSpecialty = searchParams.get('especialidad') || '';

  useEffect(() => {
    client.professionalProfiles
      .getSpecialties()
      .then(({ data }) => setSpecialties(data))
      .catch((err) => console.error('Error loading specialties:', err));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await client.professionalProfiles.list({
          specialty: selectedSpecialty || undefined,
          search: searchParams.get('q') || undefined,
          limit: 24,
        });
        setProfiles(data.items);
        setTotal(data.total);
      } catch (err) {
        console.error('Error loading professional profiles:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedSpecialty, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    setSearchParams(params);
  };

  const handleSpecialtyClick = (specialty: string) => {
    const params = new URLSearchParams(searchParams);
    if (specialty === selectedSpecialty) params.delete('especialidad');
    else params.set('especialidad', specialty);
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" /> Red Profesional
            </h1>
            <p className="text-muted-foreground mt-1">
              Talleres, artesanos y profesionales del mundo cofrade. {total} perfiles.
            </p>
          </div>
          {user && (
            <Link to="/cuenta/perfil-profesional">
              <Button className="cursor-pointer">
                <Plus className="h-4 w-4 mr-2" /> Crear mi perfil profesional
              </Button>
            </Link>
          )}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mb-6">
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => handleSpecialtyClick('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              !selectedSpecialty ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Todas
          </button>
          {specialties.map((s) => (
            <button
              key={s}
              onClick={() => handleSpecialtyClick(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                selectedSpecialty === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Cargando...</p>
        ) : profiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((p) => (
              <Link key={p.id} to={`/profesional/${p.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      {firstImage(p.portfolio_images) ? (
                        <img
                          src={firstImage(p.portfolio_images)!}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{p.business_name}</h3>
                        <Badge className="bg-primary/10 text-primary">{p.specialty}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5" /> {p.city ? `${p.city}, ` : ''}{p.province}
                    </p>
                    {p.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Todavía no hay profesionales registrados.</p>
            {user && (
              <Link to="/cuenta/perfil-profesional">
                <Button variant="outline" className="cursor-pointer">
                  Sé el primero en crear tu perfil
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
