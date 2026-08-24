import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { client, type DashboardStats } from '@/lib/api';
import AdminNav from '@/components/admin/AdminNav';
import {
  Users,
  Store,
  CreditCard,
  Sparkles,
  Package,
  Mail,
  Send,
  TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const PLAN_COLORS = ['#8b5cf6', '#f59e0b'];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminResumenPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.admin.getDashboard();
        setStats(data);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        toast.error('No se pudo cargar el resumen');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const planData = stats
    ? [
        { name: 'Básico', value: stats.basico_count },
        { name: 'Profesional', value: stats.profesional_count },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Resumen</h1>
          <p className="text-muted-foreground">Vista general de VentaCofrade, al minuto.</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Usuarios registrados"
                value={stats.total_users}
                hint={`+${stats.new_users_last_7_days} en los últimos 7 días`}
              />
              <StatCard icon={Store} label="Vendedores" value={stats.total_sellers} />
              <StatCard
                icon={CreditCard}
                label="Suscripciones activas"
                value={stats.active_subscriptions}
                hint={stats.estimated_mrr !== null ? `~${stats.estimated_mrr.toFixed(2)}€ / mes estimados` : undefined}
              />
              {stats.featured_revenue_total !== null && (
                <StatCard
                  icon={Sparkles}
                  label="Ingresos por destacados"
                  value={`${stats.featured_revenue_total.toFixed(2)}€`}
                  hint={`${(stats.featured_revenue_this_month ?? 0).toFixed(2)}€ este mes · ${stats.active_featured_count} activos ahora`}
                />
              )}
              <StatCard
                icon={Package}
                label="Anuncios activos"
                value={stats.active_products}
                hint={`${stats.total_products} anuncios en total`}
              />
              <StatCard icon={Mail} label="Lista de espera" value={stats.waitlist_count} />
              <StatCard
                icon={Send}
                label="Invitaciones enviadas"
                value={stats.invitations_sent}
                hint={`${stats.invitations_redeemed} canjeadas`}
              />
            </div>

            {planData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Suscripciones por plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {planData.map((_, index) => (
                            <Cell key={index} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
