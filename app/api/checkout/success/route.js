import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tiendaId = searchParams.get("tiendaId");
  const status = searchParams.get("status");

  const origin =
    headers().get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  if (!tiendaId) {
    return NextResponse.redirect(`${origin}/pricing?status=missing`);
  }

  if (status !== "approved") {
    return NextResponse.redirect(`${origin}/pricing?status=${status || "na"}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.redirect(`${origin}/pricing?status=error`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  await supabase
    .from("tiendas")
    .update({ estado_pago: true })
    .eq("id", tiendaId);

  return NextResponse.redirect(`${origin}/dashboard?status=paid`);
}
