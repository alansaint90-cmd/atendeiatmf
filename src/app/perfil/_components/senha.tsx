"use client";
import { useState } from "react";
import { trocarMinhaSenha } from "@/lib/actions/seguranca";
import { ModalConfirmacaoBlock } from "@/components/modal-confirmacao-block";
export function Senha() {
  const [atual, setAtual] = useState(""); const [nova, setNova] = useState("");
  const [mensagem, setMensagem] = useState(""); const [confirmar, setConfirmar] = useState(false); const [ocupado, setOcupado] = useState(false);
  async function salvar() {
    setOcupado(true);
    try { const r = await trocarMinhaSenha({ atual, nova });
      if (!r.ok) { setMensagem(r.erro); return; }
      setAtual(""); setNova(""); setMensagem(`${r.dados.aviso ?? "Senha atualizada."} Todas as sessões foram encerradas. Entre novamente.`);
    } catch { setMensagem("Não foi possível alterar a senha."); } finally { setOcupado(false); setConfirmar(false); }
  }
  return <section className="panel"><h2>Minha senha</h2><form className="form-panel" onSubmit={e => { e.preventDefault(); setConfirmar(true); }}>
    <label>Senha atual<input type="password" autoComplete="current-password" maxLength={256} value={atual} onChange={e => setAtual(e.target.value)} /></label>
    <small>Se sua conta foi criada antes do login por senha, deixe a senha atual vazia.</small>
    <label>Nova senha<input type="password" required minLength={15} maxLength={256} autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} /></label>
    <button disabled={ocupado}>Alterar senha</button></form>{mensagem && <p role="status">{mensagem} <a href="/entrar">Entrar</a></p>}
    <ModalConfirmacaoBlock aberto={confirmar} titulo="Alterar senha" mensagem="A senha será alterada e todas as suas sessões serão encerradas." carregando={ocupado} onCancelar={() => setConfirmar(false)} onConfirmar={() => void salvar()} />
  </section>;
}
