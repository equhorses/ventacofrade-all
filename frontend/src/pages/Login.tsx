import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { toast } from 'sonner';
import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';
import { Gift } from 'lucide-react';
import { INVITE_TOKEN_STORAGE_KEY } from '@/components/ComingSoonGate';

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined;
const HCAPTCHA_SCRIPT_ID = 'hcaptcha-script';
const HCAPTCHA_ONLOAD_CALLBACK_NAME = '__onHCaptchaLoad';

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
    };
    [HCAPTCHA_ONLOAD_CALLBACK_NAME]?: () => void;
  }
}

function loadHCaptchaScript(onReady: () => void) {
  if (window.hcaptcha) {
    onReady();
    return;
  }
  // hCaptcha's own docs recommend waiting for their onload callback rather
  // than the script tag's 'load' event, to avoid racing their SDK setup.
  const existingCallback = window[HCAPTCHA_ONLOAD_CALLBACK_NAME];
  window[HCAPTCHA_ONLOAD_CALLBACK_NAME] = () => {
    existingCallback?.();
    onReady();
  };

  if (document.getElementById(HCAPTCHA_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = HCAPTCHA_SCRIPT_ID;
  script.src = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${HCAPTCHA_ONLOAD_CALLBACK_NAME}`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.92l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.28v3.1C3.25 21.3 7.28 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.61H1.28A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.28 0 3.25 2.7 1.28 6.61l4 3.1c.95-2.83 3.6-4.94 6.72-4.94z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | null>(null);

  const [pendingInvite, setPendingInvite] = useState<{ email: string; months: number; isRaffle: boolean } | null>(null);
  const [inviteAlreadyRedeemed, setInviteAlreadyRedeemed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) toast.error(error);
  }, [searchParams]);

  // If the person arrived earlier via a personal ?invite= link (the
  // "Coming Soon" gate already consumed it from the URL, but kept the token
  // in localStorage — see ComingSoonGate.tsx), show them what's waiting and
  // pre-fill the signup form with the right email so they don't accidentally
  // register with a different Google account and miss out on the free access.
  useEffect(() => {
    const token = localStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
    if (!token) return;

    fetch(`${getAPIBaseURL()}/api/v1/invitations/verify?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.valid || !data.email) return;
        if (data.already_redeemed) {
          setInviteAlreadyRedeemed(true);
          return;
        }
        setPendingInvite({ email: data.email, months: data.months || 1, isRaffle: data.source === 'sorteo_instagram' });
        setMode('register');
        setEmail((current) => current || data.email);
      })
      .catch((err) => console.error('Error checking pending invitation:', err));
  }, []);

  // Render the hCaptcha widget only while in "register" mode.
  useEffect(() => {
    if (mode !== 'register' || !HCAPTCHA_SITE_KEY) return;

    let cancelled = false;
    setCaptchaToken(null);
    captchaWidgetId.current = null;

    loadHCaptchaScript(() => {
      if (cancelled || !captchaContainerRef.current || !window.hcaptcha) return;
      captchaWidgetId.current = window.hcaptcha.render(captchaContainerRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'error-callback': () => setCaptchaToken(null),
        'expired-callback': () => setCaptchaToken(null),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleGoogleLogin = () => {
    // Age confirmation only applies when creating a new account. Google's
    // own login doesn't expose birthdate/age to us, so this self-declared
    // checkbox is our only signal here — required for every new signup,
    // not just people arriving through a raffle invite.
    if (mode === 'register' && !ageConfirmed) {
      toast.error('Confirma que eres mayor de 18 años para crear una cuenta');
      return;
    }
    localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    const ageParam = mode === 'register' && ageConfirmed ? '1' : '0';
    window.location.href = `${getAPIBaseURL()}/api/v1/auth/google/login?age_confirmed=${ageParam}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register' && HCAPTCHA_SITE_KEY && !captchaToken) {
      toast.error('Confirma que no eres un robot antes de continuar');
      return;
    }

    if (mode === 'register' && !ageConfirmed) {
      toast.error('Confirma que eres mayor de 18 años para crear una cuenta');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await authApi.register(email, password, name || undefined, captchaToken || undefined);
        toast.success('Cuenta creada correctamente');
      } else {
        await authApi.login(email, password);
        toast.success('Sesión iniciada');
      }
      localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
      window.location.href = mode === 'register' ? '/?welcome=1' : '/';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo salió mal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Entra con tu email y contraseña.'
                : 'Regístrate para comprar y vender en VentaCofrade.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvite && (
              <div className="mb-5 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
                <div className="flex gap-2">
                  <Gift className="h-4 w-4 shrink-0 mt-0.5 text-purple-600" />
                  <span>
                    Tienes <strong>{pendingInvite.months} {pendingInvite.months === 1 ? 'mes' : 'meses'} de
                    acceso gratis</strong> reservados para <strong>{pendingInvite.email}</strong>. Regístrate
                    con ese mismo correo (o con Google usando esa cuenta) para activarlo automáticamente.
                  </span>
                </div>
              </div>
            )}
            {inviteAlreadyRedeemed && (
              <div className="mb-5 rounded-lg border border-muted bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Ya activaste tu acceso gratis con esta invitación — inicia sesión normalmente con esa cuenta.
              </div>
            )}
            {mode === 'register' && (
              // Required for every new account, not just raffle invites.
              // Google Sign-In doesn't tell us the person's age, so this
              // self-declared checkbox is our age gate at signup time.
              <label className="mb-5 flex items-start gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                Confirmo que soy mayor de 18 años.
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              Continuar con Google
            </Button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o con tu email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              {mode === 'register' && HCAPTCHA_SITE_KEY && (
                <div ref={captchaContainerRef} className="flex justify-center" />
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => setMode('register')}
                  >
                    Regístrate
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => setMode('login')}
                  >
                    Inicia sesión
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
