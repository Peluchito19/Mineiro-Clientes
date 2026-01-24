/* ═══════════════════════════════════════════════════════════════════════════
   MINEIRO UNIFIED ENGINE v6 - Editor Visual Universal
   "Una línea de código. Control total."
   
   Este script:
   1. Carga datos desde las tablas ORIGINALES (tiendas, productos, testimonios)
   2. Hidrata los elementos con data-mineiro-bind
   3. Permite edición visual inline (modo admin)
   4. Guarda cambios directamente en las tablas originales
   5. Sincroniza cambios en tiempo real via polling (fallback si WebSocket falla)
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  "use strict";

  const VERSION = "6.0.0";
  const SUPABASE_URL = "https://zzgyczbiufafthizurbv.supabase.co";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  
  // API URLs
  const API_BASE_URL = "https://mineiro-clientes.vercel.app/api";
  const TIENDA_API_URL = `${API_BASE_URL}/tienda`;
  const EDIT_API_URL = `${API_BASE_URL}/edit`;
  
  // Polling interval para sincronización (5 segundos)
  const POLL_INTERVAL = 5000;
  let pollTimer = null;
  let lastDataHash = null;
  
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
     DATA FETCHING - Siempre via API (bypass RLS)
     ───────────────────────────────────────────────────────────────────────── */

  const getSiteId = () => {
    // 1. Buscar en data-mineiro-site (prioridad máxima)
    const script = document.querySelector("script[data-mineiro-site]");
    if (script?.dataset.mineiroSite) return script.dataset.mineiroSite;
    
    // 2. Buscar en meta tag
    const meta = document.querySelector("meta[name='mineiro-site']");
    if (meta?.content) return meta.content;
    
    // 3. Extraer del hostname de Vercel (ej: cosmeticos-fran.vercel.app -> cosmeticos-fran)
    const hostname = window.location.hostname;
    if (hostname.endsWith('.vercel.app')) {
      return hostname.replace('.vercel.app', '');
    }
    
    // 4. Fallback: hostname completo
    return hostname.replace(/\./g, "-");
  };

  // Función para generar hash simple de datos para detectar cambios
  const generateDataHash = (data) => {
    try {
      return JSON.stringify(data).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString();
    } catch {
      return Date.now().toString();
    }
  };

  // Función unificada que carga tienda + productos + testimonios via API (bypass RLS)
  const fetchAllData = async (slug) => {
    const hostname = window.location.hostname;
    
    try {
      // Usar la API con include=all para cargar todo
      const response = await fetch(
        `${TIENDA_API_URL}?slug=${encodeURIComponent(slug)}&hostname=${encodeURIComponent(hostname)}&include=all`,
        { cache: 'no-store' } // Evitar cache para obtener datos frescos
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.found && result.tienda) {
        log(`API respondió: tienda=${result.tienda.nombre_negocio}, productos=${(result.productos || []).length}, testimonios=${(result.testimonios || []).length}`);
        return {
          tienda: result.tienda,
          productos: result.productos || [],
          testimonios: result.testimonios || []
        };
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
        return {
          tienda: createResult.tienda,
          productos: [],
          testimonios: []
        };
      }
      
      return { tienda: null, productos: [], testimonios: [] };
    } catch (apiError) {
      warn("Error con API:", apiError.message);
      return { tienda: null, productos: [], testimonios: [] };
    }
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
        // Primero buscar en testimonios de BD
        const testimonio = testimonios.find(t => t.dom_id === parsed.domId);
        if (testimonio) {
          value = getNestedValue(testimonio, parsed.field) ?? testimonio[parsed.field];
        } else {
          // Fallback: buscar en site_config.testimonios
          value = getNestedValue(siteConfig, `testimonios.${parsed.domId}.${parsed.field}`);
        }
        break;
      }

      case "producto": {
        // Primero buscar en productos de BD
        const producto = productos.find(p => p.dom_id === parsed.identifier)
                      || productos.find(p => String(p.id) === parsed.identifier);
        if (producto) {
          value = parsed.field.includes(".")
            ? getNestedValue(producto, parsed.field)
            : producto[parsed.field];
        } else {
          // Fallback: buscar en site_config.productos (para cuando no hay BD)
          value = getNestedValue(siteConfig, `productos.${parsed.identifier}.${parsed.field}`);
        }
        break;
      }
    }

    if (value !== undefined && value !== null) {
      applyValueToElement(el, value, parsed.field);
    }
  };

  const runHydration = (tienda, productos, testimonios) => {
    const elements = document.querySelectorAll("[data-mineiro-bind]:not([data-mineiro-hydrated])");
    let hydrated = 0;
    elements.forEach((el) => {
      try {
        hydrateElement(el, tienda, productos, testimonios);
        hydrated++;
      } catch (err) {
        warn(`Hydration error:`, err);
      }
    });
    if (hydrated > 0) {
      log(`Hidratados ${hydrated} elementos`);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     MUTATION OBSERVER - Detecta elementos añadidos por React/Vue/etc
     ───────────────────────────────────────────────────────────────────────── */

  let mutationObserver = null;
  let hydrationTimeout = null;

  const setupMutationObserver = () => {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((mutations) => {
      let hasNewBindings = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.hasAttribute?.('data-mineiro-bind') || 
                  node.querySelector?.('[data-mineiro-bind]')) {
                hasNewBindings = true;
                break;
              }
            }
          }
        }
        if (hasNewBindings) break;
      }

      if (hasNewBindings && tiendaData) {
        // Debounce: esperar 100ms para que React termine de renderizar
        clearTimeout(hydrationTimeout);
        hydrationTimeout = setTimeout(() => {
          log("Detectados nuevos elementos, re-hidratando...");
          runHydration(tiendaData, productosCache, testimoniosCache);
        }, 100);
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    log("MutationObserver activo - detectando elementos de React/SPA");
  };

  /* ─────────────────────────────────────────────────────────────────────────
     REALTIME SUBSCRIPTIONS + POLLING FALLBACK
     ───────────────────────────────────────────────────────────────────────── */

  let realtimeConnected = false;

  const subscribeToChanges = (tiendaId) => {
    if (!supabase) {
      warn("Supabase no inicializado, usando solo polling");
      startPolling();
      return;
    }

    try {
      // Subscribe to productos changes
      const productosChannel = supabase
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
            log("Realtime: cambio en productos detectado");
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
              // Force full re-hydrate
              forceRehydrateAll();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            realtimeConnected = true;
            log("✓ Realtime conectado para productos");
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            warn("Realtime productos falló, usando polling");
            startPolling();
          }
        });

      // Subscribe to tienda changes
      const tiendaChannel = supabase
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
            log("Realtime: cambio en tienda detectado");
            tiendaData = payload.new;
            forceRehydrateAll();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            log("✓ Realtime conectado para tienda");
          }
        });

      // Subscribe to testimonios changes
      const testimoniosChannel = supabase
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
            log("Realtime: cambio en testimonios detectado");
            if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
              const testimonio = payload.new;
              const idx = testimoniosCache.findIndex(t => t.id === testimonio.id);
              if (idx >= 0) {
                testimoniosCache[idx] = testimonio;
              } else {
                testimoniosCache.push(testimonio);
              }
              rehydrateTestimonio(testimonio);
              forceRehydrateAll();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            log("✓ Realtime conectado para testimonios");
          }
        });

      log("Suscrito a cambios en tiempo real");
      
      // Iniciar polling como respaldo después de un timeout
      setTimeout(() => {
        if (!realtimeConnected) {
          warn("Realtime no conectó, iniciando polling");
          startPolling();
        }
      }, 5000);
      
    } catch (error) {
      warn("Error en realtime:", error.message);
      startPolling();
    }
  };

  // Polling como fallback para sincronización
  const startPolling = () => {
    if (pollTimer) return; // Ya está corriendo
    
    log("Iniciando polling para sincronización (cada 5s)");
    
    pollTimer = setInterval(async () => {
      if (!tiendaData) return;
      
      try {
        const siteId = getSiteId();
        const newData = await fetchAllData(siteId);
        
        if (!newData.tienda) return;
        
        const newHash = generateDataHash({
          tienda: newData.tienda.site_config,
          productos: newData.productos,
          testimonios: newData.testimonios
        });
        
        if (lastDataHash && newHash !== lastDataHash) {
          log("Polling: detectados cambios, actualizando...");
          
          // Actualizar caches
          tiendaData = newData.tienda;
          productosCache = newData.productos;
          testimoniosCache = newData.testimonios;
          
          // Forzar re-hidratación
          forceRehydrateAll();
        }
        
        lastDataHash = newHash;
        
      } catch (error) {
        // Silenciar errores de polling
      }
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      log("Polling detenido");
    }
  };

  // Forzar re-hidratación completa (quitar atributo hydrated)
  const forceRehydrateAll = () => {
    document.querySelectorAll("[data-mineiro-bind][data-mineiro-hydrated]").forEach(el => {
      el.removeAttribute("data-mineiro-hydrated");
    });
    runHydration(tiendaData, productosCache, testimoniosCache);
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
          log(`Buscando producto con identifier: "${parsed.identifier}"`);
          log(`Productos en cache: ${productosCache.length}`);
          
          // Buscar producto por múltiples métodos
          let producto = productosCache.find(p => p.dom_id === parsed.identifier)
                      || productosCache.find(p => String(p.id) === parsed.identifier);
          
          // Si no encontró, intentar buscar por el contenedor padre del elemento
          if (!producto && el) {
            // Buscar el nombre del producto en el contenedor más cercano
            const container = el.closest('[data-mineiro-bind*="producto-"]') 
                           || el.closest('.product-card, .producto, [class*="product"], [class*="producto"]')
                           || el.parentElement?.parentElement;
            
            if (container) {
              // Buscar un elemento con el nombre del producto
              const nombreEl = container.querySelector('[data-mineiro-bind*=".nombre"]')
                            || container.querySelector('h1, h2, h3, h4, .product-name, .nombre-producto');
              
              if (nombreEl) {
                const nombreTexto = nombreEl.textContent?.trim().toLowerCase();
                if (nombreTexto) {
                  producto = productosCache.find(p => 
                    p.nombre?.toLowerCase().includes(nombreTexto) || 
                    nombreTexto.includes(p.nombre?.toLowerCase())
                  );
                }
              }
            }
            
            // Último intento: si el identifier parece un nombre, buscar por nombre
            if (!producto && parsed.identifier) {
              const searchName = parsed.identifier.replace(/-/g, ' ').toLowerCase();
              producto = productosCache.find(p => 
                p.nombre?.toLowerCase().includes(searchName) ||
                searchName.includes(p.nombre?.toLowerCase())
              );
            }
          }
          
          // Si no hay productos en cache, guardar en site_config como fallback
          if (!producto && productosCache.length === 0) {
            log(`Sin productos en BD, guardando en site_config.productos.${parsed.identifier}`);
            
            // Verificar que tiendaData existe
            if (!tiendaData || !tiendaData.id) {
              throw new Error("Tienda no configurada. Verifica el slug en data-mineiro-site");
            }
            
            // Guardar en site_config.productos como objeto dinámico
            const siteConfig = JSON.parse(JSON.stringify(tiendaData?.site_config || {}));
            if (!siteConfig.productos) siteConfig.productos = {};
            if (!siteConfig.productos[parsed.identifier]) siteConfig.productos[parsed.identifier] = {};
            
            siteConfig.productos[parsed.identifier][parsed.field] = value;
            
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
          
          if (!producto) {
            warn("Productos disponibles:", productosCache.map(p => ({ id: p.id, nombre: p.nombre, dom_id: p.dom_id })));
            throw new Error(`Producto no encontrado: ${parsed.identifier}. Verifica que exista en la base de datos o que el dom_id coincida.`);
          }

          log(`Producto encontrado: ${producto.nombre} (id: ${producto.id})`);

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
          // Buscar testimonio por múltiples métodos
          let testimonio = testimoniosCache.find(t => t.dom_id === parsed.domId);
          
          // Si no encontró, intentar buscar por el contenedor padre
          if (!testimonio && el) {
            const container = el.closest('[data-mineiro-bind*="testimonio-"]')
                           || el.closest('.testimonial, .testimonio, .review, [class*="testimonial"]')
                           || el.parentElement?.parentElement;
            
            if (container) {
              // Buscar por nombre del autor
              const nombreEl = container.querySelector('[data-mineiro-bind*=".nombre"]')
                            || container.querySelector('.author-name, .nombre-autor, .reviewer-name');
              
              if (nombreEl) {
                const nombreTexto = nombreEl.textContent?.trim().toLowerCase();
                if (nombreTexto) {
                  testimonio = testimoniosCache.find(t => 
                    t.nombre?.toLowerCase().includes(nombreTexto) ||
                    nombreTexto.includes(t.nombre?.toLowerCase())
                  );
                }
              }
            }
            
            // Intentar buscar por nombre en el identifier
            if (!testimonio && parsed.domId) {
              const searchName = parsed.domId.replace(/-/g, ' ').toLowerCase();
              testimonio = testimoniosCache.find(t => 
                t.nombre?.toLowerCase().includes(searchName) ||
                searchName.includes(t.nombre?.toLowerCase())
              );
            }
            
            // Último intento: usar el índice basado en la posición en el DOM
            if (!testimonio && testimoniosCache.length > 0) {
              const allTestimonioContainers = document.querySelectorAll('[data-mineiro-bind*="testimonio-"]');
              const containerIndex = Array.from(allTestimonioContainers).findIndex(c => c.contains(el));
              if (containerIndex >= 0 && containerIndex < testimoniosCache.length) {
                testimonio = testimoniosCache[containerIndex];
              }
            }
          }
          
          // Si no hay testimonios en cache, guardar en site_config como fallback
          if (!testimonio && testimoniosCache.length === 0) {
            log(`Sin testimonios en BD, guardando en site_config.testimonios.${parsed.domId}`);
            
            if (!tiendaData || !tiendaData.id) {
              throw new Error("Tienda no configurada. Verifica el slug en data-mineiro-site");
            }
            
            const siteConfig = JSON.parse(JSON.stringify(tiendaData?.site_config || {}));
            if (!siteConfig.testimonios) siteConfig.testimonios = {};
            if (!siteConfig.testimonios[parsed.domId]) siteConfig.testimonios[parsed.domId] = {};
            
            siteConfig.testimonios[parsed.domId][parsed.field] = value;
            
            apiPayload = {
              action: "update",
              table: "tiendas",
              data: { site_config: siteConfig },
              where: { id: tiendaData.id }
            };
            
            tiendaData.site_config = siteConfig;
            break;
          }
          
          if (!testimonio) {
            warn("Testimonios disponibles:", testimoniosCache.map(t => ({ id: t.id, nombre: t.nombre, dom_id: t.dom_id })));
            throw new Error(`Testimonio no encontrado: ${parsed.domId}. Verifica que exista en la base de datos.`);
          }

          log(`Testimonio encontrado: ${testimonio.nombre} (id: ${testimonio.id})`);

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
        log("Enviando a API:", JSON.stringify(apiPayload, null, 2));
        
        const response = await fetch(EDIT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload)
        });

        const result = await response.json();
        log("Respuesta API:", result);
        
        if (!response.ok || result.error) {
          throw new Error(result.error || `Error HTTP ${response.status}`);
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
    refresh: async () => {
      log("Refrescando datos manualmente...");
      const siteId = getSiteId();
      const newData = await fetchAllData(siteId);
      if (newData.tienda) {
        tiendaData = newData.tienda;
        productosCache = newData.productos;
        testimoniosCache = newData.testimonios;
        forceRehydrateAll();
        log("✓ Datos actualizados");
      }
    },
    forceSync: async () => {
      log("Forzando sincronización...");
      const siteId = getSiteId();
      const newData = await fetchAllData(siteId);
      if (newData.tienda) {
        tiendaData = newData.tienda;
        productosCache = newData.productos;
        testimoniosCache = newData.testimonios;
        lastDataHash = generateDataHash({
          tienda: tiendaData.site_config,
          productos: productosCache,
          testimonios: testimoniosCache
        });
        forceRehydrateAll();
        log("✓ Sincronización completa");
      }
    },
    getData: () => ({
      tienda: tiendaData,
      productos: productosCache,
      testimonios: testimoniosCache
    }),
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

      // Fetch tienda + productos + testimonios via API (bypass RLS)
      const allData = await fetchAllData(siteId);
      tiendaData = allData.tienda;
      productosCache = allData.productos;
      testimoniosCache = allData.testimonios;
      
      if (tiendaData) {
        log("Tienda cargada:", tiendaData.nombre_negocio, "(id:", tiendaData.id + ")");
        log("Slug en BD:", tiendaData.slug);
        log("URL web:", tiendaData.url_web);

        log(`Cargados: ${productosCache.length} productos, ${testimoniosCache.length} testimonios`);
        if (productosCache.length > 0) {
          log("Productos:", productosCache.map(p => `${p.nombre} (id:${p.id}, dom_id:${p.dom_id || 'none'})`).join(", "));
        }
        if (testimoniosCache.length > 0) {
          log("Testimonios:", testimoniosCache.map(t => `${t.nombre} (id:${t.id}, dom_id:${t.dom_id || 'none'})`).join(", "));
        }

        // Hydrate elements (intento inicial)
        runHydration(tiendaData, productosCache, testimoniosCache);

        // Configurar MutationObserver para detectar elementos de React
        setupMutationObserver();

        // Reintentar hidratación después de que React termine (por si acaso)
        setTimeout(() => runHydration(tiendaData, productosCache, testimoniosCache), 500);
        setTimeout(() => runHydration(tiendaData, productosCache, testimoniosCache), 1500);
        setTimeout(() => runHydration(tiendaData, productosCache, testimoniosCache), 3000);

        // Guardar hash inicial para polling
        lastDataHash = generateDataHash({
          tienda: tiendaData.site_config,
          productos: productosCache,
          testimonios: testimoniosCache
        });

        // Subscribe to realtime changes + iniciar polling como respaldo
        try {
          subscribeToChanges(tiendaData.id);
        } catch (e) {
          warn("Realtime no disponible, usando polling");
          startPolling();
        }
        
        // Siempre iniciar polling para garantizar sincronización
        // (se detendrá si el realtime funciona correctamente)
        setTimeout(() => {
          if (!realtimeConnected) {
            startPolling();
          }
        }, 6000);
        
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
