/**
 * Consentimiento de cookies no técnicas (analítica y publicidad).
 *
 * Las cookies técnicas (sesión, pago) no requieren consentimiento y no pasan
 * por aquí. Todo lo que sí lo requiere — Google Analytics, Google Ads,
 * Google AdSense y Meta Pixel — se carga EXCLUSIVAMENTE a través de
 * `loadTrackingScriptsIfConsented`, nunca de forma estática en index.html,
 * para que nada se dispare sin que la persona haya aceptado explícitamente.
 */

export type ConsentValue = 'accepted' | 'rejected';

const CONSENT_KEY = 'vc_cookie_consent';

const GA4_ID = 'G-FYNG38QM60';
const GOOGLE_ADS_ID = 'AW-18413520055';
const ADSENSE_CLIENT = 'ca-pub-6143759492313729';
const META_PIXEL_ID = '1080080141160565';

export function getConsent(): ConsentValue | null {
  const value = localStorage.getItem(CONSENT_KEY);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

export function setConsent(value: ConsentValue): void {
  localStorage.setItem(CONSENT_KEY, value);
}

/** Borra la decisión guardada, para que el banner vuelva a preguntar. */
export function resetConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
}

let alreadyLoaded = false;

/**
 * Inyecta Google Analytics + Google Ads (comparten gtag.js), Google AdSense
 * y el píxel de Meta. Idempotente: si ya se cargaron en esta sesión de
 * navegación, no los vuelve a inyectar.
 */
export function loadTrackingScripts(): void {
  if (alreadyLoaded) return;
  alreadyLoaded = true;

  // --- Google tag (gtag.js): Analytics + Google Ads ---
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(gtagScript);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: unknown[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;
  gtag('js', new Date());

  // --- Google Consent Mode ---
  // Sin esta señal explícita, gtag.js asume por defecto que NO hay
  // consentimiento (sobre todo para visitantes de la UE) y descarta las
  // peticiones de medición aunque el script se haya cargado correctamente.
  // Como esta función solo se ejecuta después de que la persona ya ha
  // aceptado nuestro propio banner, confirmamos aquí el consentimiento a
  // Google para que sí procese y envíe los datos.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  });

  gtag('config', GA4_ID);
  gtag('config', GOOGLE_ADS_ID);

  // --- Google AdSense ---
  const adsenseScript = document.createElement('script');
  adsenseScript.async = true;
  adsenseScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  adsenseScript.crossOrigin = 'anonymous';
  document.head.appendChild(adsenseScript);

  // --- Meta Pixel ---
  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  (window as any).fbq('init', META_PIXEL_ID);
  (window as any).fbq('track', 'PageView');
}

/** Llamar una vez al arrancar la app: si ya había consentimiento de una visita anterior, carga los scripts sin volver a preguntar. */
export function loadTrackingScriptsIfConsented(): void {
  if (getConsent() === 'accepted') {
    loadTrackingScripts();
  }
}
