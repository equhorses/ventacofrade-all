import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { client } from '@/lib/api';
import { Heart, Church, MapPin } from 'lucide-react';

interface Product {
  id: number;
  title: string;
  price: number;
  images: string;
  location_city?: string;
  location_province?: string;
}

export default function FavoritosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const favRes = await client.entities.favorites.mine({ sort: '-created_at', limit: 100 });
        const favorites = favRes?.data?.items || [];

        const results = await Promise.all(
          favorites.map(async (fav: { product_id: number }) => {
            try {
              const productRes = await client.entities.products.get({ id: fav.product_id });
              return productRes.data;
            } catch {
              return null;
            }
          })
        );

        setProducts(results.filter(Boolean) as Product[]);
      } catch (err) {
        console.error('Error loading favorites:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <AccountLayout title="Favoritos" description="Artículos que has guardado para más tarde">
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
            <Heart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Sin favoritos todavía</h3>
            <p className="text-sm text-muted-foreground">
              Toca el corazón de un anuncio para guardarlo aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((product) => (
            <Link key={product.id} to={`/producto/${product.id}`}>
              <Card className="hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
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
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{product.title}</p>
                    <p className="text-primary font-semibold text-sm mt-0.5">
                      {product.price?.toFixed(2)} €
                    </p>
                    {(product.location_city || product.location_province) && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {product.location_city || product.location_province}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
