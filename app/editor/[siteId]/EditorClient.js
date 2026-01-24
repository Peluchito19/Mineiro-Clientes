"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";
import {
  Search,
  Save,
  Loader2,
  RefreshCw,
  ExternalLink,
  Image,
  Type,
  DollarSign,
  MousePointer,
  Link2,
  Tag,
  FileText,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Monitor,
  Tablet,
  Zap,
  Check,
  X,
  Settings,
  Palette,
  Layout,
  Globe,
  Edit3,
  Package,
  MessageSquare,
  Home,
  AlertCircle,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   CONSTANTS & UTILITIES
   ───────────────────────────────────────────────────────────────────────── */

const ElementTypeConfig = {
  price: { icon: DollarSign, label: "Precio", color: "emerald" },
  title: { icon: Type, label: "Título", color: "cyan" },
  subtitle: { icon: Type, label: "Subtítulo", color: "blue" },
  paragraph: { icon: FileText, label: "Texto", color: "slate" },
  image: { icon: Image, label: "Imagen", color: "violet" },
  button: { icon: MousePointer, label: "Botón", color: "amber" },
  link: { icon: Link2, label: "Enlace", color: "rose" },
  badge: { icon: Tag, label: "Etiqueta", color: "pink" },
  list_item: { icon: FileText, label: "Item", color: "indigo" },
};

const formatPrice = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
};

/* ─────────────────────────────────────────────────────────────────────────
   PRODUCT CARD EDITOR
   ───────────────────────────────────────────────────────────────────────── */

