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
    const allowedTables = ["tiendas", "productos", "testimonios", "elements"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: "Tabla no permitida" }, { status: 400, headers: corsHeaders });
    }

    // Para delete, where puede estar vacío si se quiere borrar por otras condiciones
    if (action !== "delete" && (!where || Object.keys(where).length === 0)) {
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
        // IMPORTANTE: Si no se actualizó nada, es un ERROR - el registro no existe
        console.error("UPDATE FALLÓ: No se encontró registro con", where);
        return NextResponse.json({ 
          success: false, 
          error: `No se encontró el registro para actualizar. Condición: ${JSON.stringify(where)}`,
          data: null
        }, { status: 404, headers: corsHeaders });
      }
      
      console.log("UPDATE exitoso:", table, where, "->", result?.id);
      
    } else if (action === "clear-elements") {
      // Limpiar todos los elementos registrados de una tienda
      const tiendaId = where?.tienda_id;
      if (!tiendaId) {
        return NextResponse.json({ error: "Se requiere tienda_id" }, { status: 400, headers: corsHeaders });
      }
      
      const { data: deleted, error } = await supabaseAdmin
        .from("elements")
        .delete()
        .eq("tienda_id", tiendaId)
        .select();
      
      if (error) {
        console.error("Clear elements error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }
      
      console.log(`Limpiados ${deleted?.length || 0} elementos de tienda ${tiendaId}`);
      result = { cleared: deleted?.length || 0 };
      
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
    } else if (action === "delete") {
      // Si no hay where, no borrar nada (seguridad)
      if (!where || Object.keys(where).length === 0) {
        return NextResponse.json({ success: true, data: [], message: "Sin condiciones, no se borró nada" }, { headers: corsHeaders });
      }

      let query = supabaseAdmin.from(table).delete();

      const whereEntries = Object.entries(where);
      for (const [key, value] of whereEntries) {
        query = query.eq(key, value);
      }

      // Intentar borrar, si falla por columna inexistente, ignorar
      try {
        const { data: deleted, error } = await query.select();

        if (error) {
          // Si el error es por columna inexistente, ignorar silenciosamente
          if (error.message.includes("does not exist") || error.code === "42703") {
            console.log(`Columna no existe en ${table}, ignorando delete:`, error.message);
            return NextResponse.json({ success: true, data: [], message: "Tabla sin esa columna, ignorado" }, { headers: corsHeaders });
          }
          console.error("Delete error:", error);
          return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
        }

        result = deleted ?? [];
      } catch (deleteErr) {
        console.log("Delete exception (ignorada):", deleteErr.message);
        result = [];
      }
    } else if (action === "insert") {
      // INSERT: Crear nuevo registro
      // Validar que el precio no exceda el límite de integer si existe
      if (data.precio && typeof data.precio === 'number') {
        const MAX_INT = 2147483647;
        if (data.precio > MAX_INT) {
          return NextResponse.json({ 
            error: `El precio ${data.precio} es demasiado grande. Máximo: ${MAX_INT.toLocaleString()}` 
          }, { status: 400, headers: corsHeaders });
        }
      }
      
      const { data: inserted, error } = await supabaseAdmin
        .from(table)
        .insert(data)
        .select();
      
      if (error) {
        console.error("Insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
      }
      
      result = inserted && inserted.length > 0 ? inserted[0] : null;
      console.log("Producto insertado:", result?.id);
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
