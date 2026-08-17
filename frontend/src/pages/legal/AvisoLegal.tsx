import Layout from '@/components/Layout';

export default function AvisoLegal() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Aviso Legal</h1>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. Datos identificativos</h2>
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la
          Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los
          siguientes datos:
        </p>
        <ul>
          <li><strong>Titular:</strong> [PENDIENTE: nombre completo o razón social]</li>
          <li><strong>NIF/CIF:</strong> [PENDIENTE: número de NIF o CIF]</li>
          <li><strong>Domicilio:</strong> [PENDIENTE: dirección fiscal completa]</li>
          <li><strong>Email de contacto:</strong> contacto@ventacofrade.com</li>
          <li><strong>Dominio:</strong> ventacofrade.com</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Objeto</h2>
        <p>
          VentaCofrade es un marketplace que actúa como intermediario, poniendo en contacto a
          personas usuarias que desean comprar y vender artículos relacionados con el mundo
          cofrade (orfebrería, bordados, túnicas, cirios y similares). VentaCofrade no es parte
          en las compraventas realizadas entre usuarios, no interviene en la entrega de los
          artículos ni garantiza la calidad, legalidad o autenticidad de los mismos.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Condiciones de acceso y uso</h2>
        <p>
          El acceso a VentaCofrade es gratuito, salvo en lo relativo a las tarifas de vendedor
          descritas en la sección "Vender". El uso del sitio atribuye la condición de usuario y
          conlleva la aceptación de este Aviso Legal, de los Términos y Condiciones y de la
          Política de Privacidad.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Propiedad intelectual</h2>
        <p>
          Todos los contenidos del sitio (textos, diseño, logotipos, código) son propiedad de
          VentaCofrade o de sus licenciantes, salvo el contenido subido por los propios usuarios
          (fotografías y descripciones de sus anuncios), cuya responsabilidad recae en quien lo
          publica.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Limitación de responsabilidad</h2>
        <p>
          VentaCofrade no se responsabiliza de los daños derivados de transacciones realizadas
          entre usuarios, del contenido publicado por terceros, ni de la disponibilidad continua
          e ininterrumpida del servicio.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Legislación aplicable</h2>
        <p>
          Este Aviso Legal se rige por la legislación española. Para cualquier controversia,
          las partes se someten a los juzgados y tribunales que correspondan conforme a derecho.
        </p>

        <p className="text-xs text-muted-foreground mt-8">
          Última actualización: agosto de 2026.
        </p>
      </div>
    </Layout>
  );
}
