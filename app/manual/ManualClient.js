"use client";

export default function ManualClient() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition">
            ← Volver al Dashboard
          </a>
          <h1 className="text-lg font-semibold">📚 Manual de Usuario</h1>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="prose prose-invert prose-cyan max-w-none">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-4xl">
              ⚡
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Mineiro Editor
            </h1>
            <p className="text-xl text-slate-300">
              Guía completa para editar tu sitio web visualmente
            </p>
          </div>

          {/* Quick Start */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-3">
              🚀 Inicio Rápido
            </h2>
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
              <ol className="space-y-4 list-decimal list-inside">
                <li className="text-slate-200">
                  <strong className="text-white">Instala el script:</strong> Agrega el código de Mineiro a tu página web
                </li>
                <li className="text-slate-200">
                  <strong className="text-white">Activa el editor:</strong> Agrega <code className="bg-slate-800 px-2 py-1 rounded text-amber-400">?mineiro-admin</code> a cualquier URL de tu sitio
                </li>
                <li className="text-slate-200">
                  <strong className="text-white">Edita visualmente:</strong> Haz clic en cualquier elemento con borde punteado
                </li>
                <li className="text-slate-200">
                  <strong className="text-white">Guarda cambios:</strong> Clic en "Guardar" - los cambios se sincronizan automáticamente
                </li>
              </ol>
            </div>
          </section>

          {/* Installation */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-violet-400 mb-6 flex items-center gap-3">
              📦 Instalación
            </h2>
            
            <h3 className="text-lg font-semibold mb-3">Paso 1: Agregar el Script</h3>
            <p className="text-slate-300 mb-4">
              Copia y pega este código antes de cerrar la etiqueta <code className="bg-slate-800 px-2 py-1 rounded">&lt;/body&gt;</code> de tu página:
            </p>
            <div className="bg-slate-900 rounded-xl overflow-hidden mb-6">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <span className="text-sm text-slate-400">HTML</span>
                <button 
                  onClick={() => navigator.clipboard.writeText('<script src="https://mineiro-clientes.vercel.app/mineiro.js" data-mineiro-site="tu-sitio"></script>')}
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  📋 Copiar
                </button>
              </div>
              <pre className="p-4 text-sm overflow-x-auto">
                <code className="text-emerald-400">&lt;script</code>
                <code className="text-cyan-300"> src</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"https://mineiro-clientes.vercel.app/mineiro.js"</code>
                {"\n  "}
                <code className="text-cyan-300">data-mineiro-site</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"tu-sitio"</code>
                <code className="text-emerald-400">&gt;&lt;/script&gt;</code>
              </pre>
            </div>

            <h3 className="text-lg font-semibold mb-3">Paso 2: Marcar Elementos Editables</h3>
            <p className="text-slate-300 mb-4">
              Usa el atributo <code className="bg-slate-800 px-2 py-1 rounded text-cyan-400">data-mineiro-bind</code> para hacer elementos editables:
            </p>
            <div className="bg-slate-900 rounded-xl overflow-hidden">
              <pre className="p-4 text-sm overflow-x-auto">
                <code className="text-slate-400">&lt;!-- Texto simple --&gt;</code>{"\n"}
                <code className="text-emerald-400">&lt;h1</code>
                <code className="text-cyan-300"> data-mineiro-bind</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"hero.titulo"</code>
                <code className="text-emerald-400">&gt;</code>
                <code className="text-white">Bienvenidos</code>
                <code className="text-emerald-400">&lt;/h1&gt;</code>{"\n\n"}
                
                <code className="text-slate-400">&lt;!-- Imagen --&gt;</code>{"\n"}
                <code className="text-emerald-400">&lt;img</code>
                <code className="text-cyan-300"> data-mineiro-bind</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"hero.imagen"</code>
                <code className="text-cyan-300"> src</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"imagen.jpg"</code>
                <code className="text-emerald-400">&gt;</code>
              </pre>
            </div>
          </section>

          {/* Bindings Reference */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-3">
              📋 Referencia de Atributos
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Prefijo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Descripción</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ejemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr className="hover:bg-slate-900/50">
                    <td className="px-4 py-3"><code className="text-cyan-400">config-tienda.</code></td>
                    <td className="px-4 py-3 text-slate-300">Datos generales de la tienda</td>
                    <td className="px-4 py-3"><code className="text-amber-400">config-tienda.nombre_tienda</code></td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="px-4 py-3"><code className="text-cyan-400">hero.</code></td>
                    <td className="px-4 py-3 text-slate-300">Sección principal/hero</td>
                    <td className="px-4 py-3"><code className="text-amber-400">hero.titulo</code></td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="px-4 py-3"><code className="text-cyan-400">footer.</code></td>
                    <td className="px-4 py-3 text-slate-300">Pie de página</td>
                    <td className="px-4 py-3"><code className="text-amber-400">footer.telefono</code></td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="px-4 py-3"><code className="text-cyan-400">producto-{'{id}'}.</code></td>
                    <td className="px-4 py-3 text-slate-300">Producto específico</td>
                    <td className="px-4 py-3"><code className="text-amber-400">producto-pizza.nombre</code></td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="px-4 py-3"><code className="text-cyan-400">testimonio-{'{id}'}.</code></td>
                    <td className="px-4 py-3 text-slate-300">Testimonio/reseña</td>
                    <td className="px-4 py-3"><code className="text-amber-400">testimonio-juan.texto</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Product Example */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center gap-3">
              🍕 Ejemplo: Tarjeta de Producto
            </h2>
            
            <div className="bg-slate-900 rounded-xl overflow-hidden">
              <pre className="p-4 text-sm overflow-x-auto">
                <code className="text-emerald-400">&lt;div</code>
                <code className="text-cyan-300"> class</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"product-card"</code>
                <code className="text-emerald-400">&gt;</code>{"\n"}
                {"  "}<code className="text-emerald-400">&lt;img</code>{"\n"}
                {"    "}<code className="text-cyan-300">data-mineiro-bind</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"producto-pizza-margherita.imagen_url"</code>{"\n"}
                {"    "}<code className="text-cyan-300">src</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"pizza.jpg"</code>
                <code className="text-emerald-400">&gt;</code>{"\n\n"}
                
                {"  "}<code className="text-emerald-400">&lt;h3</code>
                <code className="text-cyan-300"> data-mineiro-bind</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"producto-pizza-margherita.nombre"</code>
                <code className="text-emerald-400">&gt;</code>{"\n"}
                {"    "}<code className="text-white">Pizza Margherita</code>{"\n"}
                {"  "}<code className="text-emerald-400">&lt;/h3&gt;</code>{"\n\n"}
                
                {"  "}<code className="text-emerald-400">&lt;p</code>
                <code className="text-cyan-300"> data-mineiro-bind</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"producto-pizza-margherita.descripcion"</code>
                <code className="text-emerald-400">&gt;</code>{"\n"}
                {"    "}<code className="text-white">Deliciosa pizza con tomate y mozzarella</code>{"\n"}
                {"  "}<code className="text-emerald-400">&lt;/p&gt;</code>{"\n\n"}
                
                {"  "}<code className="text-emerald-400">&lt;span</code>
                <code className="text-cyan-300"> data-mineiro-bind</code>
                <code className="text-white">=</code>
                <code className="text-amber-400">"producto-pizza-margherita.precio"</code>
                <code className="text-emerald-400">&gt;</code>{"\n"}
                {"    "}<code className="text-white">$9.990</code>{"\n"}
                {"  "}<code className="text-emerald-400">&lt;/span&gt;</code>{"\n"}
                <code className="text-emerald-400">&lt;/div&gt;</code>
              </pre>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-pink-400 mb-6 flex items-center gap-3">
              ⌨️ Atajos de Teclado
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
                <kbd className="px-3 py-2 bg-slate-800 rounded-lg text-cyan-400 font-mono">Ctrl+Z</kbd>
                <span className="text-slate-300">Deshacer último cambio</span>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
                <kbd className="px-3 py-2 bg-slate-800 rounded-lg text-cyan-400 font-mono">Escape</kbd>
                <span className="text-slate-300">Cerrar popup de edición</span>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
                <kbd className="px-3 py-2 bg-slate-800 rounded-lg text-cyan-400 font-mono">Enter</kbd>
                <span className="text-slate-300">Guardar cambio (en campos de texto)</span>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
                <kbd className="px-3 py-2 bg-slate-800 rounded-lg text-cyan-400 font-mono">Ctrl+B</kbd>
                <span className="text-slate-300">Texto en negrita</span>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
                <kbd className="px-3 py-2 bg-slate-800 rounded-lg text-cyan-400 font-mono">Ctrl+I</kbd>
                <span className="text-slate-300">Texto en cursiva</span>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
                <kbd className="px-3 py-2 bg-slate-800 rounded-lg text-cyan-400 font-mono">Ctrl+U</kbd>
                <span className="text-slate-300">Texto subrayado</span>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-3">
              💡 Consejos Pro
            </h2>
            
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-xl p-4 border border-cyan-500/20">
                <h4 className="font-semibold text-cyan-400 mb-2">Formato por palabras</h4>
                <p className="text-slate-300 text-sm">
                  Selecciona solo las palabras que quieres formatear antes de aplicar negrita, cursiva, etc.
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 rounded-xl p-4 border border-violet-500/20">
                <h4 className="font-semibold text-violet-400 mb-2">Restaurar original</h4>
                <p className="text-slate-300 text-sm">
                  Usa el estilo "Original" para volver exactamente al texto que tenías en tu código HTML.
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl p-4 border border-emerald-500/20">
                <h4 className="font-semibold text-emerald-400 mb-2">IDs únicos para productos</h4>
                <p className="text-slate-300 text-sm">
                  Usa nombres descriptivos como <code className="text-amber-400">producto-pizza-margherita</code> en vez de números.
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
                <h4 className="font-semibold text-amber-400 mb-2">Sincronización automática</h4>
                <p className="text-slate-300 text-sm">
                  Los cambios se guardan en tiempo real. Si tienes múltiples pestañas abiertas, todas se actualizan.
                </p>
              </div>
            </div>
          </section>

          {/* Support */}
          <section className="text-center py-8">
            <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800">
              <h3 className="text-xl font-semibold mb-4">¿Necesitas ayuda?</h3>
              <p className="text-slate-300 mb-6">
                Si tienes preguntas o problemas, no dudes en contactarnos.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a 
                  href="mailto:soporte@mineiro.app" 
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-xl text-white font-semibold hover:brightness-110 transition"
                >
                  📧 Contactar Soporte
                </a>
                <a 
                  href="/dashboard" 
                  className="px-6 py-3 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition"
                >
                  ← Volver al Dashboard
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
