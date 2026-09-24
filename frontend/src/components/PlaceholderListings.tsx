import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shirt,
  Flame,
  Crown,
  Scissors,
  Church,
  Medal,
  Music,
  Gem,
  Landmark,
  Package,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';

// Tarjetas de relleno para que la web no se vea vacía mientras llegan anuncios.
// Solo existen en el navegador: no están en la base de datos, ni en el sitemap,
// ni en lo que leen los buscadores. Se muestran únicamente para completar huecos
// y desaparecen solas cuando hay suficientes anuncios reales.
//
// Dos tipos, ambos honestos:
//  - "example": artículo típico de la categoría, con la etiqueta "Ejemplo" visible.
//  - "invite": invitación a publicar ("¿Tienes una túnica guardada?").
// Ninguna muestra precio ni se puede contactar: todas llevan a publicar.

type PlaceholderKind = 'example' | 'invite';

export interface PlaceholderItem {
  key: string;
  kind: PlaceholderKind;
  title: string;
  categorySlug: string;
}

const ICONS: Record<string, LucideIcon> = {
  'tunicas-capirotes': Shirt,
  'cirios-velas': Flame,
  orfebreria: Crown,
  bordados: Scissors,
  'imagenes-figuras': Church,
  'insignias-medallas': Medal,
  'instrumentos-musicales': Music,
  complementos: Gem,
  pasos: Landmark,
  otros: Package,
};

const BY_CATEGORY: Record<string, { examples: string[]; invites: string[] }> = {
  'tunicas-capirotes': {
    examples: ['Túnica de nazareno de ruán', 'Capirote de rejilla', 'Túnica de niño con capa', 'Antifaz de terciopelo'],
    invites: ['¿Tienes una túnica guardada?', 'Esa túnica que ya no usas, aquí', 'Vende tu capirote de otros años'],
  },
  'cirios-velas': {
    examples: ['Lote de cirios de nazareno', 'Velas de candelería', 'Cirio rizado artesanal', 'Cera para guardabrisas'],
    invites: ['¿Cirios de otros años? Aquí tienen salida', 'Vende la cera que te sobró'],
  },
  orfebreria: {
    examples: ['Candelabro de metal plateado', 'Jarra de plata para paso', 'Cruz de guía', 'Corona de plata sobredorada'],
    invites: ['¿Tienes orfebrería que ya no usas?', 'Tu pieza de plata, aquí'],
  },
  bordados: {
    examples: ['Escudo bordado en oro', 'Saya bordada', 'Estandarte bordado', 'Pañuelo bordado'],
    invites: ['Vende ese bordado que tienes guardado', '¿Bordados sin uso? Publícalos aquí'],
  },
  'imagenes-figuras': {
    examples: ['Imagen de candelero', 'Crucificado de madera', 'Figura de Virgen en resina', 'Relieve policromado'],
    invites: ['¿Tienes una imagen religiosa para vender?', 'Tu figura religiosa, aquí'],
  },
  'insignias-medallas': {
    examples: ['Medalla de hermandad con cordón', 'Medalla antigua de plata', 'Insignia de hermandad', 'Broche conmemorativo'],
    invites: ['Tu medalla de hermandad, aquí', '¿Medallas antiguas guardadas?'],
  },
  'instrumentos-musicales': {
    examples: ['Corneta de pistones', 'Caja de banda', 'Trompeta en Si bemol', 'Bombo de agrupación'],
    invites: ['¿Tu banda renueva instrumentos?', 'Vende el instrumento que ya no tocas'],
  },
  complementos: {
    examples: ['Cíngulo de hermandad', 'Fajín cofrade', 'Costal y faja de costalero', 'Guantes blancos de nazareno'],
    invites: ['¿Complementos que ya no usas?', 'Vende tu costal y tu faja'],
  },
  pasos: {
    examples: ['Faroles de paso', 'Respiradero tallado', 'Candelabros de guardabrisa', 'Paso de cruz de mayo'],
    invites: ['¿Tu hermandad estrena y vende lo anterior?', 'Elementos de paso con segunda vida'],
  },
  otros: {
    examples: ['Rosario antiguo', 'Estampas religiosas antiguas', 'Libro de reglas antiguo', 'Relicario'],
    invites: ['¿Algo religioso o cofrade que vender?', 'Tu colección religiosa, aquí'],
  },
};

const CATEGORY_ORDER = Object.keys(BY_CATEGORY);

function itemsForCategory(slug: string): PlaceholderItem[] {
  const data = BY_CATEGORY[slug];
  if (!data) return [];
  const result: PlaceholderItem[] = [];
  const max = Math.max(data.examples.length, data.invites.length);
  // Alterna ejemplo / invitación para que la rejilla se vea variada.
  for (let i = 0; i < max; i++) {
    if (data.examples[i]) result.push({ key: `${slug}-e${i}`, kind: 'example', title: data.examples[i], categorySlug: slug });
    if (data.invites[i]) result.push({ key: `${slug}-i${i}`, kind: 'invite', title: data.invites[i], categorySlug: slug });
  }
  return result;
}

function mixedItems(): PlaceholderItem[] {
  // Para "todas": recorre las categorías por rondas y alterna ejemplo / invitación,
  // para que la portada y Explorar muestren variedad de categorías y de tipos.
  const examples: PlaceholderItem[] = [];
  const invites: PlaceholderItem[] = [];
  const perCategory = CATEGORY_ORDER.map(itemsForCategory);
  const rounds = Math.max(...perCategory.map((list) => list.length));
  for (let r = 0; r < rounds; r++) {
    for (const list of perCategory) {
      const item = list[r];
      if (!item) continue;
      (item.kind === 'example' ? examples : invites).push(item);
    }
  }
  const result: PlaceholderItem[] = [];
  while (examples.length || invites.length) {
    if (examples.length) result.push(examples.shift() as PlaceholderItem);
    if (invites.length) result.push(invites.shift() as PlaceholderItem);
  }
  return result;
}

/**
 * Devuelve las tarjetas de relleno necesarias para llegar a `target` elementos.
 * Con `realCount >= target` devuelve una lista vacía.
 */
export function getPlaceholders(categorySlug: string | null | undefined, realCount: number, target: number): PlaceholderItem[] {
  const missing = target - realCount;
  if (missing <= 0) return [];
  const pool = categorySlug && BY_CATEGORY[categorySlug] ? itemsForCategory(categorySlug) : mixedItems();
  return pool.slice(0, missing);
}

export function PlaceholderCard({ item }: { item: PlaceholderItem }) {
  const Icon = ICONS[item.categorySlug] || Package;
  const isExample = item.kind === 'example';
  return (
    <Link to={`/publicar?categoria=${item.categorySlug}`} className="group cursor-pointer">
      <Card className="overflow-hidden border border-dashed border-primary/30 hover:border-primary/60 hover:shadow-lg transition-all duration-200 group-hover:-translate-y-1 h-full">
        <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/20 flex items-center justify-center">
          {isExample ? (
            <Icon className="h-14 w-14 text-primary/40 group-hover:scale-110 transition-transform duration-300" aria-hidden="true" />
          ) : (
            <PlusCircle className="h-14 w-14 text-primary/50 group-hover:scale-110 transition-transform duration-300" aria-hidden="true" />
          )}
          {isExample && (
            <Badge variant="outline" className="absolute top-2 left-2 bg-white/90 text-xs text-muted-foreground">
              Ejemplo
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-base font-semibold text-primary">
            {isExample ? 'Publica algo así gratis' : 'Publicar gratis'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Sin comisiones por venta</p>
        </CardContent>
      </Card>
    </Link>
  );
}
