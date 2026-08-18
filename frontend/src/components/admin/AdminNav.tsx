import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const TABS = [
  { to: '/admin', label: 'Resumen', superAdminOnly: false },
  { to: '/admin/usuarios', label: 'Usuarios', superAdminOnly: false },
  { to: '/admin/anuncios', label: 'Anuncios', superAdminOnly: false },
  { to: '/admin/vendedores', label: 'Vendedores', superAdminOnly: false },
  { to: '/admin/equipo', label: 'Equipo', superAdminOnly: true },
];

export default function AdminNav() {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();

  return (
    <div className="border-b border-border mb-2">
      <div className="max-w-6xl mx-auto px-4 flex gap-1">
        {TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin).map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
