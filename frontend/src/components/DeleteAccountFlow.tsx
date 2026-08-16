import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { client } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { AlertTriangle } from 'lucide-react';

const REASON_OPTIONS = [
  'Me aburre / no lo uso',
  'Es demasiado caro',
  'No he encontrado lo que buscaba',
  'Tengo problemas técnicos',
  'Voy a usar otra plataforma',
  'Otro motivo',
];

type Step = 'reasons' | 'confirm' | 'done';

interface DeleteAccountFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteAccountFlow({ open, onOpenChange }: DeleteAccountFlowProps) {
  const [step, setStep] = useState<Step>('reasons');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [finalAction, setFinalAction] = useState<'suspended' | 'deleted' | null>(null);

  const resetAndClose = () => {
    setStep('reasons');
    setSelectedReasons([]);
    setFeedback('');
    setFinalAction(null);
    onOpenChange(false);
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleContinueFromReasons = () => {
    setStep('confirm');
  };

  const handleSuspend = async () => {
    setLoading(true);
    try {
      await client.users.suspendAccount(selectedReasons.join(', '), feedback || undefined);
      setFinalAction('suspended');
      setStep('done');
    } catch (err) {
      toast.error('No se pudo suspender la cuenta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForever = async () => {
    setLoading(true);
    try {
      await client.users.deleteAccount(selectedReasons.join(', '), feedback || undefined);
      setFinalAction('deleted');
      setStep('done');
    } catch (err) {
      toast.error('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalClose = async () => {
    resetAndClose();
    if (finalAction === 'deleted' || finalAction === 'suspended') {
      await authApi.logout();
      window.location.href = '/';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        {step === 'reasons' && (
          <>
            <DialogHeader>
              <DialogTitle>Antes de irte, cuéntanos por qué</DialogTitle>
              <DialogDescription>
                Nos ayuda a mejorar. Marca lo que se aplique (opcional) y añade lo que quieras.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {REASON_OPTIONS.map((reason) => (
                <div key={reason} className="flex items-center gap-2">
                  <Checkbox
                    id={reason}
                    checked={selectedReasons.includes(reason)}
                    onCheckedChange={() => toggleReason(reason)}
                  />
                  <Label htmlFor={reason} className="font-normal cursor-pointer">
                    {reason}
                  </Label>
                </div>
              ))}
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Cuéntanos más (opcional)…"
                rows={3}
                className="mt-2"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button variant="outline" className="flex-1 cursor-pointer" onClick={resetAndClose}>
                Cancelar
              </Button>
              <Button className="flex-1 cursor-pointer" onClick={handleContinueFromReasons}>
                Continuar
              </Button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center">
                ¿Estás seguro de eliminar tu cuenta?
              </DialogTitle>
              <DialogDescription className="text-center pt-2">
                Puedes suspenderla en su lugar: se ocultará y podrás recuperarla simplemente
                volviendo a iniciar sesión cuando quieras.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 mt-2">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={handleSuspend}
                disabled={loading}
              >
                {loading ? 'Procesando…' : 'Prefiero suspender y poder recuperarla'}
              </Button>
              <Button
                variant="destructive"
                className="cursor-pointer"
                onClick={handleDeleteForever}
                disabled={loading}
              >
                {loading ? 'Procesando…' : 'No, quiero eliminar definitivamente mi cuenta'}
              </Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {finalAction === 'suspended' ? 'Tu cuenta ha sido suspendida' : 'Tu cuenta ha sido eliminada'}
              </DialogTitle>
              <DialogDescription className="pt-2">
                {finalAction === 'suspended' ? (
                  'Tu cuenta y tus anuncios quedan ocultos. Vuelve a iniciar sesión cuando quieras para reactivarla.'
                ) : (
                  <>
                    Recuerda que, tal y como se indica al aceptar las cookies y en nuestra política
                    de privacidad, conservaremos parte de tus datos durante 5 años por obligaciones
                    legales y fiscales, aunque tu cuenta ya no esté activa ni sea visible en la
                    plataforma.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-2 cursor-pointer" onClick={handleFinalClose}>
              Entendido
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
