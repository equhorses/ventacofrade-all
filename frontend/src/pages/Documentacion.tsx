import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import { BookOpen, Users, ShieldCheck, Camera, CreditCard, MessageCircle, BarChart3, HelpCircle, Globe, Layout as LayoutIcon, Search, Heart, Store, FileText, Download } from 'lucide-react';

export default function DocumentacionPage() {
  return (
    <Layout>
      {/* Header */}
      <section className="bg-gradient-to-br from-primary/5 to-secondary/5 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Documentación / Documentation</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Guía completa para vendedores y profesionales del mundo cofrade en VentaCofrade.
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Complete guide for sellers and professionals in the cofrade world on VentaCofrade.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <a href="/VentaCofrade-Documentacion.pdf" download>
              <Button variant="default" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Descargar Documentación PDF
              </Button>
            </a>
            <a href="/VentaCofrade-Vistas.pdf" download>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Descargar Vistas PDF
              </Button>
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="es" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="es" className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Español
            </TabsTrigger>
            <TabsTrigger value="en" className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> English
            </TabsTrigger>
          </TabsList>

          {/* ==================== SPANISH ==================== */}
          <TabsContent value="es" className="space-y-8">
            {/* Views / Vistas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutIcon className="h-5 w-5 text-primary" />
                  Vistas de la Plataforma
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">VentaCofrade cuenta con las siguientes vistas principales:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Inicio</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Página principal con buscador hero, categorías destacadas y productos destacados. Ruta: <code className="bg-muted px-1 rounded">/</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Explorar</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Listado completo de anuncios con filtros por categoría, precio, condición y ubicación. Ruta: <code className="bg-muted px-1 rounded">/explorar</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Detalle de Producto</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Vista detallada de cada artículo con galería de fotos, descripción, datos del vendedor y botón de contacto. Ruta: <code className="bg-muted px-1 rounded">/producto/:id</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Publicar Anuncio</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Formulario para crear un nuevo anuncio con título, descripción, fotos, precio, categoría y ubicación. Ruta: <code className="bg-muted px-1 rounded">/publicar</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Vender</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Información sobre planes de suscripción para vendedores (Básico y Profesional) con comparativa de características. Ruta: <code className="bg-muted px-1 rounded">/vender</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Favoritos</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Listado de artículos guardados como favoritos por el usuario. Ruta: <code className="bg-muted px-1 rounded">/favoritos</code></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Getting Started ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  1. Primeros pasos
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none space-y-3">
                <p className="text-muted-foreground">Para empezar a vender en VentaCofrade necesitas:</p>
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">Crear una cuenta:</strong> Regístrate con tu email o cuenta de Google.</li>
                  <li><strong className="text-foreground">Activar tu tienda:</strong> Pago único de 10€ para verificar tu identidad como vendedor.</li>
                  <li><strong className="text-foreground">Elegir un plan:</strong> Plan Básico (4,99€/mes) o Profesional (9,99€/mes).</li>
                  <li><strong className="text-foreground">Completar tu perfil:</strong> Nombre de tienda, ubicación y descripción.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Publishing ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  2. Publicar anuncios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">Consejos para crear anuncios efectivos:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">📸 Fotografías</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Usa luz natural, preferiblemente de día</li>
                      <li>• Muestra el artículo desde varios ángulos</li>
                      <li>• Incluye fotos de detalle (marcas, estado)</li>
                      <li>• Fondo neutro para destacar la pieza</li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">✍️ Descripción</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Título claro y descriptivo</li>
                      <li>• Medidas exactas del artículo</li>
                      <li>• Material y técnica (plata, oro, bordado)</li>
                      <li>• Historia o procedencia si la conoces</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-primary/5 rounded-lg p-4 mt-4">
                  <h4 className="font-semibold text-sm mb-2 text-primary">Categorías disponibles</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>• Túnicas y Capirotes</span>
                    <span>• Cirios y Velas</span>
                    <span>• Orfebrería</span>
                    <span>• Bordados</span>
                    <span>• Imágenes y Figuras</span>
                    <span>• Insignias y Medallas</span>
                    <span>• Instrumentos Musicales</span>
                    <span>• Complementos</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  3. Planes y precios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 font-semibold">Característica</th>
                        <th className="text-center py-3 font-semibold">Básico (4,99€/mes)</th>
                        <th className="text-center py-3 font-semibold">Profesional (9,99€/mes)</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="py-2">Anuncios activos</td>
                        <td className="text-center">10</td>
                        <td className="text-center">Ilimitados</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Fotos por anuncio</td>
                        <td className="text-center">Ilimitadas</td>
                        <td className="text-center">Ilimitadas</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Anuncios destacados</td>
                        <td className="text-center">—</td>
                        <td className="text-center">3/mes</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Estadísticas</td>
                        <td className="text-center">Básicas</td>
                        <td className="text-center">Avanzadas</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Prioridad en búsquedas</td>
                        <td className="text-center">—</td>
                        <td className="text-center">✓</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Badge verificado</td>
                        <td className="text-center">—</td>
                        <td className="text-center">✓</td>
                      </tr>
                      <tr>
                        <td className="py-2">Soporte</td>
                        <td className="text-center">Email</td>
                        <td className="text-center">Prioritario</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Messaging ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  4. Mensajería y comunicación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>El sistema de mensajería integrado te permite:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Recibir consultas de compradores interesados</li>
                  <li>Negociar precios de forma privada</li>
                  <li>Coordinar la entrega o envío del artículo</li>
                  <li>Mantener un historial de conversaciones</li>
                </ul>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                  <p className="text-yellow-800 text-xs"><strong>Consejo:</strong> Responde rápido a los mensajes. Los vendedores con respuesta en menos de 2 horas tienen un 70% más de ventas.</p>
                </div>
              </CardContent>
            </Card>

            {/* Analytics ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  5. Estadísticas y rendimiento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Con el panel de estadísticas puedes ver:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-foreground text-lg">Visitas</p>
                    <p className="text-xs">Cuántas personas ven tus anuncios</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-foreground text-lg">Mensajes</p>
                    <p className="text-xs">Consultas recibidas por anuncio</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-foreground text-lg">Favoritos</p>
                    <p className="text-xs">Veces guardado por compradores</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  6. Seguridad y confianza
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>VentaCofrade protege a vendedores y compradores:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Verificación de vendedores:</strong> El pago de activación ayuda a filtrar cuentas falsas.</li>
                  <li><strong className="text-foreground">Mensajería directa:</strong> Contacta con la otra persona sin salir de la plataforma.</li>
                  <li><strong className="text-foreground">Moderación:</strong> Revisamos anuncios para mantener la calidad del marketplace.</li>
                  <li><strong className="text-foreground">Datos protegidos:</strong> Tu información personal nunca se comparte sin tu consentimiento.</li>
                </ul>
              </CardContent>
            </Card>

            {/* FAQ ES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  7. Preguntas frecuentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { q: '¿Puedo vender sin ser profesional?', a: 'Sí, cualquier cofrade puede vender artículos. El plan básico es perfecto para particulares.' },
                  { q: '¿Cómo se realiza el pago entre comprador y vendedor?', a: 'VentaCofrade facilita el contacto. El pago se acuerda directamente entre las partes (transferencia, efectivo en mano, Bizum, etc.).' },
                  { q: '¿Puedo cancelar mi suscripción?', a: 'Sí, puedes cancelar en cualquier momento. Tu tienda permanecerá activa hasta el fin del período pagado.' },
                  { q: '¿Qué pasa si un comprador no paga?', a: 'Recomendamos acordar el pago antes del envío. Para artículos de alto valor, sugerimos entrega en persona.' },
                  { q: '¿Puedo vender artículos de fuera de Andalucía?', a: 'Sí, el marketplace está abierto a toda España, aunque la mayoría de usuarios están en Andalucía.' },
                ].map((faq, i) => (
                  <div key={i}>
                    <h4 className="font-semibold text-sm text-foreground mb-1">{faq.q}</h4>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                    {i < 4 && <Separator className="mt-4" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ENGLISH ==================== */}
          <TabsContent value="en" className="space-y-8">
            {/* Views / Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutIcon className="h-5 w-5 text-primary" />
                  Platform Views
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">VentaCofrade includes the following main views:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Home</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Main landing page with hero search bar, featured categories, and highlighted products. Route: <code className="bg-muted px-1 rounded">/</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Explore</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Full product listing with filters by category, price range, condition, and location. Route: <code className="bg-muted px-1 rounded">/explorar</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Product Detail</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Detailed view of each item with photo gallery, full description, seller info, and contact button. Route: <code className="bg-muted px-1 rounded">/producto/:id</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Create Listing</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Form to create a new listing with title, description, photos, price, category, and location. Route: <code className="bg-muted px-1 rounded">/publicar</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Sell</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Information about seller subscription plans (Basic and Professional) with feature comparison. Route: <code className="bg-muted px-1 rounded">/vender</code></p>
                  </div>
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Favorites</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">List of items saved as favorites by the user for quick access later. Route: <code className="bg-muted px-1 rounded">/favoritos</code></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Getting Started EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  1. Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none space-y-3">
                <p className="text-muted-foreground">To start selling on VentaCofrade you need:</p>
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">Create an account:</strong> Register with your email or Google account.</li>
                  <li><strong className="text-foreground">Activate your shop:</strong> One-time payment of €10 to verify your identity as a seller.</li>
                  <li><strong className="text-foreground">Choose a plan:</strong> Basic Plan (€4.99/month) or Professional (€9.99/month).</li>
                  <li><strong className="text-foreground">Complete your profile:</strong> Shop name, location, and description.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Publishing EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  2. Publishing Listings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">Tips for creating effective listings:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">📸 Photography</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Use natural light, preferably during daytime</li>
                      <li>• Show the item from multiple angles</li>
                      <li>• Include detail shots (marks, condition)</li>
                      <li>• Use a neutral background to highlight the piece</li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">✍️ Description</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Clear and descriptive title</li>
                      <li>• Exact measurements of the item</li>
                      <li>• Material and technique (silver, gold, embroidery)</li>
                      <li>• History or provenance if known</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-primary/5 rounded-lg p-4 mt-4">
                  <h4 className="font-semibold text-sm mb-2 text-primary">Available Categories</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>• Robes & Hoods</span>
                    <span>• Candles & Wax</span>
                    <span>• Silverwork</span>
                    <span>• Embroidery</span>
                    <span>• Statues & Figures</span>
                    <span>• Badges & Medals</span>
                    <span>• Musical Instruments</span>
                    <span>• Accessories</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  3. Plans & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 font-semibold">Feature</th>
                        <th className="text-center py-3 font-semibold">Basic (€4.99/mo)</th>
                        <th className="text-center py-3 font-semibold">Professional (€9.99/mo)</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b">
                        <td className="py-2">Active listings</td>
                        <td className="text-center">10</td>
                        <td className="text-center">Unlimited</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Photos per listing</td>
                        <td className="text-center">Unlimited</td>
                        <td className="text-center">Unlimited</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Featured listings</td>
                        <td className="text-center">—</td>
                        <td className="text-center">3/month</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Analytics</td>
                        <td className="text-center">Basic</td>
                        <td className="text-center">Advanced</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Search priority</td>
                        <td className="text-center">—</td>
                        <td className="text-center">✓</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Verified badge</td>
                        <td className="text-center">—</td>
                        <td className="text-center">✓</td>
                      </tr>
                      <tr>
                        <td className="py-2">Support</td>
                        <td className="text-center">Email</td>
                        <td className="text-center">Priority</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Messaging EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  4. Messaging & Communication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>The integrated messaging system allows you to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Receive inquiries from interested buyers</li>
                  <li>Negotiate prices privately</li>
                  <li>Coordinate delivery or shipping of the item</li>
                  <li>Keep a conversation history</li>
                </ul>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                  <p className="text-yellow-800 text-xs"><strong>Tip:</strong> Respond quickly to messages. Sellers who reply within 2 hours have 70% more sales.</p>
                </div>
              </CardContent>
            </Card>

            {/* Analytics EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  5. Analytics & Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>With the analytics dashboard you can see:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-foreground text-lg">Views</p>
                    <p className="text-xs">How many people see your listings</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-foreground text-lg">Messages</p>
                    <p className="text-xs">Inquiries received per listing</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-foreground text-lg">Favorites</p>
                    <p className="text-xs">Times saved by potential buyers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  6. Security & Trust
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>VentaCofrade protects both sellers and buyers:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Seller verification:</strong> The activation payment helps filter out fake accounts.</li>
                  <li><strong className="text-foreground">Rating system:</strong> Buyers can rate their experience.</li>
                  <li><strong className="text-foreground">Moderation:</strong> We review listings to maintain marketplace quality.</li>
                  <li><strong className="text-foreground">Data protection:</strong> Your personal information is never shared without your consent.</li>
                </ul>
              </CardContent>
            </Card>

            {/* FAQ EN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  7. Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { q: 'Can I sell without being a professional?', a: 'Yes, any cofrade member can sell items. The basic plan is perfect for individuals.' },
                  { q: 'How is payment handled between buyer and seller?', a: 'VentaCofrade facilitates contact. Payment is agreed directly between parties (bank transfer, cash in person, Bizum, etc.).' },
                  { q: 'Can I cancel my subscription?', a: 'Yes, you can cancel at any time. Your shop will remain active until the end of the paid period.' },
                  { q: 'What if a buyer doesn\'t pay?', a: 'We recommend agreeing on payment before shipping. For high-value items, we suggest in-person delivery.' },
                  { q: 'Can I sell items from outside Andalusia?', a: 'Yes, the marketplace is open to all of Spain, although most users are in Andalusia.' },
                ].map((faq, i) => (
                  <div key={i}>
                    <h4 className="font-semibold text-sm text-foreground mb-1">{faq.q}</h4>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                    {i < 4 && <Separator className="mt-4" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}