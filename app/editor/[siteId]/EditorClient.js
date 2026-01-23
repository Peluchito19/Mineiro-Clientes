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
   ELEMENT EDITOR CARD
   ───────────────────────────────────────────────────────────────────────── */

function ElementCard({ element, onUpdate, isSaving }) {
  const [value, setValue] = useState(element.current_value || "");
  const [isDirty, setIsDirty] = useState(false);
  const config = ElementTypeConfig[element.type] || ElementTypeConfig.paragraph;
  const Icon = config.icon;

  useEffect(() => {
    setValue(element.current_value || "");
    setIsDirty(false);
  }, [element.current_value]);

  const handleChange = (newValue) => {
    setValue(newValue);
    setIsDirty(newValue !== element.current_value);
  };

  const handleSave = () => {
    if (!isDirty) return;
    onUpdate(element.element_id, value);
    setIsDirty(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && element.type !== "paragraph") {
      e.preventDefault();
      handleSave();
    }
  };

  const colorClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    slate: "border-slate-600/30 bg-slate-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    pink: "border-pink-500/30 bg-pink-500/5",
    indigo: "border-indigo-500/30 bg-indigo-500/5",
  };

  const iconColors = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    blue: "text-blue-400",
    slate: "text-slate-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    pink: "text-pink-400",
    indigo: "text-indigo-400",
  };

  return (
    <div className={`rounded-xl border p-4 transition-all ${colorClasses[config.color]} ${isDirty ? "ring-2 ring-amber-500/50" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColors[config.color]} />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {config.label}
          </span>
          {isDirty && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
              Sin guardar
            </span>
          )}
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-xs font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Guardar
          </button>
        )}
      </div>

      {/* Name */}
      <p className="text-sm text-slate-200 font-medium mb-2 truncate" title={element.name}>
        {element.name}
      </p>

      {/* Input */}
      {element.type === "image" ? (
        <div className="space-y-2">
          <div className="relative h-24 rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700">
            {value ? (
              <img src={value} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Sin imagen
              </div>
            )}
          </div>
          <input
            type="url"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>
      ) : element.type === "paragraph" ? (
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
        />
      ) : element.type === "price" ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              value={typeof value === "number" ? value : parseFloat(value) || ""}
              onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
              onKeyDown={handleKeyDown}
              className="w-full pl-7 pr-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <div className="px-3 py-2 rounded-lg bg-slate-700/50 text-emerald-400 text-sm font-medium">
            {formatPrice(value)}
          </div>
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        />
      )}

      {/* Context badge */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-slate-500">
          Sección: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{element.context}</code>
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CONTEXT GROUP
   ───────────────────────────────────────────────────────────────────────── */

function ContextGroup({ context, elements, onUpdate, isSaving }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Layout size={16} className="text-violet-400" />
          <span className="font-medium text-slate-200">{context}</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {elements.length} elementos
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-3">
          {elements.map((el) => (
            <ElementCard
              key={el.element_id}
              element={el}
              onUpdate={onUpdate}
              isSaving={isSaving}
            />
          ))}
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
  
  const [elements, setElements] = useState(initialElements);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [previewSize, setPreviewSize] = useState("desktop");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Group elements by context
  const groupedElements = useMemo(() => {
    let filtered = elements;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (el) =>
          el.name?.toLowerCase().includes(query) ||
          el.current_value?.toString().toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((el) => el.type === filterType);
    }

    // Group by context
    const groups = {};
    filtered.forEach((el) => {
      const ctx = el.context || "General";
      if (!groups[ctx]) groups[ctx] = [];
      groups[ctx].push(el);
    });

    return groups;
  }, [elements, searchQuery, filterType]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`elements-${siteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "elements",
          filter: `site_id=eq.${siteId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setElements((prev) =>
              prev.map((el) =>
                el.element_id === payload.new.element_id ? payload.new : el
              )
            );
          } else if (payload.eventType === "INSERT") {
            setElements((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, supabase]);

  // Update element value
  const handleUpdate = useCallback(async (elementId, newValue) => {
    if (!supabase) return;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const { error } = await supabase
        .from("elements")
        .update({ current_value: newValue })
        .eq("site_id", siteId)
        .eq("element_id", elementId);

      if (error) throw error;

      // Update local state
      setElements((prev) =>
        prev.map((el) =>
          el.element_id === elementId ? { ...el, current_value: newValue } : el
        )
      );

      // Notify iframe
      iframeRef.current?.contentWindow?.postMessage(
        { type: "mineiro-update", elementId, value: newValue },
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
  }, [siteId, supabase]);

  // Refresh scan
  const handleRefreshScan = async () => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: "mineiro-rescan" }, "*");
    
    // Reload elements
    const { data } = await supabase
      .from("elements")
      .select("*")
      .eq("site_id", siteId);
    
    if (data) setElements(data);
  };

  const previewSizes = {
    mobile: { width: 375, label: "Móvil" },
    tablet: { width: 768, label: "Tablet" },
    desktop: { width: "100%", label: "Desktop" },
  };

  const siteUrl = site?.url || `https://${siteId.replace(/-/g, ".")}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="flex items-center gap-2 text-amber-400 font-bold">
            <Zap size={20} />
            <span>Mineiro</span>
          </a>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2 text-sm">
            <Globe size={14} className="text-slate-400" />
            <span className="text-slate-300">{site?.url || siteId}</span>
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
            onClick={handleRefreshScan}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            Re-escanear
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
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar elementos..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === "all"
                    ? "bg-cyan-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Todos ({elements.length})
              </button>
              {Object.entries(ElementTypeConfig).map(([type, config]) => {
                const count = elements.filter((e) => e.type === type).length;
                if (count === 0) return null;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterType === type
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Elements List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {Object.keys(groupedElements).length === 0 ? (
              <div className="text-center py-12">
                <Search size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No se encontraron elementos</p>
                <p className="text-sm text-slate-500 mt-1">
                  {searchQuery ? "Intenta con otra búsqueda" : "El sitio aún no ha sido escaneado"}
                </p>
              </div>
            ) : (
              Object.entries(groupedElements).map(([context, contextElements]) => (
                <ContextGroup
                  key={context}
                  context={context}
                  elements={contextElements}
                  onUpdate={handleUpdate}
                  isSaving={isSaving}
                />
              ))
            )}
          </div>

          {/* Stats Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {elements.length} elementos detectados
              </span>
              <span className="text-slate-500">
                Última actualización: {site?.last_scan ? new Date(site.last_scan).toLocaleString("es-CL") : "Nunca"}
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
              sandbox="allow-same-origin allow-scripts allow-forms"
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
