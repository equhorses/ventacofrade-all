import { Badge } from '@/components/ui/badge';
import { Crown, Star } from 'lucide-react';

// Insignia del plan del vendedor. Los vendedores gratuitos no llevan insignia.
export default function SellerBadge({ tier, className = '' }: { tier?: string | null; className?: string }) {
  if (tier === 'profesional') {
    return (
      <Badge className={`bg-primary text-primary-foreground gap-1 text-xs ${className}`}>
        <Crown className="h-3 w-3" aria-hidden="true" /> Profesional
      </Badge>
    );
  }
  if (tier === 'basico') {
    return (
      <Badge variant="outline" className={`border-primary/40 text-primary gap-1 text-xs bg-white/90 ${className}`}>
        <Star className="h-3 w-3" aria-hidden="true" /> Vendedor Plus
      </Badge>
    );
  }
  return null;
}
