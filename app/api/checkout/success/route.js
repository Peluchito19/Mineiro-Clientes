import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// Trial period in days
const TRIAL_DAYS = 3;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tiendaId = searchParams.get("tiendaId");
  const status = searchParams.get("status");
  const plan = searchParams.get("plan") || "mensual";

  const headersList = await headers();
  const origin =
    headersList.get("origin") ||
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

  // Calculate trial end date (3 days from now)
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  // Update tienda with trial info - payment method has been entered
  // The user gets 3 days free, then will be charged
  await supabase
    .from("tiendas")
    .update({ 
      estado_pago: true,  // Activate immediately for trial
      plan: plan,
      trial_ends_at: trialEndsAt.toISOString(),
      payment_method_added: true,
    })
    .eq("id", tiendaId);

  return NextResponse.redirect(`${origin}/dashboard?status=trial-started`);
}
