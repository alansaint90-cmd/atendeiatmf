"use client";
import { useEffect, useState } from "react";
import { chatbotExample } from "@/lib/chatbots/defaults";
import { type Chatbot } from "@/lib/chatbots/schema";
import { errorMessage, loadChatbots, saveChatbots, type Snapshot } from "@/lib/chatbots/repository";
import { ChatbotEditor } from "./editor";
import { useHydrated } from "@/lib/use-hydrated";

export function ChatbotsPage() {
  const hydrated = useHydrated();
  return hydrated ? <ChatbotsLoaded /> : <p role="status">Carregando chatbots…</p>;
}

function ChatbotsLoaded() {
  const [initial] = useState(() => {
    try { return { snapshot: loadChatbots(localStorage), error: "" }; }
    catch (error) { return { snapshot: null, error: errorMessage(error) }; }
  });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initial.snapshot);
  const [selected, setSelected] = useState(initial.snapshot?.bots[0]?.id ?? "");
  const [context, setContext] = useState(initial.snapshot?.bots[0]?.context ?? "");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initial.error);
  const [editor, setEditor] = useState<{ bot: Chatbot; creating: boolean } | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function save(bots: Chatbot[]): boolean {
    if (!snapshot) return false;
    try { const data = saveChatbots(localStorage, bots, snapshot.revision); setSnapshot(data); setError(""); setMessage("Configurações salvas neste navegador."); return true; }
    catch (error) { setError(errorMessage(error)); return false; }
  }
  const discard = () => !dirty || window.confirm("Descartar as alterações não salvas do contexto geral?");
  return <>
    <section className="page-head"><div><h1>Chatbots de IA</h1><p>Configure seus assistentes e o prompt de atendimento.</p></div><button className="primary" data-new-bot disabled={!snapshot} onClick={() => {
      if (!discard()) return; setDirty(false); setContext(snapshot?.bots.find(item => item.id === selected)?.context ?? ""); setError("");
      setEditor({ creating: true, bot: { ...structuredClone(chatbotExample), id: crypto.randomUUID(), identifier: "", persona: "", mission: "", context: "", personalities: ["Profissional"] } });
    }}>+ Novo chatbot de IA</button></section>
    {snapshot && <><article className="panel"><h2>Seus assistentes</h2><p className="bot-local-note">Configurações salvas neste navegador. A conexão com IA e WhatsApp ainda depende de integração.</p><div className="table"><table><thead><tr><th>Identificador</th><th>Persona</th><th>Personalidade</th><th>Ações</th></tr></thead><tbody>{snapshot.bots.map(bot => <tr key={bot.id}><td>{bot.identifier}</td><td>{bot.persona}</td><td>{bot.personalities.join(" · ")}</td><td><button className="secondary" data-edit-bot={bot.id} onClick={() => {
      if (!discard()) return; setDirty(false); setContext(snapshot.bots.find(item => item.id === selected)?.context ?? ""); setError(""); setEditor({ bot, creating: false });
    }}>Configurar</button></td></tr>)}</tbody></table></div></article>
    {!!snapshot.bots.length && <form className="panel form-panel" onSubmit={event => { event.preventDefault(); if (save(snapshot.bots.map(bot => bot.id === selected ? { ...bot, context } : bot))) setDirty(false); }}>
      <h2>Contexto geral</h2><p>Prompt de atendimento. Edite as instruções, os produtos e as respostas do assistente.</p>
      <label>Chatbot<select name="contextBot" value={selected} onChange={event => {
        if (!discard()) return; setSelected(event.target.value); setContext(snapshot.bots.find(bot => bot.id === event.target.value)?.context ?? ""); setDirty(false); setMessage("");
      }}>{snapshot.bots.map(bot => <option key={bot.id} value={bot.id}>{bot.identifier}</option>)}</select></label>
      <label>Prompt de atendimento<textarea name="generalContext" rows={18} maxLength={200000} value={context} onChange={event => { setContext(event.target.value); setDirty(true); setMessage(""); }} /></label>
      <small>{context.length.toLocaleString("pt-BR")} caracteres{dirty ? " · Alterações não salvas" : ""}</small><div><button className="primary">Salvar contexto geral</button></div>
    </form>}</>}
    <p role="status">{message}</p><p role="alert" className="error-message">{error}</p>
    {editor && snapshot && <ChatbotEditor initial={editor.bot} creating={editor.creating} error={error} onClose={() => { setEditor(null); setError(""); }} onSave={bot => {
      const next = editor.creating ? [...snapshot.bots, bot] : snapshot.bots.map(item => item.id === bot.id ? bot : item);
      if (save(next)) { setSelected(bot.id); setContext(bot.context); setDirty(false); setEditor(null); }
    }} />}
  </>;
}
