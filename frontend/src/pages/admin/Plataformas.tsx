import { ExternalLink, ShieldCheck, Search, Server, CreditCard, Megaphone, Mail, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminNav from '@/components/admin/AdminNav';

// Accesos directos a las plataformas externas conectadas a VentaCofrade.
// Solo enlaces: no guarda credenciales ni consulta ninguna API.

type PlatformLink = {
  name: string;
  url: string;
  check: string; // qué revisar al entrar
};

type PlatformGroup = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: PlatformLink[];
};

const GROUPS: PlatformGroup[] = [
  {
    title: 'Seguridad y reputación',
    icon: ShieldCheck,
    links: [
      {
        name: 'Search Console · Problemas de seguridad',
        url: 'https://search.google.com/search-console/security-issues?resource_id=sc-domain%3Aventacofrade.com',
        check: 'Debe decir "No se ha detectado ningún problema".',
      },
      {
        name: 'Search Console · Acciones manuales',
        url: 'https://search.google.com/search-console/manual-actions?resource_id=sc-domain%3Aventacofrade.com',
        check: 'Debe estar vacío.',
      },
      {
        name: 'Estado en Google Safe Browsing',
        url: 'https://transparencyreport.google.com/safe-browsing/search?url=ventacofrade.com',
        check: 'Debe indicar que no se ha encontrado contenido peligroso.',
      },
    ],
  },
  {
    title: 'Buscadores (SEO)',
    icon: Search,
    links: [
      {
        name: 'Search Console · Páginas indexadas',
        url: 'https://search.google.com/search-console/index?resource_id=sc-domain%3Aventacofrade.com',
        check: 'Que el número de páginas indexadas suba con el tiempo.',
      },
      {
        name: 'Search Console · Sitemaps',
        url: 'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aventacofrade.com',
        check: 'El sitemap de www debe estar en "Correcto".',
      },
      {
        name: 'Search Console · Rendimiento',
        url: 'https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Aventacofrade.com',
        check: 'Clics, impresiones y búsquedas por las que apareces.',
      },
      {
        name: 'Bing Webmaster Tools',
        url: 'https://www.bing.com/webmasters',
        check: 'Indexación en Bing (lo usa ChatGPT para buscar).',
      },
      {
        name: 'PageSpeed Insights',
        url: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.ventacofrade.com%2F',
        check: 'Velocidad de carga en móvil y ordenador.',
      },
    ],
  },
  {
    title: 'Infraestructura',
    icon: Server,
    links: [
      {
        name: 'Vercel · Web',
        url: 'https://vercel.com/da-0768/ventacofrade-all',
        check: 'Que el último deploy de Production esté en "Ready".',
      },
      {
        name: 'Railway · API y base de datos',
        url: 'https://railway.com/project/c303f50c-1a4b-408a-bdea-3691b9234c1a',
        check: 'Backend y Postgres en "Online"; revisar logs si hay errores.',
      },
      {
        name: 'Cloudflare · Dominio y DNS',
        url: 'https://dash.cloudflare.com',
        check: 'DNS de ventacofrade.com y api.ventacofrade.com.',
      },
      {
        name: 'Google Cloud · Login con Google',
        url: 'https://console.cloud.google.com/apis/credentials?project=ventacofrade',
        check: 'URIs de redirección del cliente OAuth "VentaCofrade Web".',
      },
      {
        name: 'GitHub · Repositorio',
        url: 'https://github.com/equhorses/ventacofrade-all',
        check: 'Últimos commits subidos.',
      },
    ],
  },
  {
    title: 'Pagos',
    icon: CreditCard,
    links: [
      {
        name: 'Stripe · Panel',
        url: 'https://dashboard.stripe.com',
        check: 'Pagos, suscripciones y disputas.',
      },
      {
        name: 'Stripe · Webhooks',
        url: 'https://dashboard.stripe.com/webhooks',
        check: 'Que el webhook no tenga entregas fallidas.',
      },
    ],
  },
  {
    title: 'Marketing y analítica',
    icon: Megaphone,
    links: [
      {
        name: 'Google Analytics',
        url: 'https://analytics.google.com',
        check: 'Visitas y conversiones.',
      },
      {
        name: 'Meta · Administrador de anuncios',
        url: 'https://adsmanager.facebook.com',
        check: 'Campañas activas, gasto y anuncios rechazados.',
      },
      {
        name: 'Meta · Business Suite',
        url: 'https://business.facebook.com',
        check: 'Estado de la cuenta, avisos y restricciones.',
      },
    ],
  },
  {
    title: 'Email',
    icon: Mail,
    links: [
      {
        name: 'Resend · Emails enviados',
        url: 'https://resend.com/emails',
        check: 'Emails rebotados o marcados como spam.',
      },
    ],
  },
];

const WEEKLY_CHECKLIST = [
  'Search Console: sin problemas de seguridad ni acciones manuales.',
  'Vercel y Railway: último deploy correcto y servicios en línea.',
  'Stripe: sin disputas ni webhooks fallidos.',
  'Meta: sin anuncios rechazados ni avisos en la cuenta.',
  'Resend: sin picos de rebotes.',
];

export default function AdminPlataformasPage() {
  return (
    <>
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Plataformas
          </h1>
          <p className="text-muted-foreground">
            Accesos directos a los servicios conectados a VentaCofrade. Cada enlace se abre en una
            pestaña nueva; entra con la cuenta que administra ese servicio.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisión semanal recomendada</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {WEEKLY_CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" /> {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {group.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <span className="flex items-center justify-between gap-2 font-medium text-sm">
                      {link.name}
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{link.check}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
