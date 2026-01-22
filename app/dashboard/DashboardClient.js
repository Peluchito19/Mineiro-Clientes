"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function DashboardClient({
  userId,
  initialTienda,
  initialProductos,
}) {
  const [tiendaNombre, setTiendaNombre] = useState(
    initialTienda?.nombre ?? "",
  );
  const [tiendaUrl, setTiendaUrl] = useState(initialTienda?.url ?? "");
  const [tiendaStatus, setTiendaStatus] = useState("");

  const [productos, setProductos] = useState(initialProductos ?? []);
  const [productoNombre, setProductoNombre] = useState("");
  const [productoPrecio, setProductoPrecio] = useState("");
  const [productoCategoria, setProductoCategoria] = useState("");
  const [productosError, setProductosError] = useState("");
  const [productosLoading, setProductosLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editingNombre, setEditingNombre] = useState("");
  const [editingPrecio, setEditingPrecio] = useState("");
  const [editingCategoria, setEditingCategoria] = useState("");
  const [editingVisible, setEditingVisible] = useState(true);

  useEffect(() => {
    setProductos(initialProductos ?? []);
  }, [initialProductos]);

  useEffect(() => {
    if (!userId) return;

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
  }, [userId]);

  const totalProductos = useMemo(() => productos.length, [productos]);

  const handleSaveTienda = async (event) => {
    event.preventDefault();
    setTiendaStatus("Guardando...");

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

  const handleAddProducto = async (event) => {
    event.preventDefault();
    setProductosError("");
    setProductosLoading(true);

    const precio = Number.parseFloat(productoPrecio);
    if (!productoNombre || Number.isNaN(precio) || !productoCategoria) {
      setProductosError("Completa nombre, precio y categoría.");
      setProductosLoading(false);
      return;
    }

    const { error } = await supabase.from("productos").insert({
      user_id: userId,
      nombre: productoNombre,
      precio,
      categoria: productoCategoria,
      visible: true,
    });

    if (error) {
      setProductosError("No se pudo guardar el producto.");
      setProductosLoading(false);
      return;
    }

    setProductoNombre("");
    setProductoPrecio("");
    setProductoCategoria("");
    setProductosLoading(false);
  };

  const startEditing = (producto) => {
    setEditingId(producto.id);
    setEditingNombre(producto.nombre ?? "");
    setEditingPrecio(
      producto.precio !== null && producto.precio !== undefined
        ? String(producto.precio)
        : "",
    );
    setEditingCategoria(producto.categoria ?? "");
    setEditingVisible(!!producto.visible);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingNombre("");
    setEditingPrecio("");
    setEditingCategoria("");
    setEditingVisible(true);
  };

  const handleSaveEdit = async (productoId) => {
    setProductosError("");
    const precio = Number.parseFloat(editingPrecio);

    if (!editingNombre || Number.isNaN(precio) || !editingCategoria) {
      setProductosError("Completa nombre, precio y categoría.");
      return;
    }

    const { error } = await supabase
      .from("productos")
      .update({
        nombre: editingNombre,
        precio,
        categoria: editingCategoria,
        visible: editingVisible,
      })
      .eq("id", productoId)
      .eq("user_id", userId);

    if (error) {
      setProductosError("No se pudo actualizar el producto.");
      return;
    }

    cancelEditing();
  };

  const handleToggleVisible = async (producto) => {
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
    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", productoId)
      .eq("user_id", userId);

    if (error) {
      setProductosError("No se pudo eliminar el producto.");
    }
  };

  const handleUploadImage = async (productoId, file) => {
    if (!file) return;
    setProductosError("");
    setUploadingId(productoId);

    const fileExt = file.name.split(".").pop();
    const safeName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.-]/g, "");
    const filePath = `${userId}/${productoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("fotos-menu")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/" + fileExt,
      });

    if (uploadError) {
      setProductosError("No se pudo subir la imagen.");
      setUploadingId(null);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("fotos-menu")
      .getPublicUrl(filePath);

    const publicUrl = publicData?.publicUrl;

    if (!publicUrl) {
      setProductosError("No se pudo obtener la URL pública.");
      setUploadingId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("productos")
      .update({ imagen_url: publicUrl })
      .eq("id", productoId)
      .eq("user_id", userId);

    if (updateError) {
      setProductosError("No se pudo guardar la imagen en el producto.");
    }

    setUploadingId(null);
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
              <h2 className="text-xl font-semibold text-white">Productos</h2>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {totalProductos} productos
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Crea, edita o oculta productos para tu catálogo.
            </p>
          </div>

          <form
            className="mt-6 grid gap-4 md:grid-cols-[1.3fr_0.6fr_0.9fr_auto]"
            onSubmit={handleAddProducto}
          >
            <input
              value={productoNombre}
              onChange={(event) => setProductoNombre(event.target.value)}
              placeholder="Nombre del producto"
              className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={productoPrecio}
              onChange={(event) => setProductoPrecio(event.target.value)}
              placeholder="Precio"
              className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
            />
            <input
              value={productoCategoria}
              onChange={(event) => setProductoCategoria(event.target.value)}
              placeholder="Categoría"
              className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
            />
            <button
              type="submit"
              disabled={productosLoading}
              className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {productosLoading ? "Guardando..." : "Añadir"}
            </button>
          </form>

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
                      No hay productos aún. Crea el primero arriba.
                    </td>
                  </tr>
                ) : (
                  productos.map((producto) => {
                    const isEditing = editingId === producto.id;

                    return (
                      <tr key={producto.id} className="text-slate-200">
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input
                              value={editingNombre}
                              onChange={(event) =>
                                setEditingNombre(event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/60">
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
                              <span>{producto.nombre}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingPrecio}
                              onChange={(event) =>
                                setEditingPrecio(event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                            />
                          ) : (
                            <span>${producto.precio}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input
                              value={editingCategoria}
                              onChange={(event) =>
                                setEditingCategoria(event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                            />
                          ) : (
                            <span>{producto.categoria}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                              <input
                                type="checkbox"
                                checked={editingVisible}
                                onChange={(event) =>
                                  setEditingVisible(event.target.checked)
                                }
                                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
                              />
                              Visible
                            </label>
                          ) : producto.visible ? (
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
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(producto.id)}
                                  className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  className="rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-800/50"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditing(producto)}
                                  className="rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800/60"
                                >
                                  Editar
                                </button>
                                <label className="rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800/60">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) =>
                                      handleUploadImage(
                                        producto.id,
                                        event.target.files?.[0],
                                      )
                                    }
                                    disabled={uploadingId === producto.id}
                                  />
                                  {uploadingId === producto.id
                                    ? "Subiendo..."
                                    : "Subir foto"}
                                </label>
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
                              </>
                            )}
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
    </div>
  );
}
