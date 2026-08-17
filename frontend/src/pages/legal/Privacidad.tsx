import Layout from '@/components/Layout';

export default function Privacidad() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. Responsable del tratamiento</h2>
        <ul>
          <li><strong>Responsable:</strong> [PENDIENTE: nombre completo o razón social]</li>
          <li><strong>NIF/CIF:</strong> [PENDIENTE: número de NIF o CIF]</li>
          <li><strong>Domicilio:</strong> [PENDIENTE: dirección fiscal completa]</li>
          <li><strong>Email:</strong> contacto@ventacofrade.com</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Datos que recogemos</h2>
        <p>Dependiendo de cómo uses la plataforma, tratamos los siguientes datos:</p>
        <ul>
          <li><strong>Cuenta:</strong> email, nombre, contraseña (cifrada), foto de perfil.</li>
          <li>
            <strong>Perfil de vendedor:</strong> nombre de tienda, descripción, provincia, ciudad,
            teléfono de contacto.
          </li>
          <li>
            <strong>Pagos:</strong> los datos de tarjeta se gestionan directamente por Stripe;
            VentaCofrade no almacena ni tiene acceso a los números de tarjeta.
          </li>
          <li><strong>Comunicaciones:</strong> mensajes entre compradores y vendedores dentro de la plataforma.</li>
          <li><strong>Lista de espera:</strong> email, mientras la plataforma esté en fase de lanzamiento.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Finalidad y base legal</h2>
        <ul>
          <li>Gestionar tu cuenta y permitir el uso de la plataforma (ejecución de contrato).</li>
          <li>Procesar pagos de suscripción de vendedor (ejecución de contrato).</li>
          <li>Enviar comunicaciones transaccionales: bienvenida, confirmaciones (ejecución de contrato).</li>
          <li>Avisarte del lanzamiento si te apuntas a la lista de espera (consentimiento).</li>
          <li>Cumplir obligaciones legales y fiscales (obligación legal).</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Con quién compartimos tus datos</h2>
        <p>Utilizamos los siguientes proveedores, que actúan como encargados del tratamiento:</p>
        <ul>
          <li><strong>Railway</strong> (alojamiento del backend y base de datos)</li>
          <li><strong>Vercel</strong> (alojamiento del frontend)</li>
          <li><strong>Cloudflare</strong> (DNS, almacenamiento de imágenes, email)</li>
          <li><strong>Stripe</strong> (procesamiento de pagos)</li>
          <li><strong>Resend</strong> (envío de emails transaccionales)</li>
          <li><strong>hCaptcha</strong> (verificación anti-spam en registro)</li>
        </ul>
        <p>No vendemos ni cedemos tus datos a terceros con fines publicitarios.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Plazo de conservación</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Si suspendes tu cuenta, tus datos
          quedan ocultos y podrás recuperarla iniciando sesión de nuevo. Si eliminas tu cuenta de
          forma definitiva, conservaremos los datos necesarios durante <strong>5 años</strong> por
          obligaciones legales y fiscales, tras lo cual serán eliminados o anonimizados.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Tus derechos</h2>
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación
          y portabilidad escribiendo a <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
          También puedes suspender o eliminar tu cuenta directamente desde la sección "Mi perfil".
          Si consideras que no hemos atendido tu solicitud correctamente, puedes reclamar ante la
          Agencia Española de Protección de Datos (aepd.es).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">7. Cookies</h2>
        <p>
          Consulta nuestra <a href="/cookies">Política de Cookies</a> para más información sobre
          las cookies y tecnologías similares que usamos.
        </p>

        <p className="text-xs text-muted-foreground mt-8">
          Última actualización: agosto de 2026.
        </p>
      </div>
    </Layout>
  );
}
