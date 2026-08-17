import Layout from '@/components/Layout';

export default function Cookies() {
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
            básico del sitio (por ejemplo, mantener tu sesión iniciada). No requieren
            consentimiento conforme a la normativa vigente.
          </li>
          <li>
            <strong>Cookies de terceros necesarias para el servicio:</strong> utilizadas por
            proveedores como Stripe (pago) o hCaptcha (seguridad), imprescindibles para poder
            completar determinadas funciones de la Plataforma.
          </li>
        </ul>
        <p>
          VentaCofrade <strong>no utiliza</strong> cookies de publicidad, de seguimiento
          publicitario entre sitios web, ni cookies analíticas de terceros con fines de marketing.
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
              <td className="py-2">Recordar que has aceptado esta política</td>
              <td className="py-2">Propia</td>
              <td className="py-2">12 meses</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Base legal</h2>
        <p>
          Al tratarse exclusivamente de cookies técnicas y necesarias para prestar el servicio
          solicitado, su uso se ampara en la excepción prevista en el artículo 22.2 de la LSSI-CE,
          que no exige consentimiento previo para este tipo de cookies. Aun así, te informamos de
          su uso a través del banner y de esta política, en aras de la transparencia.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Cómo gestionar o eliminar las cookies</h2>
        <p>
          Puedes permitir, bloquear o eliminar las cookies instaladas en tu equipo mediante la
          configuración de tu navegador. Ten en cuenta que bloquear las cookies técnicas puede
          impedir el correcto funcionamiento de la Plataforma (por ejemplo, no podrás mantener la
          sesión iniciada ni completar pagos).
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
