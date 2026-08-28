import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Explorar from './pages/Explorar';
import Producto from './pages/Producto';
import RedProfesionalPage from './pages/RedProfesional';
import ProfesionalDetallePage from './pages/ProfesionalDetalle';
import VendedorPage from './pages/Vendedor';
import Vender from './pages/Vender';
import Publicar from './pages/Publicar';
import Documentacion from './pages/Documentacion';
import Publicidad from './pages/Publicidad';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import Login from './pages/Login';
import PerfilPage from './pages/cuenta/Perfil';
import MisAnunciosPage from './pages/cuenta/MisAnuncios';
import MensajesPage from './pages/cuenta/Mensajes';
import ConversacionPage from './pages/cuenta/Conversacion';
import FavoritosPage from './pages/cuenta/Favoritos';
import SuscripcionPage from './pages/cuenta/Suscripcion';
import PerfilProfesionalPage from './pages/cuenta/PerfilProfesional';
import AdminVendedoresPage from './pages/admin/Vendedores';
import AdminPublicidadPage from './pages/admin/Publicidad';
import AdminEquipoPage from './pages/admin/Equipo';
import AdminResumenPage from './pages/admin/Resumen';
import AdminUsuariosPage from './pages/admin/Usuarios';
import AdminAnunciosPage from './pages/admin/Anuncios';
import AdminMensajesPage from './pages/admin/Mensajes';
import AdminSeguridadPage from './pages/admin/Seguridad';
import AdminAuditoriaPage from './pages/admin/Auditoria';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import { AuthProvider } from './contexts/AuthContext';
import ComingSoonGate from './components/ComingSoonGate';
import CookieBanner from './components/CookieBanner';
import AvisoLegal from './pages/legal/AvisoLegal';
import Privacidad from './pages/legal/Privacidad';
import Terminos from './pages/legal/Terminos';
import Cookies from './pages/legal/Cookies';
import BasesSorteo from './pages/legal/BasesSorteo';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/explorar" element={<Explorar />} />
    <Route path="/producto/:id" element={<Producto />} />
    <Route path="/red-profesional" element={<RedProfesionalPage />} />
    <Route path="/profesional/:id" element={<ProfesionalDetallePage />} />
    <Route path="/vendedor/:id" element={<VendedorPage />} />
    <Route path="/vender" element={<Vender />} />
    <Route path="/publicar" element={<Publicar />} />
    <Route path="/documentacion" element={<Documentacion />} />
    <Route path="/publicidad" element={<Publicidad />} />
    <Route path="/legal/aviso-legal" element={<AvisoLegal />} />
    <Route path="/legal/privacidad" element={<Privacidad />} />
    <Route path="/legal/terminos" element={<Terminos />} />
    <Route path="/cookies" element={<Cookies />} />
    <Route path="/legal/bases-sorteo" element={<BasesSorteo />} />
    <Route path="/favoritos" element={<Explorar />} />
    <Route path="/login" element={<Login />} />
    <Route path="/cuenta" element={<Navigate to="/cuenta/perfil" replace />} />
    <Route path="/cuenta/perfil" element={<PerfilPage />} />
    <Route path="/cuenta/anuncios" element={<MisAnunciosPage />} />
    <Route path="/cuenta/mensajes" element={<MensajesPage />} />
    <Route path="/cuenta/mensajes/:productId/:otherUserId" element={<ConversacionPage />} />
    <Route path="/cuenta/favoritos" element={<FavoritosPage />} />
    <Route path="/cuenta/suscripcion" element={<SuscripcionPage />} />
    <Route path="/cuenta/perfil-profesional" element={<PerfilProfesionalPage />} />
    <Route
      path="/admin"
      element={
        <ProtectedAdminRoute>
          <AdminResumenPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/usuarios"
      element={
        <ProtectedAdminRoute>
          <AdminUsuariosPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/anuncios"
      element={
        <ProtectedAdminRoute>
          <AdminAnunciosPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/mensajes"
      element={
        <ProtectedAdminRoute allowedRoles={['soporte']}>
          <AdminMensajesPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/vendedores"
      element={
        <ProtectedAdminRoute allowedRoles={['marketing']}>
          <AdminVendedoresPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/publicidad"
      element={
        <ProtectedAdminRoute allowedRoles={['marketing']}>
          <AdminPublicidadPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/seguridad"
      element={
        <ProtectedAdminRoute allowedRoles={['seguridad']}>
          <AdminSeguridadPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/auditoria"
      element={
        <ProtectedAdminRoute requireSuperAdmin>
          <AdminAuditoriaPage />
        </ProtectedAdminRoute>
      }
    />
    <Route
      path="/admin/equipo"
      element={
        <ProtectedAdminRoute requireSuperAdmin>
          <AdminEquipoPage />
        </ProtectedAdminRoute>
      }
    />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <ComingSoonGate>
            <AppRoutes />
          </ComingSoonGate>
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };
