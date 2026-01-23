import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

  // Get all tiendas for this user (multiple stores support)
  const { data: tiendas } = await supabase
    .from("tiendas")
    .select("id, nombre_negocio, url_web, slug, estado_pago, plan, user_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // Get first tienda as default (or null if none)
  const tienda = tiendas?.[0] ?? null;

  // Get productos for the first tienda
  let productos = [];
  if (tienda) {
    const { data: prods } = await supabase
      .from("productos")
      .select("id, nombre, precio, categoria, visible, user_id, tienda_id, imagen_url, configuracion, dom_id")
      .eq("tienda_id", tienda.id)
      .order("nombre", { ascending: true });
    productos = prods ?? [];
  }

  return (
    <DashboardClient
      userId={user.id}
      initialTiendas={tiendas ?? []}
      initialTienda={tienda}
      initialProductos={productos}
    />
  );
}
