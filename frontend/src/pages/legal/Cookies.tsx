import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { resetConsent } from '@/lib/consent';

export default function Cookies() {
  const handleChangePreferences = () => {
    resetConsent();
    window.location.reload();
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Política de Cookies</h1>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que un sitio web instala en tu navegador
          cuando lo visitas. Permiten, entre otras cosas, recordar tus preferencias, mantener tu
          sesión iniciada o analizar cómo se usa el sitio. VentaCofrade también utiliza
          almacenamiento local del navegador (localStorage), que cumple una función equivalente a
          las cookies técnicas.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Tipos de cookies según su finalidad</h2>
        <ul>
          <li>
            <strong>Cookies técnicas o necesarias:</strong> imprescindibles para el funcionamiento
            básico del sitio (por ejemplo, mantener tu sesión iniciada, procesar un pago). No
            requieren consentimiento conforme a la normativa vigente, y siempre están activas.
          </li>
          <li>
            <strong>Cookies de analítica y publicidad:</strong> Google Analytics, Google Ads,
            Google AdSense y el píxel de Meta (Facebook/Instagram). Nos ayudan a entender cómo se
            usa la web y a medir el rendimiento de nuestras campañas publicitarias. Estas cookies{' '}
            <strong>solo se activan si nos das tu consentimiento expreso</strong> a través del
            banner que aparece en tu primera visita. Si no aceptas, o si rechazas, estos scripts
            no se cargan en tu navegador en ningún momento.
          </li>
        </ul>
        <p>
          Puedes cambiar tu decisión cuando quieras, sin tener que esperar a que caduque nada:{' '}
          <Button variant="link" className="h-auto p-0 cursor-pointer" onClick={handleChangePreferences}>
            cambiar mis preferencias de cookies
          </Button>
          .
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Cookies y almacenamiento que usamos</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Nombre / tipo</th>
              <th className="text-left py-2">Finalidad</th>
              <th className="text-left py-2">Titular</th>
              <th className="text-left py-2">Duración</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">Token de sesión (localStorage)</td>
              <td className="py-2">Mantener tu sesión iniciada</td>
              <td className="py-2">Propia</td>
              <td className="py-2">Hasta que cierres sesión</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">hCaptcha</td>
              <td className="py-2">Verificar que no eres un robot al registrarte</td>
              <td className="py-2">Tercero (hCaptcha)</td>
              <td className="py-2">Según hCaptcha</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Stripe</td>
              <td className="py-2">Procesar el pago de forma segura durante el checkout</td>
              <td className="py-2">Tercero (Stripe)</td>
              <td className="py-2">Según Stripe</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Preferencia de cookies</td>
              <td className="py-2">Recordar tu decisión sobre esta política</td>
              <td className="py-2">Propia</td>
              <td className="py-2">Hasta que la cambies</td>
            </tr>
            <tr className="border-b bg-muted/30">
              <td className="py-2" colSpan={4}>
                <strong>Solo si aceptas cookies de analítica y publicidad:</strong>
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Google Analytics (_ga, _gid...)</td>
              <td className="py-2">Estadísticas de uso de la web (visitas, páginas vistas)</td>
              <td className="py-2">Tercero (Google)</td>
              <td className="py-2">Hasta 24 meses</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Google Ads</td>
              <td className="py-2">Medir conversiones de nuestras campañas publicitarias</td>
              <td className="py-2">Tercero (Google)</td>
              <td className="py-2">Hasta 24 meses</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Google AdSense</td>
              <td className="py-2">Mostrar anuncios de terceros y medir su rendimiento</td>
              <td className="py-2">Tercero (Google)</td>
              <td className="py-2">Hasta 24 meses</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Meta Pixel (Facebook/Instagram)</td>
              <td className="py-2">Medir conversiones y crear públicos para campañas en Meta</td>
              <td className="py-2">Tercero (Meta)</td>
              <td className="py-2">Hasta 90 días</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Base legal</h2>
        <p>
          Las cookies técnicas y necesarias para prestar el servicio solicitado se amparan en la
          excepción prevista en el artículo 22.2 de la LSSI-CE, que no exige consentimiento
          previo para este tipo de cookies. Las cookies de analítica y publicidad (Google
          Analytics, Google Ads, Google AdSense y Meta Pixel), en cambio, se basan en tu{' '}
          <strong>consentimiento expreso</strong>, que puedes dar o denegar libremente a través
          del banner, y que puedes retirar en cualquier momento con el mismo grado de facilidad
          con el que lo diste.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Cómo gestionar o eliminar las cookies</h2>
        <p>
          Puedes cambiar tu decisión sobre las cookies de analítica y publicidad en cualquier
          momento:
        </p>
        <Button onClick={handleChangePreferences} className="cursor-pointer">
          Cambiar mis preferencias de cookies
        </Button>
        <p className="mt-4">
          También puedes permitir, bloquear o eliminar cualquier cookie instalada en tu equipo
          mediante la configuración de tu navegador. Ten en cuenta que bloquear las cookies
          técnicas puede impedir el correcto funcionamiento de la Plataforma (por ejemplo, no
          podrás mantener la sesión iniciada ni completar pagos).
        </p>
        <ul>
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
              Google Chrome
            </a>
          </li>
          <li>
            <a href="https://support.mozilla.org/es/kb/proteccion-mejorada-contra-el-rastreo-firefox-escritorio" target="_blank" rel="noopener noreferrer">
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
              Safari
            </a>
          </li>
          <li>
            <a href="https://support.microsoft.com/es-es/microsoft-edge" target="_blank" rel="noopener noreferrer">
              Microsoft Edge
            </a>
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Cambios en esta política</h2>
        <p>
          Podemos actualizar esta Política de Cookies para reflejar cambios en las cookies que
          utilizamos o en la normativa aplicable. Te recomendamos revisarla periódicamente.
        </p>

        <p className="text-xs text-muted-foreground mt-8">
          Última actualización: agosto de 2026.
        </p>
      </div>
    </Layout>
  );
}
