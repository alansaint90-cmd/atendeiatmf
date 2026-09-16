import { metrics, volume, contacts, channels, agents, campaigns, team } from "./data";
import {icon, badge} from "./icons";
export const demoViews: Record<string, () => string> = {
  dashboard: () => `
    <section class="page-head"><div><h1>Conversas em tempo real</h1><p>Resumo operacional dos atendimentos, leads e produtividade da equipe.</p></div><button class="primary">${icon("send")} Nova campanha</button></section>
    <section class="kpi-grid">${metrics.map((m) => `<article class="kpi ${m.tone}"><div>${icon(m.icon)}</div><strong>${m.value}</strong><span>${m.label}</span></article>`).join("")}</section>
    <section class="grid-2">
      <article class="panel wide"><div class="panel-title"><h2>Evolução das mensagens</h2>${badge("7 dias", "green")}</div><div class="chart">${volume.map((v, i) => `<span style="height:${v / 2.6}px" title="${v} mensagens"><b>${["S","T","Q","Q","S","S","D","S","T","Q","Q","S"][i]}</b></span>`).join("")}</div></article>
      <article class="panel"><div class="panel-title"><h2>Últimos contatos</h2></div>${contacts.slice(0, 5).map((c) => contactRow(c)).join("")}</article>
    </section>
    <section class="grid-2">
      <article class="panel">${simpleTable("Indicadores por canal", ["Canal", "%", "Mensagens"], channels)}</article>
      <article class="panel">${simpleTable("Indicadores por atendente", ["Atendente", "Perfil", "Resolvidos", "Nota"], agents)}</article>
    </section>`,
  flows: () => `
    <section class="page-head"><div><h1>Construtor de fluxos</h1><p>Crie etapas de conversa com condições, botões e encaminhamentos.</p></div><button class="primary">${icon("flow")} Novo fluxo</button></section>
    <section class="flow-builder">
      ${["Boas-vindas", "Pergunta", "Condição", "Ação"].map((step, i) => `<article class="flow-card"><small>Etapa ${i + 1}</small><h2>${step}</h2><p>${["Olá, sou o assistente virtual. Como posso ajudar?", "Você busca vendas, suporte ou financeiro?", "Se escolher vendas, qualificar lead.", "Encaminhar para Comercial ou Atendente."][i]}</p><div>${badge(i === 1 ? "Resposta rápida" : i === 2 ? "Regra" : "Mensagem", "blue")}</div></article>`).join("")}
      <article class="panel flow-preview"><h2>Preview do fluxo</h2><div class="messages compact"><p class="message bot"><span>Bot</span>Olá. Como posso ajudar?</p><p class="quick-buttons">Vendas · Suporte · Financeiro</p><p class="message bot"><span>Bot</span>Vou encaminhar para o departamento ideal.</p></div></article>
    </section>`,
  contacts: () => `
    <section class="page-head"><div><h1>Contatos e leads</h1><p>Importe, segmente e acompanhe o histórico dos contatos.</p></div><button class="primary">${icon("inbox")} Importar CSV</button></section>
    <article class="panel">${simpleTable("Foram encontrados 1.488 contatos", ["Nome", "Telefone", "Email", "Origem", "Tags", "Status"], contacts)}</article>
    <article class="panel timeline"><h2>Histórico do contato</h2><p><strong>Alisson Johnatan</strong> abriu conversa por anúncio, respondeu qualificação e recebeu proposta do plano Profissional.</p></article>`,
  campaigns: () => `
    <section class="page-head"><div><h1>Campanhas</h1><p>Crie disparos segmentados para WhatsApp com agendamento e métricas simuladas.</p></div><button class="primary">${icon("send")} Criar campanha</button></section>
    <section class="form-grid"><article class="panel form-panel"><label>Nome da campanha<input value="Oferta plano Profissional" /></label><label>Público por tags<select><option>novo lead</option><option>premium</option><option>nutrição</option></select></label><label>Mensagem<textarea>Olá, temos uma condição especial para automatizar seu WhatsApp esta semana.</textarea></label><label>Agendar envio<input type="datetime-local" value="2026-08-31T17:30" /></label></article><article class="panel">${simpleTable("Campanhas recentes", ["Nome", "Público", "Status", "Agenda", "Enviados", "Entregues", "Respondidos"], campaigns)}</article></section>`,
  team: () => `
    <section class="page-head"><div><h1>Departamentos e equipe</h1><p>Gerencie usuários, perfis e distribuição manual de conversas.</p></div><button class="primary">${icon("users")} Novo usuário</button></section>
    <section class="grid-2"><article class="panel">${simpleTable("Equipe", ["Departamento", "Usuário", "Perfil", "Conversas"], team)}</article><article class="panel permissions"><h2>Permissões por perfil</h2><p>${badge("Administrador", "green")} Gerencia planos, usuários e integrações.</p><p>${badge("Gerente", "blue")} Acompanha relatórios e distribui atendimentos.</p><p>${badge("Atendente")} Responde conversas atribuídas.</p></article></section>`,
  plans: () => `
    <section class="page-head"><div><h1>Planos e assinatura</h1><p>Compare limites e simule a contratação de um plano.</p></div>${badge("Assinatura ativa", "green")}</section>
    <section class="plans">${[
      ["Iniciante", "R$ 97/mês", "1 canal", "3 usuários", "3 fluxos", "2 campanhas"],
      ["Profissional", "R$ 247/mês", "3 canais", "12 usuários", "15 fluxos", "20 campanhas"],
      ["Premium", "R$ 497/mês", "10 canais", "40 usuários", "Fluxos ilimitados", "Campanhas ilimitadas"],
    ].map((p, i) => `<article class="plan ${i === 1 ? "featured" : ""}"><h2>${p[0]}</h2><strong>${p[1]}</strong><p>${p.slice(2).join(" · ")}</p><button class="${i === 1 ? "primary" : "secondary"}">Assinar</button></article>`).join("")}</section>`,
};

function contactRow(c: string[]) {
  return `<div class="contact-row"><span class="avatar">${c[0].split(" ").map((x) => x[0]).slice(0, 2).join("")}</span><div><strong>${c[0]}</strong><small>${c[3]} · ${c[4]}</small></div></div>`;
}

function simpleTable(title: string, headers: string[], rows: (string | number)[][]) {
  return `<div class="panel-title"><h2>${title}</h2></div><div class="table"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((cell) => `<td>${String(cell).match(/aberta|ativo|qualificado|cliente|enviada|agendada/) ? badge(cell, "green") : String(cell).match(/pendente|rascunho/) ? badge(cell, "red") : cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

