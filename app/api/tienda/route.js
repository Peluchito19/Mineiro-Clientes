import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zzgyczbiufafthizurbv.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Buscar tienda por slug o hostname
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let slug = searchParams.get("slug");
    const hostname = searchParams.get("hostname");

    console.log("Buscando tienda:", { slug, hostname });

    if (!slug && !hostname) {
      return NextResponse.json({ error: "Se requiere slug o hostname" }, { status: 400, headers: corsHeaders });
    }

    // Normalizar el slug (quitar sufijos como .vercel.app si alguien lo pasa completo)
    if (slug) {
      slug = slug.replace('.vercel.app', '').replace(/\./g, '-');
    }

    let tienda = null;
    
    // 1. Buscar por slug exacto
    if (slug) {
      const { data } = await supabaseAdmin
        .from("tiendas")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      tienda = data;
      if (tienda) console.log("Encontrada por slug exacto:", tienda.nombre_negocio);
    }

    // 2. Si no se encontró, buscar por url_web exacta (Vercel)
    if (!tienda && hostname) {
      const { data } = await supabaseAdmin
        .from("tiendas")
        .select("*")
        .ilike("url_web", `%${hostname}%`)
        .maybeSingle();
      tienda = data;
      if (tienda) console.log("Encontrada por url_web:", tienda.nombre_negocio);
    }
    
    // 3. Buscar si el slug está contenido en nombre_negocio (normalizado)
    if (!tienda && slug) {
      const { data: allTiendas } = await supabaseAdmin
        .from("tiendas")
        .select("*");
      
      if (allTiendas) {
        // Buscar coincidencia exacta del slug en nombre normalizado
        tienda = allTiendas.find(t => {
          const nombreNorm = t.nombre_negocio?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const slugNorm = slug.toLowerCase();
          return nombreNorm === slugNorm || t.slug === slugNorm;
        });
        
        if (tienda) console.log("Encontrada por nombre normalizado:", tienda.nombre_negocio);
      }
    }

    if (!tienda) {
      console.log("Tienda no encontrada para:", { slug, hostname });
      return NextResponse.json({ 
        found: false, 
        message: "Tienda no encontrada",
        searched: { slug, hostname }
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ 
      found: true, 
      tienda 
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("Error buscando tienda:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST - Crear o actualizar tienda
export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, nombre, url_web, site_config } = body;

    if (!slug) {
      return NextResponse.json({ error: "Se requiere slug" }, { status: 400, headers: corsHeaders });
    }

    // Buscar si ya existe
    const { data: existing } = await supabaseAdmin
      .from("tiendas")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let tienda;

    if (existing) {
      // Actualizar
      const { data, error } = await supabaseAdmin
        .from("tiendas")
        .update({ 
          nombre_negocio: nombre || existing.nombre_negocio,
          url_web: url_web || existing.url_web,
          site_config: site_config || existing.site_config
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      tienda = data;
    } else {
      // Crear nueva
      const { data, error } = await supabaseAdmin
        .from("tiendas")
        .insert({
          slug,
          nombre_negocio: nombre || slug,
          url_web: url_web || "",
          plan: "trial",
          estado_pago: false,
          site_config: site_config || {}
        })
        .select()
        .single();

      if (error) throw error;
      tienda = data;
    }

    return NextResponse.json({ success: true, tienda }, { headers: corsHeaders });

  } catch (error) {
    console.error("Error creando tienda:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
