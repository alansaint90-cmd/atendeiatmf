"use client";
import { useState } from "react";
import { Marca } from "./marca";
import Link from "next/link";
import { ContaMenu } from "./conta-menu";
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

export function Workspace({ papel, nome, email }: { papel: Papel; nome: string; email: string }) {
  const [route, setRoute] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const gestor = papel === "admin" || papel === "super_admin";
  const menu = nav.filter(([id]) => id === "settings" ? gestor : ["team", "followups", "tags", "agendamentos", "chatbot", "flows", "campaigns"].includes(id) ? gestor : true);
  return <div className={`shell ${collapsed ? "sidebar-collapsed" : ""}`}><aside className="sidebar"><Marca /><nav>{menu.map(([id, label, ico]) => <button key={id} className={route === id ? "active" : ""} data-route={id} aria-label={label} aria-current={route === id ? "page" : undefined} onClick={() => setRoute(id)}><span dangerouslySetInnerHTML={{ __html: icon(ico) }} /><span className="nav-label">{label}</span></button>)}</nav><ContaMenu nome={nome} email={email} aoAbrirAssinatura={() => setRoute("plans")} /></aside>
    <section className="workspace"><header className="topbar"><button className="icon-button" aria-label="Alternar menu" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>☰</button><strong>{nav.find(item => item[0] === route)?.[1]}</strong></header>
      <main className="content">
        <Link href="/crm">CRM · Kanban e oportunidades</Link>
        {/* Keep form drafts mounted across navigation, but hide inactive sections. */}
        {gestor && <><div hidden={route !== "chatbot"} className="page-stack"><ChatbotsPage /></div>
        <div hidden={route !== "followups"}><FollowupsPage ativo={route === "followups"} /></div>
        <div hidden={route !== "tags"}><TagsPage ativo={route === "tags"} /></div>
        <div hidden={route !== "agendamentos"}><AgendamentosPage ativoNaTela={route === "agendamentos"} /></div></>}
        {gestor && route === "team" && <UsuariosPage papel={papel} />}
        {gestor && route === "settings" && <Settings podeEditar={papel === "super_admin"} />}
        <div hidden={!["dashboard", "contacts", "inbox"].includes(route)}><OperacaoPage rota={route} /></div>
        {!["dashboard", "contacts", "inbox", "team"].includes(route) && demoViews[route] && <div className="page-stack demo-view" dangerouslySetInnerHTML={{ __html: demoViews[route]() }} />}
      </main>
    </section>
  </div>;
}
