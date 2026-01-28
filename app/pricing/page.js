import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PricingClient from "./PricingClient";

// Demo emails with unlimited free access
const UNLIMITED_ACCESS_EMAILS = [
  "natocontreras.xxi@gmail.com",
];

export const metadata = {
  title: "Planes y Precios",
  description: "Elige el plan Mineiro que mejor se adapte a tu negocio. Prueba gratuita de 5 días sin compromiso.",
};

export default async function PricingPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center text-slate-300">
          <h1 className="text-xl font-semibold text-white mb-2">
            Configuración incompleta
          </h1>
          <p>Las variables de entorno de Supabase no están configuradas.</p>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's tienda to check current plan
  const { data: tienda } = await supabase
    .from("tiendas")
    .select("id, plan, estado_pago, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasUnlimitedAccess = UNLIMITED_ACCESS_EMAILS.includes(user.email?.toLowerCase());

  return (
    <PricingClient 
      userId={user.id} 
      userEmail={user.email}
      tienda={tienda} 
      hasUnlimitedAccess={hasUnlimitedAccess}
    />
  );
}
