import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { client, type BulkConfirmResult, type BulkPreview, type SellerTier } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';

const BATCH = 20;
const MAX_PHOTO_MB = 5;

function errorDetail(err: unknown, fallback: string) {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

const isUrl = (t: string) => /^https?:\/\//i.test(t);
const fileKey = (t: string) => t.split(/[\\/]/).pop()!.trim().toLowerCase();

export default function SubidaMasivaPage() {
  const [tier, setTier] = useState<SellerTier | null>(null);
  const [sheet, setSheet] = useState<File | null>(null);
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [result, setResult] = useState<BulkConfirmResult | null>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    client.sellerPlans
      .me()
      .then(({ data }) => setTier(data.tier))
      .catch(() => setTier('gratis'));
  }, []);

  const validRows = useMemo(() => preview?.rows.filter((r) => r.errors.length === 0) ?? [], [preview]);
  const missingPhotos = useMemo(
    () => (preview?.local_photos ?? []).filter((name) => !photos[name]),
    [preview, photos],
  );

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = { ...photos };
    let skipped = 0;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/') || f.size > MAX_PHOTO_MB * 1024 * 1024) {
        skipped += 1;
        return;
      }
      next[f.name.toLowerCase()] = f;
    });
    setPhotos(next);
    if (skipped) toast.warning(`${skipped} archivo(s) ignorados: no son imágenes o pesan más de ${MAX_PHOTO_MB} MB`);
  };

  const check = async (file: File) => {
    setSheet(file);
    setPreview(null);
    setResult(null);
    setChecking(true);
    try {
      const { data } = await client.bulkImport.preview(file);
      setPreview(data);
    } catch (err) {
      toast.error(errorDetail(err, 'No se pudo leer el archivo'));
    } finally {
      setChecking(false);
    }
  };

  const publish = async () => {
    if (!preview || validRows.length === 0) return;
    setRunning(true);
    setResult(null);
    try {
      // 1) Subir las fotos adjuntadas que usan las filas válidas.
      const needed = new Set<string>();
      validRows.forEach((r) => r.data.photos.forEach((t) => !isUrl(t) && photos[fileKey(t)] && needed.add(fileKey(t))));
      const photoUrls: Record<string, string> = {};
      const names = Array.from(needed);
      for (let i = 0; i < names.length; i++) {
        setProgress({ label: `Subiendo fotos (${i + 1} de ${names.length})`, value: Math.round((i / Math.max(names.length, 1)) * 100) });
        try {
          photoUrls[names[i]] = await client.storage.uploadImage(photos[names[i]], 'products');
        } catch {
          // Se avisará en el resultado de esa fila ("no has adjuntado la foto").
        }
      }

      // 2) Crear los anuncios por tandas.
      const all: BulkConfirmResult = { created: 0, vacation_mode: false, results: [] };
      for (let i = 0; i < validRows.length; i += BATCH) {
        const chunk = validRows.slice(i, i + BATCH);
        setProgress({
          label: `Publicando anuncios (${Math.min(i + BATCH, validRows.length)} de ${validRows.length})`,
          value: Math.round((i / validRows.length) * 100),
        });
        const { data } = await client.bulkImport.confirm(
          chunk.map(({ row, data: d }) => ({
            row,
            title: d.title,
            price: d.price,
            category_id: d.category_id,
            condition: d.condition,
            location_province: d.location_province,
            location_city: d.location_city,
            description: d.description,
            photos: d.photos,
          })),
          photoUrls,
        );
        all.created += data.created;
        all.vacation_mode = data.vacation_mode;
        all.results.push(...data.results);
      }
      setProgress({ label: 'Listo', value: 100 });
      setResult(all);
      setPreview(null);
      setSheet(null);
      setPhotos({});
      toast.success(`${all.created} anuncios publicados`);
    } catch (err) {
      toast.error(errorDetail(err, 'La subida se interrumpió. Revisa «Mis anuncios» antes de repetirla.'));
    } finally {
      setRunning(false);
    }
  };

  if (tier === null) {
    return (
      <AccountLayout title="Subida masiva">
        <p className="text-muted-foreground">Cargando…</p>
      </AccountLayout>
    );
  }

  if (tier !== 'profesional') {
    return (
      <AccountLayout title="Subida masiva" description="Publica todo tu catálogo de una vez">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Crown className="h-6 w-6 text-primary shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">La subida masiva está incluida en el plan Profesional</p>
                <p className="text-sm text-muted-foreground">
                  Rellena una hoja de Excel o CSV con tus artículos y sus fotos y publica hasta 200 anuncios de golpe.
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

  const withMissing = (photosOfRow: string[]) =>
    photosOfRow.filter((t) => !isUrl(t) && !photos[fileKey(t)]).length;

  return (
    <AccountLayout title="Subida masiva" description="Publica hasta 200 anuncios de una vez desde Excel o CSV">
      <div className="space-y-6">
        {/* Paso 1 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">1. Descarga la plantilla</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Una fila por anuncio. Obligatorias: <strong>titulo, precio, categoria, estado y provincia</strong>.
              Opcionales: ciudad, descripcion y fotos. En el Excel tienes una segunda hoja con las categorías,
              estados y provincias válidos.
            </p>
            <p>
              En <strong>fotos</strong> pon hasta 6 por anuncio separadas por <code>|</code>: el nombre del archivo
              (p. ej. <code>caliz1.jpg|caliz2.jpg</code>) y lo adjuntas en el paso 2, o una dirección web que empiece
              por https://.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => client.bulkImport.downloadTemplate('xlsx')} className="cursor-pointer">
                <Download className="h-4 w-4 mr-1" /> Plantilla Excel
              </Button>
              <Button variant="outline" onClick={() => client.bulkImport.downloadTemplate('csv')} className="cursor-pointer">
                <Download className="h-4 w-4 mr-1" /> Plantilla CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Paso 2 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">2. Sube tu archivo y tus fotos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={() => sheetInput.current?.click()} disabled={checking || running} className="cursor-pointer">
                {checking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                {sheet ? 'Cambiar archivo' : 'Elegir Excel o CSV'}
              </Button>
              <Button variant="outline" onClick={() => photoInput.current?.click()} disabled={running} className="cursor-pointer">
                <ImagePlus className="h-4 w-4 mr-1" /> Añadir fotos
              </Button>
              {sheet && <span className="text-sm text-muted-foreground">{sheet.name}</span>}
              {Object.keys(photos).length > 0 && (
                <span className="text-sm text-muted-foreground">· {Object.keys(photos).length} fotos adjuntadas</span>
              )}
            </div>
            <input
              ref={sheetInput}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) check(f);
              }}
            />
            <input
              ref={photoInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            {missingPhotos.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Faltan {missingPhotos.length} fotos que nombra tu archivo
                </p>
                <p className="mt-1 break-words">{missingPhotos.slice(0, 15).join(', ')}{missingPhotos.length > 15 ? '…' : ''}</p>
                <p className="mt-1 text-xs">Puedes añadirlas ahora o publicar igualmente: esos anuncios saldrán sin esas fotos.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paso 3 */}
        {preview && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">3. Revisa y publica</CardTitle>
              <p className="text-sm text-muted-foreground">
                {preview.valid} de {preview.total} anuncios listos
                {preview.invalid > 0 && ` · ${preview.invalid} con errores (no se publicarán; corrígelos y vuelve a subir el archivo)`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto border border-border rounded-md max-h-[28rem]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Fila</th>
                      <th className="p-2 font-medium">Título</th>
                      <th className="p-2 font-medium">Precio</th>
                      <th className="p-2 font-medium">Categoría</th>
                      <th className="p-2 font-medium">Fotos</th>
                      <th className="p-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => {
                      const missing = withMissing(r.data.photos);
                      return (
                        <tr key={r.row} className="border-t border-border align-top">
                          <td className="p-2 text-muted-foreground">{r.row}</td>
                          <td className="p-2 max-w-[16rem] truncate">{r.data.title || '—'}</td>
                          <td className="p-2 whitespace-nowrap">{r.data.price != null ? `${r.data.price.toFixed(2)} €` : '—'}</td>
                          <td className="p-2">{r.data.category_name || '—'}</td>
                          <td className="p-2 whitespace-nowrap">
                            {r.data.photos.length - missing}/{r.data.photos.length}
                          </td>
                          <td className="p-2">
                            {r.errors.length === 0 ? (
                              <span className="flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="h-4 w-4" /> OK
                              </span>
                            ) : (
                              <div className="text-destructive space-y-0.5">
                                {r.errors.map((e) => (
                                  <p key={e} className="flex items-start gap-1">
                                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {e}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {running && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{progress.label}</p>
                  <Progress value={progress.value} />
                </div>
              )}

              <Button onClick={publish} disabled={running || validRows.length === 0} className="cursor-pointer">
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Publicar {validRows.length} {validRows.length === 1 ? 'anuncio' : 'anuncios'}
              </Button>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-700" /> {result.created} anuncios publicados
              </CardTitle>
              {result.vacation_mode && (
                <p className="text-sm text-amber-800">
                  Tienes el modo vacaciones activado: los anuncios se han guardado en pausa y se activarán al desactivarlo.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {result.results.some((r) => (r.warnings?.length ?? 0) > 0 || !r.ok) && (
                <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
                  {result.results
                    .filter((r) => (r.warnings?.length ?? 0) > 0 || !r.ok)
                    .map((r) => (
                      <p key={r.row} className={r.ok ? 'text-amber-800' : 'text-destructive'}>
                        Fila {r.row}: {(r.ok ? r.warnings : r.errors)?.join(' ')}
                      </p>
                    ))}
                </div>
              )}
              <Button asChild variant="outline">
                <Link to="/cuenta/anuncios">Ver mis anuncios</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountLayout>
  );
}
