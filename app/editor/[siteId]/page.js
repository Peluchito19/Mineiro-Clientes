import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import EditorClient from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }) {
  const { siteId } = await params;
  const supabase = await createClient();

  // Verificar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Cargar datos del sitio
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("site_id", siteId)
    .single();

  // Cargar elementos del sitio
  const { data: elements } = await supabase
    .from("elements")
    .select("*")
    .eq("site_id", siteId)
    .order("context", { ascending: true });

  return (
    <EditorClient
      siteId={siteId}
      site={site}
      initialElements={elements || []}
      userId={user.id}
    />
  );
}