function ProductCard({ producto, onUpdate, isSaving }) {
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState("");

  const startEdit = (field, value) => {
    setEditingField(field);
    setTempValue(value || "");
  };

  const saveField = async () => {
    if (editingField) {
      await onUpdate(producto.id, editingField, tempValue);
      setEditingField(null);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue("");
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden hover:border-slate-600 transition-all">
      {/* Image Section */}
      <div className="relative h-40 bg-slate-900/50">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            <Image size={32} />
          </div>
        )}
        <button
          onClick={() => startEdit("imagen_url", producto.imagen_url)}
          className="absolute top-2 right-2 p-2 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
          title="Editar imagen"
        >
          <Edit3 size={14} />
        </button>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Name */}
        <div className="group">
          {editingField === "nombre" ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-cyan-500 text-white text-sm focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveField();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
              <button onClick={saveField} disabled={isSaving} className="p-2 rounded-lg bg-cyan-500 text-white">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={cancelEdit} className="p-2 rounded-lg bg-slate-700 text-white">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-slate-700/30 rounded-lg px-2 py-1 -mx-2"
              onClick={() => startEdit("nombre", producto.nombre)}
            >
              <h3 className="font-medium text-slate-100">{producto.nombre || "Sin nombre"}</h3>
              <Edit3 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {/* Price */}
        <div className="group">
          {editingField === "precio" ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-slate-900 border border-emerald-500 text-white text-sm focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveField();
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
              </div>
              <button onClick={saveField} disabled={isSaving} className="p-2 rounded-lg bg-emerald-500 text-white">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={cancelEdit} className="p-2 rounded-lg bg-slate-700 text-white">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-slate-700/30 rounded-lg px-2 py-1 -mx-2"
              onClick={() => startEdit("precio", producto.precio)}
            >
              <span className="text-lg font-bold text-emerald-400">{formatPrice(producto.precio)}</span>
              <Edit3 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {/* DOM ID */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Tag size={12} />
          <code className="bg-slate-900/50 px-2 py-0.5 rounded">{producto.dom_id || producto.id}</code>
        </div>
      </div>

      {/* Image URL Edit Modal */}
      {editingField === "imagen_url" && (
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <label className="text-xs text-slate-400 mb-2 block">URL de la imagen</label>
          <input
            type="url"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-violet-500 text-white text-sm focus:outline-none mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={saveField} disabled={isSaving} className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium">
              {isSaving ? "Guardando..." : "Guardar imagen"}
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SITE CONFIG FIELD EDITOR
   ───────────────────────────────────────────────────────────────────────── */

function ConfigField({ label, value, onChange, onSave, isSaving, type = "text", icon: Icon }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || "");

  useEffect(() => {
    setTempValue(value || "");
  }, [value]);

  const handleSave = async () => {
    await onSave(tempValue);
    setIsEditing(false);
  };

  const isImage = type === "image";
  const isTextarea = type === "textarea";

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 hover:border-slate-600 transition-all">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-slate-400" />}
        <span className="text-sm font-medium text-slate-300">{label}</span>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {isImage && tempValue && (
            <div className="h-24 rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
              <img src={tempValue} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {isTextarea ? (
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-cyan-500 text-white text-sm focus:outline-none resize-none"
              autoFocus
            />
          ) : (
            <input
              type={type === "price" ? "number" : "text"}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-cyan-500 text-white text-sm focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isTextarea) handleSave();
                if (e.key === "Escape") setIsEditing(false);
              }}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Guardar
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setTempValue(value || "");
              }}
              className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-slate-700/30 rounded-lg px-3 py-2 -mx-1 group"
          onClick={() => setIsEditing(true)}
        >
          {isImage ? (
            value ? (
              <div className="h-16 w-24 rounded-lg overflow-hidden bg-slate-900">
                <img src={value} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <span className="text-slate-500 text-sm italic">Sin imagen</span>
            )
          ) : type === "price" ? (
            <span className="text-emerald-400 font-bold">{formatPrice(value)}</span>
          ) : (
            <span className={`text-slate-200 text-sm ${!value ? "italic text-slate-500" : ""}`}>
              {value || "Sin definir"}
            </span>
          )}
          <Edit3 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN EDITOR COMPONENT
   ───────────────────────────────────────────────────────────────────────── */

export default function EditorClient({ siteId, site, initialElements, userId }) {
  const supabase = getSupabaseClient();
  const iframeRef = useRef(null);

  // State
  const [activeTab, setActiveTab] = useState("productos");
  const [productos, setProductos] = useState([]);
  const [tienda, setTienda] = useState(null);
  const [testimonios, setTestimonios] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [previewSize, setPreviewSize] = useState("desktop");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load tienda data
  useEffect(() => {
    if (!supabase) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to find tienda by slug or by hostname match
        const { data: tiendaData, error: tiendaError } = await supabase
          .from("tiendas")
          .select("*")
          .or(`slug.eq.${siteId},url_web.ilike.%${siteId}%`)
          .limit(1)
          .maybeSingle();

        if (tiendaError) throw tiendaError;

        if (!tiendaData) {
          setError(`No se encontró una tienda con el identificador "${siteId}". Verifica que el slug esté configurado correctamente en el Dashboard.`);
          setLoading(false);
          return;
        }

        setTienda(tiendaData);

        // Load productos
        const { data: productosData } = await supabase
          .from("productos")
          .select("*")
          .eq("tienda_id", tiendaData.id)
          .order("nombre", { ascending: true });

        setProductos(productosData || []);

        // Load testimonios
        const { data: testimoniosData } = await supabase
          .from("testimonios")
          .select("*")
          .eq("tienda_id", tiendaData.id)
          .order("orden", { ascending: true });

        setTestimonios(testimoniosData || []);

      } catch (err) {
        console.error("Load error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [siteId, supabase]);

  // Realtime subscriptions
  useEffect(() => {
    if (!supabase || !tienda) return;

    const productosChannel = supabase
      .channel(`productos-${tienda.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos",
          filter: `tienda_id=eq.${tienda.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            setProductos((prev) => {
              const idx = prev.findIndex((p) => p.id === payload.new.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = payload.new;
                return updated;
              }
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "DELETE") {
            setProductos((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const tiendaChannel = supabase
      .channel(`tienda-${tienda.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tiendas",
          filter: `id=eq.${tienda.id}`,
        },
        (payload) => {
          setTienda(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productosChannel);
      supabase.removeChannel(tiendaChannel);
    };
  }, [tienda?.id, supabase]);

  // Update producto
  const handleUpdateProducto = useCallback(async (productoId, field, value) => {
    if (!supabase) return;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const updateData = { [field]: field === "precio" ? parseFloat(value) || 0 : value };

      const { error } = await supabase
        .from("productos")
        .update(updateData)
        .eq("id", productoId);

      if (error) throw error;

      // Update local state
      setProductos((prev) =>
        prev.map((p) => (p.id === productoId ? { ...p, ...updateData } : p))
      );

      // Notify iframe
      iframeRef.current?.contentWindow?.postMessage(
        { type: "mineiro-update", productoId, field, value },
        "*"
      );

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [supabase]);

  // Update site config
  const handleUpdateSiteConfig = useCallback(async (section, field, value) => {
    if (!supabase || !tienda) return;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const siteConfig = tienda.site_config || {};
      
      if (!siteConfig[section]) {
        siteConfig[section] = {};
      }
      siteConfig[section][field] = value;

      const { error } = await supabase
        .from("tiendas")
        .update({ site_config: siteConfig })
        .eq("id", tienda.id);

      if (error) throw error;

      setTienda((prev) => ({ ...prev, site_config: siteConfig }));

      // Notify iframe
      iframeRef.current?.contentWindow?.postMessage(
        { type: "mineiro-update", section, field, value },
        "*"
      );

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [supabase, tienda]);

  // Refresh iframe
  const handleRefreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
      setIframeLoaded(false);
    }
  };

  const previewSizes = {
    mobile: { width: 375, label: "Móvil" },
    tablet: { width: 768, label: "Tablet" },
    desktop: { width: "100%", label: "Desktop" },
  };

  const siteUrl = tienda?.url_web || site?.url || `https://${siteId.replace(/-/g, ".")}`;
  const siteConfig = tienda?.site_config || {};

  // Filter productos by search
  const filteredProductos = useMemo(() => {
    if (!searchQuery) return productos;
    const query = searchQuery.toLowerCase();
    return productos.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(query) ||
        p.categoria?.toLowerCase().includes(query)
    );
  }, [productos, searchQuery]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-rose-500/20 flex items-center justify-center">
            <AlertCircle size={40} className="text-rose-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Tienda no encontrada</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors"
          >
            <Home size={18} />
            Ir al Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="mx-auto text-cyan-400 animate-spin mb-4" />
          <p className="text-slate-400">Cargando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="flex items-center gap-2 text-amber-400 font-bold">
            <Zap size={20} />
            <span>Mineiro Editor</span>
          </a>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-sm">
            <Globe size={14} className="text-slate-400" />
            <span className="text-slate-300">{tienda?.nombre_negocio || siteId}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status */}
          {saveStatus && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              saveStatus === "saved" ? "bg-emerald-500/20 text-emerald-300" :
              saveStatus === "saving" ? "bg-amber-500/20 text-amber-300" :
              "bg-rose-500/20 text-rose-300"
            }`}>
              {saveStatus === "saving" && <Loader2 size={14} className="animate-spin" />}
              {saveStatus === "saved" && <Check size={14} />}
              {saveStatus === "error" && <X size={14} />}
              {saveStatus === "saving" ? "Guardando..." : 
               saveStatus === "saved" ? "Guardado" : "Error"}
            </div>
          )}

          {/* Preview size buttons */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setPreviewSize("mobile")}
              className={`p-2 rounded-md transition-colors ${previewSize === "mobile" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
              title="Móvil"
            >
              <Smartphone size={16} />
            </button>
            <button
              onClick={() => setPreviewSize("tablet")}
              className={`p-2 rounded-md transition-colors ${previewSize === "tablet" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
              title="Tablet"
            >
              <Tablet size={16} />
            </button>
            <button
              onClick={() => setPreviewSize("desktop")}
              className={`p-2 rounded-md transition-colors ${previewSize === "desktop" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
              title="Desktop"
            >
              <Monitor size={16} />
            </button>
          </div>

          <button
            onClick={handleRefreshPreview}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            Refrescar
          </button>

          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors text-sm"
          >
            <ExternalLink size={14} />
            Ver sitio
          </a>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <aside className="w-[420px] border-r border-slate-800 bg-slate-900/50 flex flex-col flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setActiveTab("productos")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "productos"
                  ? "text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Package size={16} />
              Productos
            </button>
            <button
              onClick={() => setActiveTab("hero")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "hero"
                  ? "text-violet-400 border-b-2 border-violet-400 bg-slate-800/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layout size={16} />
              Hero
            </button>
            <button
              onClick={() => setActiveTab("footer")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "footer"
                  ? "text-amber-400 border-b-2 border-amber-400 bg-slate-800/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText size={16} />
              Footer
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Productos Tab */}
            {activeTab === "productos" && (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar productos..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                </div>

                {/* Products Grid */}
                <div className="grid gap-4">
                  {filteredProductos.length === 0 ? (
                    <div className="text-center py-8">
                      <Package size={40} className="mx-auto text-slate-600 mb-3" />
                      <p className="text-slate-400 text-sm">
                        {searchQuery ? "No se encontraron productos" : "No hay productos"}
                      </p>
                      <a
                        href="/dashboard"
                        className="inline-block mt-3 text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        Agregar productos en Dashboard →
                      </a>
                    </div>
                  ) : (
                    filteredProductos.map((producto) => (
                      <ProductCard
                        key={producto.id}
                        producto={producto}
                        onUpdate={handleUpdateProducto}
                        isSaving={isSaving}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Hero Tab */}
            {activeTab === "hero" && (
              <div className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-1">Configuración del Hero</h3>
                  <p className="text-sm text-slate-400">Edita el banner principal de tu sitio</p>
                </div>

                <ConfigField
                  label="Título Principal"
                  value={siteConfig.hero?.titulo}
                  onSave={(val) => handleUpdateSiteConfig("hero", "titulo", val)}
                  isSaving={isSaving}
                  icon={Type}
                />

                <ConfigField
                  label="Subtítulo"
                  value={siteConfig.hero?.subtitulo}
                  onSave={(val) => handleUpdateSiteConfig("hero", "subtitulo", val)}
                  isSaving={isSaving}
                  type="textarea"
                  icon={FileText}
                />

                <ConfigField
                  label="Texto del Botón"
                  value={siteConfig.hero?.boton_texto}
                  onSave={(val) => handleUpdateSiteConfig("hero", "boton_texto", val)}
                  isSaving={isSaving}
                  icon={MousePointer}
                />

                <ConfigField
                  label="Imagen de Fondo"
                  value={siteConfig.hero?.imagen_fondo}
                  onSave={(val) => handleUpdateSiteConfig("hero", "imagen_fondo", val)}
                  isSaving={isSaving}
                  type="image"
                  icon={Image}
                />
              </div>
            )}

            {/* Footer Tab */}
            {activeTab === "footer" && (
              <div className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-1">Configuración del Footer</h3>
                  <p className="text-sm text-slate-400">Edita la información del pie de página</p>
                </div>

                <ConfigField
                  label="Nombre del Negocio"
                  value={siteConfig.footer?.nombre_tienda || tienda?.nombre_negocio}
                  onSave={(val) => handleUpdateSiteConfig("footer", "nombre_tienda", val)}
                  isSaving={isSaving}
                  icon={Type}
                />

                <ConfigField
                  label="Descripción"
                  value={siteConfig.footer?.descripcion}
                  onSave={(val) => handleUpdateSiteConfig("footer", "descripcion", val)}
                  isSaving={isSaving}
                  type="textarea"
                  icon={FileText}
                />

                <ConfigField
                  label="WhatsApp"
                  value={siteConfig.footer?.whatsapp}
                  onSave={(val) => handleUpdateSiteConfig("footer", "whatsapp", val)}
                  isSaving={isSaving}
                  icon={MessageSquare}
                />

                <ConfigField
                  label="Email"
                  value={siteConfig.footer?.email}
                  onSave={(val) => handleUpdateSiteConfig("footer", "email", val)}
                  isSaving={isSaving}
                  icon={Link2}
                />

                <ConfigField
                  label="Horario de Atención"
                  value={siteConfig.footer?.horario}
                  onSave={(val) => handleUpdateSiteConfig("footer", "horario", val)}
                  isSaving={isSaving}
                  type="textarea"
                  icon={FileText}
                />
              </div>
            )}
          </div>

          {/* Stats Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {productos.length} productos
              </span>
              <span className="text-slate-500">
                {tienda?.plan || "trial"} · {tienda?.estado_pago ? "Activo" : "Trial"}
              </span>
            </div>
          </div>
        </aside>

        {/* Right Panel - Preview */}
        <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden">
          <div
            className="bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300"
            style={{
              width: previewSizes[previewSize].width,
              height: previewSize === "desktop" ? "100%" : "calc(100% - 40px)",
              maxWidth: "100%",
            }}
          >
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="text-center">
                  <Loader2 size={40} className="mx-auto text-cyan-400 animate-spin mb-3" />
                  <p className="text-slate-400">Cargando vista previa...</p>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={`${siteUrl}?mineiro-preview=true`}
              className="w-full h-full border-0"
              onLoad={() => setIframeLoaded(true)}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>

          {/* Size label */}
          <div className="mt-4 text-sm text-slate-500">
            {previewSizes[previewSize].label}
            {previewSize !== "desktop" && ` (${previewSizes[previewSize].width}px)`}
          </div>
        </main>
      </div>
    </div>
  );
}
