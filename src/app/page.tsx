import { Workspace } from "@/components/workspace";
import { obterSessao } from "@/lib/auth/sessao";
import { redirect } from "next/navigation";
import { nav } from "@/lib/demo/data";
import { lerPerfil } from "@/lib/perfil/servico";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  const { view } = await searchParams;
  const gestor = sessao.papel === "admin" || sessao.papel === "super_admin";
  const permitido = nav.some(([id]) => id === view && (gestor || !["settings", "team", "followups", "tags", "agendamentos", "chatbot", "flows", "campaigns"].includes(id)));
  const perfil = await lerPerfil(db(), sessao);
  return <Workspace papel={sessao.papel} nome={sessao.nome} email={sessao.email} foto={perfil.foto} rotaInicial={permitido && view ? view : "dashboard"} />;
}
