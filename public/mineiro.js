/* ═══════════════════════════════════════════════════════════════════════════
   MINEIRO UNIFIED ENGINE v5 - Editor Visual Universal
   "Una línea de código. Control total."
   
   Este script:
   1. Carga datos desde las tablas ORIGINALES (tiendas, productos, testimonios)
   2. Hidrata los elementos con data-mineiro-bind
   3. Permite edición visual inline (modo admin)
   4. Guarda cambios directamente en las tablas originales
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  "use strict";

  const VERSION = "5.0.0";
  const SUPABASE_URL = "https://zzgyczbiufafthizurbv.supabase.co";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  
  // Clave anon pública de Supabase
  const getSupabaseKey = () => {
    const script = document.querySelector("script[data-mineiro-key]");
    return script?.dataset.mineiroKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Z3ljemJpdWZhZnRoaXp1cmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc2NDUyNDksImV4cCI6MjA1MzIyMTI0OX0.SsJEBEVlvJPoHwrxNEKnAiF2mtv7Xa2OUBuhT0rGHiM";
  };

  /* ─────────────────────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────────────────────── */

  const log = (msg, ...args) => console.log(`%c[Mineiro v${VERSION}]%c ${msg}`, "color:#f59e0b;font-weight:bold", "color:inherit", ...args);
  const warn = (msg, ...args) => console.warn(`[Mineiro] ${msg}`, ...args);

  const formatCLP = (value) => {
    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `$${value}`;
    }
  };

  const parsePrice = (text) => {
    if (!text) return null;
    if (typeof text === 'number') return text;
    const cleaned = String(text).replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const escapeHtml = (text) => {
    const d = document.createElement("div");
    d.textContent = text ?? "";
    return d.innerHTML;
  };

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      const idx = parseInt(key, 10);
      return !isNaN(idx) ? acc[idx] : acc[key];
    }, obj);
  };

  const setNestedValue = (obj, path, value) => {
    const keys = path.split(".");
    const lastKey = keys.pop();
    let current = obj;
    for (const key of keys) {
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
    return obj;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     SUPABASE CLIENT
     ───────────────────────────────────────────────────────────────────────── */

  let supabase = null;
  let tiendaData = null;
  let productosCache = [];
  let testimoniosCache = [];

  const loadSupabase = () =>
    new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve(window.supabase);
      const s = document.createElement("script");
      s.src = SUPABASE_CDN;
      s.async = true;
      s.onload = () => resolve(window.supabase);
      s.onerror = () => reject(new Error("Failed to load Supabase"));
      document.head.appendChild(s);
    });

  const initSupabase = async () => {
    const sb = await loadSupabase();
    const key = getSupabaseKey();
    supabase = sb.createClient(SUPABASE_URL, key);
    log("Supabase conectado");
    return supabase;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     DATA FETCHING
     ───────────────────────────────────────────────────────────────────────── */

  const getSiteId = () => {
    const script = document.querySelector("script[data-mineiro-site]");
    if (script?.dataset.mineiroSite) return script.dataset.mineiroSite;
    
    const meta = document.querySelector("meta[name='mineiro-site']");
    if (meta?.content) return meta.content;
    
    return window.location.hostname.replace(/\./g, "-");
  };

  const TIENDA_API_URL = "https://mineiro-clientes.vercel.app/api/tienda";

  const fetchTienda = async (slug) => {
    const hostname = window.location.hostname;
    
    try {
      // Primero intentar con la API (más confiable)
      const response = await fetch(`${TIENDA_API_URL}?slug=${encodeURIComponent(slug)}&hostname=${encodeURIComponent(hostname)}`);
      const result = await response.json();
      
      if (result.found && result.tienda) {
        return result.tienda;
      }
      
      // Si no se encontró, crear la tienda automáticamente
      log("Tienda no encontrada, creando automáticamente...");
      const createResponse = await fetch(TIENDA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug,
          nombre: slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          url_web: window.location.origin
        })
      });
      
      const createResult = await createResponse.json();
      if (createResult.success && createResult.tienda) {
        log("Tienda creada exitosamente:", createResult.tienda.nombre_negocio);
        return createResult.tienda;
      }
      
      return null;
    } catch (apiError) {
      warn("Error con API, intentando directo con Supabase:", apiError.message);
      
      // Fallback a Supabase directo
      const { data, error } = await supabase
        .from("tiendas")
        .select("*")
        .or(`slug.eq.${slug},url_web.ilike.%${hostname}%`)
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        warn("Error fetching tienda:", error.message);
      }
      return data;
    }
  };

  const fetchProductos = async (tiendaId) => {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("tienda_id", tiendaId)
      .eq("visible", true)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data ?? [];
  };

  const fetchTestimonios = async (tiendaId) => {
    const { data, error } = await supabase
      .from("testimonios")
      .select("*")
      .eq("tienda_id", tiendaId)
      .eq("visible", true)
      .order("orden", { ascending: true });
    if (error && error.code !== "PGRST116") throw error;
    return data ?? [];
  };

  /* ─────────────────────────────────────────────────────────────────────────
     BINDING PARSER
     ───────────────────────────────────────────────────────────────────────── */

  const parseBinding = (binding) => {
    if (!binding) return null;

    // Config tienda: "config-tienda.nombre_tienda"
    if (binding.startsWith("config-tienda.")) {
      return { type: "config", field: binding.replace("config-tienda.", "") };
    }

    // Hero: "hero.titulo"
    if (binding.startsWith("hero.")) {
      return { type: "hero", field: binding.replace("hero.", "") };
    }

    // Footer: "footer.descripcion"
    if (binding.startsWith("footer.")) {
      return { type: "footer", field: binding.replace("footer.", "") };
    }

    // Testimonios config: "testimonios-config.titulo"
    if (binding.startsWith("testimonios-config.")) {
      return { type: "testimonios-config", field: binding.replace("testimonios-config.", "") };
    }

    // Testimonio individual: "testimonio-{dom_id}.nombre"
    const testimonioMatch = binding.match(/^testimonio-([a-zA-Z0-9\-_]+)\.(.+)$/);
    if (testimonioMatch) {
      return { type: "testimonio", domId: testimonioMatch[1], field: testimonioMatch[2] };
    }

    // Producto: "producto-{dom_id}.nombre"
    const productoMatch = binding.match(/^producto-([a-zA-Z0-9\-_]+)\.(.+)$/);
    if (productoMatch) {
      return { type: "producto", identifier: productoMatch[1], field: productoMatch[2] };
    }

    return null;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HYDRATION - Apply values to elements
     ───────────────────────────────────────────────────────────────────────── */

  const applyValueToElement = (el, value, field) => {
    if (value === undefined || value === null) return false;

    const tagName = el.tagName.toLowerCase();
    const imageFields = ["imagen_url", "imagen", "imagen_fondo", "logo_url", "avatar"];
    const isImageField = imageFields.some(f => field === f || field.endsWith(`.${f}`));

    if (isImageField) {
      if (tagName === "img") {
        el.src = value;
      } else {
        el.style.backgroundImage = `url('${value}')`;
      }
    } else if (field.endsWith("_url") || field === "url" || field === "link") {
      if (tagName === "a") {
        el.href = value;
      } else {
        el.textContent = value;
      }
    } else if (field === "precio" || field.endsWith(".precio")) {
      el.textContent = typeof value === "number" ? formatCLP(value) : value;
    } else if (field === "rating") {
      const stars = parseInt(value, 10) || 0;
      el.textContent = "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars));
    } else {
      el.textContent = value;
    }

    el.dataset.mineiroHydrated = "true";
    return true;
  };

  const hydrateElement = (el, tienda, productos, testimonios) => {
    const binding = el.dataset.mineiroBind;
    const parsed = parseBinding(binding);

    if (!parsed) {
      warn(`Invalid binding format: ${binding}`);
      return;
    }

    let value;
    const siteConfig = tienda?.site_config || {};

    switch (parsed.type) {
      case "config": {
        value = getNestedValue(siteConfig.config, parsed.field) 
             ?? getNestedValue(tienda, parsed.field)
             ?? tienda?.[parsed.field === "nombre_tienda" ? "nombre_negocio" : parsed.field];
        break;
      }

      case "hero": {
        value = getNestedValue(siteConfig.hero, parsed.field);
        break;
      }

      case "footer": {
        value = getNestedValue(siteConfig.footer, parsed.field)
             ?? (parsed.field === "nombre_tienda" ? tienda?.nombre_negocio : undefined);
        break;
      }

      case "testimonios-config": {
        value = getNestedValue(siteConfig.testimonios_config, parsed.field);
        break;
      }

      case "testimonio": {
        const testimonio = testimonios.find(t => t.dom_id === parsed.domId);
        if (testimonio) {
          value = getNestedValue(testimonio, parsed.field) ?? testimonio[parsed.field];
        }
        break;
      }

      case "producto": {
        const producto = productos.find(p => p.dom_id === parsed.identifier)
                      || productos.find(p => String(p.id) === parsed.identifier);
        if (producto) {
          value = parsed.field.includes(".")
            ? getNestedValue(producto, parsed.field)
            : producto[parsed.field];
        }
        break;
      }
    }

    if (value !== undefined && value !== null) {
      applyValueToElement(el, value, parsed.field);
    }
  };

  const runHydration = (tienda, productos, testimonios) => {
    const elements = document.querySelectorAll("[data-mineiro-bind]");
    let hydrated = 0;
    elements.forEach((el) => {
      try {
        hydrateElement(el, tienda, productos, testimonios);
        hydrated++;
      } catch (err) {
        warn(`Hydration error:`, err);
      }
    });
    log(`Hidratados ${hydrated} elementos`);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     REALTIME SUBSCRIPTIONS
     ───────────────────────────────────────────────────────────────────────── */

  const subscribeToChanges = (tiendaId) => {
    // Subscribe to productos changes
    supabase
      .channel(`productos-${tiendaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos",
          filter: `tienda_id=eq.${tiendaId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const producto = payload.new;
            // Update cache
            const idx = productosCache.findIndex(p => p.id === producto.id);
            if (idx >= 0) {
              productosCache[idx] = producto;
            } else {
              productosCache.push(producto);
            }
            // Re-hydrate elements for this product
            rehydrateProducto(producto);
          }
        }
      )
      .subscribe();

    // Subscribe to tienda changes
    supabase
      .channel(`tienda-${tiendaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tiendas",
          filter: `id=eq.${tiendaId}`,
        },
        (payload) => {
          tiendaData = payload.new;
          runHydration(tiendaData, productosCache, testimoniosCache);
        }
      )
      .subscribe();

    // Subscribe to testimonios changes
    supabase
      .channel(`testimonios-${tiendaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "testimonios",
          filter: `tienda_id=eq.${tiendaId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const testimonio = payload.new;
            const idx = testimoniosCache.findIndex(t => t.id === testimonio.id);
            if (idx >= 0) {
              testimoniosCache[idx] = testimonio;
            } else {
              testimoniosCache.push(testimonio);
            }
            rehydrateTestimonio(testimonio);
          }
        }
      )
      .subscribe();

    log("Suscrito a cambios en tiempo real");
  };

  const rehydrateProducto = (producto) => {
    if (!producto.dom_id) return;
    
    document.querySelectorAll(`[data-mineiro-bind^="producto-${producto.dom_id}."]`).forEach((el) => {
      const binding = el.dataset.mineiroBind;
      const parsed = parseBinding(binding);
      if (parsed && parsed.type === "producto") {
        const value = parsed.field.includes(".")
          ? getNestedValue(producto, parsed.field)
          : producto[parsed.field];
        if (value !== undefined) {
          applyValueToElement(el, value, parsed.field);
        }
      }
    });
  };

  const rehydrateTestimonio = (testimonio) => {
    if (!testimonio.dom_id) return;
    
    document.querySelectorAll(`[data-mineiro-bind^="testimonio-${testimonio.dom_id}."]`).forEach((el) => {
      const binding = el.dataset.mineiroBind;
      const parsed = parseBinding(binding);
      if (parsed && parsed.type === "testimonio") {
        const value = getNestedValue(testimonio, parsed.field) ?? testimonio[parsed.field];
        if (value !== undefined) {
          applyValueToElement(el, value, parsed.field);
        }
      }
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ADMIN MODE - Visual Inline Editing
     ───────────────────────────────────────────────────────────────────────── */

  let adminMode = false;
  let selectedElement = null;
  let pendingChanges = new Map();

  const enableAdminMode = () => {
    if (adminMode) return;
    adminMode = true;

    // Inject admin styles
    const style = document.createElement("style");
    style.id = "mineiro-admin-styles";
    style.textContent = `
      [data-mineiro-bind] {
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      [data-mineiro-bind]:hover {
        outline: 2px dashed #f59e0b !important;
        outline-offset: 2px;
      }
      [data-mineiro-bind].mineiro-selected {
        outline: 3px solid #06b6d4 !important;
        outline-offset: 3px;
      }
      [data-mineiro-bind]::after {
        content: '';
        position: absolute;
        top: -8px;
        right: -8px;
        width: 20px;
        height: 20px;
        background: #f59e0b;
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #000;
      }
      [data-mineiro-bind]:hover::after {
        opacity: 0.8;
        content: '✏️';
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 20px;
        text-align: center;
      }
      .mineiro-admin-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 56px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border-bottom: 2px solid #f59e0b;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      .mineiro-admin-bar * {
        box-sizing: border-box;
      }
      .mineiro-admin-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f59e0b;
        font-weight: 700;
        font-size: 18px;
      }
      .mineiro-admin-hint {
        color: #94a3b8;
        font-size: 14px;
      }
      .mineiro-admin-actions {
        display: flex;
        gap: 10px;
      }
      .mineiro-admin-btn {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        border: none;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mineiro-admin-btn-primary {
        background: linear-gradient(135deg, #06b6d4, #8b5cf6);
        color: white;
      }
      .mineiro-admin-btn-secondary {
        background: #334155;
        color: #e2e8f0;
      }
      .mineiro-admin-btn-success {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
      }
      .mineiro-admin-btn:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      .mineiro-edit-popup {
        position: fixed;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 2px solid #334155;
        border-radius: 16px;
        padding: 20px;
        min-width: 320px;
        max-width: 450px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .mineiro-edit-popup h3 {
        margin: 0 0 4px 0;
        color: #f1f5f9;
        font-size: 16px;
        font-weight: 600;
      }
      .mineiro-edit-popup .edit-type {
        color: #94a3b8;
        font-size: 12px;
        margin-bottom: 16px;
        padding: 4px 10px;
        background: #334155;
        border-radius: 6px;
        display: inline-block;
      }
      .mineiro-edit-popup input,
      .mineiro-edit-popup textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 2px solid #475569;
        background: #0f172a;
        color: #f1f5f9;
        font-size: 15px;
        margin-top: 8px;
        transition: border-color 0.2s;
      }
      .mineiro-edit-popup input:focus,
      .mineiro-edit-popup textarea:focus {
        outline: none;
        border-color: #06b6d4;
      }
      .mineiro-edit-popup textarea {
        min-height: 100px;
        resize: vertical;
      }
      .mineiro-edit-popup label {
        font-size: 13px;
        color: #94a3b8;
        font-weight: 500;
      }
      .mineiro-edit-actions {
        display: flex;
        gap: 10px;
        margin-top: 16px;
      }
      .mineiro-image-preview {
        width: 100%;
        height: 120px;
        border-radius: 10px;
        background: #0f172a;
        border: 2px dashed #475569;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .mineiro-image-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      body.mineiro-admin-active {
        padding-top: 56px !important;
      }
      .mineiro-changes-badge {
        background: #ef4444;
        color: white;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        margin-left: 8px;
      }
    `;
    document.head.appendChild(style);

    // Create admin bar
    const adminBar = document.createElement("div");
    adminBar.className = "mineiro-admin-bar";
    adminBar.innerHTML = `
      <div class="mineiro-admin-logo">
        <span>⚡</span>
        <span>Mineiro Editor</span>
      </div>
      <div class="mineiro-admin-hint">Haz clic en cualquier elemento para editarlo</div>
      <div class="mineiro-admin-actions">
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" onclick="window.MineiroAdmin.openDashboard()">
          📊 Panel Completo
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-primary" onclick="window.MineiroAdmin.disable()">
          ✓ Salir del Editor
        </button>
      </div>
    `;
    document.body.prepend(adminBar);
    document.body.classList.add("mineiro-admin-active");

    // Add click listener for editing
    document.addEventListener("click", handleAdminClick, true);

    log("Modo admin activado - Haz clic en cualquier elemento con data-mineiro-bind para editarlo");
  };

  const disableAdminMode = () => {
    if (!adminMode) return;
    adminMode = false;

    document.getElementById("mineiro-admin-styles")?.remove();
    document.querySelector(".mineiro-admin-bar")?.remove();
    document.querySelector(".mineiro-edit-popup")?.remove();
    document.body.classList.remove("mineiro-admin-active");
    document.removeEventListener("click", handleAdminClick, true);

    if (selectedElement) {
      selectedElement.classList.remove("mineiro-selected");
      selectedElement = null;
    }

    log("Modo admin desactivado");
  };

  const handleAdminClick = (e) => {
    // Ignore clicks inside popup
    if (e.target.closest(".mineiro-edit-popup")) {
      return;
    }

    // Ignore clicks on admin bar
    if (e.target.closest(".mineiro-admin-bar")) {
      return;
    }

    const el = e.target.closest("[data-mineiro-bind]");
    if (!el) {
      // Click outside editable elements - close popup
      document.querySelector(".mineiro-edit-popup")?.remove();
      if (selectedElement) {
        selectedElement.classList.remove("mineiro-selected");
        selectedElement = null;
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Deselect previous
    if (selectedElement) {
      selectedElement.classList.remove("mineiro-selected");
    }

    selectedElement = el;
    el.classList.add("mineiro-selected");

    showEditPopup(el);
  };

  const showEditPopup = (el) => {
    document.querySelector(".mineiro-edit-popup")?.remove();

    const binding = el.dataset.mineiroBind;
    const parsed = parseBinding(binding);
    
    if (!parsed) {
      warn("No se pudo parsear el binding:", binding);
      return;
    }

    // Determine current value and type
    const tagName = el.tagName.toLowerCase();
    let currentValue = "";
    let isImage = false;
    let isLongText = false;
    let isPrice = false;

    const imageFields = ["imagen_url", "imagen", "imagen_fondo", "logo_url", "avatar"];
    isImage = imageFields.some(f => parsed.field === f || parsed.field.endsWith(`.${f}`)) || tagName === "img";
    isPrice = parsed.field === "precio" || parsed.field.endsWith(".precio");

    if (isImage) {
      currentValue = tagName === "img" 
        ? el.src 
        : el.style.backgroundImage.replace(/url\(['"]?(.+?)['"]?\)/i, "$1");
    } else {
      currentValue = el.textContent?.trim() || "";
      if (isPrice) {
        currentValue = parsePrice(currentValue) || "";
      }
    }

    isLongText = !isImage && !isPrice && currentValue.length > 50;

    // Position popup - SIEMPRE cerca del elemento
    const rect = el.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.className = "mineiro-edit-popup";
    
    // Calcular posición centrada horizontalmente respecto al elemento
    let left = rect.left + (rect.width / 2) - 175; // 175 = mitad del ancho del popup (350/2)
    let top = rect.bottom + 10; // 10px debajo del elemento
    
    // Ajustar si se sale por la derecha
    if (left + 350 > window.innerWidth) {
      left = window.innerWidth - 360;
    }
    // Ajustar si se sale por la izquierda
    if (left < 10) {
      left = 10;
    }
    
    // Si no cabe abajo, ponerlo arriba del elemento
    const popupHeight = 280; // altura aproximada
    if (top + popupHeight > window.innerHeight) {
      top = rect.top - popupHeight - 10;
    }
    
    // Si tampoco cabe arriba, ponerlo en el centro de la pantalla
    if (top < 70) {
      top = Math.max(70, (window.innerHeight - popupHeight) / 2);
      left = Math.max(10, (window.innerWidth - 350) / 2);
    }
    
    popup.style.position = "fixed"; // Usar fixed en lugar de absolute
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.zIndex = "9999999";

    // Type label for UI
    const typeLabels = {
      config: "Configuración",
      hero: "Hero / Banner",
      footer: "Footer",
      "testimonios-config": "Config. Testimonios",
      testimonio: "Testimonio",
      producto: "Producto"
    };
    const typeLabel = typeLabels[parsed.type] || "Elemento";
    const fieldLabel = parsed.field.replace(/_/g, " ").replace(/\./g, " › ");

    // Escape values for HTML
    const escapedValue = (currentValue || "").toString().replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    popup.innerHTML = `
      <h3>Editar contenido</h3>
      <div class="edit-type">${typeLabel} › ${fieldLabel}</div>
      
      ${isImage ? `
        <div class="mineiro-image-preview">
          ${currentValue ? `<img src="${escapedValue}" alt="Preview" />` : '<span style="color:#64748b">Sin imagen</span>'}
        </div>
        <label>URL de la imagen</label>
        <input type="url" id="mineiro-edit-input" value="${escapedValue}" placeholder="https://..." />
      ` : isLongText ? `
        <label>Texto</label>
        <textarea id="mineiro-edit-input">${currentValue || ""}</textarea>
      ` : isPrice ? `
        <label>Precio (solo número)</label>
        <input type="number" id="mineiro-edit-input" value="${escapedValue}" placeholder="1000" />
      ` : `
        <label>Contenido</label>
        <input type="text" id="mineiro-edit-input" value="${escapedValue}" />
      `}
      
      <div class="mineiro-edit-actions">
        <button type="button" class="mineiro-admin-btn mineiro-admin-btn-secondary" id="mineiro-cancel-btn" style="flex:1">
          Cancelar
        </button>
        <button type="button" class="mineiro-admin-btn mineiro-admin-btn-success" id="mineiro-save-btn" style="flex:1">
          💾 Guardar
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    // Event listeners
    const input = document.getElementById("mineiro-edit-input");
    const cancelBtn = document.getElementById("mineiro-cancel-btn");
    const saveBtn = document.getElementById("mineiro-save-btn");

    // Update image preview on input
    if (isImage) {
      input.addEventListener("input", () => {
        const preview = popup.querySelector(".mineiro-image-preview");
        if (preview && input.value) {
          preview.innerHTML = `<img src="${escapeHtml(input.value)}" alt="Preview" onerror="this.style.display='none'" />`;
        }
      });
    }

    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("mousedown", (e) => e.stopPropagation());

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.remove();
      if (selectedElement) {
        selectedElement.classList.remove("mineiro-selected");
        selectedElement = null;
      }
    });

    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      saveElementChange(el, parsed, isImage, isPrice);
    });

    // Enter to save (except textarea)
    if (!isLongText) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveElementChange(el, parsed, isImage, isPrice);
        }
      });
    }

    input.focus();
    input.select();
  };

  // URL de la API para guardar cambios
  const API_URL = "https://mineiro-clientes.vercel.app/api/edit";

  const saveElementChange = async (el, parsed, isImage, isPrice) => {
    const input = document.getElementById("mineiro-edit-input");
    const saveBtn = document.getElementById("mineiro-save-btn");
    if (!input) return;

    let value = input.value;
    if (isPrice) {
      value = parseFloat(value) || 0;
    }

    saveBtn.textContent = "⏳ Guardando...";
    saveBtn.disabled = true;

    try {
      let success = false;
      let apiPayload = null;

      switch (parsed.type) {
        case "config":
        case "hero":
        case "footer":
        case "testimonios-config": {
          // Verificar que tiendaData existe
          if (!tiendaData || !tiendaData.id) {
            throw new Error("Tienda no configurada. Verifica el slug en data-mineiro-site");
          }
          
          // Update tienda.site_config
          const siteConfig = JSON.parse(JSON.stringify(tiendaData?.site_config || {}));
          
          if (parsed.type === "config") {
            if (!siteConfig.config) siteConfig.config = {};
            setNestedValue(siteConfig.config, parsed.field, value);
          } else if (parsed.type === "hero") {
            if (!siteConfig.hero) siteConfig.hero = {};
            setNestedValue(siteConfig.hero, parsed.field, value);
          } else if (parsed.type === "footer") {
            if (!siteConfig.footer) siteConfig.footer = {};
            setNestedValue(siteConfig.footer, parsed.field, value);
          } else if (parsed.type === "testimonios-config") {
            if (!siteConfig.testimonios_config) siteConfig.testimonios_config = {};
            setNestedValue(siteConfig.testimonios_config, parsed.field, value);
          }

          apiPayload = {
            action: "update",
            table: "tiendas",
            data: { site_config: siteConfig },
            where: { id: tiendaData.id }
          };
          
          // Update local cache
          tiendaData.site_config = siteConfig;
          break;
        }

        case "producto": {
          const producto = productosCache.find(p => p.dom_id === parsed.identifier)
                        || productosCache.find(p => String(p.id) === parsed.identifier);
          
          if (!producto) {
            throw new Error("Producto no encontrado");
          }

          // Build update object
          const updateData = {};
          if (parsed.field.includes(".")) {
            const topField = parsed.field.split(".")[0];
            const rest = parsed.field.split(".").slice(1).join(".");
            const currentFieldValue = JSON.parse(JSON.stringify(producto[topField] || {}));
            setNestedValue(currentFieldValue, rest, value);
            updateData[topField] = currentFieldValue;
          } else {
            updateData[parsed.field] = value;
          }

          apiPayload = {
            action: "update",
            table: "productos",
            data: updateData,
            where: { id: producto.id }
          };

          // Update local cache
          Object.assign(producto, updateData);
          break;
        }

        case "testimonio": {
          const testimonio = testimoniosCache.find(t => t.dom_id === parsed.domId);
          
          if (!testimonio) {
            throw new Error("Testimonio no encontrado");
          }

          apiPayload = {
            action: "update",
            table: "testimonios",
            data: { [parsed.field]: value },
            where: { id: testimonio.id }
          };

          // Update local cache
          Object.assign(testimonio, { [parsed.field]: value });
          break;
        }
      }

      // Llamar a la API
      if (apiPayload) {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload)
        });

        const result = await response.json();
        
        if (!response.ok || result.error) {
          throw new Error(result.error || "Error al guardar");
        }
        
        success = true;
      }

      if (success) {
        // Apply value to element immediately
        applyValueToElement(el, value, parsed.field);

        // Close popup with success feedback
        const popup = document.querySelector(".mineiro-edit-popup");
        if (popup) {
          popup.innerHTML = `
            <div style="text-align:center;padding:30px">
              <div style="font-size:48px;margin-bottom:10px">✅</div>
              <div style="color:#4ade80;font-size:16px;font-weight:600">¡Guardado!</div>
              <div style="color:#94a3b8;font-size:13px;margin-top:5px">El cambio se refleja en tu página</div>
            </div>
          `;
          setTimeout(() => popup.remove(), 1200);
        }

        if (selectedElement) {
          selectedElement.classList.remove("mineiro-selected");
          selectedElement = null;
        }

        log(`✓ Guardado: ${parsed.type}.${parsed.field} = ${value}`);
      }

    } catch (error) {
      warn("Error al guardar:", error.message);
      
      saveBtn.textContent = "❌ Error";
      saveBtn.style.background = "#ef4444";
      
      setTimeout(() => {
        saveBtn.textContent = "💾 Guardar";
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 2000);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     IFRAME COMMUNICATION (for editor preview)
     ───────────────────────────────────────────────────────────────────────── */

  const setupIframeCommunication = () => {
    window.addEventListener("message", async (event) => {
      if (!event.data || !event.data.type) return;

      switch (event.data.type) {
        case "mineiro-update": {
          // Find element and update it
          const { elementId, value, binding } = event.data;
          
          // Try to find by element_id in our cache first
          // Otherwise re-fetch and re-hydrate
          log(`Recibido update desde iframe: ${binding || elementId} = ${value}`);
          
          // Re-run hydration to pick up changes
          if (tiendaData) {
            runHydration(tiendaData, productosCache, testimoniosCache);
          }
          break;
        }

        case "mineiro-rescan": {
          // Re-fetch all data and re-hydrate
          if (tiendaData) {
            const [productos, testimonios] = await Promise.all([
              fetchProductos(tiendaData.id),
              fetchTestimonios(tiendaData.id).catch(() => []),
            ]);
            productosCache = productos;
            testimoniosCache = testimonios;
            runHydration(tiendaData, productos, testimonios);
          }
          break;
        }

        case "mineiro-enable-admin": {
          enableAdminMode();
          break;
        }
      }
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PUBLIC API
     ───────────────────────────────────────────────────────────────────────── */

  window.MineiroAdmin = {
    enable: enableAdminMode,
    disable: disableAdminMode,
    openDashboard: () => {
      const siteId = getSiteId();
      window.open(`https://mineiro-clientes.vercel.app/dashboard`, "_blank");
    },
    refresh: () => {
      if (tiendaData) {
        runHydration(tiendaData, productosCache, testimoniosCache);
      }
    },
    getSiteId,
    version: VERSION,
  };

  /* ─────────────────────────────────────────────────────────────────────────
     INITIALIZATION
     ───────────────────────────────────────────────────────────────────────── */

  const init = async () => {
    log(`Inicializando...`);
    
    // PRIMERO: Si hay ?mineiro-admin en la URL, activar modo admin inmediatamente
    const shouldEnableAdmin = window.location.search.includes("mineiro-admin") ||
                              window.location.hash.includes("mineiro-admin") ||
                              window.location.search.includes("mineiro-preview");
    
    if (shouldEnableAdmin) {
      log("Modo admin detectado en URL, activando...");
      setTimeout(enableAdminMode, 300);
    }

    try {
      await initSupabase();
      const siteId = getSiteId();
      log(`Site ID: ${siteId}`);

      // Fetch tienda
      tiendaData = await fetchTienda(siteId);
      
      if (tiendaData) {
        log("Tienda cargada:", tiendaData.nombre_negocio);

        // Fetch data in parallel
        const [productos, testimonios] = await Promise.all([
          fetchProductos(tiendaData.id).catch(() => []),
          fetchTestimonios(tiendaData.id).catch(() => []),
        ]);

        productosCache = productos;
        testimoniosCache = testimonios;

        log(`Cargados: ${productos.length} productos, ${testimonios.length} testimonios`);

        // Hydrate elements
        runHydration(tiendaData, productos, testimonios);

        // Subscribe to realtime changes
        subscribeToChanges(tiendaData.id);
      } else {
        warn(`Tienda no encontrada para: ${siteId}`);
        log("El modo admin funcionará pero sin datos de la tienda");
      }

      // Setup iframe communication
      setupIframeCommunication();

      log("✓ Engine listo");

    } catch (err) {
      warn("Error de inicialización:", err.message);
      console.error(err);
    }
  };

  const showSuspendedBanner = () => {
    if (document.getElementById("mineiro-suspended-banner")) return;
    const banner = document.createElement("div");
    banner.id = "mineiro-suspended-banner";
    banner.innerHTML = `
      <div style="position:fixed;bottom:0;left:0;right:0;background:#0f172a;color:#f8fafc;padding:16px 20px;text-align:center;font-family:system-ui;border-top:2px solid #f59e0b;z-index:99999">
        <strong>⚠️ Servicio Mineiro Suspendido</strong> - 
        <a href="https://mineiro-clientes.vercel.app/pricing" style="color:#f59e0b;text-decoration:underline">Activa tu plan</a>
      </div>
    `;
    document.body.appendChild(banner);
  };

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
