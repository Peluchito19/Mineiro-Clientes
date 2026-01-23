/* Mineiro Engine - vanilla JS embed */
(function () {
  const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) {
        resolve(window.supabase);
        return;
      }

      const script = document.createElement("script");
      script.src = SUPABASE_CDN;
      script.async = true;
      script.onload = () => resolve(window.supabase);
      script.onerror = () => reject(new Error("No se pudo cargar Supabase."));
      document.head.appendChild(script);
    });
  }

  function getConfig() {
    const currentScript = document.currentScript;
    const dataset = currentScript ? currentScript.dataset : {};
    const storeSlug =
      (dataset && dataset.storeSlug) ||
      document.querySelector("[data-store-slug]")?.getAttribute(
        "data-store-slug",
      ) ||
      window.location.hostname;

    const supabaseUrl =
      (dataset && dataset.supabaseUrl) ||
      window.MINEIRO_SUPABASE_URL ||
      "https://zzgyczbiufafthizurbv.supabase.co";

    const supabaseKey =
      (dataset && dataset.supabaseKey) ||
      window.MINEIRO_SUPABASE_ANON_KEY ||
      "sb_publishable_1HENvCdV9vCRsBX36N2U8g_zqlAlFT9";

    return { storeSlug, supabaseUrl, supabaseKey };
  }

  function formatCLP(value) {
    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `$${value}`;
    }
  }

  function showSuspendedBanner() {
    if (document.getElementById("mineiro-suspended-banner")) return;

    const banner = document.createElement("div");
    banner.id = "mineiro-suspended-banner";
    banner.textContent = "Servicio Mineiro Suspendido";
    banner.style.position = "fixed";
    banner.style.left = "0";
    banner.style.right = "0";
    banner.style.bottom = "0";
    banner.style.zIndex = "9999";
    banner.style.background = "#0f172a";
    banner.style.color = "#f8fafc";
    banner.style.padding = "12px 16px";
    banner.style.textAlign = "center";
    banner.style.fontFamily = "system-ui, sans-serif";
    banner.style.fontWeight = "600";
    banner.style.borderTop = "1px solid #1f2937";
    document.body.appendChild(banner);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function renderProductos(productos) {
    const target = document.getElementById("mineiro-menu");
    if (!target) return;

    if (!productos || productos.length === 0) {
      target.innerHTML =
        "<p style='font-family:system-ui,sans-serif;color:#94a3b8'>No hay productos disponibles.</p>";
      return;
    }

    const grouped = productos.reduce((acc, item) => {
      const category = item.categoria || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    const sections = Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((categoria) => {
        const cards = grouped[categoria]
          .map((producto) => {
            const img = producto.imagen_url
              ? `<img src="${escapeHtml(
                  producto.imagen_url,
                )}" alt="${escapeHtml(
                  producto.nombre,
                )}" style="width:100%;height:140px;object-fit:cover;border-radius:12px 12px 0 0" />`
              : `<div style="width:100%;height:140px;background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;border-radius:12px 12px 0 0;font-size:12px">Sin foto</div>`;

            return `
              <div style="border:1px solid #1f2937;border-radius:12px;overflow:hidden;background:#0b1220;color:#e2e8f0">
                ${img}
                <div style="padding:12px 14px">
                  <div style="font-weight:600;margin-bottom:6px">${escapeHtml(
                    producto.nombre,
                  )}</div>
                  <div style="color:#38bdf8;font-weight:700">${formatCLP(
                    producto.precio,
                  )}</div>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <section style="margin-bottom:28px">
            <h3 style="font-family:system-ui,sans-serif;margin:0 0 12px;color:#f8fafc">${escapeHtml(
              categoria,
            )}</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">
              ${cards}
            </div>
          </section>
        `;
      })
      .join("");

    target.innerHTML = sections;
  }

  async function init() {
    const { storeSlug, supabaseUrl, supabaseKey } = getConfig();
    if (!storeSlug) return;

    const supabaseLib = await loadSupabase();
    const client = supabaseLib.createClient(supabaseUrl, supabaseKey);

    const tiendaQuery = client
      .from("tiendas")
      .select("id, nombre, url, slug, estado_pago")
      .limit(1);

    const { data: tienda, error: tiendaError } = storeSlug.includes(".")
      ? await tiendaQuery.ilike("url", `%${storeSlug}%`).maybeSingle()
      : await tiendaQuery.eq("slug", storeSlug).maybeSingle();

    if (tiendaError || !tienda) {
      return;
    }

    if (!tienda.estado_pago) {
      showSuspendedBanner();
      return;
    }

    const { data: productos, error: productosError } = await client
      .from("productos")
      .select("id, nombre, precio, categoria, imagen_url, visible, tienda_id")
      .eq("tienda_id", tienda.id)
      .eq("visible", true)
      .order("nombre", { ascending: true });

    if (productosError) return;

    renderProductos(productos);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch(() => {});
    });
  } else {
    init().catch(() => {});
  }
})();
