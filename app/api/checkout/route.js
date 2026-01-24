import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Preference } from "mercadopago";

const PRICING = {
  mensual: { title: "Plan Mensual Mineiro", unit_price: 50000 },
  anual: { title: "Plan Anual Mineiro", unit_price: 500000 },
};

// Demo emails with unlimited free access
const UNLIMITED_ACCESS_EMAILS = [
  "natocontreras.xxi@gmail.com",
];

// Trial period in days
const TRIAL_DAYS = 3;

export async function POST(request) {
  const cookieStore = await cookies();
  const headersList = await headers();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
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

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("id, nombre_negocio")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tienda) {
    return NextResponse.json(
      { error: "No se encontró la tienda del usuario." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const plan = body?.plan === "anual" ? "anual" : "mensual";
  const selectedPlan = PRICING[plan];

  const origin =
    headersList.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const successUrl = `${origin}/api/checkout/success?tiendaId=${encodeURIComponent(
    tienda.id
  )}&plan=${encodeURIComponent(plan)}&status=approved`;
  const pendingUrl = `${origin}/pricing?status=pending`;
  const failureUrl = `${origin}/pricing?status=failure`;

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Falta MERCADOPAGO_ACCESS_TOKEN en el entorno." },
      { status: 500 }
    );
  }

  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  try {
    const { init_point, sandbox_init_point } = await preference.create({
      body: {
        items: [
          {
            title: selectedPlan.title,
            quantity: 1,
            unit_price: selectedPlan.unit_price,
            currency_id: "CLP",
          },
        ],
        back_urls: {
          success: successUrl,
          pending: pendingUrl,
          failure: failureUrl,
        },
        auto_return: "approved",
        metadata: {
          user_id: user.id,
          tienda_id: tienda.id,
          plan,
        },
        external_reference: `${tienda.id}`,
      },
    });

    return NextResponse.json({ init_point, sandbox_init_point });
  } catch (err) {
    console.error("MercadoPago error:", err);
    return NextResponse.json(
      { error: "Error creating payment preference" },
      { status: 500 }
    );
  }
}
