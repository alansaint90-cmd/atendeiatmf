"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export function FormularioPasskey() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [aviso, setAviso] = useState("");
  const [convite, setConvite] = useState(""); const [erro, setErro] = useState(""); const [carregando, setCarregando] = useState(false);
  async function entrar(registro: boolean) {
    setErro(""); setCarregando(true);
    try {
      if (registro) {
        const resposta = await fetch("/api/auth/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "concluir_registro_senha", convite, senha }) });
        const resultado = await resposta.json() as { erro?: string; aviso?: string };
        if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível criar o acesso.");
        if (resultado.aviso) setAviso(resultado.aviso);
        setConvite("");
      } else {
        const resposta = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha, lembrar: true }) });
        const resultado = await resposta.json() as { erro?: string };
        if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível entrar.");
      }
      setSenha("");
      router.push("/"); router.refresh();
    } catch { setErro("Não foi possível concluir o acesso. Verifique o código do convite e tente novamente."); }
    finally { setCarregando(false); }
  }
  return <section className="form-card"><h1>Entrar no Atende AI</h1><p>Acesse com seu e-mail e senha. No primeiro acesso, o código do convite libera o painel imediatamente.</p>
    {erro && <p role="alert">{erro}</p>}{aviso && <p role="status">{aviso}</p>}
    <form onSubmit={e => { e.preventDefault(); void entrar(false); }}>
      <label>E-mail<input type="email" required maxLength={254} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Senha<input type="password" required maxLength={256} autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <button className="primary" disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
    </form>
    <details><summary>Primeiro acesso com convite</summary><label>Convite<input type="password" autoComplete="off" value={convite} maxLength={43} onChange={e => setConvite(e.target.value)} /></label>
      <label>Defina sua senha<input type="password" autoComplete="new-password" minLength={15} maxLength={256} value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <small>Use uma frase exclusiva com pelo menos 15 caracteres. O código não é salvo no navegador.</small>
      <button disabled={carregando || convite.length !== 43 || senha.length < 15} onClick={() => void entrar(true)}>Criar senha e entrar</button></details>
    <Link href="/">Voltar ao painel</Link>
  </section>;
}
