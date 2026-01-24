import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
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
      get(name) {
        return cookieStore.get(name)?.value;
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have redirected, but just in case
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center text-slate-300">
          <h1 className="text-xl font-semibold text-white mb-2">
            Sesión no encontrada
          </h1>
          <p>Por favor <a href="/login" className="text-cyan-400 underline">inicia sesión</a>.</p>
        </div>
      </div>
    );
  }

  // Get all tiendas for this user
  const { data: tiendas } = await supabase
    .from("tiendas")
    .select("id, nombre_negocio, url_web, slug, estado_pago, plan, user_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // Get first tienda as default
  const tienda = tiendas?.[0] ?? null;

  // Get productos for the first tienda
  return (
    <DashboardClient
      userId={user.id}
      userEmail={user.email}
      initialTiendas={tiendas ?? []}
      initialTienda={tienda}
    />
  );
}
