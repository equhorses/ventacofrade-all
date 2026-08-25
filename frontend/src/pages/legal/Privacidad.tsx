import Layout from '@/components/Layout';

export default function Privacidad() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>

        <p>
          En VentaCofrade nos tomamos en serio la protección de tus datos personales. Esta
          Política de Privacidad explica qué datos recogemos, con qué finalidad, durante cuánto
          tiempo y qué derechos tienes al respecto, en cumplimiento del Reglamento (UE) 2016/679
          (RGPD) y de la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los
          derechos digitales (LOPDGDD).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. Responsable del tratamiento</h2>
        <ul>
          <li><strong>Responsable:</strong> Daniel Ariza Otero</li>
          <li><strong>NIF/CIF:</strong> 44966216C</li>
          <li><strong>Domicilio:</strong> C/ Zarza 20B, El Puerto de Santa María, Cádiz</li>
          <li><strong>Email:</strong> contacto@ventacofrade.com</li>
        </ul>
        <p>
          Dado el volumen y naturaleza del tratamiento, no resulta obligatoria la designación de
          un Delegado de Protección de Datos (DPO), sin perjuicio de que puedas dirigir cualquier
          consulta sobre privacidad al email anterior.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Datos que recogemos y su origen</h2>
        <p>Todos los datos que tratamos proceden directamente de ti, al usar la Plataforma:</p>
        <ul>
          <li><strong>Datos de cuenta:</strong> email, nombre, contraseña (almacenada de forma cifrada), foto de perfil.</li>
          <li>
            <strong>Datos de perfil de vendedor:</strong> nombre de tienda, descripción, provincia,
            ciudad, teléfono de contacto.
          </li>
          <li>
            <strong>Datos de perfil profesional (Red Profesional):</strong> especialidad,
            descripción, provincia, ciudad, teléfono, WhatsApp y fotografías de portafolio, si
            decides crear un perfil profesional.
          </li>
          <li>
            <strong>Valoraciones:</strong> la puntuación y el comentario que dejas sobre un
            vendedor o perfil profesional, o que otras personas dejan sobre el tuyo.
          </li>
          <li>
            <strong>Datos de pago:</strong> gestionados directamente por Stripe, nuestro
            proveedor de pasarela de pago. VentaCofrade no almacena ni tiene acceso en ningún
            momento a los números completos de tarjeta.
          </li>
          <li><strong>Comunicaciones:</strong> mensajes intercambiados entre personas compradoras y vendedoras dentro de la Plataforma.</li>
          <li><strong>Datos de lista de espera:</strong> email, durante la fase de lanzamiento de la Plataforma.</li>
          <li>
            <strong>Registro de seguridad:</strong> email, dirección IP y resultado (éxito o
            fallo) de cada intento de inicio de sesión, conservado con fines de prevención de
            fraude y detección de accesos indebidos.
          </li>
          <li>
            <strong>Datos técnicos y de navegación:</strong> dirección IP, tipo de navegador y
            dispositivo, páginas visitadas, recogidos de forma automática por nuestros
            proveedores de alojamiento e infraestructura con fines de seguridad y funcionamiento
            del servicio.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Finalidades y bases legales del tratamiento</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Finalidad</th>
              <th className="text-left py-2">Base legal</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">Gestionar tu cuenta y permitir el uso de la Plataforma</td>
              <td className="py-2">Ejecución de contrato</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Mostrar tu perfil de vendedor y tus anuncios a otras personas usuarias</td>
              <td className="py-2">Ejecución de contrato</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Mostrar tu perfil profesional en la Red Profesional, si creas uno</td>
              <td className="py-2">Ejecución de contrato</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Mostrar las valoraciones que dejas o que recibes</td>
              <td className="py-2">Ejecución de contrato</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Procesar el pago de tu suscripción de vendedor</td>
              <td className="py-2">Ejecución de contrato</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Enviarte comunicaciones transaccionales (bienvenida, confirmaciones de pago)</td>
              <td className="py-2">Ejecución de contrato</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Avisarte del lanzamiento si te apuntas a la lista de espera</td>
              <td className="py-2">Consentimiento</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Prevenir fraude, detectar accesos indebidos y verificar que no eres un robot (hCaptcha)</td>
              <td className="py-2">Interés legítimo</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Cumplir obligaciones fiscales, contables y legales</td>
              <td className="py-2">Obligación legal</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Destinatarios de los datos</h2>
        <p>
          No vendemos ni cedemos tus datos a terceros con fines publicitarios. Compartimos datos
          únicamente con los proveedores estrictamente necesarios para prestar el servicio, que
          actúan como encargados del tratamiento bajo contrato:
        </p>
        <ul>
          <li><strong>Railway</strong> — alojamiento del servidor y base de datos.</li>
          <li><strong>Vercel</strong> — alojamiento del sitio web.</li>
          <li><strong>Cloudflare</strong> — gestión de DNS, almacenamiento de imágenes y enrutamiento de email.</li>
          <li><strong>Stripe</strong> — procesamiento seguro de pagos.</li>
          <li><strong>Resend</strong> — envío de emails transaccionales.</li>
          <li><strong>hCaptcha</strong> — verificación anti-spam en el registro.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Transferencias internacionales</h2>
        <p>
          Algunos de nuestros proveedores (entre ellos, Stripe, Cloudflare y Resend) pueden
          procesar datos en servidores ubicados fuera del Espacio Económico Europeo, en
          particular en Estados Unidos. En estos casos, dichos proveedores cuentan con mecanismos
          de garantía reconocidos por la normativa europea, como las Cláusulas Contractuales Tipo
          aprobadas por la Comisión Europea, que aseguran un nivel de protección equivalente al
          exigido en la UE.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Plazo de conservación</h2>
        <p>
          Conservamos tus datos mientras tu cuenta permanezca activa y sea necesario para prestar
          el servicio:
        </p>
        <ul>
          <li>
            <strong>Cuenta suspendida:</strong> tus datos y anuncios quedan ocultos, pero se
            conservan íntegros para que puedas recuperar tu cuenta iniciando sesión de nuevo,
            sin límite de tiempo predeterminado.
          </li>
          <li>
            <strong>Cuenta eliminada de forma definitiva:</strong> conservaremos los datos
            estrictamente necesarios durante un plazo de <strong>5 años</strong> desde la
            solicitud de eliminación, por obligaciones legales, fiscales y de posible defensa
            ante reclamaciones, tras lo cual serán eliminados o anonimizados de forma
            irreversible.
          </li>
          <li>
            <strong>Lista de espera:</strong> hasta el lanzamiento de la Plataforma o hasta que
            solicites tu baja.
          </li>
          <li>
            <strong>Registro de seguridad (intentos de inicio de sesión):</strong> hasta 12 meses
            desde cada intento, pasado ese plazo lo eliminamos.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">7. Tus derechos</h2>
        <p>Como persona interesada, tienes derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> saber qué datos tuyos tratamos.</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos.</li>
          <li><strong>Supresión:</strong> solicitar la eliminación de tus datos.</li>
          <li><strong>Oposición:</strong> oponerte a un tratamiento concreto.</li>
          <li><strong>Limitación:</strong> solicitar que pausemos el tratamiento en determinados casos.</li>
          <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado.</li>
          <li><strong>Retirar tu consentimiento</strong> en cualquier momento, cuando el tratamiento se base en él, sin que ello afecte a la licitud del tratamiento previo.</li>
        </ul>
        <p>
          Puedes ejercer estos derechos escribiendo a{' '}
          <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>, indicando el
          derecho que deseas ejercer y adjuntando un documento que acredite tu identidad. También
          puedes suspender o eliminar tu cuenta directamente desde la sección "Mi perfil".
        </p>
        <p>
          Si consideras que no hemos atendido tu solicitud correctamente, tienes derecho a
          presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) a
          través de{' '}
          <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">8. Menores de edad</h2>
        <p>
          El uso de VentaCofrade está reservado a personas mayores de 18 años. No recogemos de
          forma consciente datos de menores de edad. Si tienes constancia de que un menor ha
          proporcionado datos personales en la Plataforma, contáctanos para proceder a su
          eliminación.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">9. Medidas de seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos frente a
          accesos no autorizados, pérdida o alteración, entre ellas el cifrado de contraseñas, el
          uso de conexiones seguras (HTTPS), el bloqueo temporal de una cuenta tras varios
          intentos de acceso fallidos, un registro interno de accesos del equipo de VentaCofrade
          para fines de seguridad y auditoría, y el acceso restringido a la información por parte
          de nuestro equipo, limitado a lo necesario según el rol de cada persona.
        </p>
        <p>
          Si, a pesar de estas medidas, se produjera una violación de la seguridad de tus datos
          personales que suponga un riesgo para tus derechos y libertades, te lo notificaremos sin
          dilación indebida, junto con las medidas adoptadas, y lo comunicaremos también a la
          Agencia Española de Protección de Datos (AEPD) cuando la normativa así lo exija.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">10. Cookies</h2>
        <p>
          Consulta nuestra <a href="/cookies">Política de Cookies</a> para más información sobre
          las cookies y tecnologías similares que usamos.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">11. Cambios en esta política</h2>
        <p>
          Podemos actualizar esta Política de Privacidad para adaptarla a novedades legislativas
          o cambios en el servicio. Te informaremos de cualquier cambio relevante a través de la
          Plataforma o por email.
        </p>

        <p className="text-xs text-muted-foreground mt-8">
          Última actualización: agosto de 2026.
        </p>
      </div>
    </Layout>
  );
}
