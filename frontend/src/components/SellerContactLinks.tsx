import { Button } from '@/components/ui/button';
import { Globe, Instagram, Facebook, MessageCircle } from 'lucide-react';

// Contacto directo del vendedor (ventaja del plan Profesional).
export interface SellerContact {
  whatsapp?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

function whatsappUrl(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) digits = `34${digits}`; // número español sin prefijo
  return `https://wa.me/${digits}`;
}

function ensureUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function instagramUrl(value: string): string {
  const trimmed = value.trim();
  if (/instagram\.com/i.test(trimmed)) return ensureUrl(trimmed);
  return `https://www.instagram.com/${trimmed.replace(/^@/, '')}`;
}

export default function SellerContactLinks({ contact, tier }: { contact: SellerContact; tier?: string | null }) {
  if (tier !== 'profesional') return null;
  const links = [
    contact.whatsapp && whatsappUrl(contact.whatsapp)
      ? { href: whatsappUrl(contact.whatsapp) as string, label: 'WhatsApp', Icon: MessageCircle }
      : null,
    contact.website ? { href: ensureUrl(contact.website), label: 'Web', Icon: Globe } : null,
    contact.instagram ? { href: instagramUrl(contact.instagram), label: 'Instagram', Icon: Instagram } : null,
    contact.facebook ? { href: ensureUrl(contact.facebook), label: 'Facebook', Icon: Facebook } : null,
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Globe }[];

  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ href, label, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer nofollow">
          <Button variant="outline" size="sm" className="gap-1 cursor-pointer">
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </Button>
        </a>
      ))}
    </div>
  );
}
