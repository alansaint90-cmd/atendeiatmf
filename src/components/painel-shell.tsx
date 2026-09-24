"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Papel } from "@/lib/db/schema/_enums";
import { nav } from "@/lib/demo/data";
import { icon } from "@/lib/demo/icons";
import { ContaMenu } from "./conta-menu";
import { Marca } from "./marca";

interface PainelShellProps {
  papel: Papel;
  nome: string;
  email: string;
  foto?: string | null;
  rota: string;
  titulo: string;
  aoNavegar: (rota: string) => void;
  children: ReactNode;
}

export function PainelShell({ papel, nome, email, foto, rota, titulo, aoNavegar, children }: PainelShellProps) {
  const [recolhido, setRecolhido] = useState(false);
  const gestor = papel === "admin" || papel === "super_admin";
  const menu = nav.filter(([id]) => id === "settings" ? gestor : ["team", "followups", "tags", "agendamentos", "chatbot", "flows", "campaigns"].includes(id) ? gestor : true);

  return <div className={`shell ${recolhido ? "sidebar-collapsed" : ""}`}>
    <aside className="sidebar"><Marca /><nav aria-label="Menu principal">
      {menu.map(([id, label, ico]) => <button key={id} type="button" className={rota === id ? "active" : ""}
        data-route={id} aria-label={label} aria-current={rota === id ? "page" : undefined}
        onClick={() => aoNavegar(id)}><span dangerouslySetInnerHTML={{ __html: icon(ico) }} /><span className="nav-label">{label}</span></button>)}
    </nav><ContaMenu nome={nome} email={email} foto={foto} aoAbrirAssinatura={() => aoNavegar("plans")} /></aside>
    <section className="workspace"><header className="topbar">
      <button className="icon-button" type="button" aria-label="Alternar menu" aria-expanded={!recolhido} onClick={() => setRecolhido(!recolhido)}>☰</button>
      <strong>{titulo}</strong>
    </header>{children}</section>
  </div>;
}
