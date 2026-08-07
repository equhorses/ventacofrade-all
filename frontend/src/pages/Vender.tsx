import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { Check, Zap, Crown, Camera, MessageCircle, BarChart3, Star } from 'lucide-react';

export default function VenderPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4 bg-secondary/20 text-secondary border-secondary/30">
            Para vendedores
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Vende tus artículos cofrades
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Llega a miles de cofrades en toda Andalucía. Publica tus artículos de orfebrería, 
            bordados, túnicas y más en el marketplace de referencia.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-10">¿Cómo funciona?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">1</div>
              <h3 className="font-semibold mb-2">Activa tu tienda</h3>
              <p className="text-sm text-muted-foreground">Pago único de activación de 10€ para verificar tu cuenta de vendedor</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">2</div>
              <h3 className="font-semibold mb-2">Publica anuncios</h3>
              <p className="text-sm text-muted-foreground">Sube fotos, describe tus artículos y establece el precio</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">3</div>
              <h3 className="font-semibold mb-2">Conecta y vende</h3>
              <p className="text-sm text-muted-foreground">Recibe mensajes de compradores interesados y cierra la venta</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-3">Planes para vendedores</h2>
          <p className="text-center text-muted-foreground mb-10">Elige el plan que mejor se adapte a tus necesidades</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Basic Plan */}
            <Card className="border-2 border-border">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Zap className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Plan Básico</CardTitle>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">4,99€</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">+ 10€ activación única</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {[
                    'Hasta 10 anuncios activos',
                    'Fotos ilimitadas por anuncio',
                    'Mensajería con compradores',
                    'Perfil de vendedor',
                    'Soporte por email',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/publicar" className="block">
                  <Button className="w-full mt-4 bg-primary hover:bg-primary/90 cursor-pointer">
                    Empezar ahora
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-secondary relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-secondary text-secondary-foreground">Más popular</Badge>
              </div>
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary/20 text-secondary flex items-center justify-center">
                  <Crown className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Plan Profesional</CardTitle>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">9,99€</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">+ 10€ activación única</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {[
                    'Anuncios ilimitados',
                    'Anuncios destacados (x3/mes)',
                    'Estadísticas avanzadas',
                    'Prioridad en búsquedas',
                    'Soporte prioritario',
                    'Badge de vendedor verificado',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/publicar" className="block">
                  <Button className="w-full mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/90 cursor-pointer">
                    Elegir Profesional
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-10">Herramientas para tu éxito</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Camera, title: 'Fotos HD', desc: 'Sube fotos en alta calidad de tus artículos' },
              { icon: MessageCircle, title: 'Chat directo', desc: 'Comunícate con compradores al instante' },
              { icon: BarChart3, title: 'Estadísticas', desc: 'Conoce las visitas y el interés en tus anuncios' },
              { icon: Star, title: 'Valoraciones', desc: 'Construye tu reputación como vendedor' },
            ].map((feat) => (
              <Card key={feat.title} className="border border-border">
                <CardContent className="p-5 text-center">
                  <feat.icon className="h-8 w-8 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold text-sm mb-1">{feat.title}</h3>
                  <p className="text-xs text-muted-foreground">{feat.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}