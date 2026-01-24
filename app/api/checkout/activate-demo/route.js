import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Demo emails with unlimited free access
const UNLIMITED_ACCESS_EMAILS = [
  "natocontreras.xxi@gmail.com",
];

export async function POST() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has unlimited access
  if (!UNLIMITED_ACCESS_EMAILS.includes(user.email?.toLowerCase())) {
    return NextResponse.json({ error: "No tienes acceso ilimitado." }, { status: 403 });
  }

  // Use service role to update tienda
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Get user's tiendas and activate them all
  const { data: tiendas, error: fetchError } = await adminSupabase
    .from("tiendas")
    .select("id")
    .eq("user_id", user.id);

  if (fetchError) {
    return NextResponse.json({ error: "Error fetching stores" }, { status: 500 });
  }

  if (!tiendas || tiendas.length === 0) {
    return NextResponse.json({ error: "No tienes tiendas para activar." }, { status: 404 });
  }

  // Activate all tiendas
  const { error: updateError } = await adminSupabase
    .from("tiendas")
    .update({ 
      estado_pago: true, 
      plan: "unlimited",
    })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Error activating stores" }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    message: "¡Acceso ilimitado activado!", 
    activated: tiendas.length 
  });
}
