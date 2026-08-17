import Layout from '@/components/Layout';

export default function Terminos() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Términos y Condiciones</h1>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. Objeto</h2>
        <p>
          Estos Términos y Condiciones regulan el uso de VentaCofrade, un marketplace que conecta
          a compradores y vendedores de artículos relacionados con el mundo cofrade. Al registrarte
          y utilizar la plataforma, aceptas estos términos en su totalidad.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Registro de cuenta</h2>
        <p>
          Para publicar anuncios o contactar con vendedores necesitas crear una cuenta. Eres
          responsable de mantener la confidencialidad de tu contraseña y de toda la actividad
          realizada desde tu cuenta.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Papel de VentaCofrade como intermediario</h2>
        <p>
          VentaCofrade únicamente pone en contacto a compradores y vendedores. No somos parte de
          las compraventas realizadas entre usuarios, no garantizamos la veracidad de los anuncios,
          la calidad o legalidad de los artículos, ni intervenimos en el pago ni en la entrega
          entre comprador y vendedor, salvo en lo relativo al cobro de las tarifas de suscripción
          de vendedor descritas más abajo.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Planes de vendedor y pagos</h2>
        <p>
          Para publicar anuncios como vendedor es necesario activar un plan de suscripción
          (Básico o Profesional), sujeto a una cuota de activación única y una cuota mensual
          recurrente, cuyos importes se muestran en la sección "Vender" antes de la contratación.
          Los pagos se procesan de forma segura a través de Stripe. VentaCofrade no almacena los
          datos de tu tarjeta.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Contenido publicado por usuarios</h2>
        <p>
          Eres responsable del contenido que publiques (fotografías, descripciones, mensajes).
          Queda prohibido publicar artículos ilegales, contenido falso, ofensivo o que infrinja
          derechos de terceros. VentaCofrade se reserva el derecho de retirar anuncios que
          incumplan estas condiciones.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Suspensión y eliminación de cuenta</h2>
        <p>
          Puedes suspender tu cuenta en cualquier momento desde "Mi perfil"; tu cuenta y anuncios
          quedarán ocultos hasta que vuelvas a iniciar sesión. También puedes solicitar la
          eliminación definitiva de tu cuenta; en ese caso, tus datos se conservarán durante 5
          años conforme a nuestra Política de Privacidad, tras lo cual serán eliminados o
          anonimizados. VentaCofrade también podrá suspender o cancelar cuentas que incumplan
          estos Términos.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">7. Modificaciones</h2>
        <p>
          Podemos actualizar estos Términos en cualquier momento. Los cambios relevantes se
          notificarán a través de la plataforma o por email.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">8. Legislación aplicable</h2>
        <p>
          Estos Términos se rigen por la legislación española. Cualquier controversia se
          someterá a los juzgados y tribunales que correspondan conforme a derecho.
        </p>

        <p className="text-xs text-muted-foreground mt-8">
          Última actualización: agosto de 2026.
        </p>
      </div>
    </Layout>
  );
}
