import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";

export async function POST(request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Mercado Pago can send either `data.id` or `id`.
  const paymentId = payload?.data?.id || payload?.id;
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  const client = new MercadoPagoConfig({ accessToken });
  const paymentClient = new Payment(client);

  try {
    const payment = await paymentClient.get({ id: paymentId });
    const status = payment?.status;
    const metadata = payment?.metadata || {};
    const tiendaId = metadata?.tienda_id || payment?.external_reference;
    const amount =
      payment?.transaction_amount ??
      payment?.transaction_details?.total_paid_amount ??
      payment?.transaction_details?.net_received_amount;
    const resolvedPlan =
      amount && amount >= 500000 ? "anual" : "mensual";

    if (status === "approved" && tiendaId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      await supabase
        .from("tiendas")
        .update({ estado_pago: true, plan: resolvedPlan })
        .eq("id", tiendaId);
    }
  } catch {
    // Ignore webhook errors; Mercado Pago will retry.
  }

  return NextResponse.json({ ok: true });
}
