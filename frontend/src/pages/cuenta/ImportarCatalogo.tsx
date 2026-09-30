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
import {
  client,
  type CatalogConsent,
  type CatalogFileItem,
  type CatalogFileSeller,
  type CatalogImportStatus,
} from '@/lib/api';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  ImageOff,
  Loader2,
  Store,
} from 'lucide-react';

// Importar el catálogo desde la web propia del vendedor (Shopify, WooCommerce o cualquier web).
// El admin, además, puede importar para otro vendedor desde un Excel/CSV + sus fotos.

const PROVINCES = [
  'Sevilla', 'Málaga', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Almería',
  'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Otra',
];
const BATCH = 20;
const MAX_PHOTOS = 10;
const UPLOAD_CONCURRENCY = 4;
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
  // Fotos del ordenador (importación desde archivo); se suben al publicar.
  local?: { file: File; url: string }[];
  // Importación desde Todocolección / Wallapop: primero lista, luego se "preparan" los marcados.
  source_url?: string;
  prepared?: boolean;
  prepError?: string;
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

// ---------- Importación desde archivo (admin) ----------
const norm = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const stem = (name: string) => name.toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '');
const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

// Carpeta que contiene la foto (si eligió una carpeta con subcarpetas por artículo).
function folderOf(f: File) {
  const parts = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '').split('/');
  return parts.length >= 3 ? parts[parts.length - 2] : '';
}

function refMatches(fileStem: string, ref: string) {
  if (!fileStem.startsWith(ref)) return false;
  const next = fileStem.charAt(ref.length);
  if (!next || !/[a-z0-9]/.test(next)) return true; // 101.jpg, 101_1.jpg, 101-2.jpg, 101 (3).jpg
  return /\d$/.test(ref) && /[a-z]/.test(next) && fileStem.length === ref.length + 1; // 101a.jpg
}

// Empareja las fotos de un artículo: por el nombre que pone el Excel, por la referencia o por la carpeta.
function matchPhotos(item: CatalogFileItem, files: File[]): File[] {
  const out: File[] = [];
  const add = (f: File) => {
    if (!out.includes(f)) out.push(f);
  };
  for (const p of item.photos) {
    if (/^https?:/i.test(p)) continue;
    const base = (p.split(/[\\/]/).pop() || '').toLowerCase();
    files.forEach((f) => {
      const n = f.name.toLowerCase();
      if (n === base || stem(n) === stem(base)) add(f);
    });
  }
  if (!out.length && item.ref) {
    const ref = item.ref.toLowerCase().trim();
    files.forEach((f) => {
      if (refMatches(stem(f.name), ref) || (folderOf(f) && norm(folderOf(f)) === norm(ref))) add(f);
    });
  }
  if (!out.length) {
    const t = norm(item.title);
    files.forEach((f) => {
      const folder = folderOf(f);
      if ((folder && norm(folder) === t) || norm(stem(f.name).replace(/[\s_-]*\(?\d{1,2}\)?$/, '')) === t) add(f);
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })).slice(0, MAX_PHOTOS);
}

function guessCategory(text: string | null, categories: Category[]) {
  if (!text) return '';
  const t = norm(text);
  const exact = categories.find((c) => norm(c.name) === t);
  const partial = categories.find((c) => {
    const n = norm(c.name);
    return n && (t.includes(n) || n.includes(t));
  });
  return String((exact || partial)?.id ?? '');
}

