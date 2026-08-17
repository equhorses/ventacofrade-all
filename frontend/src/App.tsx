import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Explorar from './pages/Explorar';
import Producto from './pages/Producto';
import Vender from './pages/Vender';
import Publicar from './pages/Publicar';
import Documentacion from './pages/Documentacion';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import Login from './pages/Login';
import PerfilPage from './pages/cuenta/Perfil';
import MisAnunciosPage from './pages/cuenta/MisAnuncios';
import MensajesPage from './pages/cuenta/Mensajes';
import ConversacionPage from './pages/cuenta/Conversacion';
import FavoritosPage from './pages/cuenta/Favoritos';
import SuscripcionPage from './pages/cuenta/Suscripcion';
import { AuthProvider } from './contexts/AuthContext';
import ComingSoonGate from './components/ComingSoonGate';
import CookieBanner from './components/CookieBanner';
import AvisoLegal from './pages/legal/AvisoLegal';
import Privacidad from './pages/legal/Privacidad';
import Terminos from './pages/legal/Terminos';
import Cookies from './pages/legal/Cookies';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/explorar" element={<Explorar />} />
    <Route path="/producto/:id" element={<Producto />} />
    <Route path="/vender" element={<Vender />} />
    <Route path="/publicar" element={<Publicar />} />
    <Route path="/documentacion" element={<Documentacion />} />
    <Route path="/legal/aviso-legal" element={<AvisoLegal />} />
    <Route path="/legal/privacidad" element={<Privacidad />} />
    <Route path="/legal/terminos" element={<Terminos />} />
    <Route path="/cookies" element={<Cookies />} />
    <Route path="/favoritos" element={<Explorar />} />
    <Route path="/login" element={<Login />} />
    <Route path="/cuenta" element={<Navigate to="/cuenta/perfil" replace />} />
    <Route path="/cuenta/perfil" element={<PerfilPage />} />
    <Route path="/cuenta/anuncios" element={<MisAnunciosPage />} />
    <Route path="/cuenta/mensajes" element={<MensajesPage />} />
    <Route path="/cuenta/mensajes/:productId/:otherUserId" element={<ConversacionPage />} />
    <Route path="/cuenta/favoritos" element={<FavoritosPage />} />
    <Route path="/cuenta/suscripcion" element={<SuscripcionPage />} />
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
            <CookieBanner />
          </ComingSoonGate>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };
