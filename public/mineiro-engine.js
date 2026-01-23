/* Mineiro Engine v2 - Hybrid Mode (Injection + Hydration) */
(function () {
  "use strict";

  const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  const DEFAULT_SUPABASE_URL = "https://zzgyczbiufafthizurbv.supabase.co";
  const DEFAULT_SUPABASE_KEY =
    "sb_publishable_1HENvCdV9vCRsBX36N2U8g_zqlAlFT9";

  /* ─────────────────────────────────────────────────────────────────────────
     CONFIG & UTILITIES
     ───────────────────────────────────────────────────────────────────────── */

  const getConfig = () => {
    const script = document.currentScript;
    const ds = script?.dataset ?? {};
    return {
      supabaseUrl: ds.supabaseUrl || window.MINEIRO_SUPABASE_URL || DEFAULT_SUPABASE_URL,
      supabaseKey: ds.supabaseKey || window.MINEIRO_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY,
      storeSlug:
        ds.storeSlug ||
        document.querySelector("[data-store-slug]")?.dataset.storeSlug ||
        window.location.hostname,
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

  const log = (msg, ...args) => console.log(`[Mineiro] ${msg}`, ...args);
  const warn = (msg, ...args) => console.warn(`[Mineiro] ${msg}`, ...args);

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

  const initSupabase = async (config) => {
    const sb = await loadSupabase();
    supabase = sb.createClient(config.supabaseUrl, config.supabaseKey);
    return supabase;
  };

  const fetchTienda = async (slug) => {
    const { data, error } = await supabase
      .from("tiendas")
      .select("*")
      .or(`slug.eq.${slug},url.ilike.%${slug}%`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
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

  /* ─────────────────────────────────────────────────────────────────────────
     SUSPENDED BANNER
     ───────────────────────────────────────────────────────────────────────── */

  const showSuspendedBanner = () => {
    if (document.getElementById("mineiro-suspended-banner")) return;
    const banner = document.createElement("div");
    banner.id = "mineiro-suspended-banner";
    banner.textContent = "Servicio Mineiro Suspendido";
    Object.assign(banner.style, {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: "#0f172a",
      color: "#f8fafc",
      padding: "12px 16px",
      textAlign: "center",
      fontFamily: "inherit",
      fontWeight: 600,
      borderTop: "1px solid #1f2937",
    });
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
     HYDRATION MODE: Bind existing DOM elements to product data
     ───────────────────────────────────────────────────────────────────────── */

  const parseBinding = (binding) => {
    // Format: "producto-{id}.{field}" or "producto-{id}.variante.{index}.precio"
    const match = binding.match(/^producto-([a-zA-Z0-9\-]+)\.(.+)$/);
    if (!match) return null;
    return { productId: match[1], field: match[2] };
  };

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      // Handle array index like "variantes.0.precio"
      const idx = parseInt(key, 10);
      return !isNaN(idx) ? acc[idx] : acc[key];
    }, obj);
  };

  const hydrateElement = (el, productos) => {
    const binding = el.dataset.mineiroBind;
    const parsed = parseBinding(binding);
    if (!parsed) {
      warn(`Invalid binding format: ${binding}`);
      return;
    }

    const producto = productos.find((p) => String(p.id) === parsed.productId);
    if (!producto) {
      warn(`Product not found for binding: ${binding}`);
      return;
    }

    let value;

    // Handle nested paths like "configuracion.variantes.0.precio"
    if (parsed.field.includes(".")) {
      value = getNestedValue(producto, parsed.field);
    } else {
      value = producto[parsed.field];
    }

    if (value === undefined) {
      warn(`Field "${parsed.field}" not found in product ${parsed.productId}`);
      return;
    }

    // Format price fields
    const priceFields = ["precio"];
    const isPriceField =
      priceFields.includes(parsed.field) ||
      parsed.field.endsWith(".precio");
    if (isPriceField && typeof value === "number") {
      value = formatCLP(value);
    }

    // Determine how to apply the value based on element/attribute
    const tagName = el.tagName.toLowerCase();

    if (parsed.field === "imagen_url" || parsed.field.endsWith(".imagen")) {
      // Image binding
      if (tagName === "img") {
        el.src = value;
      } else {
        el.style.backgroundImage = `url('${value}')`;
      }
    } else {
      // Text binding
      el.textContent = value;
    }

    // Mark as hydrated
    el.dataset.mineiroHydrated = "true";
  };

  const runHydrationMode = (productos) => {
    const elements = document.querySelectorAll("[data-mineiro-bind]");
    elements.forEach((el) => {
      try {
        hydrateElement(el, productos);
      } catch (err) {
        warn(`Hydration error for element:`, el, err);
      }
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     DOM ID BINDING: Bind by dom_id field in productos/secciones
     ───────────────────────────────────────────────────────────────────────── */

  const runDomIdBinding = (productos, secciones) => {
    // Bind products by dom_id
    productos.forEach((producto) => {
      if (!producto.dom_id) return;
      const el = document.getElementById(producto.dom_id);
      if (!el) return;

      // If it's a container, render the product card inside
      if (el.dataset.mineiroRender === "card") {
        renderProductCard(el, producto);
      }
      // Otherwise just mark it for reference
      el.dataset.mineiroProductId = producto.id;
    });

    // Bind sections by dom_id
    secciones.forEach((seccion) => {
      if (!seccion.dom_id) return;
      const el = document.getElementById(seccion.dom_id);
      if (!el) return;

      // Apply custom styles from JSONB
      if (seccion.estilos) {
        Object.assign(el.style, seccion.estilos);
      }

      el.dataset.mineiroSeccionId = seccion.id;

      // If it's a section container, render products of that section
      if (el.dataset.mineiroRender === "section") {
        const sectionProducts = productos.filter(
          (p) => p.seccion_id === seccion.id
        );
        renderSectionProducts(el, seccion.nombre, sectionProducts);
      }
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
     MAIN INIT
     ───────────────────────────────────────────────────────────────────────── */

  const init = async () => {
    const config = getConfig();

    try {
      await initSupabase(config);
      log("Supabase initialized");

      // Fetch tienda
      tiendaData = await fetchTienda(config.storeSlug);
      if (!tiendaData) {
        warn(`Tienda not found for slug: ${config.storeSlug}`);
        return;
      }

      // Check payment status
      if (tiendaData.estado_pago === false) {
        showSuspendedBanner();
        return;
      }

      // Fetch data
      const [productos, secciones] = await Promise.all([
        fetchProductos(tiendaData.id),
        fetchSecciones(tiendaData.id),
      ]);

      productosCache = productos;
      seccionesCache = secciones;

      log(`Loaded ${productos.length} products, ${secciones.length} sections`);

      // Run both modes
      runInjectionMode(productos);
      runHydrationMode(productos);
      runDomIdBinding(productos, secciones);

      // Attach variant listeners after all rendering
      attachVariantListeners();

      log("Engine ready");
    } catch (err) {
      warn("Initialization failed (page remains intact):", err.message);
      // Fail silently - don't break the page
    }
  };

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
