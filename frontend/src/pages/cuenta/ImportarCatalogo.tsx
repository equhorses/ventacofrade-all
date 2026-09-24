import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { client, type CatalogImportStatus } from '@/lib/api';
import { CheckCircle2, ChevronDown, ChevronUp, Crown, Download, Globe, ImageOff, Loader2 } from 'lucide-react';

// Importar el catálogo desde la web propia del vendedor (Shopify, WooCommerce o cualquier web).

const PROVINCES = [
  'Sevilla', 'Málaga', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Almería',
  'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Otra',
];
const BATCH = 20;
const DRAFT_KEY = 'vc_catalog_import_draft';

interface Category {
  id: number;
  name: string;
}

interface Row {
  key: string;
  selected: boolean;
  already: boolean;
  title: string;
  description: string;
  price: string;
  category_id: string;
  condition: string;
  images: string[];
  open: boolean;
}

type Phase = 'start' | 'working' | 'review' | 'done';

function errorDetail(err: unknown, fallback: string) {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

function parsePrice(value: string): number | null {
  let t = value.replace(/\s|€/g, '');
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const missing = (r: Row) =>
  [r.title.trim().length < 3 && 'título', !parsePrice(r.price) && 'precio', !r.category_id && 'categoría'].filter(
    Boolean,
  ) as string[];

const SOURCE_LABEL = { shopify: 'tu tienda Shopify', woocommerce: 'tu tienda WooCommerce', web: 'tu web' };

export default function ImportarCatalogoPage() {
  const [status, setStatus] = useState<CatalogImportStatus | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [phase, setPhase] = useState<Phase>('start');
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkCondition, setBulkCondition] = useState('');
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<{ created: number; withoutPhotos: number; vacation: boolean } | null>(null);

  useEffect(() => {
    Promise.all([client.catalogImport.status(), client.entities.categories.query({ sort: 'order_index', limit: 50 })])
      .then(([s, c]) => {
        setStatus(s.data);
        setCategories(c?.data?.items || []);
        setUrl(s.data.website || '');
        try {
          const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
          if (draft?.rows?.length) {
            setRows(draft.rows);
            setProvince(draft.province || '');
            setCity(draft.city || '');
            setPhase('review');
            toast.info('Hemos recuperado la importación que tenías a medias');
            return;
          }
        } catch {
          // borrador ilegible
        }
        setProvince(s.data.province && PROVINCES.includes(s.data.province) ? s.data.province : '');
        setCity(s.data.city || '');
      })
      .catch(() => toast.error('No se pudo cargar la importación'));
  }, []);

  useEffect(() => {
    try {
      if (phase === 'review' && rows.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, province, city }));
    } catch {
      // sin almacenamiento
    }
  }, [rows, province, city, phase]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // nada
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const incomplete = selectedRows.filter((r) => missing(r).length > 0).length;

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const search = async () => {
    if (!owner) {
      toast.error('Confirma que el catálogo es tuyo');
      return;
    }
    setPhase('working');
    setProgress({ label: 'Buscando productos en tu web… (puede tardar hasta un minuto)', value: 30 });
    try {
      const { data } = await client.catalogImport.fetch(url, owner);
      setRows(
        data.items.map((it, i) => ({
          key: `${i}-${it.title}`,
          selected: !it.already_published,
          already: it.already_published,
          title: it.title,
          description: it.description || '',
          price: it.price ? String(it.price).replace('.', ',') : '',
          category_id: '',
          condition: '',
          images: it.images,
          open: false,
        })),
      );
      toast.success(`${data.items.length} productos encontrados en ${SOURCE_LABEL[data.source]}`);
      setPhase('review');
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo leer tu web'));
      setPhase('start');
    }
  };

  const applyBulk = () => {
    if (!bulkCategory && !bulkCondition) return;
    setRows((prev) =>
      prev.map((r) =>
        r.selected
          ? { ...r, ...(bulkCategory && { category_id: bulkCategory }), ...(bulkCondition && { condition: bulkCondition }) }
          : r,
      ),
    );
    toast.success(`Aplicado a ${selectedRows.length} productos`);
  };

  const publish = async () => {
    if (!province) {
      setShowErrors(true);
      toast.error('Elige la provincia');
      return;
    }
    if (incomplete) {
      setShowErrors(true);
      toast.error(`Faltan datos en ${incomplete} ${incomplete === 1 ? 'producto' : 'productos'} (marcados en rojo)`);
      return;
    }
    setPhase('working');
    const total = { created: 0, withoutPhotos: 0, vacation: false };
    const pending = [...selectedRows];
    try {
      for (let i = 0; i < pending.length; i += BATCH) {
        const chunk = pending.slice(i, i + BATCH);
        setProgress({
          label: `Publicando y copiando fotos (${Math.min(i + BATCH, pending.length)} de ${pending.length})`,
          value: Math.round((i / pending.length) * 100),
        });
        const { data } = await client.catalogImport.publish({
          location_province: province,
          location_city: city.trim() || undefined,
          items: chunk.map((r) => ({
            title: r.title.trim(),
            description: r.description.trim() || undefined,
            price: parsePrice(r.price) as number,
            category_id: Number(r.category_id),
            condition: r.condition || 'nuevo',
            images: r.images,
          })),
        });
        total.created += data.created;
        total.withoutPhotos += data.without_photos;
        total.vacation = data.vacation_mode;
        // Los ya publicados salen de la lista por si algo falla a mitad.
        const done = new Set(chunk.map((r) => r.key));
        setRows((prev) => prev.filter((r) => !done.has(r.key)));
      }
      clearDraft();
      setResult(total);
      setPhase('done');
    } catch (err) {
      toast.error(
        errorDetail(err, 'Se interrumpió la publicación.') +
          (total.created ? ` Se publicaron ${total.created}; los que faltan siguen en la lista.` : ''),
      );
      setPhase('review');
    }
  };

  const startOver = () => {
    if (rows.length && phase === 'review' && !window.confirm('¿Descartar la importación sin publicar?')) return;
    clearDraft();
    setRows([]);
    setResult(null);
    setShowErrors(false);
    setPhase('start');
  };

  // ---------- Pantallas ----------
  if (!status) {
    return (
      <AccountLayout title="Importar catálogo">
        <p className="text-muted-foreground">Cargando…</p>
      </AccountLayout>
    );
  }

  if (!status.can_use) {
    return (
      <AccountLayout title="Importar catálogo" description="Trae todos tus productos desde tu web">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Crown className="h-6 w-6 text-primary shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">Importar tu catálogo está incluido en el plan Profesional</p>
                <p className="text-sm text-muted-foreground">
                  Si ya vendes en tu propia web, trae todos tus productos con sus fotos, descripciones y precios en unos
                  minutos, sin volver a escribirlos.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to="/cuenta/suscripcion">Ver plan Profesional</Link>
            </Button>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (!status.website) {
    return (
      <AccountLayout title="Importar catálogo">
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Para importar tu catálogo, primero añade la dirección de tu página web en «Mi perfil» (apartado Contacto
              directo). Solo se puede importar desde tu propia web.
            </p>
            <Button asChild>
              <Link to="/cuenta/perfil">Ir a Mi perfil</Link>
            </Button>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (phase === 'working') {
    return (
      <AccountLayout title="Importar catálogo">
        <Card>
          <CardContent className="p-8 space-y-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">{progress.label}</p>
            <Progress value={progress.value} />
            <p className="text-xs text-muted-foreground">No cierres esta página.</p>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (phase === 'done' && result) {
    return (
      <AccountLayout title="Importar catálogo">
        <Card>
          <CardContent className="p-8 space-y-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-700 mx-auto" />
            <p className="text-lg font-semibold text-foreground">
              ¡{result.created} {result.created === 1 ? 'anuncio publicado' : 'anuncios publicados'}!
            </p>
            {result.withoutPhotos > 0 && (
              <p className="text-sm text-amber-800">
                En {result.withoutPhotos} no se pudieron copiar las fotos desde tu web: añádelas desde «Mis anuncios».
              </p>
            )}
            {result.vacation && (
              <p className="text-sm text-amber-800">
                Tienes el modo vacaciones activado: se han guardado en pausa y se activarán al desactivarlo.
              </p>
            )}
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/cuenta/anuncios">Ver mis anuncios</Link>
              </Button>
              {rows.length > 0 ? (
                <Button onClick={() => setPhase('review')}>Ver los {rows.length} que no importé</Button>
              ) : (
                <Button onClick={startOver} className="cursor-pointer">
                  Importar más
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (phase === 'start') {
    return (
      <AccountLayout title="Importar catálogo" description="Trae tus productos desde tu propia web">
        <Card>
          <CardContent className="p-6 space-y-4">
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Pega la dirección de tu tienda online o de la página donde tienes tu catálogo.</li>
              <li>Buscamos tus productos con sus fotos, descripciones y precios.</li>
              <li>Eliges cuáles subir, les pones categoría y revisas los precios.</li>
              <li>Publicas todos de una vez.</li>
            </ol>
            <div className="space-y-1">
              <Label>Dirección de tu web o de tu catálogo</Label>
              <div className="relative">
                <Globe className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} className="pl-9" placeholder="www.mitienda.es" />
              </div>
              <p className="text-xs text-muted-foreground">
                Funciona directamente con tiendas Shopify y WooCommerce, y con la mayoría de webs de tienda. Solo desde
                la web de tu perfil; no desde Facebook, Instagram ni otras plataformas de venta.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={owner} onCheckedChange={(v) => setOwner(v === true)} className="mt-0.5" />
              <span>Confirmo que esta web y sus productos, textos y fotos son míos.</span>
            </label>
            <Button onClick={search} disabled={!url.trim() || !owner} className="cursor-pointer">
              <Download className="h-4 w-4 mr-1" /> Buscar mis productos
            </Button>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  // phase === 'review'
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  return (
    <AccountLayout
      title="Elige qué importar"
      description="Marca los productos, ponles categoría y revisa los precios. Nada se publica hasta que pulses «Publicar»."
    >
      <div className="space-y-4 pb-28">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Provincia (para todos)</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger className={showErrors && !province ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Elegir provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ciudad (opcional)</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Écija" />
              </div>
            </div>
            <div className="rounded-md bg-muted/60 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Para los {selectedRows.length} marcados:
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger className="w-48 bg-background">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bulkCondition} onValueChange={setBulkCondition}>
                  <SelectTrigger className="w-36 bg-background">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="usado">Usado</SelectItem>
                    <SelectItem value="restaurado">Restaurado</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={applyBulk} disabled={!selectedRows.length} className="cursor-pointer">
                  Aplicar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => setRows((prev) => prev.map((r) => ({ ...r, selected: v === true })))}
            />
            Marcar todos ({rows.length})
          </label>
          <Button variant="ghost" size="sm" onClick={startOver} className="cursor-pointer text-muted-foreground">
            Empezar de nuevo
          </Button>
        </div>

        {rows.map((r) => {
          const miss = missing(r);
          const hasError = showErrors && r.selected && miss.length > 0;
          return (
            <Card key={r.key} className={`${hasError ? 'border-destructive' : ''} ${r.selected ? '' : 'opacity-60'}`}>
              <CardContent className="p-3 space-y-3">
                <div className="flex gap-3 items-start">
                  <Checkbox
                    checked={r.selected}
                    onCheckedChange={(v) => update(r.key, { selected: v === true })}
                    className="mt-1"
                    aria-label="Importar este producto"
                  />
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {r.images[0] ? (
                      <img src={r.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={r.title} maxLength={200} onChange={(e) => update(r.key, { title: e.target.value })} />
                      {r.already && (
                        <span className="text-[11px] whitespace-nowrap bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          Ya publicado
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-[110px_1fr_1fr] gap-2">
                      <Input
                        value={r.price}
                        inputMode="decimal"
                        placeholder="Precio €"
                        onChange={(e) => update(r.key, { price: e.target.value })}
                        className={showErrors && r.selected && !parsePrice(r.price) ? 'border-destructive' : ''}
                      />
                      <Select value={r.category_id} onValueChange={(v) => update(r.key, { category_id: v })}>
                        <SelectTrigger className={showErrors && r.selected && !r.category_id ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={r.condition || 'nuevo'} onValueChange={(v) => update(r.key, { condition: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nuevo">Nuevo</SelectItem>
                          <SelectItem value="usado">Usado</SelectItem>
                          <SelectItem value="restaurado">Restaurado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => update(r.key, { open: !r.open })}
                      className="text-xs text-primary flex items-center gap-1 cursor-pointer"
                    >
                      {r.open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {r.images.length} {r.images.length === 1 ? 'foto' : 'fotos'} · descripción
                    </button>
                    {hasError && <p className="text-xs text-destructive">Falta: {miss.join(', ')}</p>}
                  </div>
                </div>
                {r.open && (
                  <div className="space-y-2 pl-7">
                    {r.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {r.images.map((img, i) => (
                          <div key={img} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                            <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => update(r.key, { images: r.images.filter((_, j) => j !== i) })}
                              className="absolute top-0.5 right-0.5 bg-black/60 text-white text-[10px] rounded px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Textarea
                      value={r.description}
                      rows={4}
                      onChange={(e) => update(r.key, { description: e.target.value })}
                      placeholder="Descripción"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2 justify-end">
          <span className="text-sm text-muted-foreground mr-auto">
            {selectedRows.length} de {rows.length} marcados
            {incomplete > 0 && ` · ${incomplete} sin completar`}
          </span>
          <Button onClick={publish} disabled={!selectedRows.length} className="cursor-pointer">
            Publicar {selectedRows.length} {selectedRows.length === 1 ? 'anuncio' : 'anuncios'}
          </Button>
        </div>
      </div>
    </AccountLayout>
  );
}
