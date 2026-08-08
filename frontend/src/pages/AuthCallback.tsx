import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { saveToken } from '@/lib/auth';

// This page receives the redirect from the backend after a Google login,
// which arrives with either ?token=... (success) or ?error=... (failure).
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      saveToken(token);
      toast.success('Sesión iniciada con Google');
      navigate('/', { replace: true });
      window.location.reload(); // refresh so the header picks up the logged-in user
    } else {
      toast.error(error || 'No se pudo iniciar sesión con Google');
      navigate('/login', { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Iniciando sesión...</p>
      </div>
    </div>
  );
}
