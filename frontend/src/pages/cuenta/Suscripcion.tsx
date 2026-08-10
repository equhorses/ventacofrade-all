import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Check } from 'lucide-react';

export default function SuscripcionPage() {
  return (
    <AccountLayout title="Suscripción" description="Gestiona tu plan en VentaCofrade">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Plan gratuito</p>
                <p className="text-sm text-muted-foreground">Tu plan actual</p>
              </div>
            </div>
            <Badge variant="outline">Activo</Badge>
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground mb-6">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Anuncios ilimitados
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Mensajería con otros usuarios
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Favoritos y búsqueda avanzada
            </li>
          </ul>

          <div className="rounded-md bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
            Los planes de pago (anuncios destacados, insignias de vendedor verificado, etc.)
            están en camino. En cuanto estén disponibles, podrás gestionarlos desde aquí.
          </div>

          <Button disabled className="mt-4 cursor-not-allowed opacity-60">
            Próximamente
          </Button>
        </CardContent>
      </Card>
    </AccountLayout>
  );
}
