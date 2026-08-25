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
import { client, type AdminProduct } from '@/lib/api';
import { Search, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-700' },
  sold: { label: 'Vendido', className: 'bg-muted text-muted-foreground' },
  paused: { label: 'Pausado por el vendedor', className: 'bg-amber-100 text-amber-700' },
  removed: { label: 'Retirado por moderación', className: 'bg-red-100 text-red-700' },
};

const PAGE_SIZE = 50;

export default function AdminAnunciosPage() {
  const { user, isSuperAdmin } = useAuth();
  const canModerate = isSuperAdmin || user?.role === 'moderacion';
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [actingId, setActingId] = useState<number | null>(null);

  const loadProducts = async (query?: string, offset = 0) => {
    setLoading(true);
    try {
      const { data } = await client.admin.listProducts({ search: query, skip: offset, limit: PAGE_SIZE });
      setProducts(data.items);
      setTotal(data.total);
      setSkip(offset);
    } catch (err) {
      console.error('Error loading products:', err);
      toast.error('No se pudo cargar la lista de anuncios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(search.trim() || undefined, 0);
  };

  const handleRemove = async (product: AdminProduct) => {
    if (!confirm(`¿Retirar "${product.title}" de la web? El vendedor podrá verlo como retirado.`)) return;
    setActingId(product.id);
    try {
      const { data } = await client.admin.removeProduct(product.id);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: data.status } : p)));
      toast.success('Anuncio retirado');
    } catch (err) {
      console.error('Error removing product:', err);
      toast.error('No se pudo retirar el anuncio.');
    } finally {
      setActingId(null);
    }
  };

  const handleRestore = async (product: AdminProduct) => {
    setActingId(product.id);
    try {
      const { data } = await client.admin.restoreProduct(product.id);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: data.status } : p)));
      toast.success('Anuncio restaurado');
    } catch (err) {
      console.error('Error restoring product:', err);
      toast.error('No se pudo restaurar el anuncio.');
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (product: AdminProduct) => {
    if (!confirm(`¿Eliminar "${product.title}" PARA SIEMPRE? Esto no se puede deshacer.`)) return;
    setActingId(product.id);
    try {
      await client.admin.deleteProductAdmin(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setTotal((prev) => prev - 1);
      toast.success('Anuncio eliminado permanentemente');
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('No se pudo eliminar el anuncio.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Anuncios</h1>
          <p className="text-muted-foreground">Modera las publicaciones de la web.</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{loading ? 'Cargando...' : `${total} anuncio(s)`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anuncio</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {p.title}
                      {p.featured_until && new Date(p.featured_until) > new Date() && (
                        <Badge className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-normal">
                          Destacado hasta {new Date(p.featured_until).toLocaleDateString('es-ES')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.seller_email || '—'}</TableCell>
                    <TableCell>{p.price.toFixed(2)}€</TableCell>
                    <TableCell>
                      <Badge className={STATUS_LABELS[p.status || 'active']?.className || 'bg-muted'}>
                        {STATUS_LABELS[p.status || 'active']?.label || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!canModerate ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {p.status === 'removed' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === p.id}
                              onClick={() => handleRestore(p)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actingId === p.id}
                              onClick={() => handleRemove(p)}
                            >
                              <EyeOff className="h-3 w-3 mr-1" /> Retirar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={actingId === p.id}
                            onClick={() => handleDelete(p)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No se encontraron anuncios.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={skip === 0 || loading}
                  onClick={() => loadProducts(search.trim() || undefined, Math.max(0, skip - PAGE_SIZE))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={skip + PAGE_SIZE >= total || loading}
                  onClick={() => loadProducts(search.trim() || undefined, skip + PAGE_SIZE)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
