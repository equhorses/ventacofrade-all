import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/api';
import { Church, Plus, Eye, Trash2 } from 'lucide-react';

interface Product {
  id: number;
  title: string;
  price: number;
  images: string;
  status: string;
  views_count: number;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-700' },
  sold: { label: 'Vendido', className: 'bg-muted text-muted-foreground' },
  paused: { label: 'Pausado', className: 'bg-amber-100 text-amber-700' },
};

export default function MisAnunciosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.entities.products.mine({ sort: '-created_at', limit: 100 });
      setProducts(res?.data?.items || []);
    } catch (err) {
      console.error('Error loading my products:', err);
      toast.error('No se pudieron cargar tus anuncios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar este anuncio? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      await client.entities.products.delete({ id });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Anuncio eliminado');
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('No se pudo eliminar el anuncio');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AccountLayout title="Mis anuncios" description="Gestiona los artículos que has publicado">
      <div className="flex justify-end mb-4">
        <Link to="/publicar">
          <Button size="sm" className="gap-1 cursor-pointer">
            <Plus className="h-4 w-4" />
            Publicar anuncio
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Church className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Aún no tienes anuncios</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Publica tu primer artículo y llegará a toda la comunidad cofrade.
            </p>
            <Link to="/publicar">
              <Button className="cursor-pointer">Publicar mi primer anuncio</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const status = statusLabels[product.status || 'active'] || statusLabels.active;
            return (
              <Card key={product.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-md bg-muted overflow-hidden shrink-0">
                    {product.images ? (
                      <img
                        src={product.images.split(',')[0]}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Church className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/producto/${product.id}`}
                      className="font-medium text-foreground truncate block hover:text-primary cursor-pointer"
                    >
                      {product.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-primary font-semibold text-sm">
                        {product.price?.toFixed(2)} €
                      </span>
                      <Badge className={`text-xs font-normal ${status.className}`}>{status.label}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {product.views_count ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/producto/${product.id}`}>
                      <Button variant="ghost" size="icon" className="cursor-pointer" title="Ver anuncio">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      title="Eliminar anuncio"
                      disabled={deletingId === product.id}
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccountLayout>
  );
}
