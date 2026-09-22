"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { sairDoSistema } from "@/lib/actions/sessoes";

export function Workspace({ papel, nome }: { papel: Papel; nome: string }) {
  const router = useRouter();
  const [route, setRoute] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState("");
  const gestor = papel === "admin" || papel === "super_admin";
  const menu = nav.filter(([id]) => id === "settings" ? gestor : ["team", "followups", "tags", "agendamentos", "chatbot", "flows", "campaigns"].includes(id) ? gestor : true);
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]?.toLocaleUpperCase("pt-BR")).join("") || "?";
  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setErroSaida("");
    try {
      const resultado = await sairDoSistema();
      if (!resultado.ok) { setErroSaida(resultado.erro); return; }
      router.replace("/entrar");
      router.refresh();
    } catch {
      setErroSaida("Não foi possível sair. Tente novamente.");
    } finally {
      setSaindo(false);
    }
  }
  return <div className={`shell ${collapsed ? "sidebar-collapsed" : ""}`}><aside className="sidebar"><Marca /><nav>{menu.map(([id, label, ico]) => <button key={id} className={route === id ? "active" : ""} data-route={id} aria-label={label} aria-current={route === id ? "page" : undefined} onClick={() => setRoute(id)}><span dangerouslySetInnerHTML={{ __html: icon(ico) }} /><span className="nav-label">{label}</span></button>)}</nav><div className="account"><button type="button" onClick={sair} disabled={saindo}>{saindo ? "Saindo..." : "Sair"}</button>{erroSaida && <p role="alert">{erroSaida}</p>}</div></aside>
    <section className="workspace"><header className="topbar"><button className="icon-button" aria-label="Alternar menu" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>☰</button><strong>{nav.find(item => item[0] === route)?.[1]}</strong><div className="top-actions"><Link className="user-identity" href="/perfil" aria-label={`Abrir perfil de ${nome}`}><span className="user-avatar" aria-hidden="true">{iniciais}</span><span className="user-name">{nome}</span></Link></div></header>
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
