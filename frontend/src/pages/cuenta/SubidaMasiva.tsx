import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { client, type AIListingsStatus } from '@/lib/api';
import { CheckCircle2, Crown, ImagePlus, Loader2, MoveRight, Scissors, Sparkles, Star, Trash2, X } from 'lucide-react';

// Subida con IA: el vendedor sube fotos, la IA las agrupa por artículo y propone
// título, descripción, categoría y estado. El precio lo pone siempre el vendedor.

const PROVINCES = [
  'Sevilla', 'Málaga', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Almería',
  'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Otra',
];
const MAX_FILE_MB = 5;
const UPLOAD_CONCURRENCY = 4;
const DRAFT_KEY = 'vc_ai_upload_draft';

interface Category {
  id: number;
  name: string;
}

interface DraftItem {
  key: string;
  images: string[];
  title: string;
  description: string;
  category_id: string;
  condition: string;
  price: string;
}

type Phase = 'select' | 'working' | 'review' | 'done';

const newKey = () => Math.random().toString(36).slice(2, 10);

function errorDetail(err: unknown, fallback: string) {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

function parsePrice(value: string): number | null {
  let t = value.replace(/\s|€/g, '');
  if (t.includes(',') && t.includes('.')) {
    // El último separador es el decimal: 1.234,50 o 1,234.50
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // 1.500 = mil quinientos
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function missingFields(item: DraftItem): string[] {
  const missing = [];
  if (item.title.trim().length < 3) missing.push('título');
  if (!parsePrice(item.price)) missing.push('precio');
  if (!item.category_id) missing.push('categoría');
  if (!item.condition) missing.push('estado');
  return missing;
}

export default function SubidaMasivaPage() {
  const [status, setStatus] = useState<AIListingsStatus | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [phase, setPhase] = useState<Phase>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [created, setCreated] = useState<{ count: number; vacation: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    Promise.all([client.aiListings.status(), client.entities.categories.query({ sort: 'order_index', limit: 50 })])
      .then(([s, c]) => {
        setStatus(s.data);
        setCategories(c?.data?.items || []);
        // Recupera un borrador a medias (por si se cerró la página).
        try {
          const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
          if (draft?.items?.length) {
            setItems(draft.items);
            setProvince(draft.province || s.data.province || '');
            setCity(draft.city || '');
            setPhase('review');
            toast.info('Hemos recuperado los anuncios que tenías a medias');
            return;
          }
        } catch {
          // borrador ilegible: se ignora
        }
        setProvince(s.data.province && PROVINCES.includes(s.data.province) ? s.data.province : '');
        setCity(s.data.city || '');
      })
      .catch(() => toast.error('No se pudo cargar la subida con IA'));
  }, []);

  // Guarda el borrador mientras se revisa.
  useEffect(() => {
    try {
      if (phase === 'review' && items.length) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ items, province, city }));
      }
    } catch {
      // sin almacenamiento: no pasa nada
    }
  }, [items, province, city, phase]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // nada
    }
  };

  const maxPhotos = status ? Math.min(status.max_per_batch, status.left_today) : 0;
  const perItem = status?.max_photos_per_item ?? 6;

  // ---------- Paso 1: elegir fotos ----------
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const valid: File[] = [];
    let skipped = 0;
    Array.from(list).forEach((f) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > MAX_FILE_MB * 1024 * 1024) skipped++;
      else valid.push(f);
    });
    const room = maxPhotos - files.length;
    if (valid.length > room) {
      toast.warning(`Solo caben ${room} fotos más en esta tanda`);
      valid.splice(room);
    }
    if (skipped) toast.warning(`${skipped} archivo(s) ignorados: solo JPG, PNG o WEBP de hasta ${MAX_FILE_MB} MB`);
    setFiles((prev) => [...prev, ...valid]);
    setUploadedUrls([]);
  };

  // ---------- Paso 2: subir fotos y analizar con IA ----------
  const analyze = async () => {
    if (!files.length) return;
    setPhase('working');
    try {
      let urls = uploadedUrls;
      if (urls.length !== files.length) {
        urls = new Array(files.length);
        let done = 0;
        let next = 0;
        const worker = async () => {
          while (next < files.length) {
            const i = next++;
            urls[i] = await client.storage.uploadImage(files[i], 'products');
            done++;
            setProgress({ label: `Subiendo fotos (${done} de ${files.length})`, value: Math.round((done / files.length) * 60) });
          }
        };
        await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
        setUploadedUrls(urls);
      }
      setProgress({ label: 'La IA está mirando tus fotos… (puede tardar hasta un minuto)', value: 70 });
      const { data } = await client.aiListings.analyze(urls);
      setItems(
        data.items.map((it) => ({
          key: newKey(),
          images: it.images,
          title: it.title,
          description: it.description,
          category_id: it.category_id ? String(it.category_id) : '',
          condition: it.condition || 'usado',
          price: '',
        })),
      );
      setStatus((s) => (s ? { ...s, left_today: data.left_today } : s));
      setFiles([]);
      setUploadedUrls([]);
      setPhase('review');
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo completar. Puedes volver a intentarlo.'));
      setPhase('select');
    }
  };

  // ---------- Paso 3: revisar ----------
  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const toggleSelect = (url: string) =>
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));

  const withoutSelected = (list: DraftItem[]) =>
    list.map((it) => ({ ...it, images: it.images.filter((u) => !selected.includes(u)) }));

  const moveSelectedTo = (targetKey: string) => {
    const target = items.find((it) => it.key === targetKey);
    if (!target) return;
    const incoming = selected.filter((u) => !target.images.includes(u));
    if (target.images.length + incoming.length > perItem) {
      toast.error(`Un anuncio puede tener como máximo ${perItem} fotos`);
      return;
    }
    setItems((prev) =>
      withoutSelected(prev)
        .map((it) => (it.key === targetKey ? { ...it, images: [...target.images, ...incoming] } : it))
        .filter((it) => it.images.length > 0),
    );
    setSelected([]);
  };

  const splitSelected = () => {
    if (selected.length > perItem) {
      toast.error(`Un anuncio puede tener como máximo ${perItem} fotos`);
      return;
    }
    const origin = items.find((it) => it.images.includes(selected[0]));
    setItems((prev) => {
      const rest = withoutSelected(prev).filter((it) => it.images.length > 0);
      return [
        ...rest,
        {
          key: newKey(),
          images: selected,
          title: '',
          description: '',
          category_id: origin?.category_id || '',
          condition: origin?.condition || 'usado',
          price: '',
        },
      ];
    });
    setSelected([]);
  };

  const removeSelected = () => {
    setItems((prev) => withoutSelected(prev).filter((it) => it.images.length > 0));
    setSelected([]);
  };

  const makeCover = (key: string, url: string) =>
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, images: [url, ...it.images.filter((u) => u !== url)] } : it)),
    );

  const incomplete = items.filter((it) => missingFields(it).length > 0).length;

  // ---------- Paso 4: publicar ----------
  const publish = async () => {
    if (!province) {
      toast.error('Elige la provincia');
      return;
    }
    if (incomplete) {
      setShowErrors(true);
      toast.error(`Faltan datos en ${incomplete} ${incomplete === 1 ? 'anuncio' : 'anuncios'} (marcados en rojo)`);
      return;
    }
    setPhase('working');
    setProgress({ label: `Publicando ${items.length} anuncios…`, value: 90 });
    try {
      const { data } = await client.aiListings.publish({
        location_province: province,
        location_city: city.trim() || undefined,
        items: items.map((it) => ({
          title: it.title.trim(),
          description: it.description.trim() || undefined,
          price: parsePrice(it.price) as number,
          category_id: Number(it.category_id),
          condition: it.condition,
          images: it.images,
        })),
      });
      clearDraft();
      setItems([]);
      setCreated({ count: data.created, vacation: data.vacation_mode });
      setPhase('done');
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudieron publicar. Tus anuncios siguen aquí, inténtalo de nuevo.'));
      setPhase('review');
    }
  };

  const startOver = () => {
    if (items.length && !window.confirm('¿Descartar los anuncios sin publicar?')) return;
    clearDraft();
    setItems([]);
    setFiles([]);
    setUploadedUrls([]);
    setSelected([]);
    setShowErrors(false);
    setCreated(null);
    setPhase('select');
  };

  // ---------- Pantallas ----------
  if (!status) {
    return (
      <AccountLayout title="Subida con IA">
        <p className="text-muted-foreground">Cargando…</p>
      </AccountLayout>
    );
  }

  if (!status.can_use) {
    return (
      <AccountLayout title="Subida con IA" description="Sube tus fotos y la IA te prepara los anuncios">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Crown className="h-6 w-6 text-primary shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">La subida con IA está incluida en el plan Profesional</p>
                <p className="text-sm text-muted-foreground">
                  Sube de golpe las fotos de todo lo que quieres vender. La IA agrupa las fotos de cada artículo y te
                  escribe el título y la descripción. Tú solo revisas y pones el precio.
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

  if (!status.ai_configured) {
    return (
      <AccountLayout title="Subida con IA">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            La subida con IA estará disponible muy pronto. Mientras tanto puedes publicar tus anuncios uno a uno.
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (phase === 'working') {
    return (
      <AccountLayout title="Subida con IA">
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

  if (phase === 'done' && created) {
    return (
      <AccountLayout title="Subida con IA">
        <Card>
          <CardContent className="p-8 space-y-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-700 mx-auto" />
            <p className="text-lg font-semibold text-foreground">
              ¡{created.count} {created.count === 1 ? 'anuncio publicado' : 'anuncios publicados'}!
            </p>
            {created.vacation && (
              <p className="text-sm text-amber-800">
                Tienes el modo vacaciones activado: se han guardado en pausa y se activarán al desactivarlo.
              </p>
            )}
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/cuenta/anuncios">Ver mis anuncios</Link>
              </Button>
              <Button onClick={startOver} className="cursor-pointer">
                Subir más
              </Button>
            </div>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  if (phase === 'select') {
    return (
      <AccountLayout title="Subida con IA" description="Sube las fotos de todo lo que quieres vender">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Elige las fotos de todos tus artículos a la vez (varias fotos por artículo si quieres).</li>
                <li>La IA las agrupa y escribe título, descripción, categoría y estado.</li>
                <li>Revisas, corriges lo que haga falta y pones los precios.</li>
                <li>Publicas todo de una vez.</li>
              </ol>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={maxPhotos <= 0}
                className="w-full border-2 border-dashed border-primary/40 rounded-lg p-8 flex flex-col items-center gap-2 text-primary hover:bg-primary/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImagePlus className="h-8 w-8" />
                <span className="font-medium">{files.length ? 'Añadir más fotos' : 'Elegir fotos'}</span>
                <span className="text-xs text-muted-foreground">
                  Hasta {maxPhotos} fotos · JPG, PNG o WEBP · máx. {MAX_FILE_MB} MB cada una
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              {status.left_today < status.max_per_batch && (
                <p className="text-xs text-muted-foreground">
                  Hoy te quedan {status.left_today} fotos por analizar (el límite de {status.daily_limit} se renueva cada día).
                </p>
              )}
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                      <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setFiles((prev) => prev.filter((_, j) => j !== i));
                          setUploadedUrls([]);
                        }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 cursor-pointer"
                        aria-label="Quitar foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button onClick={analyze} className="cursor-pointer">
                  <Sparkles className="h-4 w-4 mr-1" /> Preparar anuncios con IA ({files.length} fotos)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </AccountLayout>
    );
  }

  // phase === 'review'
  return (
    <AccountLayout
      title="Revisa tus anuncios"
      description="Corrige lo que haga falta y pon el precio de cada artículo. Nada se publica hasta que pulses «Publicar»."
    >
      <div className="space-y-4 pb-28">
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          ¿La IA ha juntado o separado mal alguna foto? Tócala para seleccionarla y pulsa «Mover aquí» en el anuncio
          correcto, o «Separar» para hacer un anuncio nuevo. La estrella marca la foto principal.
        </p>

        {items.map((it, index) => {
          const missing = missingFields(it);
          const hasError = showErrors && missing.length > 0;
          const canReceive = selected.length > 0 && selected.some((u) => !it.images.includes(u));
          return (
            <Card key={it.key} className={hasError ? 'border-destructive' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">Artículo {index + 1}</span>
                  <div className="flex gap-2">
                    {canReceive && (
                      <Button size="sm" onClick={() => moveSelectedTo(it.key)} className="cursor-pointer">
                        <MoveRight className="h-4 w-4 mr-1" /> Mover aquí
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setItems((prev) => prev.filter((x) => x.key !== it.key));
                        setSelected((prev) => prev.filter((u) => !it.images.includes(u)));
                      }}
                      className="cursor-pointer text-muted-foreground"
                      aria-label="Descartar artículo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {it.images.map((url, i) => {
                    const isSelected = selected.includes(url);
                    return (
                      <div
                        key={url}
                        onClick={() => toggleSelect(url)}
                        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden bg-muted cursor-pointer ring-offset-2 ${
                          isSelected ? 'ring-2 ring-primary' : ''
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            makeCover(it.key, url);
                          }}
                          className="absolute top-1 left-1 bg-black/50 rounded-full p-1 cursor-pointer"
                          aria-label="Foto principal"
                        >
                          <Star className={`h-3 w-3 ${i === 0 ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
                        </button>
                        {isSelected && (
                          <span className="absolute inset-0 bg-primary/25 flex items-end justify-end p-1">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                  <div className="space-y-1">
                    <Label>Título</Label>
                    <Input value={it.title} maxLength={200} onChange={(e) => update(it.key, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Precio (€)</Label>
                    <Input
                      value={it.price}
                      inputMode="decimal"
                      placeholder="0,00"
                      onChange={(e) => update(it.key, { price: e.target.value })}
                      className={showErrors && !parsePrice(it.price) ? 'border-destructive' : ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Categoría</Label>
                    <Select value={it.category_id} onValueChange={(v) => update(it.key, { category_id: v })}>
                      <SelectTrigger className={showErrors && !it.category_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Estado</Label>
                    <Select value={it.condition} onValueChange={(v) => update(it.key, { condition: v })}>
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
                </div>
                <div className="space-y-1">
                  <Label>Descripción</Label>
                  <Textarea
                    value={it.description}
                    rows={3}
                    onChange={(e) => update(it.key, { description: e.target.value })}
                  />
                </div>
                {hasError && <p className="text-xs text-destructive">Falta: {missing.join(', ')}</p>}
              </CardContent>
            </Card>
          );
        })}

        <Button variant="ghost" onClick={startOver} className="cursor-pointer text-muted-foreground">
          Descartar todo y empezar de nuevo
        </Button>
      </div>

      {/* Barra fija inferior */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 justify-end">
          {selected.length > 0 ? (
            <>
              <span className="text-sm text-muted-foreground mr-auto">
                {selected.length} {selected.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
              </span>
              <Button size="sm" variant="outline" onClick={splitSelected} className="cursor-pointer">
                <Scissors className="h-4 w-4 mr-1" /> Separar en anuncio nuevo
              </Button>
              <Button size="sm" variant="outline" onClick={removeSelected} className="cursor-pointer">
                <Trash2 className="h-4 w-4 mr-1" /> Quitar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])} className="cursor-pointer">
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground mr-auto">
                {items.length} anuncios
                {incomplete > 0 && ` · ${incomplete} sin completar`}
              </span>
              <Button onClick={publish} disabled={!items.length} className="cursor-pointer">
                Publicar {items.length} {items.length === 1 ? 'anuncio' : 'anuncios'}
              </Button>
            </>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
