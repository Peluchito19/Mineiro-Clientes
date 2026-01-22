import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
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
