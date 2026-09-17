import { redirect } from "next/navigation";
import Link from "next/link";
import { obterSessao } from "@/lib/auth/sessao";
import { minhasSessoes } from "@/lib/actions/sessoes";
import { Sessoes } from "./_components/sessoes";
export const dynamic = "force-dynamic";
export default async function Perfil() {
  if (!await obterSessao()) redirect("/entrar"); const r = await minhasSessoes();
  return <main className="content"><h1>Meu perfil · Segurança</h1><Link href="/crm">Voltar ao CRM</Link><p>Acesso por passkey com verificação do usuário. Sessões expiram em até 24 horas ou após uma hora sem atividade.</p>
    {r.ok ? <Sessoes inicial={r.dados} /> : <p role="alert">{r.erro}</p>}</main>;
}
