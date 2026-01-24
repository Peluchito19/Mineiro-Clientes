import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Cliente con service_role para bypass de RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zzgyczbiufafthizurbv.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, table, data, where } = body;

    // Validar tablas permitidas
    const allowedTables = ["tiendas", "productos", "testimonios"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 });
    }

    let result;

    if (action === "update") {
      const query = supabaseAdmin.from(table).update(data);
      
      // Aplicar condiciones where
      for (const [key, value] of Object.entries(where)) {
        query.eq(key, value);
      }
      
      const { data: updated, error } = await query.select().single();
      
      if (error) {
        console.error("Update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = updated;
    } else if (action === "upsert") {
      const { data: upserted, error } = await supabaseAdmin
        .from(table)
        .upsert(data)
        .select()
        .single();
      
      if (error) {
        console.error("Upsert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = upserted;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// También permitir GET para verificar que la API funciona
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "Mineiro Edit API v1.0",
    timestamp: new Date().toISOString()
  });
}
