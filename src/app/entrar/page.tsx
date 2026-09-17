import { redirect } from "next/navigation";
import Link from "next/link";
import { obterSessao } from "@/lib/auth/sessao";
import { FormularioPasskey } from "./_components/formulario";
import { Marca } from "@/components/marca";
export const dynamic = "force-dynamic";
export default async function Entrar() {
  if (process.env.AUTH_LOGIN_ENABLED !== "true") return <main className="content"><h1>Acesso individual em preparação</h1><p>A autenticação individual ainda não foi ativada neste ambiente.</p><Link href="/">Voltar ao painel</Link></main>;
  if (await obterSessao()) redirect("/crm");
  return <main className="auth-shell"><section className="auth-panel"><Marca grande slogan /><FormularioPasskey /></section></main>;
}
