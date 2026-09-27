import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';

// Cualquier dirección que no existe: antes se veía una página en blanco.
export default function NoEncontradaPage() {
  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-5">
        <SearchX className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Esta página no existe</h1>
        <p className="text-muted-foreground">Puede que el enlace esté mal escrito o que la página ya no esté disponible.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">Ir al inicio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/explorar">Ver anuncios</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/publicar">Publicar gratis</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
