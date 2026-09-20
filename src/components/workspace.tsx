"use client";
import { useState } from "react";
import { Marca } from "./marca";
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
import { UsuariosPage } from "./usuarios/page";
import type { Papel } from "@/lib/db/schema/_enums";
import { nomesPapeis } from "@/lib/auth/papeis";

export function Workspace({ papel }: { papel: Papel }) {
  const [route, setRoute] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const gestor = papel === "admin" || papel === "super_admin";
  const menu = nav.filter(([id]) => id === "settings" ? papel === "super_admin" : ["team", "followups", "tags", "agendamentos", "chatbot", "flows", "campaigns"].includes(id) ? gestor : true);
  return <div className={`shell ${collapsed ? "sidebar-collapsed" : ""}`}><aside className="sidebar"><Marca /><nav>{menu.map(([id, label, ico]) => <button key={id} className={route === id ? "active" : ""} data-route={id} aria-label={label} aria-current={route === id ? "page" : undefined} onClick={() => setRoute(id)}><span dangerouslySetInnerHTML={{ __html: icon(ico) }} /><span className="nav-label">{label}</span></button>)}</nav><div className="account"><strong>{nomesPapeis[papel]}</strong><Link href="/perfil">Meu perfil e sessões</Link></div></aside>
    <section className="workspace"><header className="topbar"><button className="icon-button" aria-label="Alternar menu" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>☰</button><strong>{nav.find(item => item[0] === route)?.[1]}</strong><div className="top-actions"><span className="badge">Dados protegidos</span></div></header>
      <main className="content">
        <Link href="/crm">CRM · Kanban e oportunidades</Link>
        {/* Keep form drafts mounted across navigation, but hide inactive sections. */}
        {gestor && <><div hidden={route !== "chatbot"} className="page-stack"><ChatbotsPage /></div>
        <div hidden={route !== "followups"}><FollowupsPage /></div>
        <div hidden={route !== "tags"}><TagsPage /></div>
        <div hidden={route !== "agendamentos"}><AgendamentosPage /></div></>}
        {gestor && route === "team" && <UsuariosPage papel={papel} />}
        {papel === "super_admin" && route === "settings" && <Settings />}
        <div hidden={!["dashboard", "contacts", "inbox"].includes(route)}><OperacaoPage rota={route} /></div>
        {!["dashboard", "contacts", "inbox", "team"].includes(route) && demoViews[route] && <div className="page-stack demo-view" dangerouslySetInnerHTML={{ __html: demoViews[route]() }} />}
      </main>
    </section>
  </div>;
}
