import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';

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

const UNREAD_POLL_MS = 30000;

export default function AdminNav() {
  const location = useLocation();
  const { user, isSuperAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const canSeeMensajes = isSuperAdmin || user?.role === 'soporte';

  useEffect(() => {
    if (!canSeeMensajes) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await client.admin.getUnreadSupportCount();
        if (!cancelled) setUnreadCount(data.unread_count);
      } catch (err) {
        console.error('Error checking unread messages:', err);
      }
    };

    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canSeeMensajes]);

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
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.to === '/admin/mensajes' && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
