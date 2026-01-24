import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Cliente con service_role para bypass de RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zzgyczbiufafthizurbv.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, table, data, where } = body;

    console.log("Edit API llamada:", { action, table, where });

    // Validar tablas permitidas
    const allowedTables = ["tiendas", "productos", "testimonios"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: "Tabla no permitida" }, { status: 400, headers: corsHeaders });
    }

    if (!where || Object.keys(where).length === 0) {
      return NextResponse.json({ error: "Se requiere condición where" }, { status: 400, headers: corsHeaders });
    }

    let result = null;

    if (action === "update") {
      // Construir query manualmente para evitar problemas con el encadenamiento
      let query = supabaseAdmin.from(table).update(data);
      
      // Aplicar todas las condiciones where
      const whereEntries = Object.entries(where);
      for (const [key, value] of whereEntries) {
        query = query.eq(key, value);
      }
      
      // NO usar .single() - usar .select() y tomar el primero
      const { data: updated, error } = await query.select();
      
      if (error) {
        console.error("Update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }
      
      // Tomar el primer resultado si existe
      result = updated && updated.length > 0 ? updated[0] : null;
      
      if (!result) {
        // Si no se actualizó nada, puede que no exista - intentar verificar
        console.log("No se actualizó ninguna fila, verificando si existe...");
        return NextResponse.json({ 
          success: true, 
          data: null,
          message: "Actualización procesada (puede que no haya cambios)"
        }, { headers: corsHeaders });
      }
      
    } else if (action === "upsert") {
      const { data: upserted, error } = await supabaseAdmin
        .from(table)
        .upsert(data)
        .select();
      
      if (error) {
        console.error("Upsert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }
      
      result = upserted && upserted.length > 0 ? upserted[0] : null;
    } else {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400, headers: corsHeaders });
    }

    console.log("Operación exitosa:", result?.id || "sin ID");
    return NextResponse.json({ success: true, data: result }, { headers: corsHeaders });
    
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "Mineiro Edit API v1.1 - Sin restricciones de pago",
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}
