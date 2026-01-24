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

    // Menu item: "menu-{id}.nombre" o "item-{id}.campo"
    const menuMatch = binding.match(/^(menu|item)-([a-zA-Z0-9\-_]+)\.(.+)$/);
    if (menuMatch) {
      return { type: "producto", identifier: menuMatch[2], field: menuMatch[3] };
    }

    // Cualquier otro formato con punto: "seccion.campo"
    if (binding.includes(".")) {
      const parts = binding.split(".");
      const section = parts[0];
      const field = parts.slice(1).join(".");
      
      // Mapear secciones comunes a tipos conocidos
      const sectionMap = {
        "navbar": "config",
        "nav": "config",
        "header": "hero",
        "banner": "hero",
        "about": "config",
        "contact": "footer",
        "social": "footer",
        "menu": "config",
        "services": "config",
        "features": "config",
      };
      
      return { 
        type: sectionMap[section] || "config", 
        field: binding 
      };
    }

    // Binding simple sin punto - tratar como config genérico
    return { type: "config", field: binding };
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HYDRATION - Apply values to elements
     ───────────────────────────────────────────────────────────────────────── */

  const applyValueToElement = (el, value, field) => {
    if (value === undefined || value === null) return false;

    const tagName = el.tagName.toLowerCase();
    const imageFields = ["imagen_url", "imagen", "imagen_fondo", "logo_url", "avatar", "logo", "foto", "image", "img", "background", "src", "picture"];
    const isImageField = imageFields.some(f => field === f || field.endsWith(`.${f}`) || field.includes(f));

    if (isImageField || (tagName === "img" && value.startsWith && (value.startsWith("http") || value.startsWith("data:")))) {
      if (tagName === "img") {
        el.src = value;
      } else {
        el.style.backgroundImage = `url('${value}')`;
      }
    } else if (field.endsWith("_url") || field === "url" || field === "link" || field === "href") {
      if (tagName === "a") {
        el.href = value;
      } else {
        el.textContent = value;
      }
    } else if (field === "precio" || field.endsWith(".precio") || field === "price") {
      el.textContent = typeof value === "number" ? formatCLP(value) : value;
    } else if (field === "rating" || field === "estrellas") {
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
     ADMIN MODE - Visual Inline Editing v2.0
     Con: Deshacer, Subida de imágenes, Ocultar barra, Preservar estilos
     ───────────────────────────────────────────────────────────────────────── */

  let adminMode = false;
  let selectedElement = null;
  let pendingChanges = new Map();
  let adminBarVisible = true;
  
  // Sistema de historial para deshacer cambios
  const changeHistory = [];
  const MAX_HISTORY = 50;
  
  // Almacenar estilos originales de elementos
  const originalStyles = new WeakMap();
  const originalValues = new WeakMap();
  const originalInlineStyles = new WeakMap();

  // Guardar estado original COMPLETO antes de editar
  const saveOriginalState = (el) => {
    if (!originalValues.has(el)) {
      const tagName = el.tagName.toLowerCase();
      const computedStyle = window.getComputedStyle(el);
      
      // Guardar contenido original
      originalValues.set(el, {
        textContent: el.textContent,
        innerHTML: el.innerHTML,
        src: el.src || null,
        backgroundImage: el.style.backgroundImage || null,
      });
      
      // Guardar estilos computados (los que vienen del CSS)
      originalStyles.set(el, {
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        fontStyle: computedStyle.fontStyle,
        color: computedStyle.color,
        textTransform: computedStyle.textTransform,
        letterSpacing: computedStyle.letterSpacing,
        lineHeight: computedStyle.lineHeight,
        textDecoration: computedStyle.textDecoration,
        textAlign: computedStyle.textAlign,
      });
      
      // Guardar estilos inline originales (el style="" del HTML)
      originalInlineStyles.set(el, el.getAttribute('style') || '');
    }
  };

  // Restaurar completamente al estado original del código HTML
  const restoreOriginalState = (el) => {
    const originalInline = originalInlineStyles.get(el);
    
    // Restaurar el atributo style original (o eliminarlo si no había)
    if (originalInline === '' || originalInline === null) {
      el.removeAttribute('style');
    } else {
      el.setAttribute('style', originalInline);
    }
    
    log("Estilos originales restaurados");
  };

  // Agregar cambio al historial
  const addToHistory = (el, binding, oldValue, newValue, field) => {
    changeHistory.push({
      element: el,
      binding,
      oldValue,
      newValue,
      field,
      timestamp: Date.now(),
      styles: originalStyles.get(el),
      inlineStyles: originalInlineStyles.get(el),
    });
    
    if (changeHistory.length > MAX_HISTORY) {
      changeHistory.shift();
    }
    
    updateUndoButton();
  };

  // Deshacer último cambio
  const undoLastChange = async () => {
    if (changeHistory.length === 0) {
      log("No hay cambios para deshacer");
      return;
    }

    const lastChange = changeHistory.pop();
    const { element, binding, oldValue, field, styles, inlineStyles } = lastChange;

    log(`Deshaciendo: ${binding} -> "${oldValue}"`);

    // Restaurar contenido (puede ser HTML o texto)
    if (oldValue && (oldValue.includes('<') || oldValue.includes('>'))) {
      // Es HTML, restaurar innerHTML
      element.innerHTML = oldValue;
    } else {
      // Es texto plano
      applyValueToElement(element, oldValue, field);
    }
    
    // Restaurar estilos inline originales
    if (inlineStyles !== undefined) {
      if (inlineStyles === '' || inlineStyles === null) {
        element.removeAttribute('style');
      } else {
        element.setAttribute('style', inlineStyles);
      }
    }

    // Enviar cambio a la API
    const parsed = parseBinding(binding);
    if (parsed) {
      try {
        await saveToAPI(parsed, oldValue, element, true);
        log("✓ Cambio deshecho y guardado");
      } catch (err) {
        warn("Error al deshacer en servidor:", err.message);
      }
    }

    updateUndoButton();
  };

  const updateUndoButton = () => {
    const undoBtn = document.getElementById("mineiro-undo-btn");
    if (undoBtn) {
      const count = changeHistory.length;
      undoBtn.style.display = count > 0 ? "flex" : "none";
      undoBtn.innerHTML = `↩️ Deshacer ${count > 1 ? `(${count})` : ''}`;
    }
  };

  // Subir imagen a Supabase Storage
  const uploadImageToStorage = async (file) => {
    if (!supabase) {
      throw new Error("Supabase no inicializado");
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `uploads/${tiendaData?.id || 'public'}/${fileName}`;

    log(`Subiendo imagen: ${file.name} -> ${filePath}`);

    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      // Intentar con bucket público alternativo
      const { data: data2, error: error2 } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error2) {
        throw new Error(`Error al subir imagen: ${error.message}`);
      }
      
      const { data: urlData } = supabase.storage.from('public').getPublicUrl(filePath);
      return urlData.publicUrl;
    }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  // Convertir archivo a base64 como fallback
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const enableAdminMode = () => {
    if (adminMode) return;
    adminMode = true;

    // Inject admin styles
    const style = document.createElement("style");
    style.id = "mineiro-admin-styles";
    style.textContent = `
      /* Elementos editables */
      [data-mineiro-bind] {
        cursor: pointer !important;
        transition: outline 0.2s ease, outline-offset 0.2s ease !important;
      }
      [data-mineiro-bind]:hover {
        outline: 2px dashed #f59e0b !important;
        outline-offset: 3px !important;
      }
      [data-mineiro-bind].mineiro-selected {
        outline: 3px solid #06b6d4 !important;
        outline-offset: 4px !important;
      }
      
      /* Indicador de editable - más sutil */
      [data-mineiro-bind]::before {
        content: '✏️';
        position: absolute;
        top: -12px;
        right: -12px;
        width: 24px;
        height: 24px;
        background: #f59e0b;
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      [data-mineiro-bind]:hover::before {
        opacity: 1;
      }
      
      /* Barra de administración */
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
        padding: 0 16px;
        z-index: 9999999;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: transform 0.3s ease;
      }
      .mineiro-admin-bar.hidden {
        transform: translateY(-100%);
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
        font-size: 16px;
      }
      .mineiro-admin-center {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mineiro-admin-hint {
        color: #94a3b8;
        font-size: 13px;
      }
      .mineiro-admin-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .mineiro-admin-btn {
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        border: none;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
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
      .mineiro-admin-btn-warning {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
      }
      .mineiro-admin-btn-danger {
        background: #dc2626;
        color: white;
      }
      .mineiro-admin-btn:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      .mineiro-admin-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      
      /* Botón flotante para mostrar barra */
      .mineiro-show-bar-btn {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999998;
        padding: 10px 16px;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        border: 2px solid #f59e0b;
        border-radius: 10px;
        color: #f59e0b;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: none;
        align-items: center;
        gap: 8px;
        font-family: system-ui, sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: all 0.2s;
      }
      .mineiro-show-bar-btn:hover {
        background: #1e293b;
        transform: scale(1.05);
      }
      .mineiro-show-bar-btn.visible {
        display: flex;
      }
      
      /* Popup de edición mejorado */
      .mineiro-edit-popup {
        position: fixed;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 2px solid #475569;
        border-radius: 16px;
        padding: 20px;
        min-width: 340px;
        max-width: 420px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.6);
        z-index: 99999999;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        max-height: 90vh;
        overflow-y: auto;
      }
      .mineiro-edit-popup h3 {
        margin: 0 0 4px 0;
        color: #f1f5f9;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .mineiro-edit-popup .close-btn {
        background: none;
        border: none;
        color: #64748b;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .mineiro-edit-popup .close-btn:hover {
        color: #ef4444;
      }
      .mineiro-edit-popup .edit-type {
        color: #94a3b8;
        font-size: 11px;
        margin-bottom: 16px;
        padding: 4px 10px;
        background: #334155;
        border-radius: 6px;
        display: inline-block;
      }
      .mineiro-edit-popup input,
      .mineiro-edit-popup textarea,
      .mineiro-edit-popup select {
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 2px solid #475569;
        background: #0f172a;
        color: #f1f5f9;
        font-size: 14px;
        margin-top: 8px;
        transition: border-color 0.2s;
        font-family: inherit;
      }
      .mineiro-edit-popup input:focus,
      .mineiro-edit-popup textarea:focus,
      .mineiro-edit-popup select:focus {
        outline: none;
        border-color: #06b6d4;
      }
      .mineiro-edit-popup textarea {
        min-height: 100px;
        resize: vertical;
      }
      .mineiro-edit-popup label {
        font-size: 12px;
        color: #94a3b8;
        font-weight: 500;
        display: block;
        margin-top: 12px;
      }
      .mineiro-edit-popup label:first-of-type {
        margin-top: 0;
      }
      .mineiro-edit-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }
      
      /* Preview de imagen mejorado */
      .mineiro-image-preview {
        width: 100%;
        height: 140px;
        border-radius: 10px;
        background: #0f172a;
        border: 2px dashed #475569;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-bottom: 12px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        position: relative;
      }
      .mineiro-image-preview:hover {
        border-color: #06b6d4;
        background: #1e293b;
      }
      .mineiro-image-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .mineiro-image-preview .upload-hint {
        color: #64748b;
        font-size: 13px;
        text-align: center;
        padding: 10px;
      }
      .mineiro-image-preview .upload-hint strong {
        color: #06b6d4;
        display: block;
        margin-bottom: 4px;
      }
      .mineiro-image-preview.dragover {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }
      .mineiro-file-input {
        display: none;
      }
      
      /* Selector de estilos */
      .mineiro-style-options {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .mineiro-style-btn {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid #475569;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .mineiro-style-btn:hover {
        border-color: #06b6d4;
        background: #334155;
      }
      .mineiro-style-btn.active {
        border-color: #06b6d4;
        background: #06b6d4;
        color: #0f172a;
      }
      
      /* Tabs de opciones */
      .mineiro-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
        border-bottom: 1px solid #334155;
        padding-bottom: 8px;
      }
      .mineiro-tab {
        padding: 6px 12px;
        border-radius: 6px 6px 0 0;
        border: none;
        background: transparent;
        color: #94a3b8;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .mineiro-tab:hover {
        color: #e2e8f0;
        background: #334155;
      }
      .mineiro-tab.active {
        color: #06b6d4;
        background: #334155;
      }
      .mineiro-tab-content {
        display: none;
      }
      .mineiro-tab-content.active {
        display: block;
      }
      
      /* Ajuste del body cuando la barra está visible */
      body.mineiro-admin-active {
        padding-top: 56px !important;
      }
      body.mineiro-admin-active.bar-hidden {
        padding-top: 0 !important;
      }
      
      /* Badge de cambios */
      .mineiro-changes-badge {
        background: #ef4444;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 6px;
      }
      
      /* Editor de texto enriquecido */
      .mineiro-rich-editor {
        width: 100%;
        min-height: 80px;
        padding: 12px 14px;
        border-radius: 10px;
        border: 2px solid #475569;
        background: #0f172a;
        color: #f1f5f9;
        font-size: 14px;
        margin-top: 8px;
        transition: border-color 0.2s;
        overflow-y: auto;
        max-height: 200px;
        line-height: 1.5;
        outline: none;
      }
      .mineiro-rich-editor:focus {
        border-color: #06b6d4;
      }
      .mineiro-rich-editor.mineiro-single-line {
        min-height: 44px;
        max-height: 44px;
        overflow: hidden;
        white-space: nowrap;
      }
      .mineiro-rich-editor b, .mineiro-rich-editor strong {
        font-weight: 700;
      }
      .mineiro-rich-editor i, .mineiro-rich-editor em {
        font-style: italic;
      }
      .mineiro-rich-editor u {
        text-decoration: underline;
      }
      .mineiro-rich-editor s, .mineiro-rich-editor strike {
        text-decoration: line-through;
      }
      
      /* Barra de formato */
      .mineiro-format-toolbar {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: 8px;
        padding: 8px;
        background: #0f172a;
        border-radius: 8px;
        border: 1px solid #334155;
        align-items: center;
      }
      .mineiro-format-btn {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid #475569;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mineiro-format-btn:hover {
        border-color: #06b6d4;
        background: #334155;
      }
      .mineiro-format-btn.active {
        border-color: #06b6d4;
        background: #06b6d4;
        color: #0f172a;
      }
      .mineiro-format-separator {
        width: 1px;
        height: 24px;
        background: #475569;
        margin: 0 4px;
      }
      .mineiro-format-select {
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid #475569;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 12px;
        cursor: pointer;
      }
      .mineiro-format-select:focus {
        border-color: #06b6d4;
        outline: none;
      }
      .mineiro-color-picker {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid #475569;
        background: #1e293b;
        cursor: pointer;
        padding: 2px;
      }
      .mineiro-color-picker::-webkit-color-swatch-wrapper {
        padding: 2px;
      }
      .mineiro-color-picker::-webkit-color-swatch {
        border-radius: 4px;
        border: none;
      }
      
      /* Loading spinner */
      .mineiro-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: mineiro-spin 0.8s linear infinite;
      }
      @keyframes mineiro-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Create admin bar
    const adminBar = document.createElement("div");
    adminBar.className = "mineiro-admin-bar";
    adminBar.id = "mineiro-admin-bar";
    adminBar.innerHTML = `
      <div class="mineiro-admin-logo">
        <span>⚡</span>
        <span>Mineiro Editor</span>
      </div>
      <div class="mineiro-admin-center">
        <div class="mineiro-admin-hint">Haz clic en cualquier elemento para editarlo</div>
        <button class="mineiro-admin-btn mineiro-admin-btn-warning" id="mineiro-undo-btn" style="display:none">
          ↩️ Deshacer
        </button>
      </div>
      <div class="mineiro-admin-actions">
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" id="mineiro-hide-bar-btn" title="Ocultar barra">
          👁️ Ocultar
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" onclick="window.MineiroAdmin.openDashboard()">
          📊 Panel
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-primary" onclick="window.MineiroAdmin.disable()">
          ✓ Salir
        </button>
      </div>
    `;
    document.body.prepend(adminBar);
    document.body.classList.add("mineiro-admin-active");

    // Botón flotante para mostrar la barra
    const showBarBtn = document.createElement("button");
    showBarBtn.className = "mineiro-show-bar-btn";
    showBarBtn.id = "mineiro-show-bar-btn";
    showBarBtn.innerHTML = "⚡ Mostrar Editor";
    showBarBtn.onclick = () => toggleAdminBar(true);
    document.body.appendChild(showBarBtn);

    // Event listeners para la barra
    document.getElementById("mineiro-hide-bar-btn").onclick = () => toggleAdminBar(false);
    document.getElementById("mineiro-undo-btn").onclick = undoLastChange;

    // Add click listener for editing
    document.addEventListener("click", handleAdminClick, true);

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcuts);

    log("Modo admin activado - Haz clic en cualquier elemento con data-mineiro-bind para editarlo");
    log("Atajos: Ctrl+Z para deshacer, Escape para cerrar popup");
  };

  const toggleAdminBar = (show) => {
    const adminBar = document.getElementById("mineiro-admin-bar");
    const showBtn = document.getElementById("mineiro-show-bar-btn");
    
    adminBarVisible = show;
    
    if (show) {
      adminBar.classList.remove("hidden");
      showBtn.classList.remove("visible");
      document.body.classList.remove("bar-hidden");
    } else {
      adminBar.classList.add("hidden");
      showBtn.classList.add("visible");
      document.body.classList.add("bar-hidden");
    }
  };

  const handleKeyboardShortcuts = (e) => {
    // Ctrl+Z para deshacer
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      if (changeHistory.length > 0 && adminMode) {
        e.preventDefault();
        undoLastChange();
      }
    }
    
    // Escape para cerrar popup
    if (e.key === "Escape") {
      const popup = document.querySelector(".mineiro-edit-popup");
      if (popup) {
        popup.remove();
        if (selectedElement) {
          selectedElement.classList.remove("mineiro-selected");
          selectedElement = null;
        }
      }
    }
  };

  const disableAdminMode = () => {
    if (!adminMode) return;
    adminMode = false;

    document.getElementById("mineiro-admin-styles")?.remove();
    document.getElementById("mineiro-admin-bar")?.remove();
    document.getElementById("mineiro-show-bar-btn")?.remove();
    document.querySelector(".mineiro-edit-popup")?.remove();
    document.body.classList.remove("mineiro-admin-active", "bar-hidden");
    document.removeEventListener("click", handleAdminClick, true);
    document.removeEventListener("keydown", handleKeyboardShortcuts);

    if (selectedElement) {
      selectedElement.classList.remove("mineiro-selected");
      selectedElement = null;
    }

    log("Modo admin desactivado");
  };

  const handleAdminClick = (e) => {
    // Ignorar clics en popup
    if (e.target.closest(".mineiro-edit-popup")) {
      return;
    }

    // Ignorar clics en barra de admin
    if (e.target.closest(".mineiro-admin-bar") || e.target.closest(".mineiro-show-bar-btn")) {
      return;
    }

    const el = e.target.closest("[data-mineiro-bind]");
    if (!el) {
      // Clic fuera de elementos editables - cerrar popup
      document.querySelector(".mineiro-edit-popup")?.remove();
      if (selectedElement) {
        selectedElement.classList.remove("mineiro-selected");
        selectedElement = null;
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Deseleccionar anterior
    if (selectedElement) {
      selectedElement.classList.remove("mineiro-selected");
    }

    selectedElement = el;
    el.classList.add("mineiro-selected");

    // Guardar estado original
    saveOriginalState(el);

    showEditPopup(el);
  };

  const showEditPopup = (el) => {
    document.querySelector(".mineiro-edit-popup")?.remove();

    const binding = el.dataset.mineiroBind;
    const parsed = parseBinding(binding);
    
    if (!parsed) {
      // Intentar editar como elemento genérico
      log(`Binding no reconocido: ${binding}, editando como texto genérico`);
    }

    // Determinar tipo de contenido
    const tagName = el.tagName.toLowerCase();
    let currentValue = "";
    let isImage = false;
    let isLongText = false;
    let isPrice = false;
    let isLink = false;

    const imageFields = ["imagen_url", "imagen", "imagen_fondo", "logo_url", "avatar", "logo", "foto", "image", "img", "background", "src"];
    const priceFields = ["precio", "price", "costo", "cost", "valor"];
    const linkFields = ["url", "link", "href", "enlace"];
    
    const field = parsed?.field || binding;
    
    isImage = imageFields.some(f => field === f || field.endsWith(`.${f}`) || field.includes(f)) || tagName === "img";
    isPrice = priceFields.some(f => field === f || field.endsWith(`.${f}`));
    isLink = linkFields.some(f => field === f || field.endsWith(`.${f}`)) || tagName === "a";

    if (isImage) {
      if (tagName === "img") {
        currentValue = el.src || "";
      } else {
        const bg = el.style.backgroundImage || window.getComputedStyle(el).backgroundImage;
        currentValue = bg.replace(/url\(['"]?(.+?)['"]?\)/i, "$1") || "";
        if (currentValue === "none") currentValue = "";
      }
    } else if (isLink && tagName === "a") {
      currentValue = el.href || "";
    } else {
      currentValue = el.textContent?.trim() || "";
      if (isPrice) {
        currentValue = parsePrice(currentValue) || "";
      }
    }

    isLongText = !isImage && !isPrice && !isLink && currentValue.length > 60;

    // Obtener estilos actuales del elemento
    const computedStyle = window.getComputedStyle(el);
    const currentStyles = {
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
    };

    // Posicionar popup cerca del elemento con scroll
    const rect = el.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    
    const popup = document.createElement("div");
    popup.className = "mineiro-edit-popup";
    
    // Calcular posición óptima
    const popupWidth = 380;
    const popupHeight = isImage ? 400 : (isLongText ? 350 : 300);
    
    let left = rect.left + scrollX + (rect.width / 2) - (popupWidth / 2);
    let top = rect.bottom + scrollY + 15;
    
    // Ajustar si se sale de la pantalla
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left + popupWidth > viewportWidth - 20) {
      left = viewportWidth - popupWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }
    
    // Si no cabe abajo, ponerlo arriba
    if (rect.bottom + popupHeight > viewportHeight - 20) {
      top = rect.top + scrollY - popupHeight - 15;
    }
    
    // Si tampoco cabe arriba, centrar en viewport
    if (top < scrollY + (adminBarVisible ? 70 : 20)) {
      top = scrollY + (viewportHeight - popupHeight) / 2;
      left = scrollX + (viewportWidth - popupWidth) / 2;
    }
    
    popup.style.position = "absolute";
    popup.style.top = `${Math.max(scrollY + 20, top)}px`;
    popup.style.left = `${left}px`;
    popup.style.width = `${popupWidth}px`;

    // Labels para UI
    const typeLabels = {
      config: "Configuración",
      hero: "Hero / Banner",
      footer: "Footer",
      "testimonios-config": "Config. Testimonios",
      testimonio: "Testimonio",
      producto: "Producto",
      menu: "Menú",
      item: "Item"
    };
    const typeLabel = typeLabels[parsed?.type] || "Elemento";
    const fieldLabel = field.replace(/_/g, " ").replace(/\./g, " › ").replace(/-/g, " ");

    // Escape valores para HTML
    const escapedValue = (currentValue || "").toString().replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Generar HTML del popup
    let contentHTML = "";
    
    if (isImage) {
      contentHTML = `
        <div class="mineiro-image-preview" id="mineiro-image-drop">
          ${currentValue ? `<img src="${escapedValue}" alt="Preview" />` : `
            <div class="upload-hint">
              <strong>📷 Arrastra una imagen aquí</strong>
              o haz clic para seleccionar
            </div>
          `}
        </div>
        <input type="file" accept="image/*" class="mineiro-file-input" id="mineiro-file-input" />
        <label>O ingresa URL de imagen</label>
        <input type="url" id="mineiro-edit-input" value="${escapedValue}" placeholder="https://..." />
      `;
    } else if (isLongText) {
      contentHTML = `
        <label>Texto (editor enriquecido)</label>
        <div class="mineiro-rich-editor" id="mineiro-rich-editor" contenteditable="true">${el.innerHTML || currentValue || ""}</div>
        <input type="hidden" id="mineiro-edit-input" value="${escapedValue}" />
        
        <label>Barra de formato</label>
        <div class="mineiro-format-toolbar">
          <button type="button" class="mineiro-format-btn" data-command="bold" title="Negrita (Ctrl+B)"><b>B</b></button>
          <button type="button" class="mineiro-format-btn" data-command="italic" title="Cursiva (Ctrl+I)"><i>I</i></button>
          <button type="button" class="mineiro-format-btn" data-command="underline" title="Subrayado (Ctrl+U)"><u>U</u></button>
          <button type="button" class="mineiro-format-btn" data-command="strikeThrough" title="Tachado"><s>S</s></button>
          <span class="mineiro-format-separator"></span>
          <button type="button" class="mineiro-format-btn" data-command="justifyLeft" title="Alinear izquierda">⬅</button>
          <button type="button" class="mineiro-format-btn" data-command="justifyCenter" title="Centrar">⬌</button>
          <button type="button" class="mineiro-format-btn" data-command="justifyRight" title="Alinear derecha">➡</button>
          <span class="mineiro-format-separator"></span>
          <select class="mineiro-format-select" id="mineiro-font-size" title="Tamaño de fuente">
            <option value="">Tamaño</option>
            <option value="1">Pequeño</option>
            <option value="3">Normal</option>
            <option value="5">Grande</option>
            <option value="7">Muy grande</option>
          </select>
        </div>
        
        <label>Estilo general</label>
        <div class="mineiro-style-options">
          <button type="button" class="mineiro-style-btn active" data-style="original">🔄 Original</button>
          <button type="button" class="mineiro-style-btn" data-style="normal">Normal</button>
        </div>
      `;
    } else if (isPrice) {
      contentHTML = `
        <label>Precio (solo número)</label>
        <input type="number" id="mineiro-edit-input" value="${escapedValue}" placeholder="1000" step="100" />
      `;
    } else if (isLink) {
      contentHTML = `
        <label>URL / Enlace</label>
        <input type="url" id="mineiro-edit-input" value="${escapedValue}" placeholder="https://..." />
        <label>Texto visible</label>
        <input type="text" id="mineiro-edit-text" value="${el.textContent?.trim() || ''}" placeholder="Texto del enlace" />
      `;
    } else {
      contentHTML = `
        <label>Contenido</label>
        <div class="mineiro-rich-editor mineiro-single-line" id="mineiro-rich-editor" contenteditable="true">${el.innerHTML || currentValue || ""}</div>
        <input type="hidden" id="mineiro-edit-input" value="${escapedValue}" />
        
        <label>Formato de texto</label>
        <div class="mineiro-format-toolbar">
          <button type="button" class="mineiro-format-btn" data-command="bold" title="Negrita"><b>B</b></button>
          <button type="button" class="mineiro-format-btn" data-command="italic" title="Cursiva"><i>I</i></button>
          <button type="button" class="mineiro-format-btn" data-command="underline" title="Subrayado"><u>U</u></button>
          <button type="button" class="mineiro-format-btn" data-command="strikeThrough" title="Tachado"><s>S</s></button>
          <span class="mineiro-format-separator"></span>
          <input type="color" class="mineiro-color-picker" id="mineiro-text-color" value="#ffffff" title="Color de texto">
        </div>
        
        <label>Estilo general del elemento</label>
        <div class="mineiro-style-options">
          <button type="button" class="mineiro-style-btn active" data-style="original">🔄 Original</button>
          <button type="button" class="mineiro-style-btn" data-style="bold">Negrita</button>
          <button type="button" class="mineiro-style-btn" data-style="italic">Cursiva</button>
          <button type="button" class="mineiro-style-btn" data-style="uppercase">ABC</button>
        </div>
      `;
    }

    popup.innerHTML = `
      <h3>
        Editar contenido
        <button type="button" class="close-btn" id="mineiro-close-popup">&times;</button>
      </h3>
      <div class="edit-type">${typeLabel} › ${fieldLabel}</div>
      
      ${contentHTML}
      
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

    // Scroll al popup si no es visible
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.top < 0 || popupRect.bottom > viewportHeight) {
      popup.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Event listeners
    const input = document.getElementById("mineiro-edit-input");
    const cancelBtn = document.getElementById("mineiro-cancel-btn");
    const saveBtn = document.getElementById("mineiro-save-btn");
    const closeBtn = document.getElementById("mineiro-close-popup");
    const fileInput = document.getElementById("mineiro-file-input");
    const imageDrop = document.getElementById("mineiro-image-drop");

    // Cerrar popup
    const closePopup = () => {
      popup.remove();
      if (selectedElement) {
        selectedElement.classList.remove("mineiro-selected");
        selectedElement = null;
      }
    };

    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopup();
    });

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopup();
    });

    // Manejo de imágenes
    if (isImage) {
      // Click para seleccionar archivo
      imageDrop?.addEventListener("click", () => fileInput?.click());
      
      // Drag and drop
      imageDrop?.addEventListener("dragover", (e) => {
        e.preventDefault();
        imageDrop.classList.add("dragover");
      });
      
      imageDrop?.addEventListener("dragleave", () => {
        imageDrop.classList.remove("dragover");
      });
      
      imageDrop?.addEventListener("drop", async (e) => {
        e.preventDefault();
        imageDrop.classList.remove("dragover");
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
          await handleImageFile(file, imageDrop, input);
        }
      });
      
      // File input change
      fileInput?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          await handleImageFile(file, imageDrop, input);
        }
      });
      
      // URL input change
      input?.addEventListener("input", () => {
        if (input.value && imageDrop) {
          imageDrop.innerHTML = `<img src="${escapeHtml(input.value)}" alt="Preview" onerror="this.parentElement.innerHTML='<div class=\\'upload-hint\\'>❌ Error al cargar imagen</div>'" />`;
        }
      });
    }

    // Manejo de estilos de texto
    const styleButtons = popup.querySelectorAll(".mineiro-style-btn");
    let selectedStyle = "original";
    
    styleButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        styleButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedStyle = btn.dataset.style;
        
        // Preview del estilo en el elemento
        previewStyleOnElement(el, selectedStyle, originalStyles.get(el));
      });
    });

    // Editor de texto enriquecido
    const richEditor = document.getElementById("mineiro-rich-editor");
    const formatButtons = popup.querySelectorAll(".mineiro-format-btn");
    const fontSizeSelect = document.getElementById("mineiro-font-size");
    const textColorPicker = document.getElementById("mineiro-text-color");
    
    if (richEditor) {
      // Sincronizar contenido con input oculto
      richEditor.addEventListener("input", () => {
        if (input) {
          input.value = richEditor.textContent;
        }
      });
      
      // Prevenir propagación
      richEditor.addEventListener("click", (e) => e.stopPropagation());
      richEditor.addEventListener("mousedown", (e) => e.stopPropagation());
      
      // Botones de formato
      formatButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const command = btn.dataset.command;
          
          // Asegurar que el foco esté en el editor
          richEditor.focus();
          
          // Ejecutar comando de formato
          document.execCommand(command, false, null);
          
          // Marcar botón como activo si aplica
          if (['bold', 'italic', 'underline', 'strikeThrough'].includes(command)) {
            const isActive = document.queryCommandState(command);
            btn.classList.toggle('active', isActive);
          }
        });
      });
      
      // Selector de tamaño de fuente
      if (fontSizeSelect) {
        fontSizeSelect.addEventListener("change", (e) => {
          e.stopPropagation();
          richEditor.focus();
          document.execCommand('fontSize', false, e.target.value);
        });
      }
      
      // Selector de color
      if (textColorPicker) {
        textColorPicker.addEventListener("input", (e) => {
          e.stopPropagation();
          richEditor.focus();
          document.execCommand('foreColor', false, e.target.value);
        });
      }
      
      // Atajos de teclado en el editor
      richEditor.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key.toLowerCase()) {
            case 'b':
              e.preventDefault();
              document.execCommand('bold', false, null);
              break;
            case 'i':
              e.preventDefault();
              document.execCommand('italic', false, null);
              break;
            case 'u':
              e.preventDefault();
              document.execCommand('underline', false, null);
              break;
          }
        }
      });
    }

    // Prevenir propagación de clicks
    input?.addEventListener("click", (e) => e.stopPropagation());
    input?.addEventListener("mousedown", (e) => e.stopPropagation());

    // Guardar
    saveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      // Si hay editor enriquecido, usar su HTML
      const valueToSave = richEditor ? richEditor.innerHTML : input?.value;
      await saveElementChange(el, parsed || { type: 'generic', field: binding }, isImage, isPrice, selectedStyle, binding, richEditor ? richEditor.innerHTML : null);
    });

    // Enter para guardar (excepto textarea y editor enriquecido)
    if (!isLongText && !richEditor) {
      input?.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          await saveElementChange(el, parsed || { type: 'generic', field: binding }, isImage, isPrice, selectedStyle, binding, null);
        }
      });
    }

    // Focus en el elemento correcto
    if (richEditor) {
      richEditor.focus();
      // Mover cursor al final
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(richEditor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      input?.focus();
      input?.select();
    }
  };

  // Manejar archivo de imagen
  const handleImageFile = async (file, previewContainer, urlInput) => {
    previewContainer.innerHTML = `<div class="upload-hint"><div class="mineiro-spinner"></div><br>Subiendo imagen...</div>`;
    
    try {
      // Intentar subir a Supabase Storage
      const imageUrl = await uploadImageToStorage(file);
      
      previewContainer.innerHTML = `<img src="${imageUrl}" alt="Preview" />`;
      urlInput.value = imageUrl;
      log("✓ Imagen subida:", imageUrl);
      
    } catch (err) {
      warn("Error al subir a Storage, usando base64:", err.message);
      
      // Fallback: convertir a base64
      try {
        const base64 = await fileToBase64(file);
        previewContainer.innerHTML = `<img src="${base64}" alt="Preview" />`;
        urlInput.value = base64;
        log("✓ Imagen convertida a base64");
      } catch (err2) {
        previewContainer.innerHTML = `<div class="upload-hint">❌ Error: ${err2.message}</div>`;
      }
    }
  };

  // Preview de estilo en elemento
  const previewStyleOnElement = (el, style, originalStyle) => {
    switch (style) {
      case "original":
        // Restaurar completamente al estado original del HTML
        restoreOriginalState(el);
        break;
      case "normal":
        el.style.fontWeight = '400';
        el.style.textTransform = 'none';
        el.style.fontStyle = 'normal';
        break;
      case "bold":
        el.style.fontWeight = '700';
        break;
      case "light":
        el.style.fontWeight = '300';
        break;
      case "italic":
        el.style.fontStyle = 'italic';
        break;
      case "uppercase":
        el.style.textTransform = 'uppercase';
        break;
      case "lowercase":
        el.style.textTransform = 'lowercase';
        break;
      case "capitalize":
        el.style.textTransform = 'capitalize';
        break;
      case "underline":
        el.style.textDecoration = 'underline';
        break;
      case "line-through":
        el.style.textDecoration = 'line-through';
        break;
    }
  };

  // Función auxiliar para guardar a la API
  const saveToAPI = async (parsed, value, el, isUndo = false) => {
    let apiPayload = null;
    
    switch (parsed.type) {
      case "config":
      case "hero":
      case "footer":
      case "testimonios-config": {
        if (!tiendaData || !tiendaData.id) {
          throw new Error("Tienda no configurada");
        }
        
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
        
        tiendaData.site_config = siteConfig;
        break;
      }

      case "producto": {
        let producto = productosCache.find(p => p.dom_id === parsed.identifier)
                    || productosCache.find(p => String(p.id) === parsed.identifier);
        
        if (!producto && el) {
          const container = el.closest('[data-mineiro-bind*="producto-"]') 
                         || el.closest('.product-card, .producto, [class*="product"], [class*="producto"], [class*="menu-item"], [class*="item"]')
                         || el.parentElement?.parentElement;
          
          if (container) {
            const nombreEl = container.querySelector('[data-mineiro-bind*=".nombre"]')
                          || container.querySelector('h1, h2, h3, h4, h5, .product-name, .nombre-producto, .item-name');
            
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
          
          if (!producto && parsed.identifier) {
            const searchName = parsed.identifier.replace(/-/g, ' ').toLowerCase();
            producto = productosCache.find(p => 
              p.nombre?.toLowerCase().includes(searchName) ||
              searchName.includes(p.nombre?.toLowerCase())
            );
          }
        }
        
        if (!producto && productosCache.length === 0) {
          if (!tiendaData || !tiendaData.id) {
            throw new Error("Tienda no configurada");
          }
          
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
          
          tiendaData.site_config = siteConfig;
          break;
        }
        
        if (!producto) {
          throw new Error(`Producto no encontrado: ${parsed.identifier}`);
        }

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

        Object.assign(producto, updateData);
        break;
      }

      case "testimonio": {
        let testimonio = testimoniosCache.find(t => t.dom_id === parsed.domId);
        
        if (!testimonio && el) {
          const container = el.closest('[data-mineiro-bind*="testimonio-"]')
                         || el.closest('.testimonial, .testimonio, .review, [class*="testimonial"], [class*="review"]')
                         || el.parentElement?.parentElement;
          
          if (container) {
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
          
          if (!testimonio && parsed.domId) {
            const searchName = parsed.domId.replace(/-/g, ' ').toLowerCase();
            testimonio = testimoniosCache.find(t => 
              t.nombre?.toLowerCase().includes(searchName) ||
              searchName.includes(t.nombre?.toLowerCase())
            );
          }
          
          if (!testimonio && testimoniosCache.length > 0) {
            const allTestimonioContainers = document.querySelectorAll('[data-mineiro-bind*="testimonio-"]');
            const containerIndex = Array.from(allTestimonioContainers).findIndex(c => c.contains(el));
            if (containerIndex >= 0 && containerIndex < testimoniosCache.length) {
              testimonio = testimoniosCache[containerIndex];
            }
          }
        }
        
        if (!testimonio && testimoniosCache.length === 0) {
          if (!tiendaData || !tiendaData.id) {
            throw new Error("Tienda no configurada");
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
          throw new Error(`Testimonio no encontrado: ${parsed.domId}`);
        }

        apiPayload = {
          action: "update",
          table: "testimonios",
          data: { [parsed.field]: value },
          where: { id: testimonio.id }
        };

        Object.assign(testimonio, { [parsed.field]: value });
        break;
      }
      
      // Tipo genérico para cualquier binding no reconocido
      case "generic":
      default: {
        if (!tiendaData || !tiendaData.id) {
          throw new Error("Tienda no configurada");
        }
        
        const siteConfig = JSON.parse(JSON.stringify(tiendaData?.site_config || {}));
        if (!siteConfig.custom) siteConfig.custom = {};
        
        // Guardar usando el binding completo como clave
        const bindingKey = parsed.field || "unknown";
        siteConfig.custom[bindingKey] = value;
        
        apiPayload = {
          action: "update",
          table: "tiendas",
          data: { site_config: siteConfig },
          where: { id: tiendaData.id }
        };
        
        tiendaData.site_config = siteConfig;
        break;
      }
    }

    if (apiPayload) {
      const response = await fetch(EDIT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload)
      });

      const result = await response.json();
      
      if (!response.ok || result.error) {
        throw new Error(result.error || `Error HTTP ${response.status}`);
      }
      
      return true;
    }
    
    return false;
  };

  const saveElementChange = async (el, parsed, isImage, isPrice, selectedStyle = "original", binding = "", richHTML = null) => {
    const input = document.getElementById("mineiro-edit-input");
    const textInput = document.getElementById("mineiro-edit-text");
    const saveBtn = document.getElementById("mineiro-save-btn");
    const richEditor = document.getElementById("mineiro-rich-editor");
    
    if (!input && !richEditor) return;

    // Obtener valor: priorizar HTML enriquecido si existe
    let value = richHTML || (richEditor ? richEditor.innerHTML : input?.value);
    let plainTextValue = richEditor ? richEditor.textContent : input?.value;
    
    if (isPrice) {
      value = parseFloat(plainTextValue) || 0;
      plainTextValue = value;
    }

    // Guardar valor original para historial
    const originalValue = originalValues.get(el);
    const oldValue = isImage 
      ? (el.tagName.toLowerCase() === "img" ? el.src : el.style.backgroundImage)
      : el.innerHTML || el.textContent?.trim();
    const oldTextContent = el.textContent?.trim();

    saveBtn.innerHTML = `<div class="mineiro-spinner"></div> Guardando...`;
    saveBtn.disabled = true;

    try {
      // Guardar texto plano a la API (sin HTML)
      await saveToAPI(parsed, plainTextValue, el);

      // Aplicar valor al elemento
      if (richHTML || richEditor) {
        // Si hay contenido HTML enriquecido, aplicarlo directamente
        el.innerHTML = value;
      } else {
        // Aplicar valor normal
        applyValueToElement(el, value, parsed.field);
      }
      
      // Aplicar texto visible si es un enlace
      if (textInput && el.tagName.toLowerCase() === "a") {
        el.textContent = textInput.value;
      }
      
      // Aplicar estilo seleccionado (solo si no es "original")
      if (selectedStyle && selectedStyle !== "original") {
        previewStyleOnElement(el, selectedStyle, originalStyles.get(el));
        el.dataset.mineiroStyle = selectedStyle;
      }

      // Agregar al historial para poder deshacer
      addToHistory(el, binding || el.dataset.mineiroBind, oldValue, value, parsed.field);

      // Cerrar popup con feedback de éxito
      const popup = document.querySelector(".mineiro-edit-popup");
      if (popup) {
        popup.innerHTML = `
          <div style="text-align:center;padding:30px">
            <div style="font-size:48px;margin-bottom:10px">✅</div>
            <div style="color:#4ade80;font-size:16px;font-weight:600">¡Guardado!</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:5px">Ctrl+Z para deshacer</div>
          </div>
        `;
        setTimeout(() => popup.remove(), 1000);
      }

      if (selectedElement) {
        selectedElement.classList.remove("mineiro-selected");
        selectedElement = null;
      }

      log(`✓ Guardado: ${binding || parsed.type}.${parsed.field} = ${plainTextValue}`);

    } catch (error) {
      warn("Error al guardar:", error.message);
      
      saveBtn.innerHTML = "❌ Error";
      saveBtn.style.background = "#ef4444";
      
      // Mostrar error en popup
      const popup = document.querySelector(".mineiro-edit-popup");
      if (popup) {
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText = "color:#ef4444;font-size:12px;margin-top:8px;padding:8px;background:#1e1e1e;border-radius:6px;";
        errorDiv.textContent = `Error: ${error.message}`;
        popup.appendChild(errorDiv);
      }
      
      setTimeout(() => {
        saveBtn.innerHTML = "💾 Guardar";
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
    toggleBar: toggleAdminBar,
    undo: undoLastChange,
    getHistory: () => [...changeHistory],
    clearHistory: () => {
      changeHistory.length = 0;
      updateUndoButton();
      log("Historial limpiado");
    },
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
      testimonios: testimoniosCache,
      history: changeHistory.length,
    }),
    getSiteId,
    isAdminMode: () => adminMode,
    isBarVisible: () => adminBarVisible,
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
