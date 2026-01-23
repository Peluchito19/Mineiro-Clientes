"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/utils/supabase/client";
import ProductEditor from "./ProductEditor";

export default function DashboardClient({
  userId,
  userEmail,
  initialTiendas = [],
  initialTienda,
  initialProductos,
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  
  // Multi-store support
  const [tiendas, setTiendas] = useState(initialTiendas);
  const [selectedTienda, setSelectedTienda] = useState(initialTienda);
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(initialTiendas.length === 0);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingNombre, setOnboardingNombre] = useState("");
  const [onboardingUrl, setOnboardingUrl] = useState("");
  
  // Store form
  const [tiendaNombre, setTiendaNombre] = useState(initialTienda?.nombre_negocio ?? "");
  const [tiendaUrl, setTiendaUrl] = useState(initialTienda?.url_web ?? "");
  const [tiendaSlug, setTiendaSlug] = useState(initialTienda?.slug ?? "");
  const [tiendaStatus, setTiendaStatus] = useState("");
  const [creatingTienda, setCreatingTienda] = useState(false);

  // Products
  const [productos, setProductos] = useState(initialProductos ?? []);
  const [productosError, setProductosError] = useState("");

  // Modal editor state
  const [editorProduct, setEditorProduct] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  // Update form when selected tienda changes
  useEffect(() => {
    if (selectedTienda) {
      setTiendaNombre(selectedTienda.nombre_negocio ?? "");
      setTiendaUrl(selectedTienda.url_web ?? "");
      setTiendaSlug(selectedTienda.slug ?? "");
    }
  }, [selectedTienda]);

  // Load products when tienda changes
  useEffect(() => {
    if (!selectedTienda?.id || !supabase) return;

    const loadProducts = async () => {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, precio, categoria, visible, user_id, tienda_id, imagen_url, configuracion, dom_id")
        .eq("tienda_id", selectedTienda.id)
        .order("nombre", { ascending: true });
      setProductos(data ?? []);
    };

    loadProducts();
  }, [selectedTienda?.id, supabase]);

  // Realtime subscription for products
  useEffect(() => {
    if (!selectedTienda?.id || !supabase) return;

    const channel = supabase
      .channel(`productos-${selectedTienda.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos",
          filter: `tienda_id=eq.${selectedTienda.id}`,
        },
        (payload) => {
          setProductos((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((item) => item.id !== payload.old.id);
            }

            const nextRow = payload.new;
            const existingIndex = current.findIndex(
              (item) => item.id === nextRow.id
            );

            if (existingIndex === -1) {
              return [...current, nextRow].sort((a, b) =>
                (a.nombre || "").localeCompare(b.nombre || "")
              );
            }

            const updated = [...current];
            updated[existingIndex] = nextRow;
            return updated.sort((a, b) =>
              (a.nombre || "").localeCompare(b.nombre || "")
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTienda?.id, supabase]);

  const totalProductos = useMemo(() => productos.length, [productos]);

  const categorias = useMemo(() => {
    const cats = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
    return cats.sort();
  }, [productos]);

  // Handlers
  const openNewProduct = () => {
    setEditorProduct(null);
    setShowEditor(true);
  };

  const openEditProduct = (producto) => {
    setEditorProduct(producto);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditorProduct(null);
  };

  const handleEditorSave = () => {
    closeEditor();
  };

  const handleSaveTienda = async (event) => {
    event.preventDefault();
    setTiendaStatus("Guardando...");

    if (!supabase) {
      setTiendaStatus("Configura las variables de Supabase.");
      return;
    }

    if (!selectedTienda?.id) {
      setTiendaStatus("Primero crea una tienda.");
      return;
    }

    const { error } = await supabase
      .from("tiendas")
      .update({
        nombre_negocio: tiendaNombre,
        url_web: tiendaUrl,
        slug: tiendaSlug,
      })
      .eq("id", selectedTienda.id);

    if (error) {
      setTiendaStatus("No se pudo guardar: " + error.message);
      return;
    }

    // Update local state
    setTiendas((prev) =>
      prev.map((t) =>
        t.id === selectedTienda.id
          ? { ...t, nombre_negocio: tiendaNombre, url_web: tiendaUrl, slug: tiendaSlug }
          : t
      )
    );
    setSelectedTienda((prev) => ({
      ...prev,
      nombre_negocio: tiendaNombre,
      url_web: tiendaUrl,
      slug: tiendaSlug,
    }));

    setTiendaStatus("¡Guardado!");
    setTimeout(() => setTiendaStatus(""), 2000);
  };

  const handleCreateTienda = async () => {
    if (!supabase) return;
    setCreatingTienda(true);

    const { data, error } = await supabase
      .from("tiendas")
      .insert({
        user_id: userId,
        nombre_negocio: "Nueva Tienda",
        url_web: "",
        slug: `tienda-${Date.now()}`,
        estado_pago: false,
        plan: "trial",
      })
      .select()
      .single();

    if (error) {
      alert("Error al crear tienda: " + error.message);
      setCreatingTienda(false);
      return;
    }

    setTiendas((prev) => [...prev, data]);
    setSelectedTienda(data);
    setCreatingTienda(false);
  };

  const handleSelectTienda = (tienda) => {
    setSelectedTienda(tienda);
    setProductos([]);
  };

  const handleToggleVisible = async (producto) => {
    if (!supabase) return;

    const { error } = await supabase
      .from("productos")
      .update({ visible: !producto.visible })
      .eq("id", producto.id);

    if (error) {
      setProductosError("No se pudo actualizar la visibilidad.");
    }
  };

  const handleDelete = async (productoId) => {
    if (!supabase) return;
    if (!confirm("¿Eliminar este producto?")) return;

    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", productoId);

    if (error) {
      setProductosError("No se pudo eliminar el producto.");
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // Onboarding: Create first store
  const handleOnboardingComplete = async () => {
    if (!supabase || !onboardingNombre) return;
    setCreatingTienda(true);

    const slug = onboardingNombre
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);

    const { data, error } = await supabase
      .from("tiendas")
      .insert({
        user_id: userId,
        nombre_negocio: onboardingNombre,
        url_web: onboardingUrl,
        slug: slug || `tienda-${Date.now()}`,
        estado_pago: false,
        plan: "trial",
      })
      .select()
      .single();

    if (error) {
      alert("Error al crear tienda: " + error.message);
      setCreatingTienda(false);
      return;
    }

    setTiendas([data]);
    setSelectedTienda(data);
    setTiendaNombre(data.nombre_negocio);
    setTiendaUrl(data.url_web);
    setTiendaSlug(data.slug);
    setShowOnboarding(false);
    setCreatingTienda(false);
  };

  // Trial/Payment status
  const isPaid = selectedTienda?.estado_pago === true;
  const plan = selectedTienda?.plan || "trial";

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="relative isolate overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.18),_transparent_55%)]" />

          <div className="relative mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-16">
            <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-2xl backdrop-blur">
              {/* Welcome */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-2xl">
                  🎉
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  ¡Bienvenido a Mineiro!
                </h1>
                <p className="text-slate-300">
                  Configura tu primera tienda para comenzar
                </p>
              </div>

              {/* Form */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    ¿Cómo se llama tu negocio? *
                  </label>
                  <input
                    type="text"
                    value={onboardingNombre}
                    onChange={(e) => setOnboardingNombre(e.target.value)}
                    placeholder="Ej: Pizzería Don Luigi"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    URL de tu página web (opcional)
                  </label>
                  <input
                    type="url"
                    value={onboardingUrl}
                    onChange={(e) => setOnboardingUrl(e.target.value)}
                    placeholder="https://www.minegocio.com"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
                  />
                  <p className="text-xs text-slate-400">
                    La URL donde instalarás el menú de Mineiro
                  </p>
                </div>

                {/* Trial info */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🎁</span>
                    <div>
                      <p className="font-medium text-amber-200">
                        Prueba gratuita de 5 días
                      </p>
                      <p className="text-sm text-amber-200/70 mt-1">
                        Acceso completo a todas las funciones. Sin compromiso.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOnboardingComplete}
                  disabled={!onboardingNombre || creatingTienda}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingTienda ? "Creando tu tienda..." : "Comenzar mi prueba gratuita →"}
                </button>

                <p className="text-center text-xs text-slate-400">
                  Al continuar, aceptas nuestros términos de servicio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-400/80">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Gestiona tus tiendas
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/pricing"
              className="rounded-xl border border-amber-500/50 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10"
            >
              {isPaid ? `Plan: ${plan}` : "🎁 Activar Plan"}
            </a>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Store Selector */}
        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-white">Mis Tiendas</h2>
            <button
              onClick={handleCreateTienda}
              disabled={creatingTienda}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {creatingTienda ? "Creando..." : "+ Nueva Tienda"}
            </button>
          </div>

          {tiendas.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No tienes tiendas aún. Crea tu primera tienda para comenzar.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tiendas.map((tienda) => (
                <button
                  key={tienda.id}
                  onClick={() => handleSelectTienda(tienda)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    selectedTienda?.id === tienda.id
                      ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-100"
                      : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{tienda.nombre_negocio || "Sin nombre"}</span>
                  {tienda.estado_pago ? (
                    <span className="ml-2 text-xs text-emerald-400">✓</span>
                  ) : (
                    <span className="ml-2 text-xs text-amber-400">Trial</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Store Settings */}
        {selectedTienda && (
          <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
            <div className="flex flex-col gap-2 mb-6">
              <h2 className="text-xl font-semibold text-white">
                Configuración de Tienda
              </h2>
              <p className="text-sm text-slate-300">
                Actualiza los datos de tu negocio.
              </p>
            </div>

            <form className="grid gap-5 md:grid-cols-3" onSubmit={handleSaveTienda}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Nombre del Negocio
                </label>
                <input
                  value={tiendaNombre}
                  onChange={(e) => setTiendaNombre(e.target.value)}
                  placeholder="Mi Restaurante"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  URL de tu Web
                </label>
                <input
                  value={tiendaUrl}
                  onChange={(e) => setTiendaUrl(e.target.value)}
                  placeholder="https://mirestaurante.com"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Slug (identificador único)
                </label>
                <input
                  value={tiendaSlug}
                  onChange={(e) => setTiendaSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="mi-restaurante"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                >
                  {tiendaStatus || "Guardar Cambios"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Products */}
        {selectedTienda && (
          <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Productos</h2>
                  <p className="text-sm text-slate-300 mt-1">
                    Crea, edita o oculta productos para tu catálogo.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {totalProductos} productos
                  </span>
                  <button
                    type="button"
                    onClick={openNewProduct}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                  >
                    + Nuevo Producto
                  </button>
                </div>
              </div>
            </div>

            {productosError && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {productosError}
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Producto</th>
                    <th className="px-5 py-4">Precio</th>
                    <th className="px-5 py-4">Categoría</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                  {productos.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-center text-slate-400" colSpan={5}>
                        No hay productos aún. Crea el primero con el botón de arriba.
                      </td>
                    </tr>
                  ) : (
                    productos.map((producto) => {
                      const hasVariants = producto.configuracion?.variantes?.length > 0;
                      const displayPrice = hasVariants
                        ? `Desde $${producto.configuracion.variantes[0]?.precio?.toLocaleString("es-CL") || 0}`
                        : `$${producto.precio?.toLocaleString("es-CL") || 0}`;

                      return (
                        <tr key={producto.id} className="text-slate-200 hover:bg-slate-900/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/60 flex-shrink-0">
                                {producto.imagen_url ? (
                                  <img
                                    src={producto.imagen_url}
                                    alt={producto.nombre}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                                    Sin foto
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">{producto.nombre}</span>
                                {hasVariants && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {producto.configuracion.variantes.length} variantes
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={hasVariants ? "text-amber-400" : ""}>
                              {displayPrice}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-slate-700/40 px-3 py-1 text-xs">
                              {producto.categoria || "Sin categoría"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {producto.visible ? (
                              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                                Visible
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-700/40 px-3 py-1 text-xs text-slate-300">
                                Oculto
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditProduct(producto)}
                                className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleVisible(producto)}
                                className="rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800/60"
                              >
                                {producto.visible ? "Ocultar" : "Mostrar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(producto.id)}
                                className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-500/10"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Product Editor Modal */}
      {showEditor && selectedTienda && (
        <ProductEditor
          product={editorProduct}
          userId={userId}
          tiendaId={selectedTienda.id}
          categorias={categorias}
          onSave={handleEditorSave}
          onCancel={closeEditor}
        />
      )}
    </div>
  );
}
