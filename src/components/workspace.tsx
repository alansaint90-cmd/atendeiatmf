"use client";
import { useState } from "react";
import Link from "next/link";
import { nav } from "@/lib/demo/data";
import { demoViews } from "@/lib/demo/views";
import { icon } from "@/lib/demo/icons";
import { ChatbotsPage } from "./chatbots/page";
import { OperacaoPage } from "./operacao/page";
import { Settings } from "./settings";
import { FollowupsPage } from "./followups/page";
import { TagsPage } from "./tags/page";
import { AgendamentosPage } from "./agendamentos/page";

export function Workspace() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [route, setRoute] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  if (!loggedIn) return <main className="auth-shell"><section className="auth-panel"><div className="brand large"><span className="brand-mark">A</span><span>AtendeIA</span></div><h1>Atendimento inteligente para WhatsApp</h1><p>Centralize conversas e configure seus assistentes.</p><form className="form-card" data-auth-form onSubmit={e => { e.preventDefault(); setLoggedIn(true); }}><label>Email<input type="email" defaultValue="admin@atendeia.com" /></label><label>Senha<input type="password" defaultValue="mvpdemo" /></label><small>Ambiente de demonstração. Este acesso não autentica usuários.</small><button className="primary">Entrar no MVP</button></form></section><aside className="auth-preview"><div className="phone"><div className="phone-top" /><div className="bubble customer">Olá, vocês atendem fora do horário comercial?</div><div className="bubble bot">Configure seu assistente para responder dúvidas e qualificar leads.</div><div className="bubble agent">Prepare as regras de transferência para sua equipe.</div></div></aside></main>;
  return <div className={`shell ${collapsed ? "sidebar-collapsed" : ""}`}><aside className="sidebar"><div className="brand"><span className="brand-mark">A</span><span>AtendeIA</span></div><nav>{nav.map(([id, label, ico]) => <button key={id} className={route === id ? "active" : ""} data-route={id} aria-label={label} aria-current={route === id ? "page" : undefined} onClick={() => setRoute(id)}><span dangerouslySetInnerHTML={{ __html: icon(ico) }} /><span className="nav-label">{label}</span></button>)}</nav><div className="account"><strong>AtendeIA</strong><span>Painel da instalação</span></div></aside>
    <section className="workspace"><header className="topbar"><button className="icon-button" aria-label="Alternar menu" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>☰</button><strong>{nav.find(item => item[0] === route)?.[1]}</strong><div className="top-actions"><span className="badge">Dados protegidos</span></div></header>
      <main className="content">
        <Link href="/crm">CRM · Kanban e oportunidades</Link>
        {/* Keep form drafts mounted across navigation, but hide inactive sections. */}
        <div hidden={route !== "chatbot"} className="page-stack"><ChatbotsPage /></div>
        <div hidden={route !== "followups"}><FollowupsPage /></div>
        <div hidden={route !== "tags"}><TagsPage /></div>
        <div hidden={route !== "agendamentos"}><AgendamentosPage /></div>
        {route === "settings" && <Settings />}
        <div hidden={!["dashboard", "contacts", "inbox"].includes(route)}><OperacaoPage rota={route} /></div>
        {!["dashboard", "contacts", "inbox"].includes(route) && demoViews[route] && <div className="page-stack demo-view" dangerouslySetInnerHTML={{ __html: demoViews[route]() }} />}
      </main>
    </section>
  </div>;
}
