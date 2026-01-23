"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";
import ProductEditor from "./ProductEditor";

export default function DashboardClient({
  userId,
  initialTienda,
  initialProductos,
}) {
  const supabase = getSupabaseClient();
  const [tiendaNombre, setTiendaNombre] = useState(
    initialTienda?.nombre ?? "",
  );
  const [tiendaUrl, setTiendaUrl] = useState(initialTienda?.url ?? "");
  const [tiendaStatus, setTiendaStatus] = useState("");

  const [productos, setProductos] = useState(initialProductos ?? []);
  const [productosError, setProductosError] = useState("");
  const [uploadingId, setUploadingId] = useState(null);

  // Modal editor state
  const [editorProduct, setEditorProduct] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    setProductos(initialProductos ?? []);
  }, [initialProductos]);

  useEffect(() => {
    if (!userId || !supabase) return;

    const channel = supabase
      .channel(`productos-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setProductos((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((item) => item.id !== payload.old.id);
            }

            const nextRow = payload.new;
            const existingIndex = current.findIndex(
              (item) => item.id === nextRow.id,
            );

            if (existingIndex === -1) {
              return [...current, nextRow].sort((a, b) =>
                a.nombre.localeCompare(b.nombre),
              );
            }

            const updated = [...current];
            updated[existingIndex] = nextRow;
            return updated.sort((a, b) => a.nombre.localeCompare(b.nombre));
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const totalProductos = useMemo(() => productos.length, [productos]);

  // Get unique categories for the editor
  const categorias = useMemo(() => {
    const cats = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
    return cats.sort();
  }, [productos]);

  // Editor handlers
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

  const handleEditorSave = (savedProduct) => {
    closeEditor();
    // The realtime subscription will update the list
  };

  const handleSaveTienda = async (event) => {
    event.preventDefault();
    setTiendaStatus("Guardando...");

    if (!supabase) {
      setTiendaStatus(
        "Configura las variables de Supabase antes de guardar.",
      );
      return;
    }

    const { error } = await supabase.from("tiendas").upsert(
      {
        user_id: userId,
        nombre: tiendaNombre,
        url: tiendaUrl,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      setTiendaStatus("No se pudo guardar. Intenta otra vez.");
      return;
    }

    setTiendaStatus("Guardado correctamente.");
  };

  const handleToggleVisible = async (producto) => {
    if (!supabase) {
      setProductosError(
        "Configura las variables de Supabase antes de guardar.",
      );
      return;
    }

    const { error } = await supabase
      .from("productos")
      .update({ visible: !producto.visible })
      .eq("id", producto.id)
      .eq("user_id", userId);

    if (error) {
      setProductosError("No se pudo actualizar la visibilidad.");
    }
  };

  const handleDelete = async (productoId) => {
    if (!supabase) {
      setProductosError(
        "Configura las variables de Supabase antes de guardar.",
      );
      return;
    }

    if (!confirm("¿Eliminar este producto?")) return;

    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", productoId)
      .eq("user_id", userId);

    if (error) {
      setProductosError("No se pudo eliminar el producto.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-400/80">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Gestiona tu tienda
          </h1>
          <p className="text-sm text-slate-300">
            Administra la información de tu negocio y tus productos en tiempo
            real.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-white">
              Datos de la tienda
            </h2>
            <p className="text-sm text-slate-300">
              Actualiza el nombre y la URL pública de tu negocio.
            </p>
          </div>

          <form className="mt-6 grid gap-5 md:grid-cols-[1.1fr_1.3fr_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Nombre
              </label>
              <input
                value={tiendaNombre}
                onChange={(event) => setTiendaNombre(event.target.value)}
                placeholder="Nombre de la tienda"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                URL de la web
              </label>
              <input
                value={tiendaUrl}
                onChange={(event) => setTiendaUrl(event.target.value)}
                placeholder="https://mitienda.com"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                onClick={handleSaveTienda}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
              >
                Guardar
              </button>
            </div>
          </form>

          {tiendaStatus ? (
            <p className="mt-4 text-sm text-slate-300">{tiendaStatus}</p>
          ) : null}
        </section>

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

          {productosError ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {productosError}
            </div>
          ) : null}

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
                    <td
                      className="px-5 py-6 text-center text-slate-400"
                      colSpan={5}
                    >
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
      </div>

      {/* Product Editor Modal */}
      {showEditor && (
        <ProductEditor
          product={editorProduct}
          userId={userId}
          tiendaId={initialTienda?.id}
          categorias={categorias}
          onSave={handleEditorSave}
          onCancel={closeEditor}
        />
      )}
    </div>
  );
}
