"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export function FormularioRecuperacao() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    const recebido = window.location.hash.slice(1);
    if (recebido) {
      window.history.replaceState(null, "", window.location.pathname);
      queueMicrotask(() => {
        if (/^[A-Za-z0-9_-]{43}$/.test(recebido)) setToken(recebido);
        else setErro("Link inválido. Solicite uma nova recuperação de senha.");
      });
    }
  }, []);
  async function enviar() {
    setErro("");
    if (token && senha !== confirmacao) { setErro("As senhas precisam ser iguais."); return; }
    setCarregando(true);
    try {
      const resposta = await fetch("/api/auth/recuperacao", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { acao: "redefinir", token, senha } : { acao: "solicitar", email }) });
      const dados = await resposta.json();
      if (!resposta.ok) { setErro(typeof dados.erro === "string" ? dados.erro : "Não foi possível concluir. Tente novamente."); return; }
      setMensagem(`${dados.mensagem}${dados.aviso ? ` ${dados.aviso}` : ""}`);
      setSenha(""); setConfirmacao(""); setToken("");
    } catch { setErro("Não foi possível conectar ao servidor. Tente novamente."); }
    finally { setCarregando(false); }
  }
  return <section className="form-card">
    <h1>{token ? "Definir nova senha" : "Recuperar senha"}</h1>
    {erro && <p role="alert">{erro}</p>}
    {mensagem ? <p role="status">{mensagem}</p> : <>
      <p>{token ? "Escolha uma frase exclusiva com pelo menos 15 caracteres. Suas sessões atuais serão encerradas." : "Informe seu e-mail para receber um link de recuperação válido por 15 minutos."}</p>
      <form onSubmit={e => { e.preventDefault(); void enviar(); }} aria-busy={carregando}>
        {token ? <>
          <label htmlFor="nova-senha">Nova senha</label>
          <input id="nova-senha" type="password" autoComplete="new-password" required minLength={15} maxLength={256}
            value={senha} onChange={e => setSenha(e.target.value)} />
          <label htmlFor="confirmar-senha">Confirmar nova senha</label>
          <input id="confirmar-senha" type="password" autoComplete="new-password" required minLength={15} maxLength={256}
            value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
        </> : <>
          <label htmlFor="recuperacao-email">E-mail</label>
          <input id="recuperacao-email" type="email" autoComplete="email" required maxLength={254}
            value={email} onChange={e => setEmail(e.target.value)} />
        </>}
        <button type="submit" className="primary" disabled={carregando}>{carregando ? "Aguarde…" : token ? "Salvar nova senha" : "Enviar link de recuperação"}</button>
      </form>
    </>}
    <Link href="/entrar">Voltar para entrar</Link>
  </section>;
}
