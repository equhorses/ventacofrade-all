import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// allowedRoles omitted = every staff role can see this tab.
// allowedRoles set = only those roles (super admin always sees everything too).
const TABS: { to: string; label: string; allowedRoles?: string[] }[] = [
  { to: '/admin', label: 'Resumen' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/anuncios', label: 'Anuncios' },
  { to: '/admin/mensajes', label: 'Mensajes', allowedRoles: ['soporte'] },
  { to: '/admin/vendedores', label: 'Vendedores', allowedRoles: ['marketing'] },
  { to: '/admin/publicidad', label: 'Publicidad', allowedRoles: ['marketing'] },
  { to: '/admin/seguridad', label: 'Seguridad', allowedRoles: ['seguridad'] },
  { to: '/admin/auditoria', label: 'Auditoría', allowedRoles: [] }, // super admin only
  { to: '/admin/equipo', label: 'Equipo', allowedRoles: [] }, // super admin only
];

export default function AdminNav() {
  const location = useLocation();
  const { user, isSuperAdmin } = useAuth();

  const visibleTabs = TABS.filter((tab) => {
    if (isSuperAdmin) return true;
    if (!tab.allowedRoles) return true; // open to any staff role
    return !!user && tab.allowedRoles.includes(user.role);
  });

  return (
    <div className="border-b border-border mb-2">
      <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
