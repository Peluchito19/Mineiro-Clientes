/* ═══════════════════════════════════════════════════════════════════════════
   MINEIRO ENGINE v4 - Universal Site Editor
   "Una línea de código. Control total."
   
   Este script hace TODO:
   1. Escanea la página y detecta elementos editables automáticamente
   2. Sincroniza con Supabase en tiempo real
   3. Aplica los valores guardados a los elementos
   4. Permite edición visual inline (modo admin)
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  "use strict";

  const VERSION = "4.0.0";
  const SUPABASE_URL = "https://zzgyczbiufafthizurbv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_1HENvCdV9vCRsBX36N2U8g_zqlAlFT9";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  const DASHBOARD_URL = "https://mineiro-clientes.vercel.app";

  /* ─────────────────────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────────────────────── */

  const log = (msg, ...args) => console.log(`%c[Mineiro]%c ${msg}`, "color:#f59e0b;font-weight:bold", "color:inherit", ...args);
  const warn = (msg, ...args) => console.warn(`[Mineiro] ${msg}`, ...args);

  const generateId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const formatPrice = (value, currency = "CLP") => {
    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `$${value}`;
    }
  };

  const parsePrice = (text) => {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const getXPath = (el) => {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return `//*[@id="${el.id}"]`;
    if (el === document.body) return "/html/body";
    
    let ix = 0;
    const siblings = el.parentNode?.childNodes || [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === el) {
        const parentPath = getXPath(el.parentNode);
        const tagName = el.tagName.toLowerCase();
        return `${parentPath}/${tagName}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === el.tagName) {
        ix++;
      }
    }
    return "";
  };

  const getElementByXPath = (xpath) => {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch {
      return null;
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ELEMENT DETECTION - Detecta qué tipo de elemento es
     ───────────────────────────────────────────────────────────────────────── */

  const ElementTypes = {
    PRICE: "price",
    TITLE: "title",
    SUBTITLE: "subtitle",
    PARAGRAPH: "paragraph",
    IMAGE: "image",
    BUTTON: "button",
    LINK: "link",
    LIST_ITEM: "list_item",
    BADGE: "badge",
    ICON: "icon",
    VIDEO: "video",
    FORM_LABEL: "form_label",
    UNKNOWN: "unknown"
  };

  const detectElementType = (el) => {
    const tag = el.tagName?.toLowerCase();
    const text = el.textContent?.trim() || "";
    const classList = Array.from(el.classList || []).join(" ").toLowerCase();
    const style = window.getComputedStyle(el);
    
    // Precio - detecta formatos de moneda
    const pricePatterns = [
      /^\$\s*[\d.,]+/,           // $1.234 o $ 1234
      /^[\d.,]+\s*\$$/,          // 1234$ o 1.234 $
      /^CLP\s*[\d.,]+/i,         // CLP 1234
      /^[\d.,]+\s*CLP$/i,        // 1234 CLP
      /^\$[\d.,]+\s*-\s*\$[\d.,]+/, // Rangos: $100 - $200
    ];
    if (pricePatterns.some(p => p.test(text)) || 
        classList.includes("price") || classList.includes("precio") ||
        el.dataset.price !== undefined) {
      return ElementTypes.PRICE;
    }

    // Imagen
    if (tag === "img" || (tag === "div" && style.backgroundImage !== "none")) {
      return ElementTypes.IMAGE;
    }

    // Video
    if (tag === "video" || tag === "iframe") {
      return ElementTypes.VIDEO;
    }

    // Botón
    if (tag === "button" || (tag === "a" && classList.includes("btn")) ||
        el.role === "button" || classList.includes("button") || classList.includes("cta")) {
      return ElementTypes.BUTTON;
    }

    // Títulos
    if (/^h[1-3]$/.test(tag) || classList.includes("title") || classList.includes("heading")) {
      return ElementTypes.TITLE;
    }

    // Subtítulos
    if (/^h[4-6]$/.test(tag) || classList.includes("subtitle") || classList.includes("subheading")) {
      return ElementTypes.SUBTITLE;
    }

    // Badge/Etiqueta
    if (classList.includes("badge") || classList.includes("tag") || classList.includes("label") ||
        classList.includes("chip") || classList.includes("pill")) {
      return ElementTypes.BADGE;
    }

    // Link
    if (tag === "a" && !classList.includes("btn")) {
      return ElementTypes.LINK;
    }

    // Párrafo
    if (tag === "p" || classList.includes("description") || classList.includes("text")) {
      return ElementTypes.PARAGRAPH;
    }

    // Lista item
    if (tag === "li") {
      return ElementTypes.LIST_ITEM;
    }

    // Label de formulario
    if (tag === "label") {
      return ElementTypes.FORM_LABEL;
    }

    // Elemento con texto que parece contenido
    if (text.length > 0 && text.length < 500 && 
        !["script", "style", "noscript", "meta", "link"].includes(tag)) {
      return ElementTypes.PARAGRAPH;
    }

    return ElementTypes.UNKNOWN;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     SMART SCANNER - Escanea la página y detecta elementos editables
     ───────────────────────────────────────────────────────────────────────── */

  const scanPage = () => {
    const elements = [];
    const seen = new Set();

    // Selectores para encontrar elementos editables
    const selectors = [
      // Precios
      "[class*='price']", "[class*='precio']", "[data-price]",
      // Títulos
      "h1", "h2", "h3", "h4", "h5", "h6",
      "[class*='title']", "[class*='heading']",
      // Textos
      "p", "[class*='description']", "[class*='text']", "[class*='content']",
      // Imágenes
      "img", "[class*='image']", "[class*='img']", "[class*='photo']", "[class*='banner']",
      // Botones
      "button", "[class*='btn']", "[class*='button']", "[class*='cta']",
      // Links importantes
      "a[class*='btn']", "a[class*='button']", "a[class*='cta']",
      // Badges
      "[class*='badge']", "[class*='tag']", "[class*='label']",
      // Listas de productos
      "[class*='product']", "[class*='item']", "[class*='card']",
    ];

    const processElement = (el) => {
      // Skip elementos ya procesados, scripts, styles, etc.
      if (seen.has(el)) return;
      if (!el.tagName) return;
      
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "noscript", "meta", "link", "head", "html"].includes(tag)) return;
      
      // Skip elementos ocultos
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      
      // Skip elementos vacíos (excepto imágenes)
      const text = el.textContent?.trim();
      if (!text && tag !== "img" && !style.backgroundImage) return;

      seen.add(el);

      const type = detectElementType(el);
      if (type === ElementTypes.UNKNOWN) return;

      // Generar o usar ID existente
      let elementId = el.id || el.dataset.mineiroId;
      if (!elementId) {
        elementId = generateId();
        el.dataset.mineiroId = elementId;
      }

      // Extraer valor actual
      let currentValue;
      let extraData = {};

      switch (type) {
        case ElementTypes.PRICE:
          currentValue = parsePrice(text) || text;
          extraData.formattedPrice = text;
          break;
        case ElementTypes.IMAGE:
          currentValue = el.src || style.backgroundImage.replace(/url\(['"]?(.+?)['"]?\)/i, "$1");
          extraData.alt = el.alt || "";
          break;
        case ElementTypes.BUTTON:
        case ElementTypes.LINK:
          currentValue = text;
          extraData.href = el.href || "";
          break;
        default:
          currentValue = text;
      }

      // Detectar contexto (para agrupar elementos relacionados)
      const parent = el.closest("[class*='product'], [class*='card'], [class*='item'], section, article");
      const context = parent ? (parent.id || parent.className.split(" ")[0] || "main") : "main";

      // Crear nombre legible
      const readableName = generateReadableName(el, type, context);

      elements.push({
        id: elementId,
        type,
        xpath: getXPath(el),
        selector: generateSelector(el),
        currentValue,
        context,
        name: readableName,
        tag,
        classes: Array.from(el.classList || []),
        ...extraData
      });
    };

    // Buscar elementos con los selectores
    selectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(processElement);
      } catch (e) {
        // Selector inválido, skip
      }
    });

    // También buscar elementos con data-mineiro-*
    document.querySelectorAll("[data-mineiro-edit]").forEach(processElement);

    log(`Escaneados ${elements.length} elementos editables`);
    return elements;
  };

  const generateSelector = (el) => {
    if (el.id) return `#${el.id}`;
    if (el.dataset.mineiroId) return `[data-mineiro-id="${el.dataset.mineiroId}"]`;
    
    // Generar selector basado en clases únicas
    const classes = Array.from(el.classList || []).filter(c => !c.startsWith("m-"));
    if (classes.length > 0) {
      const selector = `.${classes.join(".")}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
    
    return `[data-mineiro-id="${el.dataset.mineiroId || generateId()}"]`;
  };

  const generateReadableName = (el, type, context) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || "").trim().slice(0, 30);
    const alt = el.alt || "";
    
    const typeNames = {
      [ElementTypes.PRICE]: "Precio",
      [ElementTypes.TITLE]: "Título",
      [ElementTypes.SUBTITLE]: "Subtítulo",
      [ElementTypes.PARAGRAPH]: "Texto",
      [ElementTypes.IMAGE]: "Imagen",
      [ElementTypes.BUTTON]: "Botón",
      [ElementTypes.LINK]: "Enlace",
      [ElementTypes.BADGE]: "Etiqueta",
      [ElementTypes.LIST_ITEM]: "Item",
    };

    const typeName = typeNames[type] || "Elemento";
    
    if (type === ElementTypes.IMAGE) {
      return alt ? `${typeName}: ${alt}` : `${typeName} en ${context}`;
    }
    
    if (text) {
      return `${typeName}: "${text}${text.length >= 30 ? "..." : ""}"`;
    }
    
    return `${typeName} en ${context}`;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     SUPABASE CLIENT
     ───────────────────────────────────────────────────────────────────────── */

  let supabase = null;
  let siteData = null;
  let elementsData = {};

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
    supabase = sb.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabase;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     DATA SYNC - Sincroniza elementos con Supabase
     ───────────────────────────────────────────────────────────────────────── */

  const getSiteId = () => {
    // Obtener de script, meta, o generar desde hostname
    const script = document.querySelector("script[data-mineiro-site]");
    if (script?.dataset.mineiroSite) return script.dataset.mineiroSite;
    
    const meta = document.querySelector("meta[name='mineiro-site']");
    if (meta?.content) return meta.content;
    
    // Usar hostname como fallback
    return window.location.hostname.replace(/\./g, "-");
  };

  const fetchSiteData = async (siteId) => {
    const { data, error } = await supabase
      .from("sites")
      .select("*, elements(*)")
      .eq("site_id", siteId)
      .maybeSingle();
    
    if (error && error.code !== "PGRST116") {
      warn("Error fetching site:", error.message);
    }
    
    return data;
  };

  const saveSiteMap = async (siteId, elements) => {
    // Crear o actualizar el sitio
    const { data: site, error: siteError } = await supabase
      .from("sites")
      .upsert({
        site_id: siteId,
        url: window.location.origin,
        last_scan: new Date().toISOString(),
        element_count: elements.length,
      }, { onConflict: "site_id" })
      .select()
      .single();

    if (siteError) {
      warn("Error saving site:", siteError.message);
      return null;
    }

    // Guardar elementos detectados
    const elementRows = elements.map(el => ({
      site_id: siteId,
      element_id: el.id,
      type: el.type,
      name: el.name,
      xpath: el.xpath,
      selector: el.selector,
      context: el.context,
      original_value: el.currentValue,
      current_value: el.currentValue,
      metadata: {
        tag: el.tag,
        classes: el.classes,
        href: el.href,
        alt: el.alt,
      }
    }));

    // Upsert elementos (no sobreescribir current_value si ya existe)
    for (const row of elementRows) {
      const { error } = await supabase
        .from("elements")
        .upsert(row, { 
          onConflict: "site_id,element_id",
          ignoreDuplicates: false 
        });
      
      if (error) {
        warn(`Error saving element ${row.element_id}:`, error.message);
      }
    }

    return site;
  };

  const loadSavedValues = async (siteId) => {
    const { data, error } = await supabase
      .from("elements")
      .select("element_id, current_value, type, metadata")
      .eq("site_id", siteId);

    if (error) {
      warn("Error loading values:", error.message);
      return {};
    }

    const values = {};
    (data || []).forEach(el => {
      values[el.element_id] = {
        value: el.current_value,
        type: el.type,
        metadata: el.metadata
      };
    });

    return values;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HYDRATION - Aplica valores guardados a los elementos
     ───────────────────────────────────────────────────────────────────────── */

  const hydrateElement = (el, value, type, metadata = {}) => {
    if (value === undefined || value === null) return;

    const tag = el.tagName?.toLowerCase();

    switch (type) {
      case ElementTypes.PRICE:
        el.textContent = typeof value === "number" ? formatPrice(value) : value;
        break;

      case ElementTypes.IMAGE:
        if (tag === "img") {
          el.src = value;
          if (metadata.alt) el.alt = metadata.alt;
        } else {
          el.style.backgroundImage = `url('${value}')`;
        }
        break;

      case ElementTypes.BUTTON:
      case ElementTypes.LINK:
        el.textContent = value;
        if (metadata.href) el.href = metadata.href;
        break;

      default:
        el.textContent = value;
    }

    el.dataset.mineiroHydrated = "true";
  };

  const hydrateAll = (savedValues) => {
    let hydrated = 0;

    Object.entries(savedValues).forEach(([elementId, data]) => {
      // Buscar por ID, data-mineiro-id, o selector
      let el = document.getElementById(elementId) ||
               document.querySelector(`[data-mineiro-id="${elementId}"]`);
      
      if (!el && data.metadata?.selector) {
        el = document.querySelector(data.metadata.selector);
      }

      if (el) {
        hydrateElement(el, data.value, data.type, data.metadata);
        hydrated++;
      }
    });

    log(`Hidratados ${hydrated} elementos`);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     REALTIME UPDATES - Escucha cambios en tiempo real
     ───────────────────────────────────────────────────────────────────────── */

  const subscribeToChanges = (siteId) => {
    const channel = supabase
      .channel(`site-${siteId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "elements",
          filter: `site_id=eq.${siteId}`,
        },
        (payload) => {
          const { element_id, current_value, type, metadata } = payload.new;
          
          let el = document.getElementById(element_id) ||
                   document.querySelector(`[data-mineiro-id="${element_id}"]`);
          
          if (el) {
            hydrateElement(el, current_value, type, metadata);
            log(`Actualizado en tiempo real: ${element_id}`);
          }
        }
      )
      .subscribe();

    log("Suscrito a cambios en tiempo real");
    return channel;
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ADMIN MODE - Edición visual inline
     ───────────────────────────────────────────────────────────────────────── */

  let adminMode = false;
  let selectedElement = null;

  const enableAdminMode = () => {
    if (adminMode) return;
    adminMode = true;

    // Inyectar estilos de admin
    const style = document.createElement("style");
    style.id = "mineiro-admin-styles";
    style.textContent = `
      [data-mineiro-id]:hover {
        outline: 2px dashed #f59e0b !important;
        outline-offset: 2px;
        cursor: pointer;
      }
      [data-mineiro-id].mineiro-selected {
        outline: 2px solid #06b6d4 !important;
        outline-offset: 2px;
      }
      .mineiro-admin-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 48px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border-bottom: 1px solid #334155;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .mineiro-admin-bar * {
        box-sizing: border-box;
      }
      .mineiro-admin-logo {
        color: #f59e0b;
        font-weight: 700;
        font-size: 16px;
      }
      .mineiro-admin-actions {
        display: flex;
        gap: 8px;
      }
      .mineiro-admin-btn {
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        border: none;
      }
      .mineiro-admin-btn-primary {
        background: linear-gradient(135deg, #06b6d4, #8b5cf6);
        color: white;
      }
      .mineiro-admin-btn-secondary {
        background: #334155;
        color: #e2e8f0;
      }
      .mineiro-admin-btn:hover {
        filter: brightness(1.1);
      }
      .mineiro-edit-popup {
        position: fixed;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 16px;
        min-width: 280px;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .mineiro-edit-popup input,
      .mineiro-edit-popup textarea {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #475569;
        background: #0f172a;
        color: #f1f5f9;
        font-size: 14px;
        margin-top: 8px;
      }
      .mineiro-edit-popup textarea {
        min-height: 80px;
        resize: vertical;
      }
      .mineiro-edit-popup label {
        font-size: 12px;
        color: #94a3b8;
        font-weight: 500;
      }
      .mineiro-edit-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      body.mineiro-admin-active {
        padding-top: 48px !important;
      }
    `;
    document.head.appendChild(style);

    // Crear barra de admin
    const adminBar = document.createElement("div");
    adminBar.className = "mineiro-admin-bar";
    adminBar.innerHTML = `
      <div class="mineiro-admin-logo">⚡ Mineiro Editor</div>
      <div style="color:#94a3b8;font-size:13px">Haz clic en cualquier elemento para editarlo</div>
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

    // Click listener para edición
    document.addEventListener("click", handleAdminClick, true);

    log("Modo admin activado");
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
    const el = e.target.closest("[data-mineiro-id]");
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();

    // Deseleccionar anterior
    if (selectedElement) {
      selectedElement.classList.remove("mineiro-selected");
    }

    selectedElement = el;
    el.classList.add("mineiro-selected");

    showEditPopup(el);
  };

  const showEditPopup = (el) => {
    // Remover popup anterior
    document.querySelector(".mineiro-edit-popup")?.remove();

    const elementId = el.dataset.mineiroId;
    const type = detectElementType(el);
    const currentValue = type === ElementTypes.IMAGE 
      ? (el.src || el.style.backgroundImage.replace(/url\(['"]?(.+?)['"]?\)/i, "$1"))
      : el.textContent;

    const rect = el.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.className = "mineiro-edit-popup";
    
    // Posicionar
    let top = rect.bottom + 10 + window.scrollY;
    let left = rect.left + window.scrollX;
    
    // Ajustar si se sale de la pantalla
    if (left + 300 > window.innerWidth) {
      left = window.innerWidth - 320;
    }
    if (top + 200 > window.innerHeight + window.scrollY) {
      top = rect.top - 210 + window.scrollY;
    }
    
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    const inputType = type === ElementTypes.PARAGRAPH ? "textarea" : "input";
    const inputTypeAttr = type === ElementTypes.PRICE ? 'type="number"' : 'type="text"';

    popup.innerHTML = `
      <label>Editar ${type === ElementTypes.IMAGE ? "URL de imagen" : "contenido"}</label>
      <${inputType} ${inputType === "input" ? inputTypeAttr : ""} 
        id="mineiro-edit-input" 
        value="${currentValue?.replace(/"/g, "&quot;") || ""}"
        ${inputType === "textarea" ? `>${currentValue || ""}</textarea>` : "/>"}
      <div class="mineiro-edit-actions">
        <button class="mineiro-admin-btn mineiro-admin-btn-secondary" onclick="document.querySelector('.mineiro-edit-popup')?.remove()">
          Cancelar
        </button>
        <button class="mineiro-admin-btn mineiro-admin-btn-primary" onclick="window.MineiroAdmin.saveElement('${elementId}', '${type}')">
          💾 Guardar
        </button>
      </div>
    `;

    document.body.appendChild(popup);
    document.getElementById("mineiro-edit-input").focus();
  };

  const saveElement = async (elementId, type) => {
    const input = document.getElementById("mineiro-edit-input");
    if (!input) return;

    let value = input.value;
    if (type === ElementTypes.PRICE) {
      value = parseFloat(value) || 0;
    }

    const siteId = getSiteId();
    
    // Guardar en Supabase
    const { error } = await supabase
      .from("elements")
      .update({ current_value: value })
      .eq("site_id", siteId)
      .eq("element_id", elementId);

    if (error) {
      warn("Error saving:", error.message);
      alert("Error al guardar");
      return;
    }

    // Aplicar localmente
    if (selectedElement) {
      hydrateElement(selectedElement, value, type, {});
    }

    // Cerrar popup
    document.querySelector(".mineiro-edit-popup")?.remove();
    log(`Guardado: ${elementId}`);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PUBLIC API
     ───────────────────────────────────────────────────────────────────────── */

  window.MineiroAdmin = {
    enable: enableAdminMode,
    disable: disableAdminMode,
    saveElement,
    openDashboard: () => {
      const siteId = getSiteId();
      window.open(`${DASHBOARD_URL}/editor/${siteId}`, "_blank");
    },
    scan: scanPage,
    getSiteId,
  };

  /* ─────────────────────────────────────────────────────────────────────────
     INITIALIZATION
     ───────────────────────────────────────────────────────────────────────── */

  const init = async () => {
    log(`Mineiro Engine v${VERSION} inicializando...`);

    try {
      await initSupabase();
      const siteId = getSiteId();
      log(`Site ID: ${siteId}`);

      // Escanear página
      const elements = scanPage();

      // Guardar mapa en Supabase (en background)
      saveSiteMap(siteId, elements).catch(e => warn("Error saving map:", e));

      // Cargar valores guardados y aplicarlos
      const savedValues = await loadSavedValues(siteId);
      if (Object.keys(savedValues).length > 0) {
        hydrateAll(savedValues);
      }

      // Suscribirse a cambios en tiempo real
      subscribeToChanges(siteId);

      // Si hay ?mineiro-admin en la URL, activar modo admin
      if (window.location.search.includes("mineiro-admin") ||
          window.location.hash.includes("mineiro-admin")) {
        enableAdminMode();
      }

      log("✓ Engine listo");

    } catch (err) {
      warn("Error de inicialización:", err);
    }
  };

  // Iniciar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
