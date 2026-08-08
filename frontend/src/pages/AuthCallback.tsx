import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// This page used to handle the OIDC redirect callback from Atoms' identity
// provider. Login is now handled directly on the /login page, so this route
// just sends visitors there if they land here from an old bookmark/link.
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo...</p>
      </div>
    </div>
  );
}
