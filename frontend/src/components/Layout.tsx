import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Search, Heart, User, Plus, Church } from 'lucide-react';
import { client } from '@/lib/api';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/explorar', label: 'Explorar' },
    { href: '/explorar?categoria=orfebreria', label: 'Orfebrería' },
    { href: '/explorar?categoria=bordados', label: 'Bordados' },
    { href: '/vender', label: 'Vender' },
  ];

  const isActive = (href: string) => location.pathname === href.split('?')[0];

  const handleLogin = () => {
    client.auth.toLogin();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 cursor-pointer">
              <Church className="h-7 w-7 text-primary" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary leading-none">VentaCofrade</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Marketplace Cofrade</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive(link.href)
                      ? 'text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link to="/publicar">
                <Button size="sm" className="hidden sm:flex gap-1 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
                  <Plus className="h-4 w-4" />
                  Publicar
                </Button>
              </Link>
              <Link to="/explorar" className="p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                <Search className="h-5 w-5 text-muted-foreground" />
              </Link>
              <Link to="/favoritos" className="p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                <Heart className="h-5 w-5 text-muted-foreground" />
              </Link>
              <button onClick={handleLogin} className="p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                <User className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Mobile menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button className="md:hidden p-2 rounded-md hover:bg-muted cursor-pointer">
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <nav className="flex flex-col gap-2 mt-8">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                          isActive(link.href)
                            ? 'text-primary bg-primary/5'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      to="/publicar"
                      onClick={() => setMobileOpen(false)}
                      className="px-4 py-3 rounded-md text-sm font-medium text-primary bg-primary/5 cursor-pointer"
                    >
                      + Publicar anuncio
                    </Link>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Church className="h-6 w-6" />
                <span className="text-lg font-bold">VentaCofrade</span>
              </div>
              <p className="text-sm text-primary-foreground/70">
                El marketplace de referencia del mundo cofrade en España.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Explorar</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/explorar" className="hover:text-primary-foreground transition-colors cursor-pointer">Todos los anuncios</Link></li>
                <li><Link to="/explorar?categoria=orfebreria" className="hover:text-primary-foreground transition-colors cursor-pointer">Orfebrería</Link></li>
                <li><Link to="/explorar?categoria=bordados" className="hover:text-primary-foreground transition-colors cursor-pointer">Bordados</Link></li>
                <li><Link to="/explorar?categoria=tunicas-capirotes" className="hover:text-primary-foreground transition-colors cursor-pointer">Túnicas</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Vender</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/vender" className="hover:text-primary-foreground transition-colors cursor-pointer">Cómo vender</Link></li>
                <li><Link to="/publicar" className="hover:text-primary-foreground transition-colors cursor-pointer">Publicar anuncio</Link></li>
                <li><Link to="/documentacion" className="hover:text-primary-foreground transition-colors cursor-pointer">Documentación</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Contacto</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li>Sevilla, Andalucía · España</li>
                <li>hola@ventacofrade.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-6 text-center text-sm text-primary-foreground/60">
            <p>© 2026 VentaCofrade. Todos los derechos reservados.</p>
            <p className="mt-1">Hecho con devoción en Andalucía.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}