async function uploadAll(files: File[], onEach: () => void): Promise<Map<File, string>> {
  const done = new Map<File, string>();
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      try {
        done.set(f, await client.storage.uploadImage(f, 'products'));
      } catch {
        // foto que no se pudo subir: el anuncio se publica con las demás
      }
      onEach();
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
  return done;
}

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
  // Importación desde archivo para otro vendedor (solo admin)
  const [sellerEmail, setSellerEmail] = useState('');
  const [sheet, setSheet] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [seller, setSeller] = useState<CatalogFileSeller | null>(null);
  const fileMode = seller !== null; // importación para otro vendedor (archivo o plataforma)
  const [platformUrl, setPlatformUrl] = useState('');
  const [consent, setConsent] = useState<CatalogConsent | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [platform, setPlatform] = useState<'todocoleccion' | 'wallapop' | null>(null);
  const [keywords, setKeywords] = useState('');
  const [asDraft, setAsDraft] = useState(true);
  const [coverMark, setCoverMark] = useState(true);
  const [filter, setFilter] = useState('');

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
      // Las fotos del ordenador no se pueden guardar en un borrador: la importación desde archivo no se guarda.
      if (phase === 'review' && rows.length && !fileMode)
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, province, city }));
    } catch {
      // sin almacenamiento
    }
  }, [rows, province, city, phase, fileMode]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // nada
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const incomplete = selectedRows.filter((r) => missing(r).length > 0).length;
  const unprepared = selectedRows.filter((r) => r.source_url && !r.prepared && !r.prepError).length;

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

  const readFile = async () => {
    if (!sellerEmail.trim() || !sheet) {
      toast.error('Pon el email del vendedor y elige el Excel o CSV');
      return;
    }
    setPhase('working');
    setProgress({ label: 'Leyendo el archivo…', value: 30 });
    try {
      const { data } = await client.catalogImport.parseFile(sheet, sellerEmail.trim());
      const images = photoFiles.filter((f) => IMAGE_RE.test(f.name));
      const used = new Set<File>();
      const newRows: Row[] = data.items.map((it, i) => {
        const matched = matchPhotos(it, images);
        matched.forEach((f) => used.add(f));
        const remote = it.photos.filter((p) => /^https?:/i.test(p));
        return {
          key: `f${i}-${it.title}`,
          selected: !it.already_published,
          already: it.already_published,
          title: it.title,
          description: it.description || '',
          price: it.price ? String(it.price).replace('.', ',') : '',
          category_id: guessCategory(it.category, categories),
          condition: it.condition || '',
          images: remote.slice(0, Math.max(0, MAX_PHOTOS - matched.length)),
          local: matched.map((file) => ({ file, url: URL.createObjectURL(file) })),
          open: false,
        };
      });
      setSeller(data.seller);
      setRows(newRows);
      setProvince(data.seller.province && PROVINCES.includes(data.seller.province) ? data.seller.province : '');
      setCity(data.seller.city || '');
      const withPhotos = newRows.filter((r) => (r.local?.length || 0) + r.images.length > 0).length;
      const unused = images.length - used.size;
      toast.success(
        `${newRows.length} artículos leídos · ${withPhotos} con fotos` +
          (unused > 0 ? ` · ${unused} fotos sin emparejar` : '') +
          (data.skipped ? ` · ${data.skipped} filas sin título ignoradas` : ''),
      );
      setPhase('review');
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo leer el archivo'));
      setPhase('start');
    }
  };

  const checkConsent = async (ask: boolean) => {
    if (!sellerEmail.trim() || !platformUrl.trim()) {
      toast.error('Pon el email del vendedor y la dirección de su tienda');
      return;
    }
    try {
      if (ask) {
        const { data } = await client.catalogImport.consentRequest(sellerEmail.trim(), platformUrl.trim());
        setConsent(data.consent);
        toast.success(
          data.already
            ? data.consent.status === 'accepted'
              ? 'Ya la tenía aceptada'
              : 'Ya se la habías pedido; sigue pendiente'
            : 'Mensaje enviado. Te avisaremos en contacto@ cuando acepte',
        );
      } else {
        const { data } = await client.catalogImport.consentStatus(sellerEmail.trim(), platformUrl.trim());
        setConsent(data.consent);
      }
      setConsentChecked(true);
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo comprobar la autorización'));
    }
  };

  const loadPlatformList = async () => {
    setPhase('working');
    setProgress({ label: 'Leyendo la lista de sus anuncios, página a página… (puede tardar un par de minutos)', value: 25 });
    try {
      const { data } = await client.catalogImport.platformList(sellerEmail.trim(), platformUrl.trim(), keywords.trim());
      setSeller(data.seller);
      setPlatform(data.platform);
      setRows(
        data.items.map((it, i) => ({
          key: `p${i}-${it.source_url}`,
          selected: false, // tiene cosas no cofrades: se marcan a mano
          already: it.already_published,
          title: it.title,
          description: '',
          price: it.price ? String(it.price).replace('.', ',') : '',
          category_id: '',
          condition: 'usado',
          images: it.images,
          source_url: it.source_url,
          prepared: false,
          open: false,
        })),
      );
      setProvince(data.seller.province && PROVINCES.includes(data.seller.province) ? data.seller.province : '');
      setCity(data.seller.city || '');
      toast.success(`${data.items.length} anuncios encontrados. Marca los cofrades.`);
      setPhase('review');
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo leer su tienda'));
      setPhase('start');
    }
  };

  const prepareSelected = async () => {
    const pending = rows.filter((r) => r.selected && !r.prepared && !r.prepError && r.source_url);
    if (!pending.length) return;
    setPhase('working');
    try {
      for (let i = 0; i < pending.length; i += BATCH) {
        const chunk = pending.slice(i, i + BATCH);
        setProgress({
          label: `Trayendo descripciones y fotos (${Math.min(i + BATCH, pending.length)} de ${pending.length})`,
          value: Math.round((i / pending.length) * 100),
        });
        const { data } = await client.catalogImport.platformDetails(
          sellerEmail.trim(),
          platformUrl.trim(),
          chunk.map((r) => r.source_url as string),
        );
        const byUrl = new Map(data.items.map((d) => [d.source_url, d]));
        setRows((prev) =>
          prev.map((r) => {
            const d = r.source_url ? byUrl.get(r.source_url) : undefined;
            if (!d) return r;
            if (d.error) return { ...r, prepError: d.error };
            return {
              ...r,
              prepared: true,
              prepError: undefined,
              title: d.title || r.title, // el de la ficha es el bueno
              description: d.description || r.description,
              price: d.price ? String(d.price).replace('.', ',') : r.price,
              images: d.images?.length ? d.images : r.images,
            };
          }),
        );
      }
      toast.success('Preparados. Revisa categorías y precios y publica.');
    } catch (err) {
      toast.error(errorDetail(err, 'Se interrumpió la preparación; los que faltan siguen marcados.'));
    } finally {
      setPhase('review');
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
      // Con muchas fotos por anuncio (Todocolección), tandas más pequeñas para no agotar el tiempo del servidor.
      const step = platform ? 6 : BATCH;
      for (let i = 0; i < pending.length; i += step) {
        const chunk = pending.slice(i, i + step);
        const label = `Publicando y copiando fotos (${Math.min(i + step, pending.length)} de ${pending.length})`;
        setProgress({ label, value: Math.round((i / pending.length) * 100) });
        const localFiles = chunk.flatMap((r) => (r.local || []).map((l) => l.file));
        let uploadedCount = 0;
        const uploaded = localFiles.length
          ? await uploadAll(localFiles, () => {
              uploadedCount += 1;
              setProgress({ label: `${label} · foto ${uploadedCount} de ${localFiles.length}`, value: Math.round((i / pending.length) * 100) });
            })
          : new Map<File, string>();
        const { data } = await client.catalogImport.publish({
          location_province: province,
          location_city: city.trim() || undefined,
          seller_email: seller?.email,
          as_draft: seller ? asDraft : undefined,
          cover_tc_watermark: platform === 'todocoleccion' ? coverMark : undefined,
          items: chunk.map((r) => ({
            title: r.title.trim(),
            description: r.description.trim() || undefined,
            price: parsePrice(r.price) as number,
            category_id: Number(r.category_id),
            condition: r.condition || 'nuevo',
            images: [
              ...(r.local || []).map((l) => uploaded.get(l.file)).filter((u): u is string => !!u),
              ...r.images,
            ].slice(0, MAX_PHOTOS),
          })),
        });
        total.withoutPhotos += chunk.filter(
          (r) => (r.local || []).length > 0 && !(r.local || []).some((l) => uploaded.has(l.file)) && !r.images.length,
        ).length;
        total.created += data.created;
        total.withoutPhotos += data.without_photos;
        total.vacation = data.vacation_mode;
        // Los ya publicados salen de la lista por si algo falla a mitad.
        const done = new Set(chunk.map((r) => r.key));
        setRows((prev) => prev.filter((r) => !done.has(r.key)));
      }
      clearDraft();
      if (seller && asDraft && total.created > 0) {
        client.catalogImport
          .notifySellerDrafts(seller.email, total.created)
          .catch(() => toast.error('Subidos, pero no se pudo avisar al vendedor. Escríbele tú.'));
      }
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
    rows.forEach((r) => r.local?.forEach((l) => URL.revokeObjectURL(l.url)));
    setRows([]);
    setResult(null);
    setShowErrors(false);
    setSeller(null);
    setSheet(null);
    setPhotoFiles([]);
    setPlatform(null);
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

  if (!status.website && !status.is_admin) {
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
              ¡{result.created}{' '}
              {seller && asDraft
                ? result.created === 1 ? 'borrador subido' : 'borradores subidos'
                : result.created === 1 ? 'anuncio publicado' : 'anuncios publicados'}
              !
            </p>
            {seller && (
              <p className="text-sm text-muted-foreground">
                En la cuenta de <strong>{seller.shop_name || seller.name || seller.email}</strong> ({seller.email})
                {asDraft
                  ? ', en borrador. Le hemos avisado por el mensajero y por email para que los revise y los active.'
                  : '.'}
              </p>
            )}
            {result.withoutPhotos > 0 && (
              <p className="text-sm text-amber-800">
                En {result.withoutPhotos} no se pudieron copiar las fotos: se pueden añadir desde «Mis anuncios».
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
        {status.is_admin && (
          <Card className="mt-4 border-primary/40">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-6 w-6 text-primary shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Solo admin: subir el catálogo de otro vendedor</p>
                  <p className="text-sm text-muted-foreground">
                    Con el Excel o CSV que nos manda (por ejemplo, el que usó en Importamatic de Todocolección) y sus
                    fotos. Se publica en SU cuenta; antes lo revisas todo aquí.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email de la cuenta del vendedor</Label>
                <Input
                  type="email"
                  value={sellerEmail}
                  onChange={(e) => setSellerEmail(e.target.value)}
                  placeholder="vendedor@correo.com"
                />
                <p className="text-xs text-muted-foreground">Tiene que haberse registrado antes en VentaCofrade.</p>
              </div>
              <div className="space-y-1">
                <Label>Excel o CSV del catálogo</Label>
                <Input type="file" accept=".xlsx,.xlsm,.csv,.txt" onChange={(e) => setSheet(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">
                  Primera fila con los nombres de las columnas: Título, Precio, Descripción y, si las tiene, Categoría,
                  Estado, Referencia y Fotos.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Carpeta de fotos</Label>
                <input
                  type="file"
                  multiple
                  // @ts-expect-error atributo no estándar: permite elegir una carpeta entera
                  webkitdirectory=""
                  onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                  className="block text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {photoFiles.length
                    ? `${photoFiles.filter((f) => IMAGE_RE.test(f.name)).length} fotos elegidas. `
                    : ''}
                  Se emparejan solas por el nombre del archivo que pone el Excel, por la referencia (101.jpg,
                  101_2.jpg…) o por subcarpetas con el título o la referencia de cada artículo.
                </p>
              </div>
              <Button onClick={readFile} disabled={!sellerEmail.trim() || !sheet} className="cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Leer el catálogo
              </Button>
            </CardContent>
          </Card>
        )}
        {status.is_admin && (
          <Card className="mt-4 border-primary/40">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Store className="h-6 w-6 text-primary shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Solo admin: traer sus anuncios de Todocolección o Wallapop</p>
                  <p className="text-sm text-muted-foreground">
                    Primero le pedimos permiso por el mensajero (marca una casilla y queda registrado). Cuando acepte,
                    traes la lista de sus anuncios, marcas solo los cofrades y se publican en SU cuenta.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email de la cuenta del vendedor</Label>
                <Input
                  type="email"
                  value={sellerEmail}
                  onChange={(e) => {
                    setSellerEmail(e.target.value);
                    setConsentChecked(false);
                  }}
                  placeholder="vendedor@correo.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Dirección de su tienda</Label>
                <Input
                  value={platformUrl}
                  onChange={(e) => {
                    setPlatformUrl(e.target.value);
                    setConsentChecked(false);
                  }}
                  placeholder="todocoleccion.net/usuario/NOMBRE  o  es.wallapop.com/user/..."
                />
              </div>
              <div className="space-y-1">
                <Label>Solo los que tengan estas palabras (opcional)</Label>
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Ej. semana santa"
                />
                <p className="text-xs text-muted-foreground">
                  Útil si tiene miles de lotes de todo tipo. Solo en Todocolección; sin palabras se traen todos (hasta 2.000).
                </p>
              </div>
              {consentChecked && (
                <div className="rounded-md bg-muted/60 p-3 text-sm">
                  {!consent && <p>Todavía no se le ha pedido autorización para esta tienda.</p>}
                  {consent?.status === 'pending' && (
                    <p>
                      Autorización <strong>pendiente</strong>: se la pedimos el{' '}
                      {consent.created_at ? new Date(consent.created_at).toLocaleDateString('es-ES') : ''}. Te llegará un
                      aviso a contacto@ cuando la acepte.
                    </p>
                  )}
                  {consent?.status === 'accepted' && (
                    <p className="text-green-700 font-medium">
                      Autorización aceptada el{' '}
                      {consent.accepted_at ? new Date(consent.accepted_at).toLocaleString('es-ES') : ''}.
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => checkConsent(false)}
                  disabled={!sellerEmail.trim() || !platformUrl.trim()}
                  className="cursor-pointer"
                >
                  Comprobar autorización
                </Button>
                {consentChecked && !consent && (
                  <Button onClick={() => checkConsent(true)} className="cursor-pointer">
                    Pedirle autorización por el mensajero
                  </Button>
                )}
                {consent?.status === 'accepted' && (
                  <Button onClick={loadPlatformList} className="cursor-pointer">
                    <Download className="h-4 w-4 mr-1" /> Traer la lista de sus anuncios
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </AccountLayout>
    );
  }

  // phase === 'review'
  const filterNorm = filter.trim().toLowerCase();
  const visibleRows = filterNorm
    ? rows.filter((r) => `${r.title} ${r.description}`.toLowerCase().includes(filterNorm))
    : rows;
  const visibleKeys = new Set(visibleRows.map((r) => r.key));
  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => r.selected);
  return (
    <AccountLayout
      title="Elige qué importar"
      description="Marca los productos, ponles categoría y revisa los precios. Nada se publica hasta que pulses «Publicar»."
    >
      <div className="space-y-4 pb-28">
        {seller && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm space-y-2">
            <p>
              Se subirá a la cuenta de <strong>{seller.shop_name || seller.name || seller.email}</strong> (
              {seller.email}){seller.published > 0 && `, que ya tiene ${seller.published} anuncios`}.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={asDraft} onCheckedChange={(v) => setAsDraft(v === true)} className="mt-0.5" />
              <span>
                <strong>Subir como borradores</strong>: no los ve nadie hasta que el vendedor los revise y los active
                (le avisamos al terminar).
              </span>
            </label>
            {platform === 'todocoleccion' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={coverMark} onCheckedChange={(v) => setCoverMark(v === true)} className="mt-0.5" />
                <span>
                  <strong>Tapar la marca de agua de Todocolección</strong> con un recuadro morado de VentaCofrade
                  (abajo a la derecha de cada foto).
                </span>
              </label>
            )}
          </div>
        )}
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
              onCheckedChange={(v) =>
                setRows((prev) => prev.map((r) => (visibleKeys.has(r.key) ? { ...r, selected: v === true } : r)))
              }
            />
            Marcar todos ({visibleRows.length})
          </label>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar: virgen, candelabro, bordado…"
            className="max-w-xs h-8"
          />
          <Button variant="ghost" size="sm" onClick={startOver} className="cursor-pointer text-muted-foreground">
            Empezar de nuevo
          </Button>
        </div>

        {visibleRows.map((r) => {
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
                    {r.local?.[0] || r.images[0] ? (
                      <img
                        src={r.local?.[0]?.url || r.images[0]}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
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
                      {r.images.length + (r.local?.length || 0)}{' '}
                      {r.images.length + (r.local?.length || 0) === 1 ? 'foto' : 'fotos'} · descripción
                    </button>
                    {r.source_url && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {r.selected && !r.prepared && !r.prepError && (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Sin preparar</span>
                        )}
                        {r.prepared && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Preparado</span>}
                        {r.prepError && <span className="text-destructive">No se pudo preparar: {r.prepError}</span>}
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                          Ver el original <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    )}
                    {hasError && <p className="text-xs text-destructive">Falta: {miss.join(', ')}</p>}
                  </div>
                </div>
                {r.open && (
                  <div className="space-y-2 pl-7">
                    {r.images.length + (r.local?.length || 0) > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {(r.local || []).map((l, i) => (
                          <div key={l.url} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                            <img src={l.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => update(r.key, { local: (r.local || []).filter((_, j) => j !== i) })}
                              className="absolute top-0.5 right-0.5 bg-black/60 text-white text-[10px] rounded px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
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
          {platform && unprepared > 0 ? (
            <Button onClick={prepareSelected} className="cursor-pointer">
              Preparar {unprepared} {unprepared === 1 ? 'marcado' : 'marcados'}
            </Button>
          ) : (
            <Button onClick={publish} disabled={!selectedRows.length} className="cursor-pointer">
              {seller && asDraft
                ? `Subir ${selectedRows.length} ${selectedRows.length === 1 ? 'borrador' : 'borradores'}`
                : `Publicar ${selectedRows.length} ${selectedRows.length === 1 ? 'anuncio' : 'anuncios'}`}
            </Button>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
