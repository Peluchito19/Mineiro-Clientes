"use client";

import { useState } from "react";
import {
  ImagePlus,
  Save,
  Loader2,
  Globe,
  MessageSquare,
  Mail,
  Clock,
  Type,
  FileText,
  Image,
  Link,
  Sparkles,
} from "lucide-react";
import { getSupabaseClient } from "@/utils/supabase/client";

/* ─────────────────────────────────────────────────────────────────────────
   FIELD COMPONENT
   ───────────────────────────────────────────────────────────────────────── */

function ConfigField({ label, icon: Icon, field, value, onChange, type = "text", placeholder, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
        {Icon && <Icon size={14} className="text-slate-400" />}
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 resize-none text-sm"
        />
      ) : (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 text-sm"
        />
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   IMAGE UPLOAD FIELD
   ───────────────────────────────────────────────────────────────────────── */

function ImageField({ label, field, value, onChange, userId }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `site-config/${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("fotos-menu")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("fotos-menu")
        .getPublicUrl(fileName);

      onChange(field, urlData.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <Image size={14} className="text-slate-400" />
        {label}
      </label>
      <div className="relative">
        <div
          className={`
            h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors cursor-pointer
            ${value ? "border-slate-600" : "border-slate-700 hover:border-slate-500"}
          `}
        >
          {value ? (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-slate-500">
              <ImagePlus size={28} className="mx-auto mb-1" />
              <span className="text-xs">Click para subir</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
              <Loader2 size={24} className="text-cyan-400 animate-spin" />
            </div>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(field, "")}
          className="text-xs text-rose-400 hover:text-rose-300"
        >
          Eliminar imagen
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION WRAPPER
   ───────────────────────────────────────────────────────────────────────── */

function ConfigSection({ title, icon: Icon, children, color = "cyan" }) {
  const colorClasses = {
    cyan: "from-cyan-500/20 to-transparent border-cyan-500/30 text-cyan-400",
    violet: "from-violet-500/20 to-transparent border-violet-500/30 text-violet-400",
    amber: "from-amber-500/20 to-transparent border-amber-500/30 text-amber-400",
    emerald: "from-emerald-500/20 to-transparent border-emerald-500/30 text-emerald-400",
  };

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      <div className={`px-5 py-3 bg-gradient-to-r ${colorClasses[color]} border-b`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} />}
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────────────────── */

export default function SiteConfigEditor({ tienda, userId, onSave }) {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(tienda.site_config || {
    config: {
      nombre_tienda: tienda.nombre_negocio || "",
      slogan: "",
      whatsapp: "",
      whatsapp_display: "",
    },
    hero: {
      imagen_fondo: "",
      titulo: "",
      subtitulo: "",
      boton_texto: "",
      boton_url: "",
    },
    footer: {
      descripcion: "",
      whatsapp: "",
      email: "",
      horario_semana: "",
      horario_sabado: "",
      copyright: "",
    },
    testimonios_config: {
      titulo: "Lo que dicen nuestros clientes",
      subtitulo: "Testimonios reales",
    },
  });

  const updateField = (section, field, value) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tiendas")
        .update({ site_config: config })
        .eq("id", tienda.id);

      if (error) throw error;
      onSave?.(config);
    } catch (err) {
      console.error("Save error:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="text-amber-400" size={22} />
            Configuración del Sitio
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Edita los textos e imágenes de la web de tu cliente
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save size={18} />
              Guardar Configuración
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Config */}
        <ConfigSection title="Información General" icon={Globe} color="cyan">
          <ConfigField
            label="Nombre de la Tienda"
            icon={Type}
            field="nombre_tienda"
            value={config.config?.nombre_tienda}
            onChange={(f, v) => updateField("config", f, v)}
            placeholder="Cosméticos Fran"
          />
          <ConfigField
            label="Slogan"
            icon={Sparkles}
            field="slogan"
            value={config.config?.slogan}
            onChange={(f, v) => updateField("config", f, v)}
            placeholder="Belleza & Estilo"
          />
          <ConfigField
            label="WhatsApp (número)"
            icon={MessageSquare}
            field="whatsapp"
            value={config.config?.whatsapp}
            onChange={(f, v) => updateField("config", f, v)}
            placeholder="+56 9 1234 5678"
          />
          <ConfigField
            label="WhatsApp (texto a mostrar)"
            field="whatsapp_display"
            value={config.config?.whatsapp_display}
            onChange={(f, v) => updateField("config", f, v)}
            placeholder="WhatsApp: +56 9 1234 5678"
            hint="Texto que aparecerá junto al botón de WhatsApp"
          />
        </ConfigSection>

        {/* Hero Section */}
        <ConfigSection title="Banner Principal (Hero)" icon={Image} color="violet">
          <ImageField
            label="Imagen de Fondo"
            field="imagen_fondo"
            value={config.hero?.imagen_fondo}
            onChange={(f, v) => updateField("hero", f, v)}
            userId={userId}
          />
          <ConfigField
            label="Título Principal"
            icon={Type}
            field="titulo"
            value={config.hero?.titulo}
            onChange={(f, v) => updateField("hero", f, v)}
            placeholder="Bienvenidos a nuestra tienda"
          />
          <ConfigField
            label="Subtítulo"
            field="subtitulo"
            value={config.hero?.subtitulo}
            onChange={(f, v) => updateField("hero", f, v)}
            placeholder="Los mejores productos al mejor precio"
            type="textarea"
          />
          <div className="grid grid-cols-2 gap-3">
            <ConfigField
              label="Texto del Botón"
              field="boton_texto"
              value={config.hero?.boton_texto}
              onChange={(f, v) => updateField("hero", f, v)}
              placeholder="Ver Catálogo"
            />
            <ConfigField
              label="URL del Botón"
              icon={Link}
              field="boton_url"
              value={config.hero?.boton_url}
              onChange={(f, v) => updateField("hero", f, v)}
              placeholder="#catalogo"
            />
          </div>
        </ConfigSection>

        {/* Footer */}
        <ConfigSection title="Pie de Página (Footer)" icon={FileText} color="emerald">
          <ConfigField
            label="Descripción del Negocio"
            field="descripcion"
            value={config.footer?.descripcion}
            onChange={(f, v) => updateField("footer", f, v)}
            placeholder="Somos una tienda dedicada a..."
            type="textarea"
          />
          <div className="grid grid-cols-2 gap-3">
            <ConfigField
              label="WhatsApp"
              icon={MessageSquare}
              field="whatsapp"
              value={config.footer?.whatsapp}
              onChange={(f, v) => updateField("footer", f, v)}
              placeholder="+56 9 1234 5678"
            />
            <ConfigField
              label="Email"
              icon={Mail}
              field="email"
              value={config.footer?.email}
              onChange={(f, v) => updateField("footer", f, v)}
              placeholder="contacto@mitienda.cl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ConfigField
              label="Horario Semana"
              icon={Clock}
              field="horario_semana"
              value={config.footer?.horario_semana}
              onChange={(f, v) => updateField("footer", f, v)}
              placeholder="Lun - Vie: 9:00 - 18:00"
            />
            <ConfigField
              label="Horario Sábado"
              icon={Clock}
              field="horario_sabado"
              value={config.footer?.horario_sabado}
              onChange={(f, v) => updateField("footer", f, v)}
              placeholder="Sáb: 10:00 - 14:00"
            />
          </div>
          <ConfigField
            label="Texto de Copyright"
            field="copyright"
            value={config.footer?.copyright}
            onChange={(f, v) => updateField("footer", f, v)}
            placeholder="© 2024 Mi Tienda. Todos los derechos reservados."
          />
        </ConfigSection>

        {/* Testimonios Config */}
        <ConfigSection title="Sección de Testimonios" icon={MessageSquare} color="amber">
          <ConfigField
            label="Título de la Sección"
            icon={Type}
            field="titulo"
            value={config.testimonios_config?.titulo}
            onChange={(f, v) => updateField("testimonios_config", f, v)}
            placeholder="Lo que dicen nuestros clientes"
          />
          <ConfigField
            label="Subtítulo"
            field="subtitulo"
            value={config.testimonios_config?.subtitulo}
            onChange={(f, v) => updateField("testimonios_config", f, v)}
            placeholder="Testimonios reales de compradores"
          />
        </ConfigSection>
      </div>
    </div>
  );
}
