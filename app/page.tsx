export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.2),_transparent_55%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-16">
          <header className="flex flex-col gap-6">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-cyan-400/80">
              Mineiro Client System
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              Digitaliza tu carta y gestiona tu negocio con una plataforma
              profesional.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 md:text-lg">
              Mineiro centraliza tus productos, publicaciones y pagos en un
              panel seguro. Publica tu menú en minutos y controla todo desde un
              dashboard moderno.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
              >
                Acceder a mi Panel
              </a>
              <a
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-slate-700/60 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900/70"
              >
                Ver planes
              </a>
            </div>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
              <h2 className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Beneficios
              </h2>
              <ul className="mt-6 space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-cyan-400" />
                  Control total de productos, precios y categorías en tiempo
                  real.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-violet-400" />
                  Tu menú disponible en la web con imágenes y ordenadas por
                  secciones.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  Pago seguro y activación inmediata de tu servicio.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
              <h2 className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Planes
              </h2>
              <div className="mt-6 grid gap-4">
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/70 p-5">
                  <div className="text-lg font-semibold text-white">Mensual</div>
                  <div className="text-2xl font-semibold text-cyan-400">
                    $50.000
                  </div>
                  <p className="text-sm text-slate-400">
                    Perfecto para negocios en crecimiento.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/70 p-5">
                  <div className="text-lg font-semibold text-white">Anual</div>
                  <div className="text-2xl font-semibold text-violet-400">
                    $500.000
                  </div>
                  <p className="text-sm text-slate-400">
                    Ahorra y asegura tu presencia digital.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
