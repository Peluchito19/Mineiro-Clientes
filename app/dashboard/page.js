import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("id, nombre, url, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: productos } = await supabase
    .from("productos")
    .select("id, nombre, precio, categoria, visible, user_id, imagen_url")
    .eq("user_id", user.id)
    .order("nombre", { ascending: true });

  return (
    <DashboardClient
      userId={user.id}
      initialTienda={tienda ?? null}
      initialProductos={productos ?? []}
    />
  );
}
