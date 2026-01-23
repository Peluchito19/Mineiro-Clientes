import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Grid Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg font-bold text-slate-900">
            ⚡
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Mineiro
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/pricing" 
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Precios
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-sm font-medium hover:bg-white/20 transition-all"
          >
            Iniciar Sesión
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-amber-300">Una línea de código. Control total.</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
            <span className="bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
              Edita cualquier web
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-400 bg-clip-text text-transparent">
              sin tocar código
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Tu cliente pega <span className="text-white font-medium">una sola línea de código</span> en su página.
            Tú editas <span className="text-cyan-400 font-medium">precios, textos, imágenes</span> y todo lo demás 
            desde un panel visual que se adapta automáticamente a su sitio.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/login"
              className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-[1.02]"
            >
              <span className="relative z-10">Comenzar Gratis →</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-400 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            </Link>
            <Link
              href="#como-funciona"
              className="px-8 py-4 rounded-2xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800/50 transition-all"
            >
              Ver cómo funciona
            </Link>
          </div>

          {/* Code Preview */}
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-amber-500/20 rounded-3xl blur-2xl opacity-50" />
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-500 ml-2">index.html</span>
              </div>
              <pre className="p-5 text-sm text-left overflow-x-auto">
                <code>
                  <span className="text-slate-500">{"<!-- Pega esto antes de </body> -->"}</span>
                  {"\n"}
                  <span className="text-violet-400">{"<script"}</span>
                  <span className="text-cyan-300">{" src"}</span>
                  <span className="text-white">{"="}</span>
                  <span className="text-amber-300">{'"https://mineiro.app/m.js"'}</span>
                  <span className="text-violet-400">{">"}</span>
                  <span className="text-violet-400">{"</script>"}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="como-funciona" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Edición inteligente que se adapta a cada sitio
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Nuestro motor detecta automáticamente qué elementos son editables
            y genera un panel personalizado para cada cliente.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="group relative rounded-2xl border border-slate-800 bg-slate-900/50 p-8 hover:border-cyan-500/50 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-3xl">🔍</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Detección Automática</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              El motor escanea la página y detecta precios, títulos, imágenes, botones 
              y cualquier elemento editable sin configuración manual.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group relative rounded-2xl border border-slate-800 bg-slate-900/50 p-8 hover:border-violet-500/50 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-3xl">✨</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Panel Personalizado</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Se genera un panel de edición único para cada sitio, organizado por 
              secciones y tipos de contenido. Sin formularios genéricos.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group relative rounded-2xl border border-slate-800 bg-slate-900/50 p-8 hover:border-amber-500/50 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Cambios en Tiempo Real</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Edita y ve los cambios instantáneamente en la vista previa. 
              Al guardar, se aplican automáticamente en la web del cliente.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-12 md:p-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sm text-cyan-400 font-medium tracking-wider uppercase mb-4 block">
                Proceso Simple
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                De instalación a edición en 
                <span className="text-amber-400"> 3 pasos</span>
              </h2>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Tu cliente pega el script</h3>
                    <p className="text-sm text-slate-400">
                      Una línea de código antes de cerrar el body. Funciona con cualquier web: 
                      HTML, WordPress, Shopify, Wix, React, etc.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">El motor escanea y mapea</h3>
                    <p className="text-sm text-slate-400">
                      Automáticamente detecta precios, imágenes, textos y genera 
                      un mapa editable de toda la página.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Tú editas desde el panel</h3>
                    <p className="text-sm text-slate-400">
                      Un panel visual con preview en tiempo real. Cambia precios, 
                      textos, imágenes y todo se actualiza al instante.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden shadow-2xl">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="h-6 rounded-lg bg-slate-700/50 flex items-center px-3">
                      <span className="text-xs text-slate-500">mineiro.app/editor/mi-tienda</span>
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div className="flex h-[300px]">
                  {/* Sidebar */}
                  <div className="w-1/3 border-r border-slate-700 p-3 space-y-2">
                    <div className="h-8 rounded-lg bg-slate-800" />
                    <div className="h-16 rounded-lg bg-cyan-500/20 border border-cyan-500/30" />
                    <div className="h-16 rounded-lg bg-slate-800" />
                    <div className="h-16 rounded-lg bg-violet-500/20 border border-violet-500/30" />
                    <div className="h-16 rounded-lg bg-slate-800" />
                  </div>
                  {/* Preview */}
                  <div className="flex-1 p-4 flex items-center justify-center">
                    <div className="w-full h-full rounded-xl bg-white/5 border border-slate-700 flex items-center justify-center">
                      <span className="text-slate-500 text-sm">Vista previa del sitio</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Planes simples, sin sorpresas
          </h2>
          <p className="text-slate-400">
            Prueba gratis por 5 días. Luego elige el plan que mejor se adapte a ti.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
            <div className="text-sm text-slate-400 mb-2">Mensual</div>
            <div className="text-4xl font-bold text-white mb-1">$50.000</div>
            <div className="text-sm text-slate-500 mb-6">CLP / mes</div>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Sitios ilimitados
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Elementos ilimitados
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Edición en tiempo real
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Soporte prioritario
              </li>
            </ul>
          </div>

          <div className="relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-xs font-bold text-slate-900">
              AHORRA 17%
            </div>
            <div className="text-sm text-amber-400 mb-2">Anual</div>
            <div className="text-4xl font-bold text-white mb-1">$500.000</div>
            <div className="text-sm text-slate-500 mb-6">CLP / año</div>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Todo lo del plan mensual
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> 2 meses gratis
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Onboarding personalizado
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Acceso anticipado a features
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
          >
            Comenzar prueba gratuita
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm font-bold text-slate-900">
                ⚡
              </div>
              <span className="font-semibold">Mineiro</span>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Mineiro. Edición visual para cualquier web.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/pricing" className="hover:text-white transition-colors">Precios</Link>
              <Link href="/login" className="hover:text-white transition-colors">Acceder</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
