import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { User, Package, MessageCircle, Heart, CreditCard } from 'lucide-react';

interface AccountLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const navItems = [
  { href: '/cuenta/perfil', label: 'Mi perfil', icon: User },
  { href: '/cuenta/anuncios', label: 'Mis anuncios', icon: Package },
  { href: '/cuenta/mensajes', label: 'Mensajes', icon: MessageCircle },
  { href: '/cuenta/favoritos', label: 'Favoritos', icon: Heart },
  { href: '/cuenta/suscripcion', label: 'Suscripción', icon: CreditCard },
];

function initials(name?: string, email?: string) {
  const source = name?.trim() || email || '?';
  return source.slice(0, 1).toUpperCase();
}

export default function AccountLayout({ children, title, description }: AccountLayoutProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-muted-foreground">
          Cargando tu cuenta…
        </div>
      </Layout>
    );
  }

  if (!user) {
    // Waiting for the redirect effect above to kick in.
    return null;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="md:sticky md:top-24 md:self-start">
            <div className="flex items-center gap-3 mb-6 px-1">
              <Avatar className="h-11 w-11 border border-border">
                <AvatarImage src={user.avatar_url || undefined} alt={user.name || 'Avatar'} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {initials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{user.name || 'Mi cuenta'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
              {navItems.map((item) => {
                const active = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && <p className="text-muted-foreground mt-1">{description}</p>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </Layout>
  );
}
