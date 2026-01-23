"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Star,
  User,
  MessageSquare,
  ShoppingBag,
  ImagePlus,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { getSupabaseClient } from "@/utils/supabase/client";

/* ─────────────────────────────────────────────────────────────────────────
   STAR RATING INPUT
   ───────────────────────────────────────────────────────────────────────── */

function StarRating({ value, onChange }) {
  const stars = parseInt(value, 10) || 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-xl transition-colors ${
            n <= stars ? "text-amber-400" : "text-slate-600 hover:text-amber-400/50"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TESTIMONIO CARD EDITOR
   ───────────────────────────────────────────────────────────────────────── */

function TestimonioCard({ testimonio, onChange, onDelete, onToggleVisible, userId }) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `testimonios/${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("fotos-menu")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("fotos-menu")
        .getPublicUrl(fileName);

      onChange("imagen", urlData.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-slate-900/60 overflow-hidden transition-all ${
      testimonio.visible ? "border-slate-700" : "border-slate-800 opacity-60"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400">
          <GripVertical size={16} className="cursor-grab" />
          <span className="text-xs font-mono bg-slate-700/50 px-2 py-0.5 rounded">
            {testimonio.dom_id || "sin-dom-id"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleVisible}
            className={`p-1.5 rounded-lg transition-colors ${
              testimonio.visible 
                ? "text-emerald-400 hover:bg-emerald-500/20" 
                : "text-slate-500 hover:bg-slate-700"
            }`}
            title={testimonio.visible ? "Visible" : "Oculto"}
          >
            {testimonio.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="relative w-16 h-16">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800 flex items-center justify-center">
                {testimonio.imagen ? (
                  <img src={testimonio.imagen} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-slate-600" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-slate-900/80 rounded-full flex items-center justify-center">
                    <Loader2 size={20} className="text-cyan-400 animate-spin" />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full"
                disabled={uploading}
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600">
                <ImagePlus size={12} className="text-slate-400" />
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
                  <User size={12} /> Nombre
                </label>
                <input
                  type="text"
                  value={testimonio.nombre || ""}
                  onChange={(e) => onChange("nombre", e.target.value)}
                  placeholder="María González"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
                  <ShoppingBag size={12} /> Producto comprado
                </label>
                <input
                  type="text"
                  value={testimonio.producto_comprado || ""}
                  onChange={(e) => onChange("producto_comprado", e.target.value)}
                  placeholder="Labial Mate"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
                <Star size={12} /> Rating
              </label>
              <StarRating
                value={testimonio.rating}
                onChange={(v) => onChange("rating", v)}
              />
            </div>
          </div>
        </div>

        {/* DOM ID */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            DOM ID (para binding)
          </label>
          <input
            type="text"
            value={testimonio.dom_id || ""}
            onChange={(e) => onChange("dom_id", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder="testimonio-maria"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">
            Usa este ID en el HTML: <code className="bg-slate-800 px-1 rounded">data-mineiro-bind="testimonio-{testimonio.dom_id || "id"}.nombre"</code>
          </p>
        </div>

        {/* Texto */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <MessageSquare size={12} /> Texto del testimonio
          </label>
          <textarea
            value={testimonio.texto || ""}
            onChange={(e) => onChange("texto", e.target.value)}
            placeholder="Me encantó el producto, la calidad es increíble y llegó muy rápido..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm resize-none"
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────────────────── */

export default function TestimoniosEditor({ tiendaId, userId }) {
  const [testimonios, setTestimonios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load testimonios
  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase || !tiendaId) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("testimonios")
          .select("*")
          .eq("tienda_id", tiendaId)
          .order("orden", { ascending: true });

        if (error && error.code !== "42P01") throw error; // Ignore "table not found"
        setTestimonios(data || []);
      } catch (err) {
        console.error("Error loading testimonios:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tiendaId]);

  const handleAdd = () => {
    const newTestimonio = {
      id: `temp-${Date.now()}`,
      tienda_id: tiendaId,
      user_id: userId,
      dom_id: `testimonio-${Date.now()}`,
      nombre: "",
      texto: "",
      imagen: "",
      rating: 5,
      producto_comprado: "",
      visible: true,
      orden: testimonios.length,
      _isNew: true,
    };
    setTestimonios([...testimonios, newTestimonio]);
  };

  const handleChange = (index, field, value) => {
    setTestimonios((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value, _modified: true } : t))
    );
  };

  const handleDelete = async (index) => {
    const testimonio = testimonios[index];
    
    if (!testimonio._isNew) {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      if (!confirm("¿Eliminar este testimonio?")) return;
      
      const { error } = await supabase
        .from("testimonios")
        .delete()
        .eq("id", testimonio.id);
        
      if (error) {
        alert("Error al eliminar: " + error.message);
        return;
      }
    }

    setTestimonios((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleVisible = (index) => {
    handleChange(index, "visible", !testimonios[index].visible);
  };

  const handleSaveAll = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSaving(true);
    try {
      for (const testimonio of testimonios) {
        const payload = {
          tienda_id: tiendaId,
          user_id: userId,
          dom_id: testimonio.dom_id,
          nombre: testimonio.nombre,
          texto: testimonio.texto,
          imagen: testimonio.imagen,
          rating: testimonio.rating,
          producto_comprado: testimonio.producto_comprado,
          visible: testimonio.visible,
          orden: testimonio.orden,
        };

        if (testimonio._isNew) {
          const { error } = await supabase
            .from("testimonios")
            .insert({ id: crypto.randomUUID(), ...payload });
          if (error) throw error;
        } else if (testimonio._modified) {
          const { error } = await supabase
            .from("testimonios")
            .update(payload)
            .eq("id", testimonio.id);
          if (error) throw error;
        }
      }

      // Reload to get clean data
      const { data } = await supabase
        .from("testimonios")
        .select("*")
        .eq("tienda_id", tiendaId)
        .order("orden", { ascending: true });

      setTestimonios(data || []);
    } catch (err) {
      console.error("Save error:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = testimonios.some((t) => t._isNew || t._modified);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <MessageSquare className="text-amber-400" size={22} />
            Testimonios
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona los testimonios que aparecen en la web
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Plus size={18} />
            Agregar
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Todo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Testimonios Grid */}
      {testimonios.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-slate-700 bg-slate-900/30">
          <MessageSquare size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 mb-4">No hay testimonios aún</p>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
          >
            <Plus size={18} />
            Crear primer testimonio
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {testimonios.map((testimonio, index) => (
            <TestimonioCard
              key={testimonio.id}
              testimonio={testimonio}
              onChange={(field, value) => handleChange(index, field, value)}
              onDelete={() => handleDelete(index)}
              onToggleVisible={() => handleToggleVisible(index)}
              userId={userId}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
        <p className="text-sm text-slate-400">
          <strong className="text-slate-300">Tip:</strong> Usa el <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">dom_id</code> para vincular cada testimonio con tu HTML.
          Por ejemplo: <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">data-mineiro-bind="testimonio-maria.texto"</code>
        </p>
      </div>
    </div>
  );
}
