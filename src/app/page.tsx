import { Workspace } from "@/components/workspace";
import { obterSessao } from "@/lib/auth/sessao";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  return <Workspace papel={sessao.papel} nome={sessao.nome} />;
}
