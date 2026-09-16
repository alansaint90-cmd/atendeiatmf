"use client";
import { useState } from "react";
import { agents, conversations as initialConversations, type Conversation } from "@/lib/demo/data";

export function Inbox({ conversations, onChange }: { conversations: Conversation[]; onChange: (items: Conversation[]) => void }) {
  const [selectedId, setSelectedId] = useState(initialConversations[0].id);
  const [status, setStatus] = useState("todos");
  const [tag, setTag] = useState("todas");
  const [assignee, setAssignee] = useState("todos");
  const [reply, setReply] = useState("");
  const filtered = conversations.filter(item => (status === "todos" || item.status === status) && (tag === "todas" || item.tag === tag) && (assignee === "todos" || item.assignee === assignee));
  const selected = filtered.find(item => item.id === selectedId) ?? filtered[0];
  const update = (patch: Partial<Conversation>) => { if (selected) onChange(conversations.map(item => item.id === selected.id ? { ...item, ...patch } : item)); };
  return <section className="inbox-layout"><aside className="conversation-list"><div className="filters">
    <select aria-label="Status da conversa" value={status} onChange={e => setStatus(e.target.value)}>{["todos", "aberta", "pendente", "encerrada"].map(value => <option key={value}>{value}</option>)}</select>
    <select aria-label="Tag" value={tag} onChange={e => setTag(e.target.value)}>{["todas", "novo lead", "suporte", "premium", "campanha"].map(value => <option key={value}>{value}</option>)}</select>
    <select aria-label="Atendente" value={assignee} onChange={e => setAssignee(e.target.value)}>{["todos", ...agents.map(item => String(item[0]))].map(value => <option key={value}>{value}</option>)}</select>
  </div>{filtered.map(item => <button className={`conversation ${selected?.id === item.id ? "active" : ""}`} key={item.id} onClick={() => { setSelectedId(item.id); setReply(""); }}><strong>{item.name}</strong><span>{item.last}</span><small>{item.status} · {item.department}</small></button>)}</aside>
    {selected ? <section className="chat-panel"><header><div><h2>{selected.name}</h2><p>{selected.phone} · {selected.channel}</p></div><span className="badge">{selected.status}</span></header>
      <div className="chat-tools"><select aria-label="Atribuir atendente" value={selected.assignee} onChange={e => update({ assignee: e.target.value })}>{agents.map(item => <option key={String(item[0])}>{item[0]}</option>)}</select>
        <select aria-label="Departamento" value={selected.department} onChange={e => update({ department: e.target.value })}>{["Comercial", "Suporte", "Financeiro", "Atendimento"].map(value => <option key={value}>{value}</option>)}</select>
        <button className="secondary" disabled={selected.status === "encerrada"} onClick={() => update({ status: "encerrada" })}>Encerrar</button>
      </div><div className="messages">{selected.messages.map(([who, text], i) => <p className={`message ${who}`} key={i}><span>{who === "customer" ? selected.name : who === "bot" ? "Chatbot IA" : selected.assignee}</span>{text}</p>)}</div>
      <form className="reply" onSubmit={e => { e.preventDefault(); const text = reply.trim(); if (!text) return; update({ messages: [...selected.messages, ["agent", text]], last: text }); setReply(""); }}><input aria-label="Resposta manual" placeholder="Digite uma resposta manual..." value={reply} maxLength={10000} disabled={selected.status === "encerrada"} onChange={e => setReply(e.target.value)} /><button className="primary" disabled={!reply.trim() || selected.status === "encerrada"}>Enviar</button></form>
    </section> : <article className="panel"><h2>Nenhuma conversa encontrada</h2><p>Ajuste os filtros para ver outros atendimentos.</p></article>}
  </section>;
}
