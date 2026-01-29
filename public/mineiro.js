/* ═══════════════════════════════════════════════════════════════════════════
   MINEIRO UNIFIED ENGINE v6.1 - Editor Visual Universal
   "Una línea de código. Control total."
   
   Este script:
   1. Carga datos desde las tablas ORIGINALES (tiendas, productos, testimonios)
   2. Hidrata los elementos con data-mineiro-bind
   3. Permite edición visual inline (modo admin)
   4. Guarda cambios directamente en las tablas originales
   5. Sincroniza cambios en tiempo real via polling (fallback si WebSocket falla)
   
   Performance optimizations:
   - Lazy loading de Supabase SDK
   - Debounced hydration
   - Efficient DOM queries with caching
   - RequestIdleCallback for non-critical operations
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  "use strict";

  const VERSION = "6.1.0";
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
      
      // Si no se encontró, NO crear automáticamente (evita reactivar páginas borradas)
      const autoCreateScript = document.querySelector('script[data-mineiro-autocreate="true"]');
      const shouldAutoCreate = autoCreateScript?.dataset?.mineiroAutocreate === 'true';

      if (shouldAutoCreate) {
        log("Tienda no encontrada, creando automáticamente...");
        const createResponse = await fetch(TIENDA_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug,
            nombre: slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            url_web: window.location.origin,
            allowAutoCreate: true
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
      }

      warn("Tienda no registrada: no se creará automáticamente.");
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

    // 🍕 FORMATO ESPECIAL: menu.{categoria}.{producto}.{campo}
    // Ej: menu.pizzas.napolitana.precio.fam -> producto "napolitana", campo "precio.fam"
    const menuProductMatch = binding.match(/^menu\.([a-zA-Z0-9\-_]+)\.([a-zA-Z0-9\-_]+)\.(.+)$/);
    if (menuProductMatch) {
      const categoria = menuProductMatch[1]; // "pizzas"
      const productoId = menuProductMatch[2]; // "napolitana"
      const campo = menuProductMatch[3]; // "precio.fam" o "nombre" o "ingredientes"
      return { 
        type: "producto", 
        identifier: productoId, 
        field: campo,
        categoria: categoria
      };
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

  // Mapa global para guardar el HTML original ANTES de cualquier hidratación
  const htmlOriginalDelCodigo = new Map();
  
  // Set de elementos que el usuario restauró a original y no deben re-hidratarse
  const preservedOriginalElements = new Set();
  
  // Key para localStorage de elementos preservados
  const PRESERVED_STORAGE_KEY = 'mineiro_preserved_bindings';
  
  // Cargar elementos preservados desde localStorage
  const loadPreservedBindings = () => {
    try {
      const stored = localStorage.getItem(PRESERVED_STORAGE_KEY);
      if (stored) {
        const bindings = JSON.parse(stored);
        log(`Cargados ${bindings.length} bindings preservados desde localStorage`);
        return new Set(bindings);
      }
    } catch (err) {
      warn('Error cargando preserved bindings:', err.message);
    }
    return new Set();
  };
  
  // Guardar elementos preservados en localStorage
  const savePreservedBindings = () => {
    try {
      // Combinar elementos del Set con los bindings actuales
      const bindings = new Set([...preservedBindingsSet]);
      preservedOriginalElements.forEach(el => {
        if (el.dataset?.mineiroBind) {
          bindings.add(el.dataset.mineiroBind);
        }
      });
      localStorage.setItem(PRESERVED_STORAGE_KEY, JSON.stringify([...bindings]));
      log(`Guardados ${bindings.size} bindings preservados en localStorage`);
    } catch (err) {
      warn('Error guardando preserved bindings:', err.message);
    }
  };
  
  // Remover un binding de los preservados (cuando el usuario guarda un nuevo valor)
  const removeFromPreserved = (binding) => {
    preservedBindingsSet.delete(binding);
    // Buscar y desmarcar el elemento
    document.querySelectorAll(`[data-mineiro-bind="${binding}"]`).forEach(el => {
      preservedOriginalElements.delete(el);
      delete el.dataset.mineiroPreserved;
    });
    savePreservedBindings();
    log(`Binding removido de preservados: ${binding}`);
  };
  
  // Limpiar TODOS los elementos preservados
  const clearAllPreserved = () => {
    preservedBindingsSet.clear();
    preservedOriginalElements.clear();
    document.querySelectorAll('[data-mineiro-preserved]').forEach(el => {
      delete el.dataset.mineiroPreserved;
    });
    localStorage.removeItem(PRESERVED_STORAGE_KEY);
    log('✓ Todos los elementos preservados han sido limpiados');
  };
  
  // 🔥 FUNCIÓN NUCLEAR: Limpiar TODOS los datos de Mineiro (localStorage + site_config.productos)
  const clearAllMineiroData = async () => {
    log('🔥 Limpiando TODOS los datos de Mineiro...');
    
    // 1. Limpiar localStorage
    clearAllPreserved();
    localEdits.clear();
    htmlOriginalDelCodigo.clear();
    
    // Limpiar cualquier otro item de localStorage relacionado con mineiro
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('mineiro') || key.includes('Mineiro'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    log(`   ✓ Limpiados ${keysToRemove.length} items de localStorage`);
    
    // 2. Limpiar site_config.productos en la base de datos
    if (tiendaData?.id && tiendaData?.site_config) {
      try {
        const newSiteConfig = JSON.parse(JSON.stringify(tiendaData.site_config));
        delete newSiteConfig.productos; // Eliminar todos los productos guardados en site_config
        
        const response = await fetch(EDIT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            table: 'tiendas',
            data: { site_config: newSiteConfig },
            where: { id: tiendaData.id }
          })
        });
        
        if (response.ok) {
          tiendaData.site_config = newSiteConfig;
          log('   ✓ site_config.productos limpiado de la base de datos');
        }
      } catch (err) {
        warn('Error limpiando site_config:', err);
      }
    }
    
    // 3. Quitar atributos de hidratación de todos los elementos
    document.querySelectorAll('[data-mineiro-hydrated]').forEach(el => {
      el.removeAttribute('data-mineiro-hydrated');
    });
    
    log('✅ TODOS los datos de Mineiro han sido limpiados. Recarga la página para ver los valores originales del HTML.');
    
    // Mostrar alerta al usuario
    alert('✅ Datos limpiados correctamente.\n\nRecarga la página (F5) para ver los valores originales de tu HTML.');
    
    return true;
  };
  
  // Exponer función globalmente para poder usarla desde consola
  window.clearAllMineiroData = clearAllMineiroData;
  
  // Set de bindings que fueron preservados (persiste entre recargas)
  const preservedBindingsSet = loadPreservedBindings();

  // Función para capturar el HTML original de todos los elementos ANTES de hidratar
  const captureOriginalHTML = () => {
    const elements = document.querySelectorAll("[data-mineiro-bind]");
    elements.forEach((el) => {
      // Solo guardar si no se ha guardado antes
      if (!htmlOriginalDelCodigo.has(el)) {
        htmlOriginalDelCodigo.set(el, {
          innerHTML: el.innerHTML,
          textContent: el.textContent,
          src: el.src || null,
          href: el.href || null,
          backgroundImage: el.style.backgroundImage || null,
          styleAttribute: el.getAttribute('style') || '',
        });
        
        // Si este binding estaba preservado en localStorage, marcarlo
        const binding = el.dataset.mineiroBind;
        if (binding && preservedBindingsSet.has(binding)) {
          preservedOriginalElements.add(el);
          el.dataset.mineiroPreserved = 'true';
          log(`Elemento preservado restaurado: ${binding}`);
        }
      }
    });
    log(`Capturados ${htmlOriginalDelCodigo.size} elementos originales del código HTML`);
  };

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
      // Si el valor contiene HTML (tags), usar innerHTML para preservar formato
      if (typeof value === 'string' && (value.includes('<') && value.includes('>'))) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }

    el.dataset.mineiroHydrated = "true";
    return true;
  };

  // 🔒 Map para guardar valores editados localmente (no se sobreescriben por polling)
  const localEdits = new Map(); // binding -> { value, timestamp }
  const LOCAL_EDIT_PROTECTION_MS = 30000; // Proteger ediciones locales por 30 segundos

  const hydrateElement = (el, tienda, productos, testimonios) => {
    const binding = el.dataset.mineiroBind;
    
    // 🔒 VERIFICAR SI HAY UNA EDICIÓN LOCAL RECIENTE
    // Si el usuario editó este elemento hace menos de 30 segundos, NO re-hidratar
    const localEdit = localEdits.get(binding);
    if (localEdit && (Date.now() - localEdit.timestamp) < LOCAL_EDIT_PROTECTION_MS) {
      log(`🔒 Elemento con edición local reciente, NO se hidrata: ${binding}`);
      return;
    }
    
    // TRIPLE verificación para no hidratar elementos preservados:
    // 1. Está en el Set de elementos preservados
    // 2. Tiene el atributo data-mineiro-preserved
    // 3. Su binding está en localStorage (preservedBindingsSet)
    if (preservedOriginalElements.has(el) || 
        el.dataset.mineiroPreserved === 'true' || 
        preservedBindingsSet.has(binding)) {
      log(`⚠️ Elemento preservado, NO se hidrata: ${binding}`);
      el.dataset.mineiroPreserved = 'true'; // Asegurar que esté marcado
      return;
    }
    
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
        // 🔍 Buscar producto por dom_id o nombre normalizado
        const searchId = parsed.identifier.toLowerCase();
        let producto = productos.find(p => p.dom_id === parsed.identifier)
                    || productos.find(p => String(p.id) === parsed.identifier)
                    || productos.find(p => p.nombre?.toLowerCase().replace(/\s+/g, '-') === searchId)
                    || productos.find(p => p.nombre?.toLowerCase() === searchId.replace(/-/g, ' '))
                    || productos.find(p => p.nombre?.toLowerCase().includes(searchId.replace(/-/g, ' ')));
        
        if (producto) {
          // 🎯 El campo puede ser "precio.fam", "precio.ind", "nombre", etc.
          // Primero intentar obtener el valor directo del producto
          if (parsed.field.includes(".")) {
            // Campo anidado: precio.fam -> producto.precio.fam o producto.configuracion.precios.fam
            value = getNestedValue(producto, parsed.field);
            
            // Si no se encuentra, buscar en configuracion.precios
            if (value === undefined && parsed.field.startsWith("precio.")) {
              const tamano = parsed.field.split(".")[1]; // "fam", "ind", "xl"
              value = getNestedValue(producto, `configuracion.precios.${tamano}`);
            }
            
            // Si aún no se encuentra, intentar buscar variantes
            if (value === undefined && parsed.field.startsWith("precio.")) {
              const tamano = parsed.field.split(".")[1];
              const variantes = producto.configuracion?.variantes || [];
              const variante = variantes.find(v => 
                v.nombre?.toLowerCase().includes(tamano) || 
                v.id === tamano ||
                v.tipo === tamano
              );
              if (variante) value = variante.precio;
            }
            
            // Fallback: usar precio base si es campo de precio
            if (value === undefined && parsed.field.startsWith("precio")) {
              value = producto.precio;
            }
          } else {
            value = producto[parsed.field];
          }
        }
        
        // Fallback: buscar en site_config si no hay producto en BD
        if (value === undefined) {
          // Buscar en site_config.config.menu.{categoria}.{producto}.{campo}
          if (parsed.categoria) {
            value = getNestedValue(siteConfig, `config.menu.${parsed.categoria}.${parsed.identifier}.${parsed.field}`);
          }
          // También buscar en site_config.productos
          if (value === undefined) {
            value = getNestedValue(siteConfig, `productos.${parsed.identifier}.${parsed.field}`);
          }
        }
        break;
      }
    }

    if (value !== undefined && value !== null) {
      applyValueToElement(el, value, parsed.field);
    }
  };

  const runHydration = (tienda, productos, testimonios) => {
    // IMPORTANTE: Capturar HTML original ANTES de hidratar
    captureOriginalHTML();
    
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
  // IMPORTANTE: No re-hidratar elementos que el usuario restauró a original NI ediciones locales recientes
  const forceRehydrateAll = () => {
    document.querySelectorAll("[data-mineiro-bind][data-mineiro-hydrated]").forEach(el => {
      const binding = el.dataset.mineiroBind;
      
      // 🔒 No tocar elementos con edición local reciente
      const localEdit = localEdits.get(binding);
      if (localEdit && (Date.now() - localEdit.timestamp) < LOCAL_EDIT_PROTECTION_MS) {
        return; // Proteger edición local
      }
      
      // No tocar elementos preservados por el usuario
      if (!preservedOriginalElements.has(el) && el.dataset.mineiroPreserved !== 'true') {
        el.removeAttribute("data-mineiro-hydrated");
      }
    });
    runHydration(tiendaData, productosCache, testimoniosCache);
  };

  const rehydrateProducto = (producto) => {
    if (!producto.dom_id) return;
    
    document.querySelectorAll(`[data-mineiro-bind^="producto-${producto.dom_id}."]`).forEach((el) => {
      const binding = el.dataset.mineiroBind;
      const parsed = parseBinding(binding);
      if (parsed && parsed.type === "producto") {
        let value;
        
        if (parsed.field.includes(".")) {
          // Campo anidado: precio.fam -> producto.precio.fam o producto.configuracion.precios.fam
          value = getNestedValue(producto, parsed.field);
          
          // Si no se encuentra, buscar en configuracion.precios
          if (value === undefined && parsed.field.startsWith("precio.")) {
            const tamano = parsed.field.split(".")[1]; // "fam", "ind", "xl"
            value = getNestedValue(producto, `configuracion.precios.${tamano}`);
          }
          
          // Si aún no se encuentra, intentar buscar variantes
          if (value === undefined && parsed.field.startsWith("precio.")) {
            const tamano = parsed.field.split(".")[1];
            const variantes = producto.configuracion?.variantes || [];
            const variante = variantes.find(v => 
              v.nombre?.toLowerCase().includes(tamano) || 
              v.id === tamano ||
              v.tipo === tamano
            );
            if (variante) value = variante.precio;
          }
          
          // Fallback: usar precio base si es campo de precio
          if (value === undefined && parsed.field.startsWith("precio")) {
            value = producto.precio;
          }
        } else {
          value = producto[parsed.field];
        }
        
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
  
  // Almacenar estilos computados de elementos (para referencia)
  const originalStyles = new WeakMap();

  // Guardar estilos computados cuando se edita (para referencia, no para restaurar)
  const saveComputedStyles = (el) => {
    if (!originalStyles.has(el)) {
      const computedStyle = window.getComputedStyle(el);
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
    }
  };

  // Restaurar completamente al estado original del código HTML (ANTES de cualquier hidratación)
  const restoreToCodeOriginal = (el) => {
    const original = htmlOriginalDelCodigo.get(el);
    
    if (!original) {
      warn("No se encontró el HTML original para este elemento");
      return false;
    }
    
    // Restaurar innerHTML original
    el.innerHTML = original.innerHTML;
    
    // Restaurar atributo style original
    if (original.styleAttribute === '' || original.styleAttribute === null) {
      el.removeAttribute('style');
    } else {
      el.setAttribute('style', original.styleAttribute);
    }
    
    // Restaurar src si es imagen
    if (original.src && el.tagName.toLowerCase() === 'img') {
      el.src = original.src;
    }
    
    // Restaurar href si es enlace
    if (original.href && el.tagName.toLowerCase() === 'a') {
      el.href = original.href;
    }
    
    // Marcar como elemento preservado para que NO se vuelva a hidratar
    preservedOriginalElements.add(el);
    el.dataset.mineiroPreserved = 'true';
    
    // Persistir en localStorage para que sobreviva recargas
    const binding = el.dataset.mineiroBind;
    if (binding) {
      preservedBindingsSet.add(binding);
      savePreservedBindings();
    }
    
    log("✓ Restaurado al HTML original del código (protegido de re-hidratación, persistido)");
    return true;
  };

  // Agregar cambio al historial
  const addToHistory = (el, binding, oldValue, newValue, field) => {
    const original = htmlOriginalDelCodigo.get(el);
    
    changeHistory.push({
      element: el,
      binding,
      oldValue,
      newValue,
      field,
      timestamp: Date.now(),
      codeOriginal: original, // Guardar referencia al original del código
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
    const { element, binding, oldValue, field, codeOriginal } = lastChange;

    log(`Deshaciendo: ${binding} -> "${oldValue}"`);

    // Restaurar contenido (puede ser HTML o texto)
    if (oldValue && (oldValue.includes('<') || oldValue.includes('>'))) {
      // Es HTML, restaurar innerHTML
      element.innerHTML = oldValue;
    } else {
      // Es texto plano
      applyValueToElement(element, oldValue, field);
    }
    
    // Restaurar estilos inline del código original (si hay referencia)
    if (codeOriginal && codeOriginal.styleAttribute !== undefined) {
      if (codeOriginal.styleAttribute === '' || codeOriginal.styleAttribute === null) {
        element.removeAttribute('style');
      } else {
        element.setAttribute('style', codeOriginal.styleAttribute);
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

  /* ─────────────────────────────────────────────────────────────────────────
     PANEL: AÑADIR CONTENIDO (Productos, Categorías, Testimonios)
     ───────────────────────────────────────────────────────────────────────── */

  // Función para registrar cambios en la tabla elements (para historial)
  const registerElementChange = async (binding, elementId, type, name, originalValue, newValue) => {
    if (!tiendaData?.slug) return;
    
    try {
      const response = await fetch(EDIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          table: 'elements',
          data: {
            site_id: tiendaData.slug,
            element_id: elementId || binding,
            type: type || 'text',
            name: name || binding,
            original_value: String(originalValue || '').substring(0, 1000),
            current_value: String(newValue || '').substring(0, 1000),
            updated_at: new Date().toISOString()
          },
          where: { site_id: tiendaData.slug, element_id: elementId || binding }
        })
      });
      
      if (response.ok) {
        log(`✓ Cambio registrado en historial: ${binding}`);
      }
    } catch (err) {
      warn('Error registrando cambio:', err.message);
    }
  };

  const showAddContentPanel = () => {
    // Remover panel anterior si existe
    document.querySelector(".mineiro-panel")?.remove();

    // Usar categorías del menú (site_config.menu.categorias)
    const menuCategorias = tiendaData?.site_config?.menu?.categorias || {};
    const configCategorias = tiendaData?.site_config?.categorias || [];
    const menuItems = tiendaData?.site_config?.menu?.items || [];
    const menuSections = tiendaData?.site_config?.menu?.secciones || [];
    
    // Extraer categorías del menú como lista de objetos con slug y título
    const existingCategories = [];
    
    // Log para debug
    log('Menu categorias encontradas:', Object.keys(menuCategorias));
    
    const addCategory = (slugValue, tituloValue) => {
      const slug = String(slugValue || '').trim();
      let titulo = String(tituloValue || '').trim();

      if (!titulo && slug) {
        titulo = slug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      const alreadyExists = existingCategories.some((c) =>
        c.slug === slug || c.titulo.toLowerCase() === titulo.toLowerCase()
      );

      if (slug && slug.length > 0 && !alreadyExists) {
        existingCategories.push({ slug, titulo });
        log(`Categoría encontrada: ${slug} -> ${titulo}`);
      }
    };

    const extractFromBindings = () => {
      const bindings = Array.from(document.querySelectorAll('[data-mineiro-bind^="menu.categorias."]'))
        .map((el) => el.getAttribute('data-mineiro-bind'))
        .filter(Boolean);

      bindings.forEach((binding) => {
        const match = binding.match(/^menu\.categorias\.([^\.]+)\./);
        if (match) {
          const slug = match[1];
          addCategory(slug, slug);
        }
      });
    };

    if (Array.isArray(menuCategorias)) {
      menuCategorias.forEach((data) => {
        if (typeof data === 'object' && data !== null) {
          const slug = data.slug || data.id || data.key || data.nombre || data.title || data.titulo || '';
          const titulo = data.titulo || data.boton || data.nombre || data.title || data.label || '';
          addCategory(slug, titulo);
        } else if (typeof data === 'string') {
          addCategory(data.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), data);
        }
      });
    } else {
      Object.entries(menuCategorias).forEach(([slug, data]) => {
        let titulo = '';
        
        // Manejar diferentes estructuras de datos
        if (typeof data === 'object' && data !== null) {
          // Buscar el título en diferentes propiedades posibles
          titulo = (data.titulo || data.boton || data.nombre || data.title || data.label || '').trim();
          
          // Si tiene icono pero no título, puede ser una categoría válida
          if (!titulo && data.icono) {
            titulo = slug
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        } else if (typeof data === 'string') {
          titulo = data.trim();
        }
        
        addCategory(slug, titulo);
      });
    }

    if (Array.isArray(menuItems)) {
      menuItems.forEach((item) => {
        if (!item) return;
        const slug = item.slug || item.id || item.key || item.nombre || item.title || item.titulo || '';
        const titulo = item.titulo || item.nombre || item.label || item.title || '';
        addCategory(slug, titulo);
      });
    }

    if (Array.isArray(menuSections)) {
      menuSections.forEach((section) => {
        if (!section) return;
        const slug = section.slug || section.id || section.key || section.nombre || section.title || section.titulo || '';
        const titulo = section.titulo || section.nombre || section.label || section.title || '';
        addCategory(slug, titulo);
      });
    }

    if (Array.isArray(configCategorias)) {
      configCategorias.forEach((cat) => {
        if (!cat) return;
        if (typeof cat === 'string') {
          const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          addCategory(slug, cat);
          return;
        }
        const slug = cat.slug || cat.nombre || cat.title || cat.titulo || '';
        const titulo = cat.nombre || cat.titulo || cat.title || cat.label || '';
        addCategory(slug, titulo);
      });
    }

    // Extraer categorías desde bindings en el DOM (fallback final)
    extractFromBindings();

    // También buscar categorías en productos existentes como fallback
    const productCategories = [...new Set(productosCache.map(p => p.categoria).filter(Boolean))];
    productCategories.forEach(cat => {
      if (!existingCategories.find(c => c.titulo.toLowerCase() === cat.toLowerCase() || c.slug === cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
        const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        existingCategories.push({ slug, titulo: cat });
      }
    });
    
    log(`Total categorías disponibles: ${existingCategories.length}`, existingCategories.map(c => c.titulo));
    
    // Detectar diseño de tarjetas de producto existentes
    const existingProductCards = document.querySelectorAll('[data-mineiro-bind*="producto-"]');
    const cardTemplateInfo = detectCardDesign(existingProductCards);

    const panel = document.createElement("div");
    panel.className = "mineiro-panel mineiro-add-panel";
    panel.innerHTML = `
      <div class="mineiro-panel-header">
        <h3>➕ Añadir Contenido</h3>
        <button class="mineiro-panel-close" onclick="this.closest('.mineiro-panel').remove()">✕</button>
      </div>
      <div class="mineiro-panel-body">
        <!-- Tabs -->
        <div class="mineiro-panel-tabs">
          <button class="mineiro-panel-tab active" data-tab="producto">📦 Producto</button>
          <button class="mineiro-panel-tab" data-tab="categoria">📁 Categoría</button>
          <button class="mineiro-panel-tab" data-tab="testimonio">💬 Testimonio</button>
        </div>

        <!-- Tab: Producto -->
        <div class="mineiro-panel-tab-content active" data-content="producto">
          <div class="mineiro-form-group">
            <label>Nombre del producto</label>
            <input type="text" id="add-producto-nombre" placeholder="Ej: Pizza Margherita" />
          </div>
          <div class="mineiro-form-group">
            <label>Precio</label>
            <input type="number" id="add-producto-precio" placeholder="Ej: 9990" />
          </div>
          <div class="mineiro-form-group">
            <label>Categoría</label>
            <select id="add-producto-categoria">
              <option value="">Sin categoría</option>
              ${existingCategories.map(c => `<option value="${c.titulo}">${c.titulo}</option>`).join('')}
            </select>
            ${existingCategories.length === 0 ? '<div class="mineiro-form-info" style="margin-top:8px;background:#ef4444/10;border-color:#ef4444/30;color:#fca5a5">⚠️ No hay categorías configuradas. Crea una categoría primero en la pestaña "Categoría".</div>' : ''}
          </div>
          <div class="mineiro-form-group">
            <label>Descripción (opcional)</label>
            <textarea id="add-producto-descripcion" placeholder="Descripción del producto..."></textarea>
          </div>
          <div class="mineiro-form-group">
            <label>Imagen (opcional)</label>
            <div class="mineiro-image-drop" id="add-producto-image-drop">
              <div class="mineiro-drop-hint">📷 Arrastra una imagen o haz clic para seleccionar</div>
              <input type="file" accept="image/*" style="display:none" />
            </div>
          </div>
          <div class="mineiro-form-info">
            ${cardTemplateInfo.found 
              ? `✅ Se detectó el diseño de tarjetas existente. El nuevo producto se adaptará automáticamente.`
              : `ℹ️ El producto se creará en la base de datos. Agrega un contenedor con data-mineiro-bind para mostrarlo.`
            }
          </div>
          <button class="mineiro-btn-primary" id="add-producto-btn">➕ Crear Producto</button>
        </div>

        <!-- Tab: Categoría -->
        <div class="mineiro-panel-tab-content" data-content="categoria">
          <div class="mineiro-form-group">
            <label>Nombre de la categoría</label>
            <input type="text" id="add-categoria-nombre" placeholder="Ej: Pizzas Tradicionales, Bebidas..." />
          </div>
          <div class="mineiro-form-group">
            <label>Descripción (opcional)</label>
            <textarea id="add-categoria-descripcion" placeholder="Descripción de la categoría..."></textarea>
          </div>
          <button class="mineiro-btn-primary" id="add-categoria-btn">📁 Crear Categoría en Menú</button>
          <div class="mineiro-form-info" style="margin-top:16px">
            <strong>Categorías del menú:</strong><br>
            ${existingCategories.length > 0 
              ? existingCategories.map(c => `<span class="mineiro-tag">${c.titulo}</span>`).join(' ')
              : '<em style="color:#94a3b8">No hay categorías configuradas en el menú</em>'
            }
          </div>
        </div>

        <!-- Tab: Testimonio -->
        <div class="mineiro-panel-tab-content" data-content="testimonio">
          <div class="mineiro-form-group">
            <label>Nombre del cliente</label>
            <input type="text" id="add-testimonio-nombre" placeholder="Ej: María García" />
          </div>
          <div class="mineiro-form-group">
            <label>Testimonio</label>
            <textarea id="add-testimonio-texto" placeholder="El comentario del cliente..."></textarea>
          </div>
          <div class="mineiro-form-group">
            <label>Calificación</label>
            <select id="add-testimonio-rating">
              <option value="5">⭐⭐⭐⭐⭐ (5 estrellas)</option>
              <option value="4">⭐⭐⭐⭐ (4 estrellas)</option>
              <option value="3">⭐⭐⭐ (3 estrellas)</option>
              <option value="2">⭐⭐ (2 estrellas)</option>
              <option value="1">⭐ (1 estrella)</option>
            </select>
          </div>
          <div class="mineiro-form-group">
            <label>Avatar (opcional)</label>
            <div class="mineiro-image-drop" id="add-testimonio-image-drop">
              <div class="mineiro-drop-hint">📷 Arrastra una imagen o haz clic</div>
              <input type="file" accept="image/*" style="display:none" />
            </div>
          </div>
          <button class="mineiro-btn-primary" id="add-testimonio-btn">💬 Crear Testimonio</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Setup tabs
    panel.querySelectorAll('.mineiro-panel-tab').forEach(tab => {
      tab.onclick = () => {
        panel.querySelectorAll('.mineiro-panel-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.mineiro-panel-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelector(`[data-content="${tab.dataset.tab}"]`).classList.add('active');
      };
    });

    // Image drops
    setupImageDrop('add-producto-image-drop');
    setupImageDrop('add-testimonio-image-drop');

    // Buttons
    document.getElementById('add-producto-btn').onclick = createNewProduct;
    document.getElementById('add-categoria-btn').onclick = createNewCategory;
    document.getElementById('add-testimonio-btn').onclick = createNewTestimonio;
  };

  const setupImageDrop = (dropId) => {
    const drop = document.getElementById(dropId);
    if (!drop) return;
    
    const input = drop.querySelector('input[type="file"]');
    
    drop.onclick = () => input.click();
    
    drop.ondragover = (e) => {
      e.preventDefault();
      drop.classList.add('dragover');
    };
    
    drop.ondragleave = () => drop.classList.remove('dragover');
    
    drop.ondrop = async (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) await handleImageDropFile(drop, file);
    };
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await handleImageDropFile(drop, file);
    };
  };

  const handleImageDropFile = async (drop, file) => {
    drop.innerHTML = '<div class="mineiro-drop-hint"><div class="mineiro-spinner"></div> Subiendo...</div>';
    
    try {
      const url = await uploadImageToStorage(file);
      drop.innerHTML = `<img src="${url}" alt="Preview" style="max-width:100%;max-height:100px;border-radius:8px" />`;
      drop.dataset.imageUrl = url;
    } catch (err) {
      // Fallback a base64
      try {
        const base64 = await fileToBase64(file);
        drop.innerHTML = `<img src="${base64}" alt="Preview" style="max-width:100%;max-height:100px;border-radius:8px" />`;
        drop.dataset.imageUrl = base64;
      } catch (err2) {
        drop.innerHTML = `<div class="mineiro-drop-hint">❌ Error: ${err.message}</div>`;
      }
    }
  };

  const detectCardDesign = (existingCards) => {
    if (existingCards.length === 0) {
      return { found: false, template: null };
    }
    
    // Analizar la primera tarjeta para detectar el patrón
    const firstCard = existingCards[0].closest('[class*="card"], [class*="product"], [class*="item"], .producto, .menu-item') 
                   || existingCards[0].parentElement?.parentElement;
    
    if (!firstCard) return { found: false, template: null };
    
    return {
      found: true,
      template: {
        className: firstCard.className,
        tagName: firstCard.tagName.toLowerCase(),
        hasImage: !!firstCard.querySelector('img'),
        hasPrice: !!firstCard.querySelector('[data-mineiro-bind*="precio"]'),
        hasDescription: !!firstCard.querySelector('[data-mineiro-bind*="descripcion"]'),
      }
    };
  };

  // Función para renderizar un nuevo producto en contenedores existentes
  const tryRenderNewProduct = (producto) => {
    const categoria = producto.categoria?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
    const categoriaOriginal = producto.categoria?.toLowerCase().trim() || '';
    const domId = producto.dom_id || producto.id;
    
    log(`🎯 Renderizando producto: "${producto.nombre}" | Categoría: "${categoriaOriginal}" | dom_id: ${domId}`);
    
    // Verificar si ya existe
    if (document.querySelector(`[data-mineiro-product-id="${domId}"]`)) {
      log(`   ⚠️ Producto ya existe en el DOM, saltando`);
      return true;
    }
    
    let rendered = false;
    
    // 🔥 ESTRATEGIA 0: Buscar CUALQUIER contenedor que tenga productos existentes
    // Esta es la más agresiva y generalmente funciona
    const allProductBindings = document.querySelectorAll('[data-mineiro-bind*="producto-"]');
    log(`   Productos existentes en DOM: ${allProductBindings.length}`);
    
    if (allProductBindings.length > 0 && !rendered) {
      // Encontrar todos los contenedores únicos de productos
      const containersSet = new Set();
      allProductBindings.forEach(el => {
        // Subir en el DOM para encontrar el contenedor
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          // Buscar un contenedor que parezca un grid o lista
          if (parent.children.length >= 1) {
            const hasProducts = parent.querySelector('[data-mineiro-bind*="producto-"]');
            if (hasProducts) {
              containersSet.add(parent);
            }
          }
          parent = parent.parentElement;
        }
      });
      
      log(`   Contenedores de productos encontrados: ${containersSet.size}`);
      
      // Filtrar para encontrar el contenedor correcto por categoría
      for (const container of containersSet) {
        // Ver si este contenedor tiene productos de la categoría correcta
        const productosEnContainer = container.querySelectorAll('[data-mineiro-bind*="producto-"]');
        
        // Si no hay categoría específica O el contenedor tiene productos de cualquier categoría, usar este
        if (!categoriaOriginal || productosEnContainer.length > 0) {
          // Verificar si la categoría coincide por el texto
          let categoriaCoincide = !categoriaOriginal; // Si no hay categoría, cualquier contenedor sirve
          
          if (categoriaOriginal) {
            // Buscar si algún producto en este contenedor tiene la misma categoría
            const textoContainer = container.textContent?.toLowerCase() || '';
            if (textoContainer.includes(categoriaOriginal)) {
              categoriaCoincide = true;
            }
            
            // También buscar en headings cercanos
            const heading = container.closest('section, [class*="section"]')?.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading && heading.textContent?.toLowerCase().includes(categoriaOriginal)) {
              categoriaCoincide = true;
            }
          }
          
          if (categoriaCoincide && !container.querySelector(`[data-mineiro-product-id="${domId}"]`)) {
            const card = createProductCard(producto, container);
            if (card) {
              container.appendChild(card);
              rendered = true;
              log(`   ✓ Renderizado en contenedor de productos existente`);
              break;
            }
          }
        }
      }
      
      // Si no encontró por categoría, usar el primer contenedor disponible
      if (!rendered && containersSet.size > 0) {
        const firstContainer = Array.from(containersSet)[0];
        if (!firstContainer.querySelector(`[data-mineiro-product-id="${domId}"]`)) {
          const card = createProductCard(producto, firstContainer);
          if (card) {
            firstContainer.appendChild(card);
            rendered = true;
            log(`   ✓ Renderizado en primer contenedor disponible (sin match de categoría)`);
          }
        }
      }
    }
    
    // Estrategia 1: Buscar contenedores con data-mineiro-section
    if (!rendered) {
      const sectionContainers = document.querySelectorAll('[data-mineiro-section]');
      log(`   Secciones encontradas: ${sectionContainers.length}`);
      sectionContainers.forEach(container => {
        if (rendered) return;
        const sectionName = container.dataset.mineiroSection?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const sectionOriginal = container.dataset.mineiroSection?.toLowerCase().trim() || '';
        
        if (sectionName === categoria || sectionOriginal === categoriaOriginal || 
            sectionName === 'todos' || sectionName === 'all' || !categoria) {
          const card = createProductCard(producto, container);
          container.appendChild(card);
          rendered = true;
          log(`   ✓ Renderizado en sección: ${sectionOriginal}`);
        }
      });
    }
    
    // Estrategia 2: Buscar contenedores con data-mineiro-category o data-category
    if (!rendered) {
      const categorySelectors = [
        `[data-mineiro-category="${categoria}"]`,
        `[data-mineiro-category="${categoriaOriginal}"]`,
        `[data-mineiro-categoria="${categoria}"]`,
        `[data-mineiro-categoria="${categoriaOriginal}"]`,
        `[data-category="${categoria}"]`,
        `[data-category="${categoriaOriginal}"]`
      ];
      
      for (const selector of categorySelectors) {
        const containers = document.querySelectorAll(selector);
        containers.forEach(container => {
          if (!rendered) {
            const card = createProductCard(producto, container);
            container.appendChild(card);
            rendered = true;
            log(`   ✓ Renderizado con selector: ${selector}`);
          }
        });
        if (rendered) break;
      }
    }
    
    // Estrategia 3: Buscar secciones por texto del heading
    if (!rendered && categoriaOriginal) {
      const allSections = document.querySelectorAll('section, [class*="section"], [class*="category"], [class*="categoria"]');
      log(`   Buscando por heading en ${allSections.length} secciones...`);
      
      for (const section of allSections) {
        const heading = section.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"]');
        if (heading) {
          const headingText = heading.textContent?.toLowerCase().trim() || '';
          if (headingText.includes(categoriaOriginal) || categoriaOriginal.includes(headingText)) {
            // Buscar un grid o contenedor de productos dentro
            const grid = section.querySelector('[class*="grid"], [class*="products"], [class*="items"], [class*="menu"], .productos');
            const container = grid || section;
            const card = createProductCard(producto, container);
            container.appendChild(card);
            rendered = true;
            log(`   ✓ Renderizado bajo heading: "${headingText}"`);
            break;
          }
        }
      }
    }
    
    // Estrategia 4: Buscar contenedores que ya tengan productos de la misma categoría
    if (!rendered && categoriaOriginal) {
      // Buscar productos existentes con la misma categoría en su binding
      const existingCatBindings = document.querySelectorAll('[data-mineiro-bind*=".categoria"]');
      log(`   Bindings de categoría encontrados: ${existingCatBindings.length}`);
      
      for (const catEl of existingCatBindings) {
        const catText = catEl.textContent?.toLowerCase().trim() || '';
        if (catText.includes(categoriaOriginal) || categoriaOriginal.includes(catText)) {
          // Encontrar el contenedor padre que tenga el grid de productos
          let container = catEl.closest('[class*="grid"], [class*="products"], [class*="items"], section');
          if (!container) {
            // Subir hasta encontrar un contenedor con varios hijos
            container = catEl.parentElement;
            let attempts = 0;
            while (container && container.children.length < 3 && attempts < 6) {
              container = container.parentElement;
              attempts++;
            }
          }
          
          if (container && container !== document.body && !container.querySelector(`[data-mineiro-product-id="${domId}"]`)) {
            const card = createProductCard(producto, container);
            container.appendChild(card);
            rendered = true;
            log(`   ✓ Renderizado junto a productos de misma categoría`);
            break;
          }
        }
      }
    }
    
    // Estrategia 5: Buscar cualquier grid o contenedor genérico de productos
    if (!rendered) {
      const genericSelectors = [
        '.products-grid', '.menu-items', '.productos', '.products',
        '[class*="product-list"]', '[class*="menu-grid"]', '[class*="product-grid"]',
        '.grid', '[class*="items-container"]'
      ];
      
      for (const selector of genericSelectors) {
        const containers = document.querySelectorAll(selector);
        if (containers.length > 0) {
          const container = containers[0];
          if (!container.querySelector(`[data-mineiro-product-id="${domId}"]`)) {
            const card = createProductCard(producto, container);
            container.appendChild(card);
            rendered = true;
            log(`   ✓ Renderizado en contenedor genérico: ${selector}`);
            break;
          }
        }
      }
    }
    
    // Estrategia 6: Buscar el padre de cualquier producto existente
    if (!rendered) {
      const anyProduct = document.querySelector('[data-mineiro-bind*="producto-"]');
      if (anyProduct) {
        let container = anyProduct.parentElement;
        let attempts = 0;
        while (container && container.children.length < 2 && attempts < 5) {
          container = container.parentElement;
          attempts++;
        }
        
        if (container && container !== document.body && !container.querySelector(`[data-mineiro-product-id="${domId}"]`)) {
          const card = createProductCard(producto, container);
          container.appendChild(card);
          rendered = true;
          log(`   ✓ Renderizado en contenedor de producto existente`);
        }
      }
    }
    
    // Estrategia 7: Crear sección flotante temporal
    if (!rendered) {
      log(`   ⚠️ No se encontró contenedor. Creando sección temporal.`);
      
      const insertPoint = document.querySelector('main, .main, #main, .content, article, .menu-section') || document.body;
      
      const tempSection = document.createElement('div');
      tempSection.className = 'mineiro-new-products-section';
      tempSection.style.cssText = 'padding:20px;margin:20px 0;background:rgba(6,182,212,0.1);border:2px dashed #06b6d4;border-radius:12px;';
      tempSection.innerHTML = `<h3 style="color:#06b6d4;margin:0 0 16px 0;font-size:14px;">✨ Nuevos productos - Categoría: ${producto.categoria || 'Sin categoría'}</h3>`;
      tempSection.dataset.mineiroSection = categoria || 'nuevos';
      
      const card = createProductCard(producto, null);
      tempSection.appendChild(card);
      insertPoint.appendChild(tempSection);
      rendered = true;
      log(`   ✓ Renderizado en sección temporal`);
    }
    
    if (!rendered) {
      showProductCreatedNotification(producto);
      log(`   ℹ️ Producto guardado. Recarga para ver en categoría.`);
    }
    
    return rendered;
  };
  
  // Mostrar notificación cuando el producto se crea pero no se puede renderizar
  const showProductCreatedNotification = (producto) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 100001;
      animation: mineiroSlideIn 0.3s ease;
      max-width: 350px;
    `;
    notification.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">✅ Producto creado</div>
      <div style="font-size:13px;opacity:0.9">"${producto.nombre}" guardado. Recarga la página para verlo en su categoría.</div>
      <button onclick="window.location.reload()" style="margin-top:10px;padding:6px 12px;background:rgba(255,255,255,0.2);border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px">
        🔄 Recargar página
      </button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 8000);
  };

  // Crear tarjeta de producto HTML - intenta clonar estilo existente
  const createProductCard = (producto, container = null) => {
    const domId = producto.dom_id || producto.id;
    const precio = typeof producto.precio === 'number' 
      ? formatCLP(producto.precio) 
      : producto.precio || '$0';
    
    // Intentar clonar una tarjeta existente del contenedor
    if (container) {
      const existingCard = container.querySelector('[data-mineiro-bind*="producto-"]')?.closest('.card, .product-card, .menu-item, .producto, [class*="card"], [class*="item"]')
                        || container.querySelector('[class*="product"], [class*="item"], [class*="card"]');
      
      if (existingCard) {
        const clonedCard = existingCard.cloneNode(true);
        clonedCard.dataset.mineiroProductId = domId;
        
        // Actualizar los bindings y valores
        const updateElement = (selector, value, bindSuffix) => {
          const el = clonedCard.querySelector(selector);
          if (el) {
            el.dataset.mineiroBind = `producto-${domId}.${bindSuffix}`;
            if (el.tagName.toLowerCase() === 'img') {
              el.src = value || '';
              el.alt = producto.nombre || '';
            } else {
              el.textContent = value || '';
            }
          }
        };
        
        // Buscar y actualizar imagen
        const imgEl = clonedCard.querySelector('img');
        if (imgEl) {
          imgEl.src = producto.imagen_url || '';
          imgEl.alt = producto.nombre || '';
          imgEl.dataset.mineiroBind = `producto-${domId}.imagen_url`;
        }
        
        // Buscar y actualizar nombre
        const nombreEl = clonedCard.querySelector('[data-mineiro-bind*=".nombre"], h1, h2, h3, h4, .product-name, .item-name, .nombre');
        if (nombreEl) {
          nombreEl.textContent = producto.nombre;
          nombreEl.dataset.mineiroBind = `producto-${domId}.nombre`;
        }
        
        // Buscar y actualizar precio
        const precioEl = clonedCard.querySelector('[data-mineiro-bind*=".precio"], .price, .precio, [class*="price"]');
        if (precioEl) {
          precioEl.textContent = precio;
          precioEl.dataset.mineiroBind = `producto-${domId}.precio`;
        }
        
        // Buscar y actualizar descripción
        const descEl = clonedCard.querySelector('[data-mineiro-bind*=".descripcion"], .description, .descripcion, p');
        if (descEl && producto.descripcion) {
          descEl.textContent = producto.descripcion;
          descEl.dataset.mineiroBind = `producto-${domId}.descripcion`;
        }
        
        // Hacer editable si está en modo admin
        if (adminMode) {
          clonedCard.querySelectorAll('[data-mineiro-bind]').forEach(el => {
            el.style.cursor = 'pointer';
            el.style.outline = '1px dashed rgba(34,211,238,0.4)';
          });
        }
        
        log(`✓ Tarjeta clonada de diseño existente`);
        return clonedCard;
      }
    }
    
    // Fallback: crear tarjeta con diseño por defecto
    const card = document.createElement('div');
    card.className = 'mineiro-product-card';
    card.dataset.mineiroProductId = domId;
    card.innerHTML = `
      <div style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;transition:transform 0.2s">
        ${producto.imagen_url ? `
          <img 
            data-mineiro-bind="producto-${domId}.imagen_url" 
            src="${producto.imagen_url}" 
            alt="${producto.nombre}"
            style="width:100%;height:160px;object-fit:cover"
          />
        ` : `
          <div style="width:100%;height:160px;background:#0f172a;display:flex;align-items:center;justify-content:center;color:#64748b">
            📷 Sin imagen
          </div>
        `}
        <div style="padding:16px">
          <div style="font-size:12px;color:#f59e0b;margin-bottom:4px;text-transform:uppercase">
            ${producto.categoria || 'Sin categoría'}
          </div>
          <h3 
            data-mineiro-bind="producto-${domId}.nombre"
            style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 8px 0"
          >${producto.nombre}</h3>
          ${producto.descripcion ? `
            <p 
              data-mineiro-bind="producto-${domId}.descripcion"
              style="font-size:13px;color:#94a3b8;margin:0 0 12px 0"
            >${producto.descripcion}</p>
          ` : ''}
          <div 
            data-mineiro-bind="producto-${domId}.precio"
            style="font-size:20px;font-weight:700;color:#f59e0b"
          >${precio}</div>
        </div>
      </div>
    `;
    
    // Hacer editable si está en modo admin
    if (adminMode) {
      card.querySelectorAll('[data-mineiro-bind]').forEach(el => {
        el.style.cursor = 'pointer';
        el.style.outline = '1px dashed rgba(34,211,238,0.4)';
      });
    }
    
    return card;
  };

  const createNewProduct = async () => {
    const nombre = document.getElementById('add-producto-nombre').value.trim();
    const precioRaw = parseFloat(document.getElementById('add-producto-precio').value) || 0;
    const catSelect = document.getElementById('add-producto-categoria');
    const descripcion = document.getElementById('add-producto-descripcion').value.trim();
    const imageDrop = document.getElementById('add-producto-image-drop');
    const imagenUrl = imageDrop?.dataset?.imageUrl || '';

    // Validar precio máximo (límite de INTEGER en PostgreSQL)
    const MAX_PRECIO = 2147483647;
    const precio = Math.min(Math.floor(precioRaw), MAX_PRECIO);
    
    if (precioRaw > MAX_PRECIO) {
      alert(`El precio es demasiado grande. Máximo permitido: $${MAX_PRECIO.toLocaleString()}`);
      return;
    }

    let categoria = catSelect?.value || '';

    if (!nombre) {
      alert('El nombre del producto es requerido');
      return;
    }

    if (!tiendaData?.id) {
      alert('Error: Tienda no configurada. Refresca la página e intenta de nuevo.');
      return;
    }

    const btn = document.getElementById('add-producto-btn');
    btn.innerHTML = '<div class="mineiro-spinner"></div> Creando...';
    btn.disabled = true;

    try {
      // Generar dom_id único basado en nombre
      const baseDomId = nombre.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos  
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Asegurar unicidad añadiendo timestamp si ya existe
      let domId = baseDomId;
      const existingDomIds = productosCache.map(p => p.dom_id);
      if (existingDomIds.includes(domId)) {
        domId = `${baseDomId}-${Date.now().toString(36)}`;
      }

      const productoData = {
        tienda_id: tiendaData.id,
        user_id: tiendaData.user_id || null,
        nombre,
        precio,
        categoria: categoria || null,
        descripcion: descripcion || null,
        imagen_url: imagenUrl || null,
        dom_id: domId,
        visible: true
      };

      log('Creando producto:', productoData);

      const response = await fetch(EDIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          table: 'productos',
          data: productoData,
          where: { tienda_id: tiendaData.id, dom_id: domId }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Agregar al cache local
        const newProduct = result.data || { ...productoData, id: crypto.randomUUID() };
        productosCache.push(newProduct);
        
        btn.innerHTML = '✅ ¡Producto creado!';
        btn.style.background = '#22c55e';
        
        // Intentar renderizar el producto en contenedores existentes
        tryRenderNewProduct(newProduct);
        
        // Limpiar form
        setTimeout(() => {
          document.getElementById('add-producto-nombre').value = '';
          document.getElementById('add-producto-precio').value = '';
          document.getElementById('add-producto-descripcion').value = '';
          if (catSelect) catSelect.value = '';
          if (imageDrop) {
            imageDrop.innerHTML = '<div class="mineiro-drop-hint">📷 Arrastra una imagen o haz clic para seleccionar</div><input type="file" accept="image/*" style="display:none" />';
            imageDrop.dataset.imageUrl = '';
            setupImageDrop('add-producto-image-drop');
          }
          
          btn.innerHTML = '➕ Crear Producto';
          btn.style.background = '';
          btn.disabled = false;
        }, 1500);
        
        log(`✓ Producto creado: ${nombre} (dom_id: ${domId}, categoria: ${categoria})`);
      } else {
        throw new Error(result.error || 'Error al crear producto');
      }
    } catch (err) {
      warn('Error al crear producto:', err.message);
      console.error(err);
      btn.innerHTML = '❌ Error';
      btn.style.background = '#ef4444';
      
      // Mostrar error al usuario
      const errorDiv = document.createElement('div');
      errorDiv.className = 'mineiro-form-info';
      errorDiv.style.cssText = 'background:#ef4444/20;border:1px solid #ef4444;color:#fca5a5;margin-top:8px';
      errorDiv.textContent = `Error: ${err.message}`;
      btn.parentNode.appendChild(errorDiv);
      
      setTimeout(() => {
        btn.innerHTML = '➕ Crear Producto';
        btn.style.background = '';
        btn.disabled = false;
        errorDiv.remove();
      }, 3000);
    }
  };

  const createNewCategory = async () => {
    const nombre = document.getElementById('add-categoria-nombre').value.trim();
    const descripcion = document.getElementById('add-categoria-descripcion').value.trim();

    if (!nombre) {
      alert('El nombre de la categoría es requerido');
      return;
    }

    if (!tiendaData?.id) {
      alert('Error: Tienda no configurada');
      return;
    }

    const btn = document.getElementById('add-categoria-btn');
    btn.innerHTML = '<div class="mineiro-spinner"></div> Creando...';
    btn.disabled = true;

    try {
      // Generar slug de la categoría
      const slug = nombre.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Clonar site_config y agregar categoría al menú
      const siteConfig = JSON.parse(JSON.stringify(tiendaData.site_config || {}));
      
      // Asegurar que exista la estructura del menú
      if (!siteConfig.menu) siteConfig.menu = {};
      if (!siteConfig.menu.categorias) siteConfig.menu.categorias = {};
      
      // Agregar la nueva categoría
      if (!siteConfig.menu.categorias[slug]) {
        siteConfig.menu.categorias[slug] = {
          titulo: nombre,
          boton: nombre,
          descripcion: descripcion || '',
          orden: Object.keys(siteConfig.menu.categorias).length
        };
      } else {
        // Ya existe, actualizar
        siteConfig.menu.categorias[slug].titulo = nombre;
        siteConfig.menu.categorias[slug].boton = nombre;
        if (descripcion) siteConfig.menu.categorias[slug].descripcion = descripcion;
      }

      // También mantener compatibilidad con categorias array si existe
      if (!siteConfig.categorias) siteConfig.categorias = [];
      if (!siteConfig.categorias.find(c => c.nombre === nombre)) {
        siteConfig.categorias.push({ nombre, descripcion, slug, orden: siteConfig.categorias.length });
      }

      const response = await fetch(EDIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          table: 'tiendas',
          data: { site_config: siteConfig },
          where: { id: tiendaData.id }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        tiendaData.site_config = siteConfig;
        
        btn.innerHTML = '✅ ¡Categoría creada!';
        btn.style.background = '#22c55e';
        
        setTimeout(() => {
          // Refrescar el panel para mostrar la nueva categoría
          showAddContentPanel();
        }, 1500);
        
        log(`✓ Categoría creada: ${nombre}`);
      } else {
        throw new Error(result.error || 'Error al crear categoría');
      }
    } catch (err) {
      warn('Error al crear categoría:', err.message);
      btn.innerHTML = '❌ Error';
      btn.style.background = '#ef4444';
      setTimeout(() => {
        btn.innerHTML = '📁 Crear Categoría';
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);
    }
  };

  const createNewTestimonio = async () => {
    const nombre = document.getElementById('add-testimonio-nombre').value.trim();
    const texto = document.getElementById('add-testimonio-texto').value.trim();
    const rating = parseInt(document.getElementById('add-testimonio-rating').value) || 5;
    const imageDrop = document.getElementById('add-testimonio-image-drop');
    const avatar = imageDrop?.dataset?.imageUrl || '';

    if (!nombre || !texto) {
      alert('El nombre y el testimonio son requeridos');
      return;
    }

    if (!tiendaData?.id) {
      alert('Error: Tienda no configurada');
      return;
    }

    const btn = document.getElementById('add-testimonio-btn');
    btn.innerHTML = '<div class="mineiro-spinner"></div> Creando...';
    btn.disabled = true;

    try {
      const domId = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const response = await fetch(EDIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          table: 'testimonios',
          data: {
            tienda_id: tiendaData.id,
            nombre,
            texto,
            estrellas: rating,
            avatar: avatar || null,
            dom_id: domId,
            visible: true,
            orden: testimoniosCache.length
          },
          where: { tienda_id: tiendaData.id, dom_id: domId }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.data) {
          testimoniosCache.push(result.data);
        }
        
        btn.innerHTML = '✅ ¡Testimonio creado!';
        btn.style.background = '#22c55e';
        
        setTimeout(() => {
          document.getElementById('add-testimonio-nombre').value = '';
          document.getElementById('add-testimonio-texto').value = '';
          document.getElementById('add-testimonio-rating').value = '5';
          imageDrop.innerHTML = '<div class="mineiro-drop-hint">📷 Arrastra una imagen o haz clic</div><input type="file" accept="image/*" style="display:none" />';
          imageDrop.dataset.imageUrl = '';
          setupImageDrop('add-testimonio-image-drop');
          
          btn.innerHTML = '💬 Crear Testimonio';
          btn.style.background = '';
          btn.disabled = false;
        }, 1500);
        
        log(`✓ Testimonio creado: ${nombre}`);
      } else {
        throw new Error(result.error || 'Error al crear testimonio');
      }
    } catch (err) {
      warn('Error al crear testimonio:', err.message);
      btn.innerHTML = '❌ Error';
      btn.style.background = '#ef4444';
      setTimeout(() => {
        btn.innerHTML = '💬 Crear Testimonio';
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PANEL: CONFIGURACIÓN DE USUARIO
     ───────────────────────────────────────────────────────────────────────── */

  const showSettingsPanel = () => {
    document.querySelector(".mineiro-panel")?.remove();

    const panel = document.createElement("div");
    panel.className = "mineiro-panel mineiro-settings-panel";
    panel.innerHTML = `
      <div class="mineiro-panel-header">
        <h3>⚙️ Configuración</h3>
        <button class="mineiro-panel-close" onclick="this.closest('.mineiro-panel').remove()">✕</button>
      </div>
      <div class="mineiro-panel-body">
        <!-- Info de la tienda -->
        <div class="mineiro-settings-section">
          <h4>🏪 Información de la Tienda</h4>
          <div class="mineiro-form-group">
            <label>Nombre del negocio</label>
            <input type="text" id="settings-tienda-nombre" value="${tiendaData?.nombre_negocio || ''}" />
          </div>
          <div class="mineiro-form-group">
            <label>URL del sitio</label>
            <input type="text" id="settings-tienda-url" value="${tiendaData?.url_web || ''}" readonly />
          </div>
          <div class="mineiro-form-group">
            <label>Slug (identificador)</label>
            <input type="text" id="settings-tienda-slug" value="${tiendaData?.slug || ''}" readonly />
          </div>
          <button class="mineiro-btn-primary" id="settings-save-tienda">💾 Guardar Cambios</button>
        </div>

        <!-- Manual de uso -->
        <div class="mineiro-settings-section">
          <h4>📖 Ayuda</h4>
          <button class="mineiro-btn-secondary" id="settings-open-manual">📚 Ver Manual de Usuario</button>
          <button class="mineiro-btn-secondary" id="settings-open-snippets">💻 Ver Snippets de Código</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Toggle password visibility
    panel.querySelectorAll('.mineiro-toggle-password').forEach(btn => {
      btn.onclick = () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁️' : '🙈';
      };
    });

    // Event handlers
    document.getElementById('settings-save-tienda').onclick = saveStoreSettings;
    document.getElementById('settings-open-manual').onclick = showUserManual;
    document.getElementById('settings-open-snippets').onclick = showCodeSnippets;
  };

  const loadUserEmail = async () => {
    if (!supabase) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        document.getElementById('settings-user-email').value = user.email;
      }
    } catch (err) {
      log('No se pudo cargar email de usuario');
    }
  };

  const saveStoreSettings = async () => {
    const nombre = document.getElementById('settings-tienda-nombre').value.trim();
    const btn = document.getElementById('settings-save-tienda');
    
    if (!nombre || !tiendaData?.id) return;

    btn.innerHTML = '<div class="mineiro-spinner"></div> Guardando...';
    btn.disabled = true;

    try {
      const response = await fetch(EDIT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          table: 'tiendas',
          data: { nombre_negocio: nombre },
          where: { id: tiendaData.id }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        tiendaData.nombre_negocio = nombre;
        btn.innerHTML = '✅ Guardado';
        btn.style.background = '#22c55e';
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      btn.innerHTML = '❌ Error';
      btn.style.background = '#ef4444';
    }
    
    setTimeout(() => {
      btn.innerHTML = '💾 Guardar Cambios';
      btn.style.background = '';
      btn.disabled = false;
    }, 2000);
  };

  const changeUserEmail = async () => {
    const newEmail = document.getElementById('settings-user-email').value.trim();
    
    if (!newEmail || !supabase) {
      alert('Ingresa un email válido');
      return;
    }

    const btn = document.getElementById('settings-change-email');
    btn.innerHTML = '<div class="mineiro-spinner"></div>';
    btn.disabled = true;

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;
      
      alert('Se ha enviado un email de confirmación a tu nueva dirección');
      btn.innerHTML = '✅ Email enviado';
    } catch (err) {
      alert('Error: ' + err.message);
      btn.innerHTML = '❌ Error';
    }
    
    setTimeout(() => {
      btn.innerHTML = '📧 Cambiar Email';
      btn.disabled = false;
    }, 2000);
  };

  const changeUserPassword = async () => {
    const newPass = document.getElementById('settings-new-password').value;
    const confirmPass = document.getElementById('settings-confirm-password').value;

    if (!newPass || newPass.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPass !== confirmPass) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (!supabase) return;

    const btn = document.getElementById('settings-change-password');
    btn.innerHTML = '<div class="mineiro-spinner"></div>';
    btn.disabled = true;

    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      
      if (error) throw error;
      
      alert('Contraseña actualizada exitosamente');
      document.getElementById('settings-new-password').value = '';
      document.getElementById('settings-confirm-password').value = '';
      btn.innerHTML = '✅ Actualizada';
    } catch (err) {
      alert('Error: ' + err.message);
      btn.innerHTML = '❌ Error';
    }
    
    setTimeout(() => {
      btn.innerHTML = '🔑 Cambiar Contraseña';
      btn.disabled = false;
    }, 2000);
  };

  const resetPassword = async () => {
    const email = document.getElementById('settings-user-email').value.trim();
    
    if (!email || !supabase) {
      alert('Ingresa tu email para recuperar la contraseña');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login?reset=true'
      });
      
      if (error) throw error;
      
      alert('Se ha enviado un email con instrucciones para restablecer tu contraseña');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     MANUAL DE USUARIO Y SNIPPETS
     ───────────────────────────────────────────────────────────────────────── */

  const showUserManual = () => {
    document.querySelector(".mineiro-panel")?.remove();

    const panel = document.createElement("div");
    panel.className = "mineiro-panel mineiro-manual-panel";
    panel.style.maxWidth = "800px";
    panel.innerHTML = `
      <div class="mineiro-panel-header">
        <h3>📚 Manual de Usuario - Mineiro Editor</h3>
        <button class="mineiro-panel-close" onclick="this.closest('.mineiro-panel').remove()">✕</button>
      </div>
      <div class="mineiro-panel-body mineiro-manual-content">
        <h4>🚀 Inicio Rápido</h4>
        <ol>
          <li><strong>Activar modo edición:</strong> Agrega <code>?mineiro-admin</code> a la URL de tu sitio</li>
          <li><strong>Editar contenido:</strong> Haz clic en cualquier elemento con borde punteado</li>
          <li><strong>Guardar cambios:</strong> Clic en "Guardar" o presiona Enter</li>
          <li><strong>Deshacer:</strong> Usa Ctrl+Z o el botón "Deshacer"</li>
        </ol>

        <h4>✏️ Edición de Texto</h4>
        <ul>
          <li><strong>Formato de texto:</strong> Usa la barra de herramientas para negrita (B), cursiva (I), subrayado (U)</li>
          <li><strong>Estilos por palabra:</strong> Selecciona texto específico y aplica formato solo a esa selección</li>
          <li><strong>Restaurar original:</strong> Selecciona "Original" en estilos para volver al texto del código HTML</li>
        </ul>

        <h4>🖼️ Imágenes</h4>
        <ul>
          <li><strong>Subir imagen:</strong> Arrastra y suelta o haz clic para seleccionar archivo</li>
          <li><strong>URL externa:</strong> También puedes pegar una URL de imagen</li>
          <li><strong>Formatos soportados:</strong> JPG, PNG, GIF, WebP</li>
        </ul>

        <h4>➕ Añadir Contenido</h4>
        <ul>
          <li><strong>Productos:</strong> Usa el botón "Añadir" → "Producto" para crear nuevos items</li>
          <li><strong>Categorías:</strong> Organiza tus productos en categorías desde el panel</li>
          <li><strong>Testimonios:</strong> Agrega reseñas de clientes con foto y calificación</li>
        </ul>

        <h4>⌨️ Atajos de Teclado</h4>
        <table class="mineiro-shortcuts-table">
          <tr><td><code>Ctrl+Z</code></td><td>Deshacer último cambio</td></tr>
          <tr><td><code>Escape</code></td><td>Cerrar popup de edición</td></tr>
          <tr><td><code>Enter</code></td><td>Guardar cambio (en campos de texto)</td></tr>
          <tr><td><code>Ctrl+B</code></td><td>Negrita (en editor de texto)</td></tr>
          <tr><td><code>Ctrl+I</code></td><td>Cursiva (en editor de texto)</td></tr>
          <tr><td><code>Ctrl+U</code></td><td>Subrayado (en editor de texto)</td></tr>
        </table>

        <h4>💡 Tips</h4>
        <ul>
          <li>Los cambios se guardan automáticamente en la base de datos</li>
          <li>Puedes ocultar la barra de edición mientras trabajas</li>
          <li>Usa el panel de configuración para cambiar datos de tu cuenta</li>
          <li>Los productos nuevos se sincronizan automáticamente con tu sitio</li>
        </ul>
      </div>
    `;
    document.body.appendChild(panel);
  };

  const showCodeSnippets = () => {
    document.querySelector(".mineiro-panel")?.remove();

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mineiro-clientes.vercel.app';
    const slug = tiendaData?.slug || 'tu-sitio';

    const panel = document.createElement("div");
    panel.className = "mineiro-panel mineiro-snippets-panel";
    panel.style.maxWidth = "900px";
    panel.innerHTML = `
      <div class="mineiro-panel-header">
        <h3>💻 Snippets de Código</h3>
        <button class="mineiro-panel-close" onclick="this.closest('.mineiro-panel').remove()">✕</button>
      </div>
      <div class="mineiro-panel-body">
        <h4>📦 Script Principal</h4>
        <p>Agrega este script antes de cerrar <code>&lt;/body&gt;</code>:</p>
        <div class="mineiro-code-block">
          <button class="mineiro-copy-btn" onclick="copySnippet(this)">📋 Copiar</button>
          <pre>&lt;script src="${baseUrl}/mineiro.js" data-mineiro-site="${slug}"&gt;&lt;/script&gt;</pre>
        </div>

        <h4>🏪 Datos de la Tienda</h4>
        <div class="mineiro-code-block">
          <button class="mineiro-copy-btn" onclick="copySnippet(this)">📋 Copiar</button>
          <pre>&lt;!-- Nombre del negocio --&gt;
&lt;h1 data-mineiro-bind="config-tienda.nombre_tienda"&gt;Mi Negocio&lt;/h1&gt;

&lt;!-- Logo --&gt;
&lt;img data-mineiro-bind="config-tienda.logo_url" src="logo.png" alt="Logo"&gt;</pre>
        </div>

        <h4>🦸 Hero Section</h4>
        <div class="mineiro-code-block">
          <button class="mineiro-copy-btn" onclick="copySnippet(this)">📋 Copiar</button>
          <pre>&lt;section class="hero"&gt;
  &lt;h1 data-mineiro-bind="hero.titulo"&gt;Bienvenidos&lt;/h1&gt;
  &lt;p data-mineiro-bind="hero.subtitulo"&gt;La mejor experiencia&lt;/p&gt;
  &lt;div data-mineiro-bind="hero.imagen_fondo" style="background-image:url('hero.jpg')"&gt;&lt;/div&gt;
&lt;/section&gt;</pre>
        </div>

        <h4>📦 Productos</h4>
        <div class="mineiro-code-block">
          <button class="mineiro-copy-btn" onclick="copySnippet(this)">📋 Copiar</button>
          <pre>&lt;!-- Usa un ID único para cada producto (dom_id en la BD) --&gt;
&lt;div class="product-card"&gt;
  &lt;img data-mineiro-bind="producto-pizza-margherita.imagen_url" src="pizza.jpg"&gt;
  &lt;h3 data-mineiro-bind="producto-pizza-margherita.nombre"&gt;Pizza Margherita&lt;/h3&gt;
  &lt;p data-mineiro-bind="producto-pizza-margherita.descripcion"&gt;Descripción&lt;/p&gt;
  &lt;span data-mineiro-bind="producto-pizza-margherita.precio"&gt;$9.990&lt;/span&gt;
&lt;/div&gt;</pre>
        </div>

        <h4>💬 Testimonios</h4>
        <div class="mineiro-code-block">
          <button class="mineiro-copy-btn" onclick="copySnippet(this)">📋 Copiar</button>
          <pre>&lt;div class="testimonial"&gt;
  &lt;img data-mineiro-bind="testimonio-cliente1.avatar" src="avatar.jpg"&gt;
  &lt;p data-mineiro-bind="testimonio-cliente1.texto"&gt;Excelente servicio&lt;/p&gt;
  &lt;strong data-mineiro-bind="testimonio-cliente1.nombre"&gt;Juan Pérez&lt;/strong&gt;
  &lt;span data-mineiro-bind="testimonio-cliente1.estrellas"&gt;⭐⭐⭐⭐⭐&lt;/span&gt;
&lt;/div&gt;</pre>
        </div>

        <h4>📋 Footer</h4>
        <div class="mineiro-code-block">
          <button class="mineiro-copy-btn" onclick="copySnippet(this)">📋 Copiar</button>
          <pre>&lt;footer&gt;
  &lt;p data-mineiro-bind="footer.descripcion"&gt;Texto del footer&lt;/p&gt;
  &lt;a data-mineiro-bind="footer.telefono" href="tel:+56912345678"&gt;+56 9 1234 5678&lt;/a&gt;
  &lt;a data-mineiro-bind="footer.email" href="mailto:info@ejemplo.com"&gt;info@ejemplo.com&lt;/a&gt;
&lt;/footer&gt;</pre>
        </div>

        <h4>📖 Atributos Disponibles</h4>
        <table class="mineiro-attributes-table">
          <thead>
            <tr><th>Prefijo</th><th>Uso</th><th>Ejemplo</th></tr>
          </thead>
          <tbody>
            <tr><td><code>config-tienda.</code></td><td>Datos de la tienda</td><td><code>config-tienda.nombre_tienda</code></td></tr>
            <tr><td><code>hero.</code></td><td>Sección hero</td><td><code>hero.titulo</code></td></tr>
            <tr><td><code>footer.</code></td><td>Pie de página</td><td><code>footer.telefono</code></td></tr>
            <tr><td><code>producto-{id}.</code></td><td>Producto específico</td><td><code>producto-pizza.nombre</code></td></tr>
            <tr><td><code>testimonio-{id}.</code></td><td>Testimonio específico</td><td><code>testimonio-juan.texto</code></td></tr>
          </tbody>
        </table>
      </div>
    `;
    document.body.appendChild(panel);

    // Función global para copiar
    window.copySnippet = (btn) => {
      const code = btn.nextElementSibling.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = '📋 Copiar', 2000);
      });
    };
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
      .mineiro-restore-btn {
        background: #1e293b;
        border-color: #f59e0b;
        color: #f59e0b;
      }
      .mineiro-restore-btn:hover {
        background: #f59e0b;
        color: #0f172a;
      }
      .mineiro-restore-btn.active {
        background: #f59e0b;
        border-color: #f59e0b;
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
      
      /* Paneles flotantes */
      .mineiro-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 2px solid #475569;
        border-radius: 20px;
        padding: 0;
        max-width: 500px;
        width: 90%;
        max-height: 85vh;
        overflow: hidden;
        box-shadow: 0 25px 80px rgba(0,0,0,0.7);
        z-index: 999999999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .mineiro-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #334155;
        background: #0f172a;
      }
      .mineiro-panel-header h3 {
        margin: 0;
        color: #f1f5f9;
        font-size: 18px;
        font-weight: 600;
      }
      .mineiro-panel-close {
        background: none;
        border: none;
        color: #64748b;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.15s;
      }
      .mineiro-panel-close:hover {
        color: #ef4444;
        background: rgba(239,68,68,0.1);
      }
      .mineiro-panel-body {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(85vh - 80px);
      }
      
      /* Tabs del panel */
      .mineiro-panel-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #334155;
      }
      .mineiro-panel-tab {
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid #475569;
        background: transparent;
        color: #94a3b8;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .mineiro-panel-tab:hover {
        background: #334155;
        color: #e2e8f0;
      }
      .mineiro-panel-tab.active {
        background: linear-gradient(135deg, #06b6d4, #8b5cf6);
        border-color: transparent;
        color: white;
      }
      .mineiro-panel-tab-content {
        display: none;
      }
      .mineiro-panel-tab-content.active {
        display: block;
      }
      
      /* Form groups */
      .mineiro-form-group {
        margin-bottom: 16px;
      }
      .mineiro-form-group label {
        display: block;
        font-size: 12px;
        color: #94a3b8;
        font-weight: 500;
        margin-bottom: 6px;
      }
      .mineiro-form-group input,
      .mineiro-form-group textarea,
      .mineiro-form-group select {
        width: 100%;
        padding: 10px 14px;
        border-radius: 8px;
        border: 2px solid #475569;
        background: #0f172a;
        color: #f1f5f9;
        font-size: 14px;
        transition: border-color 0.2s;
        font-family: inherit;
      }
      .mineiro-form-group input:focus,
      .mineiro-form-group textarea:focus,
      .mineiro-form-group select:focus {
        outline: none;
        border-color: #06b6d4;
      }
      .mineiro-form-group textarea {
        min-height: 80px;
        resize: vertical;
      }
      .mineiro-form-info {
        padding: 12px;
        background: #334155;
        border-radius: 8px;
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 16px;
      }
      
      /* Image drop zone */
      .mineiro-image-drop {
        width: 100%;
        height: 100px;
        border: 2px dashed #475569;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        background: #0f172a;
      }
      .mineiro-image-drop:hover {
        border-color: #06b6d4;
        background: #1e293b;
      }
      .mineiro-image-drop.dragover {
        border-color: #10b981;
        background: rgba(16,185,129,0.1);
      }
      .mineiro-drop-hint {
        color: #64748b;
        font-size: 13px;
        text-align: center;
      }
      
      /* Buttons */
      .mineiro-btn-primary {
        width: 100%;
        padding: 12px 20px;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg, #06b6d4, #8b5cf6);
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .mineiro-btn-primary:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      .mineiro-btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .mineiro-btn-secondary {
        width: 100%;
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid #475569;
        background: #334155;
        color: #e2e8f0;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .mineiro-btn-secondary:hover {
        background: #475569;
      }
      .mineiro-btn-link {
        background: none;
        border: none;
        color: #06b6d4;
        font-size: 13px;
        cursor: pointer;
        text-decoration: underline;
        padding: 8px 0;
        width: 100%;
        text-align: center;
      }
      .mineiro-btn-link:hover {
        color: #22d3ee;
      }
      
      /* Tags */
      .mineiro-tag {
        display: inline-block;
        padding: 4px 10px;
        background: #334155;
        border-radius: 6px;
        font-size: 12px;
        color: #e2e8f0;
        margin: 2px;
      }
      
      /* Settings sections */
      .mineiro-settings-section {
        padding: 16px 0;
        border-bottom: 1px solid #334155;
      }
      .mineiro-settings-section:last-child {
        border-bottom: none;
      }
      .mineiro-settings-section h4 {
        margin: 0 0 12px 0;
        color: #f1f5f9;
        font-size: 14px;
        font-weight: 600;
      }
      .mineiro-password-field {
        position: relative;
      }
      .mineiro-password-field input {
        padding-right: 50px;
      }
      .mineiro-toggle-password {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        font-size: 16px;
      }
      
      /* Manual content */
      .mineiro-manual-content {
        font-size: 14px;
        color: #e2e8f0;
        line-height: 1.6;
      }
      .mineiro-manual-content h4 {
        color: #06b6d4;
        margin: 20px 0 10px;
        font-size: 16px;
      }
      .mineiro-manual-content h4:first-child {
        margin-top: 0;
      }
      .mineiro-manual-content ul, .mineiro-manual-content ol {
        padding-left: 20px;
        margin: 10px 0;
      }
      .mineiro-manual-content li {
        margin: 6px 0;
      }
      .mineiro-manual-content code {
        background: #334155;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        color: #f59e0b;
      }
      .mineiro-shortcuts-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
      }
      .mineiro-shortcuts-table td {
        padding: 8px 12px;
        border-bottom: 1px solid #334155;
      }
      .mineiro-shortcuts-table td:first-child {
        width: 120px;
      }
      
      /* Code snippets */
      .mineiro-code-block {
        position: relative;
        background: #0f172a;
        border-radius: 10px;
        margin: 10px 0;
        overflow: hidden;
      }
      .mineiro-code-block pre {
        padding: 16px;
        margin: 0;
        font-size: 12px;
        color: #e2e8f0;
        overflow-x: auto;
        white-space: pre-wrap;
        font-family: 'Fira Code', 'Monaco', monospace;
      }
      .mineiro-copy-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 6px 12px;
        background: #334155;
        border: none;
        border-radius: 6px;
        color: #e2e8f0;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .mineiro-copy-btn:hover {
        background: #06b6d4;
      }
      .mineiro-attributes-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 12px;
      }
      .mineiro-attributes-table th,
      .mineiro-attributes-table td {
        padding: 10px;
        border: 1px solid #334155;
        text-align: left;
      }
      .mineiro-attributes-table th {
        background: #334155;
        color: #e2e8f0;
      }
      .mineiro-attributes-table code {
        background: #0f172a;
        padding: 2px 6px;
        border-radius: 4px;
        color: #06b6d4;
      }
      
      /* Category Add Product Buttons */
      .mineiro-category-add-btn {
        position: absolute;
        bottom: 10px;
        right: 10px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #06b6d4, #0891b2);
        border: 2px solid rgba(255,255,255,0.2);
        color: white;
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4);
        transition: all 0.2s ease;
        z-index: 100;
        opacity: 0;
        transform: scale(0.8);
      }
      .mineiro-section-wrapper:hover .mineiro-category-add-btn,
      [data-mineiro-section]:hover .mineiro-category-add-btn {
        opacity: 1;
        transform: scale(1);
      }
      .mineiro-category-add-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(6, 182, 212, 0.6);
      }
      .mineiro-section-wrapper {
        position: relative;
      }
      .mineiro-section-highlight {
        outline: 2px dashed rgba(6, 182, 212, 0.5);
        outline-offset: 4px;
      }
      
      /* Navigation hint tooltip */
      .mineiro-nav-hint {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: #f1f5f9;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 100002;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        border: 1px solid #334155;
        margin-bottom: 8px;
        animation: mineiroFadeIn 0.2s ease;
      }
      .mineiro-nav-hint::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #1e293b;
      }
      .mineiro-nav-hint kbd {
        background: #334155;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        margin: 0 2px;
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
        <div class="mineiro-admin-hint">Click para editar | Doble-click en enlaces para navegar</div>
        <button class="mineiro-admin-btn mineiro-admin-btn-warning" id="mineiro-undo-btn" style="display:none">
          ↩️ Deshacer
        </button>
      </div>
      <div class="mineiro-admin-actions">
        <button class="mineiro-admin-btn mineiro-admin-btn-success" id="mineiro-add-btn" title="Añadir contenido">
          ➕ Añadir
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" id="mineiro-hide-bar-btn" title="Ocultar barra">
          👁️ Ocultar
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" onclick="window.MineiroAdmin.openDashboard()">
          📊 Panel
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" id="mineiro-settings-btn" title="Configuración">
          ⚙️
        </button>
        <button class="mineiro-admin-btn" id="mineiro-reset-btn" title="Limpiar todos los cambios guardados" style="background:#dc2626">
          🗑️ Reset
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-primary" onclick="window.MineiroAdmin.exitToPanel()">
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
    document.getElementById("mineiro-add-btn").onclick = showAddContentPanel;
    document.getElementById("mineiro-settings-btn").onclick = showSettingsPanel;
    document.getElementById("mineiro-reset-btn").onclick = () => {
      if (confirm('⚠️ ¿Estás seguro de que quieres borrar TODOS los cambios guardados?\n\nEsto eliminará:\n- Cambios de precios\n- Cambios de texto\n- Cualquier edición guardada\n\nLa página mostrará los valores originales del HTML.')) {
        clearAllMineiroData();
      }
    };

    // Add DOUBLE-click listener for editing (single click = normal navigation)
    document.addEventListener("dblclick", handleAdminDoubleClick, true);
    
    // Single click solo para resaltar elementos editables
    document.addEventListener("click", handleAdminSingleClick, true);

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcuts);
    
    // Agregar botones "+" a las secciones de categorías para añadir productos
    addCategoryAddButtons();

    log("Modo admin activado - DOBLE-CLICK para editar, click normal para navegar");
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
    document.removeEventListener("dblclick", handleAdminDoubleClick, true);
    document.removeEventListener("click", handleAdminSingleClick, true);
    document.removeEventListener("keydown", handleKeyboardShortcuts);
    
    // Remover botones de agregar producto de categorías
    document.querySelectorAll(".mineiro-category-add-btn").forEach(btn => btn.remove());

    if (selectedElement) {
      selectedElement.classList.remove("mineiro-selected");
      selectedElement = null;
    }

    log("Modo admin desactivado");
  };

  // Agregar botones "+" a las secciones de categorías para añadir productos
  const addCategoryAddButtons = () => {
    // Buscar contenedores de sección con data-mineiro-section
    const sectionContainers = document.querySelectorAll('[data-mineiro-section]');
    
    sectionContainers.forEach(container => {
      // No agregar si ya tiene un botón
      if (container.querySelector('.mineiro-category-add-btn')) return;
      
      const sectionName = container.dataset.mineiroSection;
      if (!sectionName) return;
      
      // Asegurar que el contenedor tenga position relative
      const computedPosition = window.getComputedStyle(container).position;
      if (computedPosition === 'static') {
        container.style.position = 'relative';
      }
      
      // Crear botón de agregar
      const addBtn = document.createElement('button');
      addBtn.className = 'mineiro-category-add-btn';
      addBtn.innerHTML = '+';
      addBtn.title = `Agregar producto a "${sectionName}"`;
      addBtn.dataset.categorySlug = sectionName;
      
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showQuickAddProductModal(sectionName);
      });
      
      container.appendChild(addBtn);
      log(`Botón "+" agregado a sección: ${sectionName}`);
    });
    
    // También buscar contenedores con data-mineiro-category
    const categoryContainers = document.querySelectorAll('[data-mineiro-category], [data-mineiro-categoria]');
    
    categoryContainers.forEach(container => {
      if (container.querySelector('.mineiro-category-add-btn')) return;
      
      const categoryName = container.dataset.mineiroCategory || container.dataset.mineiroCategoria;
      if (!categoryName) return;
      
      const computedPosition = window.getComputedStyle(container).position;
      if (computedPosition === 'static') {
        container.style.position = 'relative';
      }
      
      const addBtn = document.createElement('button');
      addBtn.className = 'mineiro-category-add-btn';
      addBtn.innerHTML = '+';
      addBtn.title = `Agregar producto a "${categoryName}"`;
      addBtn.dataset.categorySlug = categoryName;
      
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showQuickAddProductModal(categoryName);
      });
      
      container.appendChild(addBtn);
    });
  };

  // Modal rápido para agregar producto a una categoría específica
  const showQuickAddProductModal = (categorySlug) => {
    // Remover modal anterior si existe
    document.querySelector('.mineiro-quick-add-modal')?.remove();
    
    const categoryTitle = categorySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const modal = document.createElement('div');
    modal.className = 'mineiro-quick-add-modal mineiro-edit-popup';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;max-width:90vw;z-index:100001';
    
    modal.innerHTML = `
      <h3>
        ➕ Nuevo producto en "${categoryTitle}"
        <button type="button" class="close-btn" id="quick-add-close">&times;</button>
      </h3>
      
      <label>Nombre del producto *</label>
      <input type="text" id="quick-add-nombre" placeholder="Ej: Pizza Margherita" />
      
      <label>Precio *</label>
      <input type="number" id="quick-add-precio" placeholder="5000" step="100" />
      
      <label>Descripción (opcional)</label>
      <textarea id="quick-add-descripcion" placeholder="Descripción del producto..." style="min-height:60px"></textarea>
      
      <label>Imagen (opcional)</label>
      <div class="mineiro-image-preview" id="quick-add-image-drop" style="height:100px">
        <div class="upload-hint">📷 Clic o arrastra imagen</div>
      </div>
      <input type="file" accept="image/*" id="quick-add-file" style="display:none" />
      <input type="hidden" id="quick-add-imagen-url" />
      
      <div class="mineiro-edit-actions" style="margin-top:16px">
        <button type="button" class="mineiro-admin-btn mineiro-admin-btn-secondary" id="quick-add-cancel" style="flex:1">
          Cancelar
        </button>
        <button type="button" class="mineiro-admin-btn mineiro-admin-btn-success" id="quick-add-save" style="flex:1">
          💾 Crear Producto
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const closeModal = () => modal.remove();
    
    document.getElementById('quick-add-close').onclick = closeModal;
    document.getElementById('quick-add-cancel').onclick = closeModal;
    
    // Image handling
    const imageDrop = document.getElementById('quick-add-image-drop');
    const fileInput = document.getElementById('quick-add-file');
    const imageUrlInput = document.getElementById('quick-add-imagen-url');
    
    imageDrop.onclick = () => fileInput.click();
    imageDrop.ondragover = (e) => { e.preventDefault(); imageDrop.classList.add('dragover'); };
    imageDrop.ondragleave = () => imageDrop.classList.remove('dragover');
    imageDrop.ondrop = async (e) => {
      e.preventDefault();
      imageDrop.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        await handleQuickAddImage(file, imageDrop, imageUrlInput);
      }
    };
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleQuickAddImage(file, imageDrop, imageUrlInput);
      }
    };
    
    // Save product
    document.getElementById('quick-add-save').onclick = async () => {
      const nombre = document.getElementById('quick-add-nombre').value.trim();
      const precioRaw = parseFloat(document.getElementById('quick-add-precio').value) || 0;
      const descripcion = document.getElementById('quick-add-descripcion').value.trim();
      const imagenUrl = imageUrlInput.value;
      
      // Validar precio máximo (límite de INTEGER en PostgreSQL)
      const MAX_PRECIO = 2147483647;
      const precio = Math.min(Math.floor(precioRaw), MAX_PRECIO);
      
      if (precioRaw > MAX_PRECIO) {
        alert(`El precio es demasiado grande. Máximo permitido: $${MAX_PRECIO.toLocaleString()}`);
        return;
      }
      
      if (!nombre) {
        alert('El nombre es requerido');
        return;
      }
      if (!precio || precio <= 0) {
        alert('El precio es requerido y debe ser mayor a 0');
        return;
      }
      
      const saveBtn = document.getElementById('quick-add-save');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="mineiro-spinner"></span> Guardando...';
      
      try {
        const domId = nombre.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        const productoData = {
          tienda_id: tiendaData?.id,
          dom_id: domId,
          nombre,
          precio,
          descripcion: descripcion || null,
          imagen_url: imagenUrl || null,
          categoria: categorySlug,
          activo: true,
          user_id: tiendaData?.user_id || null
        };
        
        const response = await fetch(EDIT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'insert',
            table: 'productos',
            data: productoData
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          const newProduct = result.data || { ...productoData, id: crypto.randomUUID() };
          productosCache.push(newProduct);
          
          // Renderizar el producto en su contenedor
          tryRenderNewProduct(newProduct);
          
          saveBtn.innerHTML = '✅ ¡Creado!';
          saveBtn.style.background = '#22c55e';
          
          setTimeout(closeModal, 1000);
          log(`✓ Producto "${nombre}" creado en categoría "${categorySlug}"`);
        } else {
          throw new Error(result.error || 'Error al crear producto');
        }
      } catch (err) {
        warn('Error al crear producto:', err.message);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Crear Producto';
        alert('Error: ' + err.message);
      }
    };
    
    // Focus en nombre
    document.getElementById('quick-add-nombre').focus();
  };

  // Manejar imagen en modal rápido
  const handleQuickAddImage = async (file, previewContainer, urlInput) => {
    previewContainer.innerHTML = '<div class="upload-hint"><div class="mineiro-spinner"></div> Subiendo...</div>';
    
    try {
      const imageUrl = await uploadImageToStorage(file);
      previewContainer.innerHTML = `<img src="${imageUrl}" alt="Preview" style="max-height:100%;max-width:100%;object-fit:contain" />`;
      urlInput.value = imageUrl;
    } catch (err) {
      // Fallback a base64
      try {
        const base64 = await fileToBase64(file);
        previewContainer.innerHTML = `<img src="${base64}" alt="Preview" style="max-height:100%;max-width:100%;object-fit:contain" />`;
        urlInput.value = base64;
      } catch (err2) {
        previewContainer.innerHTML = '<div class="upload-hint">❌ Error al cargar imagen</div>';
      }
    }
  };

  // SINGLE CLICK - Para elementos que NO son enlaces ni botones de navegación: abre editor
  // Para enlaces y botones de navegación: SIEMPRE ejecuta su función normal (no se bloquea)
  const handleAdminSingleClick = (e) => {
    // Ignorar clics en popup o barra de admin
    if (e.target.closest(".mineiro-edit-popup, .mineiro-admin-bar, .mineiro-show-bar-btn, .mineiro-category-add-btn, .mineiro-quick-add-modal, .mineiro-panel")) {
      return;
    }

    const el = e.target.closest("[data-mineiro-bind]");
    if (!el) {
      // Clic fuera - cerrar popup y quitar selección
      document.querySelector(".mineiro-edit-popup")?.remove();
      if (selectedElement) {
        selectedElement.classList.remove("mineiro-selected");
        selectedElement = null;
      }
      return;
    }

    // 🔗 DETECTAR SI ES ENLACE O ESTÁ DENTRO DE UN ENLACE
    const linkAncestor = el.closest('a');
    const isLink = el.tagName.toLowerCase() === 'a';
    const isInsideLink = linkAncestor !== null;
    
    // 🔘 DETECTAR SI ES BOTÓN DE NAVEGACIÓN/FILTRADO
    const tagName = el.tagName.toLowerCase();
    const isButton = tagName === 'button';
    const isInsideButton = el.closest('button') !== null;
    const isNavElement = el.closest('nav, [role="navigation"], [role="tablist"], .nav, .navigation, .tabs, .category-tabs, .filter-tabs') !== null;
    const hasOnClick = el.hasAttribute('onclick') || el.closest('[onclick]') !== null;
    const isInteractiveButton = (isButton || isInsideButton) && (isNavElement || hasOnClick || 
      el.closest('[data-filter], [data-category], [data-tab], [data-producto-id]') !== null);
    
    // Si es un enlace, botón de navegación, o elemento interactivo: NO BLOQUEAR
    if (isLink || isInsideLink || isInteractiveButton) {
      log(`🖱️ Click en elemento interactivo: ${el.dataset.mineiroBind} → Ejecutando acción normal (doble-click para editar)`);
      // NO hacer nada - dejar que ejecute su función normal
      return;
    }

    // Para TODO lo demás (precios, títulos, textos, imágenes): ABRIR EDITOR
    e.preventDefault();
    e.stopPropagation();

    if (selectedElement && selectedElement !== el) {
      selectedElement.classList.remove("mineiro-selected");
    }
    selectedElement = el;
    el.classList.add("mineiro-selected");

    saveComputedStyles(el);
    showEditPopup(el);
    log(`🖱️ Click en elemento: ${el.dataset.mineiroBind} → Abriendo editor`);
  };

  // DOUBLE CLICK - Para editar enlaces, botones de navegación y elementos interactivos
  const handleAdminDoubleClick = (e) => {
    // Ignorar clics en popup o barra de admin
    if (e.target.closest(".mineiro-edit-popup, .mineiro-admin-bar, .mineiro-show-bar-btn, .mineiro-category-add-btn, .mineiro-quick-add-modal, .mineiro-panel")) {
      return;
    }

    const el = e.target.closest("[data-mineiro-bind]");
    if (!el) return;

    // 🔗 DETECTAR SI ES ENLACE O BOTÓN
    const linkAncestor = el.closest('a');
    const isLink = el.tagName.toLowerCase() === 'a';
    const isInsideLink = linkAncestor !== null;
    const tagName = el.tagName.toLowerCase();
    const isButton = tagName === 'button';
    const isInsideButton = el.closest('button') !== null;
    const isInteractive = isLink || isInsideLink || isButton || isInsideButton;
    
    // Doble-click funciona para enlaces y botones (para editar su texto)
    if (!isInteractive) {
      // Para no-interactivos, el single-click ya abrió el editor
      return;
    }

    // Solo permitir editar si el binding es para el nombre/texto, NO para URL
    const binding = el.dataset.mineiroBind || '';
    const isNameBinding = binding.includes('.nombre') || binding.includes('.titulo') || 
                          binding.includes('.text') || binding.includes('.label') ||
                          !binding.includes('.url') && !binding.includes('.href') && !binding.includes('.link');
    
    if (!isNameBinding) {
      log(`⚠️ Doble-click en elemento interactivo pero binding es URL, ignorando: ${binding}`);
      return;
    }

    // Doble-click en elemento interactivo: abrir editor
    e.preventDefault();
    e.stopPropagation();

    if (selectedElement && selectedElement !== el) {
      selectedElement.classList.remove("mineiro-selected");
    }
    selectedElement = el;
    el.classList.add("mineiro-selected");

    saveComputedStyles(el);
    showEditPopup(el);
    log(`✏️ Doble-click: Editando elemento interactivo: ${binding}`);
  };

  // Hint para enlaces (doble-click para editar)
  const showLinkEditHint = (el) => {
    document.querySelectorAll('.mineiro-nav-hint').forEach(h => h.remove());
    
    const hint = document.createElement('div');
    hint.className = 'mineiro-nav-hint';
    hint.innerHTML = `Click = navegar | <strong>Doble-click</strong> = editar`;
    hint.style.cssText = 'position:fixed;z-index:100003;pointer-events:none;';
    
    const rect = el.getBoundingClientRect();
    hint.style.top = `${Math.max(10, rect.top - 40)}px`;
    hint.style.left = `${rect.left + rect.width/2}px`;
    hint.style.transform = 'translateX(-50%)';
    
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 2500);
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
    
    // Obtener imagen original del código HTML
    const originalImageData = htmlOriginalDelCodigo.get(el);
    const originalImageSrc = originalImageData?.src || originalImageData?.backgroundImage?.replace(/url\(['"]?(.+?)['"]?\)/i, "$1") || null;
    
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
        ${originalImageSrc && originalImageSrc !== currentValue ? `
          <button type="button" class="mineiro-admin-btn mineiro-restore-original-btn" id="mineiro-restore-image-btn" style="margin-top:10px;width:100%">
            🔄 Restaurar imagen original
          </button>
          <div style="margin-top:8px;padding:8px;background:#1e293b;border-radius:6px;font-size:11px;color:#94a3b8">
            <strong>Original:</strong><br>
            <img src="${originalImageSrc}" style="max-width:100%;max-height:60px;margin-top:4px;border-radius:4px;opacity:0.7" />
          </div>
        ` : ''}
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
          <span class="mineiro-format-separator"></span>
          <button type="button" class="mineiro-format-btn mineiro-restore-btn" data-command="restore" title="Restaurar original">🔄</button>
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
          <button type="button" class="mineiro-format-btn" data-command="bold" title="Negrita (Ctrl+B)"><b>B</b></button>
          <button type="button" class="mineiro-format-btn" data-command="italic" title="Cursiva (Ctrl+I)"><i>I</i></button>
          <button type="button" class="mineiro-format-btn" data-command="underline" title="Subrayado (Ctrl+U)"><u>U</u></button>
          <button type="button" class="mineiro-format-btn" data-command="strikeThrough" title="Tachado"><s>S</s></button>
          <span class="mineiro-format-separator"></span>
          <input type="color" class="mineiro-color-picker" id="mineiro-text-color" value="#ffffff" title="Color de texto">
          <span class="mineiro-format-separator"></span>
          <button type="button" class="mineiro-format-btn mineiro-restore-btn" data-command="restore" title="Restaurar original">🔄</button>
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
      // Botón para restaurar imagen original
      const restoreImageBtn = document.getElementById("mineiro-restore-image-btn");
      if (restoreImageBtn && originalImageSrc) {
        restoreImageBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          input.value = originalImageSrc;
          if (imageDrop) {
            imageDrop.innerHTML = `<img src="${originalImageSrc}" alt="Preview" />`;
          }
          log("✓ Imagen restaurada al original del código HTML");
        });
      }
      
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

    // Variable para rastrear si se quiere restaurar original
    let restoreOriginal = false;

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
        // Si el usuario edita, desactivar restaurar original
        restoreOriginal = false;
        const restoreBtn = popup.querySelector('[data-command="restore"]');
        if (restoreBtn) restoreBtn.classList.remove('active');
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
          
          // Comando especial: restaurar original
          if (command === 'restore') {
            const codeOriginal = htmlOriginalDelCodigo.get(el);
            if (codeOriginal) {
              richEditor.innerHTML = codeOriginal.innerHTML;
              if (input) input.value = codeOriginal.textContent;
              restoreOriginal = true;
              btn.classList.add('active');
              log("Contenido restaurado al original del código HTML");
            }
            return;
          }
          
          // Desactivar restaurar si se aplica formato
          restoreOriginal = false;
          const restoreBtn = popup.querySelector('[data-command="restore"]');
          if (restoreBtn) restoreBtn.classList.remove('active');
          
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
      
      // Detectar estado inicial de formato
      richEditor.addEventListener("focus", updateFormatButtonStates);
      richEditor.addEventListener("keyup", updateFormatButtonStates);
      richEditor.addEventListener("mouseup", updateFormatButtonStates);
      
      function updateFormatButtonStates() {
        formatButtons.forEach(btn => {
          const command = btn.dataset.command;
          if (['bold', 'italic', 'underline', 'strikeThrough'].includes(command)) {
            const isActive = document.queryCommandState(command);
            btn.classList.toggle('active', isActive);
          }
        });
      }
      
      // Selector de tamaño de fuente
      if (fontSizeSelect) {
        fontSizeSelect.addEventListener("change", (e) => {
          e.stopPropagation();
          restoreOriginal = false;
          const restoreBtn = popup.querySelector('[data-command="restore"]');
          if (restoreBtn) restoreBtn.classList.remove('active');
          richEditor.focus();
          document.execCommand('fontSize', false, e.target.value);
        });
      }
      
      // Selector de color
      if (textColorPicker) {
        textColorPicker.addEventListener("input", (e) => {
          e.stopPropagation();
          restoreOriginal = false;
          const restoreBtn = popup.querySelector('[data-command="restore"]');
          if (restoreBtn) restoreBtn.classList.remove('active');
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
              restoreOriginal = false;
              break;
            case 'i':
              e.preventDefault();
              document.execCommand('italic', false, null);
              restoreOriginal = false;
              break;
            case 'u':
              e.preventDefault();
              document.execCommand('underline', false, null);
              restoreOriginal = false;
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
      const selectedStyle = restoreOriginal ? "original" : "edited";
      await saveElementChange(el, parsed || { type: 'generic', field: binding }, isImage, isPrice, selectedStyle, binding, richEditor ? richEditor.innerHTML : null);
    });

    // Enter para guardar (excepto textarea y editor enriquecido)
    if (!isLongText && !richEditor) {
      input?.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const selectedStyle = restoreOriginal ? "original" : "edited";
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
        // Restaurar completamente al estado original del código HTML (ANTES de hidratación)
        restoreToCodeOriginal(el);
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
        // 🔍 BÚSQUEDA MEJORADA DE PRODUCTO
        log(`🔍 Buscando producto para: ${parsed.identifier}`);
        log(`   Productos en cache: ${productosCache.length}`);
        
        // Estrategia 1: Por dom_id exacto
        let producto = productosCache.find(p => p.dom_id === parsed.identifier);
        if (producto) log(`   ✓ Encontrado por dom_id: ${producto.id} (${producto.nombre})`);
        
        // Estrategia 2: Por ID directo
        if (!producto) {
          producto = productosCache.find(p => String(p.id) === parsed.identifier);
          if (producto) log(`   ✓ Encontrado por id: ${producto.id} (${producto.nombre})`);
        }
        
        // Estrategia 3: Por nombre normalizado del binding
        if (!producto && parsed.identifier) {
          const searchName = parsed.identifier.replace(/-/g, ' ').toLowerCase().trim();
          producto = productosCache.find(p => {
            const pNombre = p.nombre?.toLowerCase().trim() || '';
            const pDomId = (p.dom_id || '').toLowerCase().replace(/-/g, ' ').trim();
            return pNombre === searchName || pDomId === searchName ||
                   pNombre.includes(searchName) || searchName.includes(pNombre);
          });
          if (producto) log(`   ✓ Encontrado por nombre: ${producto.id} (${producto.nombre})`);
        }
        
        // Estrategia 4: Buscar en el contexto del DOM
        if (!producto && el) {
          const container = el.closest('[data-mineiro-bind*="producto-"]') 
                         || el.closest('.product-card, .producto, [class*="product"], [class*="producto"], [class*="menu-item"], [class*="item"]')
                         || el.parentElement?.parentElement;
          
          if (container) {
            // Buscar el nombre del producto en el contenedor
            const nombreEl = container.querySelector('[data-mineiro-bind*=".nombre"]')
                          || container.querySelector('h1, h2, h3, h4, h5, .product-name, .nombre-producto, .item-name');
            
            if (nombreEl) {
              const nombreTexto = nombreEl.textContent?.trim().toLowerCase();
              if (nombreTexto) {
                producto = productosCache.find(p => {
                  const pNombre = p.nombre?.toLowerCase().trim() || '';
                  return pNombre === nombreTexto || 
                         pNombre.includes(nombreTexto) || 
                         nombreTexto.includes(pNombre);
                });
                if (producto) log(`   ✓ Encontrado por DOM: ${producto.id} (${producto.nombre})`);
              }
            }
            
            // Buscar otros bindings en el contenedor que puedan indicar el producto
            if (!producto) {
              const otherBindings = container.querySelectorAll('[data-mineiro-bind*="producto-"]');
              otherBindings.forEach(otherEl => {
                if (producto) return;
                const otherBinding = otherEl.dataset.mineiroBind;
                const otherParsed = parseBinding(otherBinding);
                if (otherParsed?.identifier) {
                  producto = productosCache.find(p => p.dom_id === otherParsed.identifier);
                  if (producto) log(`   ✓ Encontrado por binding hermano: ${producto.id}`);
                }
              });
            }
          }
        }
        
        // Estrategia 5: Fallback a site_config si el producto no existe en BD
        // IMPORTANTE: Esto permite editar productos que están en el HTML pero no en la base de datos
        if (!producto) {
          if (!tiendaData || !tiendaData.id) {
            throw new Error("Tienda no configurada");
          }
          
          log(`   ⚠️ Producto "${parsed.identifier}" no encontrado en BD, guardando en site_config`);
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

        // Validar que el producto tenga un ID válido
        if (!producto.id) {
          throw new Error(`Producto encontrado pero sin ID válido: ${producto.nombre}`);
        }

        const updateData = {};
        
        // 🎯 Manejar campos de precio con tamaño (precio.fam, precio.ind, precio.xl)
        if (parsed.field.startsWith("precio.")) {
          const tamano = parsed.field.split(".")[1]; // "fam", "ind", "xl"
          
          // Opción 1: Guardar en configuracion.precios.{tamano}
          const config = JSON.parse(JSON.stringify(producto.configuracion || {}));
          if (!config.precios) config.precios = {};
          config.precios[tamano] = value;
          
          // También actualizar variantes si existen
          if (config.variantes) {
            const varianteIdx = config.variantes.findIndex(v => 
              v.nombre?.toLowerCase().includes(tamano) || 
              v.id === tamano ||
              v.tipo === tamano
            );
            if (varianteIdx >= 0) {
              config.variantes[varianteIdx].precio = value;
            }
          }
          
          updateData.configuracion = config;
          
          // Si es el precio del tamaño principal (fam suele ser el default), actualizar también precio base
          if (tamano === 'fam' || tamano === 'familiar') {
            updateData.precio = value;
          }
          
          log(`   📤 Guardando precio ${tamano}: ${value} en producto ${producto.id}`);
        } else if (parsed.field.includes(".")) {
          const topField = parsed.field.split(".")[0];
          const rest = parsed.field.split(".").slice(1).join(".");
          const currentFieldValue = JSON.parse(JSON.stringify(producto[topField] || {}));
          setNestedValue(currentFieldValue, rest, value);
          updateData[topField] = currentFieldValue;
        } else {
          updateData[parsed.field] = value;
        }

        log(`   📤 Guardando: producto.${parsed.field} = ${value} (ID: ${producto.id})`);

        apiPayload = {
          action: "update",
          table: "productos",
          data: updateData,
          where: { id: producto.id }
        };

        // Actualizar cache local
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

    // SI el usuario eligió "original", usar el valor original del código HTML
    const codeOriginal = htmlOriginalDelCodigo.get(el);
    let value, plainTextValue, valueForAPI;
    
    if (selectedStyle === "original" && codeOriginal) {
      // Usar el contenido original del código HTML
      value = codeOriginal.innerHTML;
      plainTextValue = codeOriginal.textContent;
      // Para restaurar: guardar el HTML original si tiene formato, sino texto plano
      const hasHTMLInOriginal = value !== plainTextValue && (
        value.includes('<') && value.includes('>')
      );
      valueForAPI = hasHTMLInOriginal ? value : plainTextValue;
      log("Guardando valor ORIGINAL del código HTML:", valueForAPI);
    } else {
      // Obtener valor del editor: priorizar HTML enriquecido si existe
      value = richHTML || (richEditor ? richEditor.innerHTML : input?.value);
      plainTextValue = richEditor ? richEditor.textContent : input?.value;
      
      // Determinar si hay formato HTML (estilos individuales como <b>, <i>, etc.)
      const hasHTMLFormatting = richEditor && value !== plainTextValue && (
        value.includes('<b>') || value.includes('<strong>') ||
        value.includes('<i>') || value.includes('<em>') ||
        value.includes('<u>') || value.includes('<s>') ||
        value.includes('<span') || value.includes('<font')
      );
      
      // Para guardar en BD: usar HTML si tiene formato, texto plano si no
      valueForAPI = hasHTMLFormatting ? value : plainTextValue;
    }
    
    if (isPrice) {
      value = parseFloat(plainTextValue) || 0;
      valueForAPI = value;
      plainTextValue = value;
    }

    // Guardar valor original para historial (usar el valor actual del elemento)
    const oldValue = isImage 
      ? (el.tagName.toLowerCase() === "img" ? el.src : el.style.backgroundImage)
      : el.innerHTML || el.textContent?.trim();
    const oldTextContent = el.textContent?.trim();
    
    // Si el usuario guarda, quitar de elementos preservados para permitir futuras hidrataciones
    preservedOriginalElements.delete(el);
    delete el.dataset.mineiroPreserved;

    saveBtn.innerHTML = `<div class="mineiro-spinner"></div> Guardando...`;
    saveBtn.disabled = true;

    try {
      // Guardar a la API (con HTML si tiene formato, texto plano si no)
      await saveToAPI(parsed, valueForAPI, el);

      // Aplicar valor al elemento
      if (selectedStyle === "original" && codeOriginal) {
        // Restaurar completamente al original del código
        el.innerHTML = codeOriginal.innerHTML;
        if (codeOriginal.styleAttribute) {
          el.setAttribute('style', codeOriginal.styleAttribute);
        } else {
          el.removeAttribute('style');
        }
        // Limpiar estilo personalizado
        delete el.dataset.mineiroStyle;
      } else if (richHTML || richEditor) {
        // Si hay contenido HTML enriquecido, aplicarlo directamente
        el.innerHTML = value;
      } else {
        // Aplicar valor normal
        applyValueToElement(el, value, parsed.field);
      }
      
      // 🔄 SINCRONIZAR TODOS LOS ELEMENTOS CON EL MISMO BINDING
      const currentBinding = binding || el.dataset.mineiroBind;
      
      // 🔐 REGISTRAR EDICIÓN LOCAL PARA PROTEGER DEL POLLING
      if (currentBinding) {
        localEdits.set(currentBinding, {
          value: valueForAPI,
          timestamp: Date.now()
        });
        log(`🔐 Edición local registrada: ${currentBinding} (protegida por 30s)`);
      }
      
      if (currentBinding) {
        document.querySelectorAll(`[data-mineiro-bind="${currentBinding}"]`).forEach(otherEl => {
          if (otherEl !== el) {
            // Aplicar el mismo valor a elementos duplicados
            if (selectedStyle === "original" && htmlOriginalDelCodigo.get(otherEl)) {
              const otherOriginal = htmlOriginalDelCodigo.get(otherEl);
              otherEl.innerHTML = otherOriginal.innerHTML;
            } else if (richHTML || richEditor) {
              otherEl.innerHTML = value;
            } else {
              applyValueToElement(otherEl, value, parsed.field);
            }
            // Remover de preservados para que se sincronice bien
            preservedOriginalElements.delete(otherEl);
            delete otherEl.dataset.mineiroPreserved;
            log(`✓ Sincronizado elemento duplicado: ${currentBinding}`);
          }
        });
        
        // Remover este binding de los preservados en localStorage
        removeFromPreserved(currentBinding);
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
      
      // Registrar cambio en tabla elements para historial del dashboard
      const changeType = isImage ? 'image' : (el.tagName.toLowerCase() === 'a' ? 'link' : 'text');
      const elementName = parsed.field || binding;
      await registerElementChange(
        binding || el.dataset.mineiroBind,
        `${parsed.type}-${parsed.identifier || parsed.domId || parsed.field}`,
        changeType,
        elementName,
        oldTextContent || oldValue,
        plainTextValue || valueForAPI
      );

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
     AUTOMATIC SECTION DETECTION - Detecta categorías automáticamente
     ───────────────────────────────────────────────────────────────────────── */

  function detectProductSections() {
    const sections = new Map(); // categoria -> {count, headings, elements}
    
    // Palabras clave comunes para secciones de productos
    const categoryKeywords = [
      'pizza', 'bebida', 'comida', 'postre', 'entrada', 'plato principal',
      'ensalada', 'sandwich', 'burger', 'snack', 'bebidas', 'bebida caliente',
      'jugo', 'vino', 'cerveza', 'licor', 'agua', 'refrescos',
      'categoria', 'tipo', 'sección', 'grupo', 'clase'
    ];

    // 1. Buscar headings (h1-h3) que contengan palabras clave
    document.querySelectorAll('h1, h2, h3, h4').forEach(heading => {
      const text = heading.textContent?.toLowerCase() || '';
      for (const keyword of categoryKeywords) {
        if (text.includes(keyword)) {
          const cleanText = heading.textContent?.trim() || 'Sin nombre';
          if (!sections.has(cleanText)) {
            sections.set(cleanText, {
              count: 0,
              elements: [],
              detected_from: 'heading'
            });
          }
          break;
        }
      }
    });

    // 2. Analizar estructura de elementos repetidos (probable grid/lista de productos)
    const potentialProductContainers = document.querySelectorAll(
      '[class*="product"], [class*="card"], [class*="item"], [class*="box"], [data-mineiro-bind*="producto"]'
    );

    // Agrupar por contenedor padre común
    const containerGroups = new Map();
    potentialProductContainers.forEach(el => {
      const parent = el.closest('[class*="container"], [class*="grid"], [class*="section"], main, section, article');
      if (parent) {
        const parentKey = parent.className || parent.tagName;
        if (!containerGroups.has(parentKey)) {
          containerGroups.set(parentKey, []);
        }
        containerGroups.get(parentKey).push(el);
      }
    });

    // 3. Si no hay secciones detectadas pero hay múltiples productos, crear categoría genérica
    if (sections.size === 0 && potentialProductContainers.length > 0) {
      sections.set('Productos', {
        count: potentialProductContainers.length,
        elements: Array.from(potentialProductContainers),
        detected_from: 'auto'
      });
    }

    log(`Secciones detectadas: ${sections.size}`, Array.from(sections.keys()));
    return sections;
  }

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
    exitToPanel: () => {
      // Deshabilitar modo admin y redirigir al panel
      disableAdminMode();
      window.location.href = "https://mineiro-clientes.vercel.app/dashboard";
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
    detectSections: detectProductSections, // Expone la función de detección
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
          log("Productos:", productosCache.map(p => `${p.nombre} (id:${p.id}, dom_id:${p.dom_id || 'none'}, categoria:${p.categoria || 'sin asignar'})`).join(", "));
        }
        if (testimoniosCache.length > 0) {
          log("Testimonios:", testimoniosCache.map(t => `${t.nombre} (id:${t.id}, dom_id:${t.dom_id || 'none'})`).join(", "));
        }

        // Detectar secciones automáticamente
        const detectedSections = detectProductSections();
        
        // Asignar productos a secciones detectadas automáticamente si no tienen categoría
        if (detectedSections.size > 0 && productosCache.length > 0) {
          const sectionArray = Array.from(detectedSections.keys());
          log(`Asignando productos a secciones detectadas...`, sectionArray);
          
          // Agrupar productos sin categoría
          const productsWithoutCategory = productosCache.filter(p => !p.categoria);
          if (productsWithoutCategory.length > 0 && sectionArray.length > 0) {
            // Distribuir productos sin categoría entre las secciones detectadas
            productsWithoutCategory.forEach((producto, idx) => {
              const assignedSection = sectionArray[idx % sectionArray.length];
              if (assignedSection && assignedSection !== 'Productos') {
                log(`Asignando ${producto.nombre} a sección: ${assignedSection}`);
                producto.categoria = assignedSection;
              }
            });
          }
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
