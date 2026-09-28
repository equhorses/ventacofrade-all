import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { client, type CatalogConsent } from '@/lib/api';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

// Marca que el backend pone en el mensaje del mensajero cuando pide permiso para importar el catálogo.
export const CONSENT_MARKER_RE = /\[\[autorizacion-catalogo:(\d+)\]\]/;

export function stripConsentMarker(text: string) {
  return text.replace(CONSENT_MARKER_RE, '').trim();
}

function formatDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConsentCard({ consentId, canAccept }: { consentId: number; canAccept: boolean }) {
  const [consent, setConsent] = useState<CatalogConsent | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.catalogImport
      .getConsent(consentId)
      .then(({ data }) => setConsent(data))
      .catch(() => setConsent(null));
  }, [consentId]);

  if (!consent) return null;

  const accept = async () => {
    setSaving(true);
    try {
      const { data } = await client.catalogImport.acceptConsent(consentId);
      setConsent(data);
      toast.success('¡Gracias! Nos ponemos con tu catálogo');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'No se pudo guardar tu autorización');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-background p-3 space-y-3 text-foreground">
      <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
        <ShieldCheck className="h-4 w-4" /> Autorización para importar tu catálogo
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">{consent.consent_text}</p>
      {consent.status === 'accepted' ? (
        <p className="text-xs font-medium text-green-700 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> Aceptada el {formatDate(consent.accepted_at)}
        </p>
      ) : consent.status !== 'pending' ? (
        <p className="text-xs text-muted-foreground">Esta autorización ya no está activa.</p>
      ) : canAccept ? (
        <>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
            <span>He leído el texto de arriba y acepto.</span>
          </label>
          <Button size="sm" onClick={accept} disabled={!checked || saving} className="cursor-pointer">
            {saving ? 'Guardando…' : 'Aceptar'}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Pendiente de que el vendedor la acepte.</p>
      )}
    </div>
  );
}
