import { Church } from 'lucide-react';

// Cabecera y pie del blog con la misma estética que el resto de VentaCofrade.
// Las páginas del blog se sirven como HTML estático (sin montar React), así que
// aquí se usan enlaces <a> normales en lugar de <Link> de react-router.

type BlogShellProps = {
  children: React.ReactNode;
};

const navLinks = [
  { href: '/explorar', label: 'Explorar' },
  { href: '/vender', label: 'Vender' },
  { href: '/blog/', label: 'Guías' },
];

const BlogShell = ({ children }: BlogShellProps) => (
  <div className="min-h-screen flex flex-col bg-background text-foreground">
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <Church className="h-7 w-7 text-primary" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-lg font-bold text-primary leading-none">VentaCofrade</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">
                Marketplace Cofrade
              </span>
            </span>
          </a>
          <nav className="flex items-center gap-1" aria-label="Navegación principal">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>

    <div className="flex-1">{children}</div>

    <section className="bg-secondary/15 border-t border-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-primary">¿Tienes enseres cofrades que ya no usas?</h2>
        <p className="mt-3 text-foreground/80">
          Publica tu anuncio en VentaCofrade. Publicar y comprar es gratis.
        </p>
        <a
          href="/vender"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Empezar a vender
        </a>
      </div>
    </section>

    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Church className="h-6 w-6" aria-hidden="true" />
              <span className="text-lg font-bold">VentaCofrade</span>
            </div>
            <p className="text-sm text-primary-foreground/70">
              El marketplace de referencia del mundo cofrade en España.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-primary-foreground/80" aria-label="Enlaces del pie">
            <a href="/explorar" className="hover:text-primary-foreground">Todos los anuncios</a>
            <a href="/vender" className="hover:text-primary-foreground">Cómo vender</a>
            <a href="/blog/" className="hover:text-primary-foreground">Guías</a>
            <a href="/legal/aviso-legal" className="hover:text-primary-foreground">Aviso legal</a>
            <a href="/legal/privacidad" className="hover:text-primary-foreground">Privacidad</a>
          </nav>
        </div>
        <div className="border-t border-primary-foreground/20 mt-8 pt-6 text-center text-sm text-primary-foreground/60">
          <p>© 2026 VentaCofrade. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  </div>
);

export default BlogShell;
