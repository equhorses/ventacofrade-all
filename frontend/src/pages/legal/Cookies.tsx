import Layout from '@/components/Layout';

export default function Cookies() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Política de Cookies</h1>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos que se almacenan en tu navegador. VentaCofrade
          también usa almacenamiento local (localStorage) del navegador con una función
          equivalente.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Cookies y almacenamiento que usamos</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Tipo</th>
              <th className="text-left py-2">Finalidad</th>
              <th className="text-left py-2">Duración</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">Sesión (localStorage)</td>
              <td className="py-2">Mantener tu sesión iniciada</td>
              <td className="py-2">Hasta que cierres sesión</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">hCaptcha</td>
              <td className="py-2">Verificar que no eres un robot al registrarte</td>
              <td className="py-2">Según hCaptcha</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Stripe</td>
              <td className="py-2">Procesar el pago de forma segura durante el checkout</td>
              <td className="py-2">Según Stripe</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Preferencia de cookies</td>
              <td className="py-2">Recordar que has aceptado esta política</td>
              <td className="py-2">12 meses</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4">
          Todas las cookies y almacenamiento que usamos son técnicamente necesarios para el
          funcionamiento de la plataforma o para procesar tus pagos de forma segura. No usamos
          cookies de publicidad ni de seguimiento con fines de marketing de terceros.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Cómo desactivarlas</h2>
        <p>
          Puedes eliminar o bloquear estas cookies desde la configuración de tu navegador, aunque
          esto puede afectar al funcionamiento de la plataforma (por ejemplo, no podrás mantener
          la sesión iniciada).
        </p>

        <p className="text-xs text-muted-foreground mt-8">
          Última actualización: agosto de 2026.
        </p>
      </div>
    </Layout>
  );
}
