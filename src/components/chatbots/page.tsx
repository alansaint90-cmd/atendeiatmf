"use client";
import { useEffect, useState } from "react";
import { carregarChatbots, salvarChatbot } from "@/lib/actions/chatbots";
import { chatbotExample } from "@/lib/chatbots/defaults";
import type { ChatbotPersistido } from "@/lib/chatbots/server-repository";
import { type Chatbot } from "@/lib/chatbots/schema";
import { ChatbotEditor } from "./editor";

export function ChatbotsPage() {
  const [itens, setItens] = useState<ChatbotPersistido[] | null>(null);
  const [selected, setSelected] = useState("");
  const [context, setContext] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ bot: Chatbot; registro: ChatbotPersistido | null } | null>(null);

  useEffect(() => {
    let ativo = true;
    void carregarChatbots().then(resultado => {
      if (!ativo) return;
      if (!resultado.ok) { setError(resultado.erro); setItens([]); return; }
      const dados = resultado.dados;
      setItens(dados);
      const primeiro = dados[0];
      if (primeiro) { setSelected(primeiro.id); setContext(primeiro.configuracao.context); }
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const discard = () => !dirty || window.confirm("Descartar as alterações não salvas do prompt de atendimento?");
  async function persistir(bot: Chatbot, registro: ChatbotPersistido | null) {
    if (saving) return false;
    setSaving(true); setError(""); setMessage("");
    try {
      const resultado = await salvarChatbot({ id: registro?.id ?? null, versao: registro?.versao ?? null, configuracao: bot });
      if (!resultado.ok) { setError(resultado.erro); return false; }
      setItens(atuais => [...(atuais ?? []).filter(item => item.id !== resultado.dados.id), resultado.dados]
        .sort((a, b) => a.configuracao.identifier.localeCompare(b.configuracao.identifier, "pt-BR")));
      setSelected(resultado.dados.id); setContext(resultado.dados.configuracao.context); setDirty(false);
      setMessage("Configuração salva no servidor. O agente usará estas instruções nas próximas mensagens.");
      return true;
    } catch {
      setError("Não foi possível salvar o prompt. Confira a conexão e tente novamente; sua edição permanece nesta tela.");
      return false;
    } finally { setSaving(false); }
  }

  if (itens === null) return <p role="status">Carregando chatbots…</p>;
  const selecionado = itens.find(item => item.id === selected) ?? null;
  return <>
    <section className="page-head"><div><h1>Chatbots de IA</h1><p>Configure as instruções prioritárias do agente no WhatsApp.</p></div><button className="primary" data-new-bot disabled={saving} onClick={() => {
      if (!discard()) return;
      setEditor({ registro: null, bot: { ...structuredClone(chatbotExample), id: crypto.randomUUID(), identifier: "", persona: "", mission: "", context: "", personalities: ["Profissional"] } });
    }}>+ Novo chatbot de IA</button></section>
    <article className="panel"><h2>Seus assistentes</h2><p className="bot-local-note">Configurações compartilhadas e salvas no servidor. O chatbot vinculado à Evolution controla o atendimento.</p>
      {itens.length ? <div className="table chatbot-table"><table><thead><tr><th>Identificador</th><th>Persona</th><th>Personalidade</th><th>Ações</th></tr></thead><tbody>{itens.map(item => <tr key={item.id}><td data-label="Identificador">{item.configuracao.identifier}</td><td data-label="Persona">{item.configuracao.persona}</td><td data-label="Personalidade">{item.configuracao.personalities.join(" · ")}</td><td data-label="Ações"><button className="secondary" data-edit-bot={item.id} onClick={() => {
        if (!discard()) return; setDirty(false); setContext(selecionado?.configuracao.context ?? ""); setError(""); setEditor({ bot: item.configuracao, registro: item });
      }}>Configurar</button></td></tr>)}</tbody></table></div> : <p>Nenhum chatbot cadastrado. Crie o primeiro assistente.</p>}
    </article>
    {!!itens.length && <form className="panel form-panel" onSubmit={async event => {
      event.preventDefault(); if (selecionado) await persistir({ ...selecionado.configuracao, context }, selecionado);
    }}>
      <h2>Prompt de atendimento do SDR</h2><p>Estas são as instruções usadas pelo agente para responder no WhatsApp.</p>
      <label>Chatbot<select name="contextBot" value={selected} onChange={event => {
        if (!discard()) return; const proximo = itens.find(item => item.id === event.target.value); setSelected(event.target.value); setContext(proximo?.configuracao.context ?? ""); setDirty(false); setMessage("");
      }}>{itens.map(item => <option key={item.id} value={item.id}>{item.configuracao.identifier}</option>)}</select></label>
      <label>Prompt de atendimento<textarea name="generalContext" rows={18} maxLength={200000} value={context} onChange={event => { setContext(event.target.value); setDirty(true); setMessage(""); }} /></label>
      <small>{context.length.toLocaleString("pt-BR")} caracteres{dirty ? " · Alterações não salvas" : ""}</small><div><button className="primary" disabled={saving}>{saving ? "Salvando…" : "Salvar prompt de atendimento"}</button></div>
    </form>}
    <p role="status">{message}</p><p role="alert" className="error-message">{error}</p>
    {editor && <ChatbotEditor initial={editor.bot} creating={!editor.registro} error={error} onClose={() => { setEditor(null); setError(""); }} onSave={async bot => {
      if (await persistir(bot, editor.registro)) setEditor(null);
    }} />}
  </>;
}
