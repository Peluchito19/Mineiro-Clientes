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

  // Cargar datos del sitio (puede no existir aún)
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("site_id", siteId)
    .maybeSingle();

  // Cargar elementos del sitio
  const { data: elements, error: elementsError } = await supabase
    .from("elements")
    .select("*")
    .eq("site_id", siteId)
    .order("context", { ascending: true });

  // Si hay error de tabla no existe, devolver array vacío
  const safeElements = elementsError ? [] : (elements || []);

  return (
    <EditorClient
      siteId={siteId}
      site={site || { site_id: siteId, url: null }}
      initialElements={safeElements}
      userId={user.id}
    />
  );
}
