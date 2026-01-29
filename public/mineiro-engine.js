/* Mineiro Engine v3.5 - Full Site Editing Support with Unified Data */
(function () {
  "use strict";

  const hasUnifiedScript =
    window.MINEIRO_UNIFIED_LOADED ||
    document.querySelector("script[src*='mineiro.js']");
  const allowEngine =
    document.currentScript?.dataset?.mineiroEngine === "true" ||
    document.querySelector("script[data-mineiro-engine='true']");

  if (hasUnifiedScript && !allowEngine) {
    console.warn(
      "[Mineiro Engine] Desactivado: se detectó mineiro.js. Para forzar, usa data-mineiro-engine='true'."
    );
    return;
  }

  const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  const DEFAULT_SUPABASE_URL = "https://zzgyczbiufafthizurbv.supabase.co";
  const DEFAULT_SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Z3ljemJpdWZhZnRoaXp1cmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc2NDUyNDksImV4cCI6MjA1MzIyMTI0OX0.SsJEBEVlvJPoHwrxNEKnAiF2mtv7Xa2OUBuhT0rGHiM";

  /* ─────────────────────────────────────────────────────────────────────────
     CONFIG & UTILITIES
     ───────────────────────────────────────────────────────────────────────── */

  const getConfig = () => {
    const script = document.currentScript || document.querySelector("script[data-store-slug]");
    const ds = script?.dataset ?? {};
    
    // Detectar slug de múltiples fuentes
    let storeSlug = ds.storeSlug || ds.mineiroSite || document.querySelector("[data-store-slug]")?.dataset.storeSlug;
    
    // Si no hay slug explícito, extraer del hostname
    if (!storeSlug) {
      const hostname = window.location.hostname;
      // Para Vercel: cosmeticos-fran.vercel.app -> cosmeticos-fran
      if (hostname.endsWith('.vercel.app')) {
        storeSlug = hostname.replace('.vercel.app', '');
      } else {
        storeSlug = hostname.replace(/\./g, "-");
      }
    }
    
    return {
      supabaseUrl: ds.supabaseUrl || window.MINEIRO_SUPABASE_URL || DEFAULT_SUPABASE_URL,
      supabaseKey: ds.supabaseKey || window.MINEIRO_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY,
      storeSlug,
    };
  };

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

  const escapeHtml = (text) => {
    const d = document.createElement("div");
    d.textContent = text ?? "";
    return d.innerHTML;
  };

  const log = (msg, ...args) => console.log(`[Mineiro Engine] ${msg}`, ...args);
  const warn = (msg, ...args) => console.warn(`[Mineiro Engine] ${msg}`, ...args);

  const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      const idx = parseInt(key, 10);
      return !isNaN(idx) ? acc[idx] : acc[key];
    }, obj);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     SUPABASE LOADER
     ───────────────────────────────────────────────────────────────────────── */

  const loadSupabase = () =>
    new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve(window.supabase);
      const s = document.createElement("script");
      s.src = SUPABASE_CDN;
      s.async = true;
      s.onload = () => resolve(window.supabase);
      s.onerror = () => reject(new Error("Failed to load Supabase SDK"));
      document.head.appendChild(s);
    });

  /* ─────────────────────────────────────────────────────────────────────────
     DATA FETCHING
     ───────────────────────────────────────────────────────────────────────── */

  let supabase = null;
  let tiendaData = null;
  let productosCache = [];
  let seccionesCache = [];
  let testimoniosCache = [];

  const initSupabase = async (config) => {
    const sb = await loadSupabase();
    supabase = sb.createClient(config.supabaseUrl, config.supabaseKey);
    return supabase;
  };

  const TIENDA_API_URL = "https://mineiro-clientes.vercel.app/api/tienda";

  // Función unificada que carga tienda + productos + testimonios via API (bypass RLS)
  const fetchAllData = async (slug) => {
    const hostname = window.location.hostname;
    
    try {
      const response = await fetch(
        `${TIENDA_API_URL}?slug=${encodeURIComponent(slug)}&hostname=${encodeURIComponent(hostname)}&include=all`
      );
      const result = await response.json();
      
      if (result.found && result.tienda) {
        return {
          tienda: result.tienda,
          productos: result.productos || [],
          testimonios: result.testimonios || []
        };
      }
      
      return { tienda: null, productos: [], testimonios: [] };
    } catch (apiError) {
      warn("Error con API:", apiError.message);
      return { tienda: null, productos: [], testimonios: [] };
    }
  };

  const fetchSecciones = async (tiendaId) => {
    const { data, error } = await supabase
      .from("secciones")
      .select("*")
      .eq("tienda_id", tiendaId)
      .order("orden", { ascending: true });
    if (error) throw error;
    return data ?? [];
  };

  /* ─────────────────────────────────────────────────────────────────────────
     SUSPENDED BANNER
     ───────────────────────────────────────────────────────────────────────── */

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

  /* ─────────────────────────────────────────────────────────────────────────
     VARIANT HANDLING
     ───────────────────────────────────────────────────────────────────────── */

  const buildVariantSelector = (producto, containerId) => {
    const config = producto.configuracion;
    const variantes = config?.variantes;
    if (!variantes || variantes.length === 0) return "";

    const opts = variantes
      .map(
        (v, i) =>
          `<option value="${i}" data-precio="${v.precio}">${escapeHtml(v.nombre)} - ${formatCLP(v.precio)}</option>`
      )
      .join("");

    return `
      <select
        class="mineiro-variant-select"
        data-target-price="${containerId}-price"
        style="width:100%;padding:8px 10px;margin-top:8px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:14px;cursor:pointer"
      >
        ${opts}
      </select>
    `;
  };

  const buildExtrasUI = (producto) => {
    const config = producto.configuracion;
    const agregados = config?.agregados;
    if (!agregados || agregados.length === 0) return "";

    return agregados
      .map((grupo) => {
        const opciones = (grupo.opciones ?? [])
          .map(
            (opt) =>
              `<label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" value="${opt.precio ?? 0}" style="accent-color:#f59e0b" />
                <span>${escapeHtml(opt.nombre)}${opt.precio ? ` (+${formatCLP(opt.precio)})` : ""}</span>
              </label>`
          )
          .join("");
        return `
          <div class="mineiro-extras-group" style="margin-top:10px">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">${escapeHtml(grupo.grupo)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:13px">${opciones}</div>
          </div>
        `;
      })
      .join("");
  };

  const attachVariantListeners = () => {
    document.querySelectorAll(".mineiro-variant-select").forEach((select) => {
      select.addEventListener("change", (e) => {
        const targetId = select.dataset.targetPrice;
        const priceEl = document.getElementById(targetId);
        if (!priceEl) return;
        const option = select.options[select.selectedIndex];
        const precio = parseFloat(option.dataset.precio) || 0;
        priceEl.textContent = formatCLP(precio);
      });
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     INJECTION MODE: Render products into empty containers
     ───────────────────────────────────────────────────────────────────────── */

  const renderSectionProducts = (container, sectionName, productos) => {
    const filtered = productos.filter(
      (p) =>
        (p.categoria ?? "").toLowerCase() === sectionName.toLowerCase() ||
        (p.seccion ?? "").toLowerCase() === sectionName.toLowerCase()
    );

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-family:inherit">No hay productos en esta sección.</p>`;
      return;
    }

    const cards = filtered
      .map((producto) => {
        const id = producto.id;
        const cardId = `mineiro-card-${id}`;
        const hasVariants =
          producto.configuracion?.variantes?.length > 0;
        const basePrice = hasVariants
          ? producto.configuracion.variantes[0].precio
          : producto.precio;

        const img = producto.imagen_url
          ? `<img src="${escapeHtml(producto.imagen_url)}" alt="${escapeHtml(producto.nombre)}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:10px 10px 0 0" />`
          : `<div style="width:100%;height:160px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;border-radius:10px 10px 0 0">Sin imagen</div>`;

        return `
          <div id="${cardId}" class="mineiro-product-card" style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;overflow:hidden;display:flex;flex-direction:column">
            ${img}
            <div style="padding:14px;flex:1;display:flex;flex-direction:column">
              <div style="font-weight:600;font-size:15px;color:#f1f5f9;margin-bottom:4px">${escapeHtml(producto.nombre)}</div>
              <div id="${cardId}-price" style="font-size:18px;font-weight:700;color:#f59e0b">${formatCLP(basePrice)}</div>
              ${buildVariantSelector(producto, cardId)}
              ${buildExtrasUI(producto)}
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="mineiro-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;font-family:inherit">
        ${cards}
      </div>
    `;
  };

  const runInjectionMode = (productos) => {
    const containers = document.querySelectorAll("[data-mineiro-section]");
    containers.forEach((el) => {
      const sectionName = el.dataset.mineiroSection;
      if (!sectionName) return;
      renderSectionProducts(el, sectionName, productos);
    });
    attachVariantListeners();
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HYDRATION MODE: Bind existing DOM elements to data
     Supports: producto-{dom_id}.field, config-tienda.field, hero.field,
               footer.field, testimonio-{dom_id}.field
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

    // Menu categorias: "menu.categorias.{categoria-slug}.{field}"
    const menuCategoriaMatch = binding.match(/^menu\.categorias\.([a-zA-Z0-9\-_]+)\.(.+)$/);
    if (menuCategoriaMatch) {
      return { 
        type: "menu-categoria", 
        categoriaSlug: menuCategoriaMatch[1], 
        field: menuCategoriaMatch[2] 
      };
    }

    // Producto: "producto-{dom_id_or_uuid}.nombre"
    const productoMatch = binding.match(/^producto-([a-zA-Z0-9\-_]+)\.(.+)$/);
    if (productoMatch) {
      return { type: "producto", identifier: productoMatch[1], field: productoMatch[2] };
    }

    return null;
  };

  const applyValueToElement = (el, value, field) => {
    if (value === undefined || value === null) return false;

    const tagName = el.tagName.toLowerCase();

    // Image fields
    const imageFields = ["imagen_url", "imagen", "imagen_fondo", "logo_url", "avatar"];
    const isImageField = imageFields.some(f => field === f || field.endsWith(`.${f}`));

    if (isImageField) {
      if (tagName === "img") {
        el.src = value;
      } else {
        el.style.backgroundImage = `url('${value}')`;
      }
    }
    // Link fields
    else if (field.endsWith("_url") || field === "url" || field === "link") {
      if (tagName === "a") {
        el.href = value;
      } else {
        el.textContent = value;
      }
    }
    // Price fields
    else if (field === "precio" || field.endsWith(".precio")) {
      el.textContent = typeof value === "number" ? formatCLP(value) : value;
    }
    // Rating (stars)
    else if (field === "rating") {
      const stars = parseInt(value, 10) || 0;
      el.textContent = "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars));
    }
    // Default: text content
    else {
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
        // Try from site_config.config first, then tienda fields
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
        // Buscar en siteConfig.footer primero
        value = getNestedValue(siteConfig.footer, parsed.field);
        
        // Si no existe, usar valores por defecto de la tienda
        if (value === undefined) {
          if (parsed.field === "nombre_tienda") {
            value = tienda?.nombre_negocio;
          } else if (parsed.field === "whatsapp") {
            value = tienda?.whatsapp;
          } else if (parsed.field === "email") {
            value = tienda?.email;
          }
        }
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

      case "menu-categoria": {
        // Buscar en site_config.menu.categorias
        const menuConfig = siteConfig.menu || {};
        const categoriasConfig = menuConfig.categorias || {};
        const categoriaConfig = categoriasConfig[parsed.categoriaSlug] || {};
        
        value = categoriaConfig[parsed.field];
        
        // Si no existe en la config, usar valores por defecto
        if (value === undefined && parsed.field === "titulo") {
          // Convertir slug a título (ej: "tradicionales" -> "Tradicionales")
          value = parsed.categoriaSlug
            .split("-")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        }
        
        // Handle special actions for buttons
        if (parsed.field === "boton" && el.tagName.toLowerCase() === "button") {
          // Add click handler to filter products by category
          el.addEventListener("click", () => {
            filterProductsByCategory(parsed.categoriaSlug, productos);
          });
          // Set button text if value exists
          if (value) {
            el.textContent = value;
          }
        }
        break;
      }

      case "producto": {
        // Find by dom_id first, then by UUID
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

  /* ─────────────────────────────────────────────────────────────────────────
     CATEGORY FILTERING
     ───────────────────────────────────────────────────────────────────────── */

  const filterProductsByCategory = (categoriaSlug, productos) => {
    // Convert slug back to category name for matching
    // "tradicionales" -> "Tradicionales", "de-casa" -> "De Casa"
    const categoryName = categoriaSlug
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    
    // Find containers that show products
    const containers = document.querySelectorAll("[data-mineiro-section], [data-mineiro-category-display]");
    
    containers.forEach(container => {
      const filtered = productos.filter(p => {
        const prodCat = (p.categoria || "").toLowerCase();
        const searchCat = categoryName.toLowerCase();
        return prodCat === searchCat || prodCat.includes(searchCat) || searchCat.includes(prodCat);
      });
      
      if (filtered.length > 0) {
        renderSectionProducts(container, categoryName, productos);
      }
    });
    
    log(`Filtrado por categoría: ${categoryName} (${categoriaSlug})`);
  };

  const runHydrationMode = (tienda, productos, testimonios) => {
    const elements = document.querySelectorAll("[data-mineiro-bind]:not([data-mineiro-hydrated])");
    let hydrated = 0;
    elements.forEach((el) => {
      try {
        hydrateElement(el, tienda, productos, testimonios);
        hydrated++;
      } catch (err) {
        warn(`Hydration error for element:`, el, err);
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
        clearTimeout(hydrationTimeout);
        hydrationTimeout = setTimeout(() => {
          log("Detectados nuevos elementos, re-hidratando...");
          runHydrationMode(tiendaData, productosCache, testimoniosCache);
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
     DOM ID BINDING: Bind by dom_id field in productos/secciones/testimonios
     ───────────────────────────────────────────────────────────────────────── */

  const runDomIdBinding = (productos, secciones, testimonios) => {
    // Bind products by dom_id
    productos.forEach((producto) => {
      if (!producto.dom_id) return;
      const el = document.getElementById(producto.dom_id);
      if (!el) return;

      if (el.dataset.mineiroRender === "card") {
        renderProductCard(el, producto);
      }
      el.dataset.mineiroProductId = producto.id;
    });

    // Bind sections by dom_id
    secciones.forEach((seccion) => {
      if (!seccion.dom_id) return;
      const el = document.getElementById(seccion.dom_id);
      if (!el) return;

      if (seccion.estilos) {
        Object.assign(el.style, seccion.estilos);
      }

      el.dataset.mineiroSeccionId = seccion.id;

      if (el.dataset.mineiroRender === "section") {
        const sectionProducts = productos.filter(
          (p) => p.seccion_id === seccion.id
        );
        renderSectionProducts(el, seccion.nombre, sectionProducts);
      }
    });

    // Bind testimonios by dom_id
    testimonios.forEach((testimonio) => {
      if (!testimonio.dom_id) return;
      const el = document.getElementById(testimonio.dom_id);
      if (!el) return;
      el.dataset.mineiroTestimonioId = testimonio.id;
    });
  };

  const renderProductCard = (container, producto) => {
    const id = producto.id;
    const cardId = `mineiro-card-${id}`;
    const hasVariants = producto.configuracion?.variantes?.length > 0;
    const basePrice = hasVariants
      ? producto.configuracion.variantes[0].precio
      : producto.precio;

    const img = producto.imagen_url
      ? `<img src="${escapeHtml(producto.imagen_url)}" alt="${escapeHtml(producto.nombre)}" loading="lazy" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0" />`
      : "";

    container.innerHTML = `
      <div class="mineiro-product-card" style="font-family:inherit">
        ${img}
        <div style="padding:12px">
          <div style="font-weight:600;margin-bottom:4px">${escapeHtml(producto.nombre)}</div>
          <div id="${cardId}-price" style="font-size:17px;font-weight:700;color:#f59e0b">${formatCLP(basePrice)}</div>
          ${buildVariantSelector(producto, cardId)}
          ${buildExtrasUI(producto)}
        </div>
      </div>
    `;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     REALTIME SUBSCRIPTIONS
     ───────────────────────────────────────────────────────────────────────── */

  const subscribeToChanges = (tiendaId) => {
    // Subscribe to productos changes
    supabase
      .channel(`productos-engine-${tiendaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos",
          filter: `tienda_id=eq.${tiendaId}`,
        },
        (payload) => {
          log("Producto actualizado en tiempo real");
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const producto = payload.new;
            const idx = productosCache.findIndex(p => p.id === producto.id);
            if (idx >= 0) {
              productosCache[idx] = producto;
            } else if (producto.visible) {
              productosCache.push(producto);
            }
            // Re-hydrate all elements
            runHydrationMode(tiendaData, productosCache, testimoniosCache);
          }
        }
      )
      .subscribe();

    // Subscribe to tienda changes
    supabase
      .channel(`tienda-engine-${tiendaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tiendas",
          filter: `id=eq.${tiendaId}`,
        },
        (payload) => {
          log("Tienda actualizada en tiempo real");
          tiendaData = payload.new;
          runHydrationMode(tiendaData, productosCache, testimoniosCache);
        }
      )
      .subscribe();

    // Subscribe to testimonios changes
    supabase
      .channel(`testimonios-engine-${tiendaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "testimonios",
          filter: `tienda_id=eq.${tiendaId}`,
        },
        (payload) => {
          log("Testimonio actualizado en tiempo real");
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const testimonio = payload.new;
            const idx = testimoniosCache.findIndex(t => t.id === testimonio.id);
            if (idx >= 0) {
              testimoniosCache[idx] = testimonio;
            } else if (testimonio.visible) {
              testimoniosCache.push(testimonio);
            }
            runHydrationMode(tiendaData, productosCache, testimoniosCache);
          }
        }
      )
      .subscribe();

    log("Suscrito a cambios en tiempo real");
  };

  /* ─────────────────────────────────────────────────────────────────────────
     MAIN INIT
     ───────────────────────────────────────────────────────────────────────── */

  const init = async () => {
    const config = getConfig();
    log("Inicializando con slug:", config.storeSlug);

    try {
      await initSupabase(config);
      log("Supabase conectado");

      // Fetch tienda + productos + testimonios via API (bypass RLS)
      const allData = await fetchAllData(config.storeSlug);
      tiendaData = allData.tienda;
      productosCache = allData.productos;
      testimoniosCache = allData.testimonios;
      
      if (!tiendaData) {
        warn(`Tienda no encontrada para: ${config.storeSlug}`);
        return;
      }

      log("Tienda cargada:", tiendaData.nombre_negocio);
      log(`Cargados: ${productosCache.length} productos, ${testimoniosCache.length} testimonios`);

      // Check payment status - allow trial period
      if (tiendaData.estado_pago === false && tiendaData.plan !== "trial") {
        showSuspendedBanner();
        return;
      }

      // Fetch secciones (puede fallar por RLS)
      let secciones = [];
      try {
        secciones = await fetchSecciones(tiendaData.id);
      } catch (e) {
        // No es crítico
      }
      seccionesCache = secciones;

      // Run all binding modes
      runHydrationMode(tiendaData, productosCache, testimoniosCache);
      runInjectionMode(productosCache);
      runDomIdBinding(productosCache, secciones, testimoniosCache);

      // Attach variant listeners after all rendering
      attachVariantListeners();

      // Configurar MutationObserver para detectar elementos de React
      setupMutationObserver();

      // Reintentar hidratación para SPAs (React, Vue, etc)
      setTimeout(() => runHydrationMode(tiendaData, productosCache, testimoniosCache), 500);
      setTimeout(() => runHydrationMode(tiendaData, productosCache, testimoniosCache), 1500);
      setTimeout(() => runHydrationMode(tiendaData, productosCache, testimoniosCache), 3000);

      // Subscribe to realtime changes (puede fallar por RLS)
      try {
        subscribeToChanges(tiendaData.id);
      } catch (e) {
        warn("Realtime no disponible, los cambios se verán al recargar");
      }

      log("✓ Engine listo");
    } catch (err) {
      warn("Error de inicialización:", err.message);
      console.error(err);
    }
  };

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
