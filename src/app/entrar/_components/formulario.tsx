"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";

async function requisitar<T>(entrada: unknown): Promise<T> {
  const resposta = await fetch("/api/auth/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
  if (!resposta.ok) throw new Error("Não foi possível autenticar. Confira o acesso e tente novamente.");
  return resposta.json() as Promise<T>;
}
export function FormularioPasskey() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [aviso, setAviso] = useState("");
  const [convite, setConvite] = useState(""); const [erro, setErro] = useState(""); const [carregando, setCarregando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  async function entrar(registro: boolean) {
    setErro(""); setCarregando(true);
    let avisoCadastro = "";
    try {
      if (registro) {
        const { options, aviso } = await requisitar<{ options: PublicKeyCredentialCreationOptionsJSON; aviso?: string }>({ acao: "iniciar_registro", convite, senha });
        if (aviso) { setAviso(aviso); avisoCadastro = aviso; }
        const resposta = await startRegistration({ optionsJSON: options });
        await requisitar({ acao: "concluir_registro", resposta }); setConvite("");
      } else {
        const resposta = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha, lembrar: true }) });
        const resultado = await resposta.json() as { erro?: string };
        if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível entrar.");
      }
      setSenha("");
      if (avisoCadastro) { setConcluido(true); return; }
      router.push("/"); router.refresh();
    } catch { setErro("Não foi possível concluir o acesso. Verifique sua passkey ou o convite e tente novamente."); }
    finally { setCarregando(false); }
  }
  if (concluido) return <section className="form-card"><h1>Acesso criado</h1><p role="status">{aviso}</p><Link href="/">Continuar para o painel</Link></section>;
  return <section className="form-card"><h1>Entrar no Atende AI</h1><p>Acesse com seu e-mail e senha e confirme com a passkey do seu dispositivo.</p>
    {erro && <p role="alert">{erro}</p>}{aviso && <p role="status">{aviso}</p>}
    <form onSubmit={e => { e.preventDefault(); void entrar(false); }}>
      <label>E-mail<input type="email" required maxLength={254} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Senha<input type="password" required maxLength={256} autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <button className="primary" disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
    </form>
    <details><summary>Primeiro acesso com convite</summary><label>Convite<input type="password" autoComplete="off" value={convite} maxLength={43} onChange={e => setConvite(e.target.value)} /></label>
      <label>Defina sua senha<input type="password" autoComplete="new-password" minLength={15} maxLength={256} value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <small>Use uma frase exclusiva com pelo menos 15 caracteres. Você cadastrará a passkey na próxima etapa.</small>
      <button disabled={carregando || convite.length !== 43 || senha.length < 15} onClick={() => void entrar(true)}>Criar senha e cadastrar passkey</button></details>
    <Link href="/">Voltar ao painel</Link>
  </section>;
}
