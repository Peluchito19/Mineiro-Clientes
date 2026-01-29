"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ImagePlus,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  Eye,
  Code,
  Save,
  Loader2,
} from "lucide-react";
import { getSupabaseClient } from "@/utils/supabase/client";

/* ─────────────────────────────────────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────────────────────────────────────── */

const formatCLP = (value) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
};

/* ─────────────────────────────────────────────────────────────────────────
   LIVE PREVIEW CARD
   ───────────────────────────────────────────────────────────────────────── */

function ProductPreviewCard({ data, useVariants }) {
  const { nombre, precio, imagen_url, categoria, variantes } = data;

  const displayPrice = useVariants && variantes?.length > 0
    ? variantes[0]?.precio
    : precio;

  return (
    <div className="w-full max-w-xs mx-auto rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl">
      {/* Image */}
      <div className="h-44 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
        {imagen_url ? (
          <img
            src={imagen_url}
            alt={nombre || "Producto"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-slate-600 text-sm flex flex-col items-center gap-2">
            <ImagePlus size={32} />
            <span>Sin imagen</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="text-xs text-amber-500 font-medium mb-1 uppercase tracking-wide">
          {categoria || "Sin categoría"}
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-2">
          {nombre || "Nombre del producto"}
        </h3>
        <div className="text-2xl font-bold text-amber-400">
          {formatCLP(displayPrice || 0)}
        </div>

        {/* Variants preview */}
        {useVariants && variantes?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <select className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded-lg px-3 py-2 text-sm">
              {variantes.map((v, i) => (
                <option key={i} value={i}>
                  {v.nombre || `Variante ${i + 1}`} - {formatCLP(v.precio || 0)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SNIPPET GENERATOR
   ───────────────────────────────────────────────────────────────────────── */

function SnippetGenerator({ productId, productName, categoria, isNew }) {
  const [copied, setCopied] = useState(null);
  const [activeTab, setActiveTab] = useState("section");

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Convert category name to slug format (e.g., "De Casa" -> "de-casa")
  const categoriaSlug = categoria 
    ? categoria.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
    : "general";

  const snippets = {
    section: `<!-- Pega esto UNA VEZ donde quieras mostrar todos los productos de "${categoria || "General"}" -->
  <div data-mineiro-section="${categoria || "General"}"></div>

  <!-- Script al final del body (solo una vez) -->
  <script src="${siteUrl}/mineiro.js" data-mineiro-site="tu-sitio"></script>`,

    categoryBindings: `<!-- Bindings para la categoría "${categoria || "General"}" -->
<!-- Botón de categoría (se activa automáticamente para filtrar) -->
<button data-mineiro-bind="menu.categorias.${categoriaSlug}.boton">
  ${categoria || "Categoría"}
</button>

<!-- Ícono de categoría -->
<i data-mineiro-bind="menu.categorias.${categoriaSlug}.icono" class="icon-${categoriaSlug}"></i>

<!-- Título de categoría -->
<h2 data-mineiro-bind="menu.categorias.${categoriaSlug}.titulo">
  ${categoria || "Categoría"}
</h2>

<!-- Contenedor para mostrar productos de esta categoría -->
<div data-mineiro-section="${categoria || "General"}" data-mineiro-category-display></div>`,

    bindPrice: `<!-- Para mostrar el precio de "${productName || "este producto"}" -->
<span data-mineiro-bind="producto-${productId}.precio">$0</span>`,

    bindName: `<!-- Para mostrar el nombre -->
<span data-mineiro-bind="producto-${productId}.nombre">Producto</span>`,

    bindImage: `<!-- Para mostrar la imagen -->
<img data-mineiro-bind="producto-${productId}.imagen_url" src="" alt="${productName}" />

<!-- O como fondo -->
<div data-mineiro-bind="producto-${productId}.imagen_url" style="background-size:cover"></div>`,

    fullCard: `<!-- Contenedor para renderizar la tarjeta completa -->
<div id="producto-${productId}" data-mineiro-render="card"></div>`,
  };

  const copyToClipboard = async (key) => {
    try {
      await navigator.clipboard.writeText(snippets[key]);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Error copying:", err);
    }
  };

  const CopyButton = ({ snippetKey }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(snippetKey)}
      className="absolute top-2 right-2 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
    >
      {copied === snippetKey ? (
        <Check size={16} className="text-green-400" />
      ) : (
        <Copy size={16} className="text-slate-300" />
      )}
    </button>
  );

  if (isNew) {
    return (
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <div className="flex items-center gap-2 text-amber-400 mb-3">
          <Code size={18} />
          <span className="font-medium">Código de Integración</span>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Guarda el producto primero para generar los códigos de integración.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 text-amber-400 mb-1">
          <Code size={18} />
          <span className="font-medium">Código de Integración</span>
        </div>
        <p className="text-xs text-slate-400">
          El cliente pega estos códigos <strong>UNA SOLA VEZ</strong>. Después, todo se actualiza automáticamente desde aquí.
        </p>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex border-b border-slate-700">
          <Tabs.Trigger
            value="section"
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 transition-colors"
          >
            Sección Completa
          </Tabs.Trigger>
          <Tabs.Trigger
            value="category"
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 transition-colors"
          >
            Categoría
          </Tabs.Trigger>
          <Tabs.Trigger
            value="bind"
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 transition-colors"
          >
            Elementos Individuales
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="section" className="p-4 space-y-4">
          <div className="relative">
            <p className="text-xs text-slate-400 mb-2">
              Renderiza automáticamente TODOS los productos de la categoría "{categoria || "General"}":
            </p>
            <pre className="bg-slate-900 rounded-lg p-3 pr-12 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {snippets.section}
            </pre>
            <CopyButton snippetKey="section" />
          </div>
        </Tabs.Content>

        <Tabs.Content value="category" className="p-4 space-y-4">
          <div className="relative">
            <p className="text-xs text-slate-400 mb-2">
              Bindings completos para la categoría "{categoria || "General"}" (botón, ícono, título y productos):
            </p>
            <pre className="bg-slate-900 rounded-lg p-3 pr-12 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {snippets.categoryBindings}
            </pre>
            <CopyButton snippetKey="categoryBindings" />
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-400">
              <strong className="text-amber-400">Formato del slug:</strong> {categoriaSlug}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Los botones con <code className="bg-slate-700 px-1 rounded text-xs">data-mineiro-bind="menu.categorias.{categoriaSlug}.boton"</code> filtran automáticamente los productos de esta categoría.
            </p>
          </div>
        </Tabs.Content>

        <Tabs.Content value="bind" className="p-4 space-y-4">
          <p className="text-xs text-slate-400">
            Para actualizar elementos específicos que ya existen en la web del cliente:
          </p>

          <div className="relative">
            <p className="text-xs text-slate-500 mb-1">Precio:</p>
            <pre className="bg-slate-900 rounded-lg p-3 pr-12 text-xs text-slate-300 overflow-x-auto">
              {snippets.bindPrice}
            </pre>
            <CopyButton snippetKey="bindPrice" />
          </div>

          <div className="relative">
            <p className="text-xs text-slate-500 mb-1">Nombre:</p>
            <pre className="bg-slate-900 rounded-lg p-3 pr-12 text-xs text-slate-300 overflow-x-auto">
              {snippets.bindName}
            </pre>
            <CopyButton snippetKey="bindName" />
          </div>

          <div className="relative">
            <p className="text-xs text-slate-500 mb-1">Imagen:</p>
            <pre className="bg-slate-900 rounded-lg p-3 pr-12 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {snippets.bindImage}
            </pre>
            <CopyButton snippetKey="bindImage" />
          </div>

          <div className="relative">
            <p className="text-xs text-slate-500 mb-1">Tarjeta completa (auto-render):</p>
            <pre className="bg-slate-900 rounded-lg p-3 pr-12 text-xs text-slate-300 overflow-x-auto">
              {snippets.fullCard}
            </pre>
            <CopyButton snippetKey="fullCard" />
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN PRODUCT EDITOR
   ───────────────────────────────────────────────────────────────────────── */

export default function ProductEditor({
  product = null,
  userId,
  tiendaId,
  categorias = [],
  onSave,
  onCancel,
}) {
  const isNew = !product?.id;

  const [useVariants, setUseVariants] = useState(
    product?.configuracion?.variantes?.length > 0
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      nombre: product?.nombre || "",
      precio: product?.precio || 0,
      categoria: product?.categoria || "",
      imagen_url: product?.imagen_url || "",
      visible: product?.visible ?? true,
      dom_id: product?.dom_id || "",
      variantes: product?.configuracion?.variantes || [
        { nombre: "Normal", precio: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variantes",
  });

  const watchedValues = watch();

  // Image upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Error: Supabase no está configurado");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("fotos-menu")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("fotos-menu")
        .getPublicUrl(fileName);

      setValue("imagen_url", urlData.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  // Form submit
  const onSubmit = async (data) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Error: Supabase no está configurado");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        tienda_id: tiendaId,
        nombre: data.nombre,
        precio: useVariants ? (data.variantes[0]?.precio || 0) : parseInt(data.precio, 10),
        categoria: data.categoria,
        imagen_url: data.imagen_url || "",
        visible: data.visible,
        dom_id: data.dom_id || null,
        configuracion: useVariants
          ? { variantes: data.variantes.map((v) => ({ ...v, precio: parseInt(v.precio, 10) })) }
          : null,
      };

      let result;
      if (isNew) {
        // Generate UUID client-side for new products
        const newId = crypto.randomUUID();
        const { data: newProduct, error } = await supabase
          .from("productos")
          .insert({ id: newId, ...payload })
          .select()
          .single();
        if (error) throw error;
        result = newProduct;
      } else {
        const { data: updated, error } = await supabase
          .from("productos")
          .update(payload)
          .eq("id", product.id)
          .select()
          .single();
        if (error) throw error;
        result = updated;
      }

      onSave?.(result);
    } catch (err) {
      console.error("Save error:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Prepare preview data
  const previewData = {
    nombre: watchedValues.nombre,
    precio: watchedValues.precio,
    categoria: watchedValues.categoria,
    imagen_url: watchedValues.imagen_url,
    variantes: watchedValues.variantes,
  };

  return (
    <Tooltip.Provider>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-slate-100">
              {isNew ? "Nuevo Producto" : "Editar Producto"}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {/* Split View */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col lg:flex-row max-h-[calc(90vh-130px)] overflow-hidden">
              {/* LEFT: Form */}
              <div className="flex-1 p-6 overflow-y-auto border-r border-slate-700">
                <div className="space-y-6">
                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Imagen del Producto
                    </label>
                    <div className="relative">
                      <div
                        className={`
                          h-40 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors
                          ${watchedValues.imagen_url ? "border-slate-600" : "border-slate-700 hover:border-slate-500"}
                        `}
                      >
                        {watchedValues.imagen_url ? (
                          <img
                            src={watchedValues.imagen_url}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center text-slate-500">
                            <ImagePlus size={32} className="mx-auto mb-2" />
                            <span className="text-sm">Click para subir</span>
                          </div>
                        )}
                        {uploading && (
                          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                            <Loader2 size={32} className="text-amber-400 animate-spin" />
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Nombre del Producto *
                    </label>
                    <input
                      {...register("nombre", { required: "Nombre requerido" })}
                      type="text"
                      placeholder="Ej: Pizza Margherita"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    {errors.nombre && (
                      <p className="text-red-400 text-sm mt-1">{errors.nombre.message}</p>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Categoría
                    </label>
                    <input
                      {...register("categoria")}
                      type="text"
                      placeholder="Ej: Pizzas, Bebidas, Postres"
                      list="categorias-list"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <datalist id="categorias-list">
                      {categorias.map((cat, i) => (
                        <option key={i} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  {/* DOM ID for binding */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      DOM ID (para binding)
                    </label>
                    <input
                      {...register("dom_id")}
                      type="text"
                      placeholder="Ej: producto-labial"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Usa este ID en el HTML del cliente: <code className="bg-slate-700 px-1 rounded">data-mineiro-bind="producto-{"{dom_id}"}.nombre"</code>
                    </p>
                  </div>

                  {/* Price Mode Switch */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Precios por Variante</p>
                      <p className="text-xs text-slate-400">
                        Activa para definir tamaños (Familiar, Mediana, etc.)
                      </p>
                    </div>
                    <Switch.Root
                      checked={useVariants}
                      onCheckedChange={setUseVariants}
                      className="w-11 h-6 bg-slate-700 rounded-full relative data-[state=checked]:bg-amber-500 transition-colors"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-lg transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                    </Switch.Root>
                  </div>

                  {/* Price or Variants */}
                  {!useVariants ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Precio Base
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          {...register("precio")}
                          type="number"
                          placeholder="0"
                          className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Variantes de Precio
                      </label>
                      <div className="space-y-3">
                        {fields.map((field, index) => (
                          <div key={field.id} className="flex gap-3 items-center">
                            <input
                              {...register(`variantes.${index}.nombre`)}
                              type="text"
                              placeholder="Tamaño"
                              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                            />
                            <div className="relative w-32">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input
                                {...register(`variantes.${index}.precio`)}
                                type="number"
                                placeholder="0"
                                className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                              />
                            </div>
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                              >
                                <Trash2 size={18} className="text-red-400" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => append({ nombre: "", precio: 0 })}
                          className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <Plus size={16} />
                          Agregar variante
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Visibility */}
                  <div className="flex items-center gap-3">
                    <input
                      {...register("visible")}
                      type="checkbox"
                      id="visible"
                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="visible" className="text-sm text-slate-300">
                      Producto visible en el menú
                    </label>
                  </div>
                </div>
              </div>

              {/* RIGHT: Preview & Snippets */}
              <div className="w-full lg:w-96 p-6 overflow-y-auto bg-slate-950/50">
                <div className="space-y-6">
                  {/* Live Preview */}
                  <div>
                    <div className="flex items-center gap-2 text-slate-300 mb-3">
                      <Eye size={18} />
                      <span className="text-sm font-medium">Vista Previa</span>
                    </div>
                    <ProductPreviewCard data={previewData} useVariants={useVariants} />
                  </div>

                  {/* Snippet Generator */}
                  <SnippetGenerator
                    productId={product?.id}
                    productName={watchedValues.nombre}
                    categoria={watchedValues.categoria}
                    isNew={isNew}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isNew ? "Crear Producto" : "Guardar Cambios"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
