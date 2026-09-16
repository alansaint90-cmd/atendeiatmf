let openaiApiKey = "";
const state = {
  route: "dashboard",
  loggedIn: false,
  conversationId: "c1",
  conversationStatus: "todos",
  tag: "todas",
  assignee: "todos",
};

const metrics = [
  { label: "Conversas abertas", value: 631, tone: "green", icon: "message" },
  { label: "Pendentes", value: 113, tone: "red", icon: "clock" },
  { label: "Leads qualificados", value: 288, tone: "blue", icon: "spark" },
  { label: "Taxa de resposta", value: "94%", tone: "orange", icon: "activity" },
];

const volume = [86, 104, 92, 130, 146, 118, 172, 164, 188, 210, 196, 232];
const channels = [
  ["WhatsApp principal", 72, 784],
  ["WhatsApp vendas", 18, 241],
  ["Instagram Direct", 7, 68],
  ["Widget web", 3, 32],
];
const agents = [
  ["Marina Costa", "Gerente", 86, 4.8],
  ["Rafael Lima", "Atendente", 74, 4.6],
  ["Bianca Rocha", "Atendente", 69, 4.7],
  ["Leo Andrade", "Suporte", 61, 4.5],
];

const conversations = [
  {
    id: "c1",
    name: "Alisson Johnatan",
    phone: "+55 (11) 94026-2887",
    status: "aberta",
    tag: "novo lead",
    department: "Comercial",
    assignee: "Marina Costa",
    channel: "WhatsApp principal",
    score: 92,
    last: "Quero conhecer o plano profissional.",
    messages: [
      ["customer", "Olá, vi o anúncio e queria entender os planos."],
      ["bot", "Claro. Você quer automatizar vendas, suporte ou ambos?"],
      ["customer", "Vendas, principalmente recuperação de leads."],
      ["agent", "Perfeito, Alisson. O plano Profissional atende bem esse volume."],
    ],
  },
  {
    id: "c2",
    name: "Thainara Damann",
    phone: "+55 (71) 8241-7351",
    status: "pendente",
    tag: "suporte",
    department: "Suporte",
    assignee: "Rafael Lima",
    channel: "WhatsApp vendas",
    score: 64,
    last: "O QR Code desconectou novamente.",
    messages: [
      ["customer", "Bom dia. Meu WhatsApp caiu."],
      ["bot", "Entendi. Vou verificar a conexão do canal."],
      ["customer", "O QR Code desconectou novamente."],
    ],
  },
  {
    id: "c3",
    name: "Luiza Martins",
    phone: "+55 (85) 9770-6940",
    status: "encerrada",
    tag: "premium",
    department: "Financeiro",
    assignee: "Bianca Rocha",
    channel: "WhatsApp principal",
    score: 81,
    last: "Pagamento confirmado, obrigada.",
    messages: [
      ["customer", "Preciso da segunda via."],
      ["agent", "Enviei o link de pagamento por aqui."],
      ["customer", "Pagamento confirmado, obrigada."],
    ],
  },
  {
    id: "c4",
    name: "Camila Souza",
    phone: "+55 (64) 9228-8957",
    status: "aberta",
    tag: "campanha",
    department: "Atendimento",
    assignee: "Leo Andrade",
    channel: "Instagram Direct",
    score: 77,
    last: "Pode me chamar amanhã?",
    messages: [
      ["customer", "Recebi a campanha."],
      ["bot", "Quer que um especialista fale com você?"],
      ["customer", "Pode me chamar amanhã?"],
    ],
  },
];

const contacts = [
  ["Alisson Johnatan", "+55 (11) 94026-2887", "alisson@email.com", "Anúncio", "novo lead", "qualificado"],
  ["Thainara Damann", "+55 (71) 8241-7351", "thainara@email.com", "Indicação", "suporte", "ativo"],
  ["Luiza Martins", "+55 (85) 9770-6940", "luiza@email.com", "Site", "premium", "cliente"],
  ["Camila Souza", "+55 (64) 9228-8957", "camila@email.com", "Campanha", "campanha", "nutrição"],
  ["Rodrigo Vieira", "+55 (21) 93318-7712", "rodrigo@email.com", "Landing page", "novo lead", "pendente"],
];

const campaigns = [
  ["Boas-vindas novos leads", "novo lead", "agendada", "Hoje 17:30", 1290, 1178, 214],
  ["Upgrade Premium", "premium", "enviada", "28/08/2026", 420, 402, 96],
  ["Reativação 30 dias", "nutrição", "rascunho", "Sem agenda", 0, 0, 0],
];

const team = [
  ["Comercial", "Marina Costa", "Gerente", 18],
  ["Suporte", "Rafael Lima", "Atendente", 12],
  ["Financeiro", "Bianca Rocha", "Atendente", 7],
  ["Atendimento", "Leo Andrade", "Atendente", 9],
];

const nav = [
  ["dashboard", "Dashboard", "grid"],
  ["inbox", "Caixa de entrada", "inbox"],
  ["chatbot", "Chatbot IA", "spark"],
  ["flows", "Fluxos", "flow"],
  ["contacts", "Contatos e leads", "users"],
  ["campaigns", "Campanhas", "send"],
  ["team", "Equipe", "briefcase"],
  ["settings", "Configurações", "settings"],
  ["plans", "Planos", "card"],
];

function icon(name) {
  const paths = {
    grid: "<rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/><rect x='3' y='14' width='7' height='7'/><rect x='14' y='14' width='7' height='7'/>",
    inbox: "<path d='M22 12h-6l-2 3h-4l-2-3H2'/><path d='M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z'/>",
    message: "<path d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z'/>",
    clock: "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>",
    spark: "<path d='M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z'/><path d='M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z'/>",
    activity: "<path d='M3 12h4l3-8 4 16 3-8h4'/>",
    users: "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>",
    send: "<path d='M22 2L11 13'/><path d='M22 2l-7 20-4-9-9-4z'/>",
    briefcase: "<rect x='2' y='7' width='20' height='14' rx='2'/><path d='M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'/>",
    settings: "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 5 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 5a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.3.3.68.5 1.1.6H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z'/>",
    card: "<rect x='2' y='5' width='20' height='14' rx='2'/><path d='M2 10h20'/>",
    flow: "<path d='M6 3v6'/><path d='M18 15v6'/><rect x='3' y='9' width='6' height='6' rx='1'/><rect x='15' y='9' width='6' height='6' rx='1'/><path d='M9 12h6'/>",
    lock: "<rect x='3' y='11' width='18' height='10' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>",
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

function badge(text, tone = "neutral") {
  return `<span class="badge ${tone}">${text}</span>`;
}

function render() {
  document.getElementById("app").innerHTML = state.loggedIn ? layout() : authView();
  bindEvents();
}

function authView() {
  return `
    <main class="auth-shell">
      <section class="auth-panel">
        <div class="brand large"><span class="brand-mark">A</span><span>AtendeIA</span></div>
        <h1>Atendimento inteligente para WhatsApp</h1>
        <p>Centralize conversas, automatize respostas com IA e acompanhe sua operação em uma única interface.</p>
        <div class="auth-tabs">
          <button class="active" data-login>Login</button>
          <button data-login>Cadastro</button>
          <button data-login>Recuperar senha</button>
        </div>
        <form class="form-card" data-auth-form>
          <label>Email<input value="admin@atendeia.com" type="email" /></label>
          <label>Senha<input value="mvpdemo" type="password" /></label>
          <label>Perfil
            <select><option>Administrador</option><option>Gerente</option><option>Atendente</option></select>
          </label>
          <button class="primary" type="submit">${icon("lock")} Entrar no MVP</button>
        </form>
      </section>
      <aside class="auth-preview">
        <div class="phone">
          <div class="phone-top"></div>
          <div class="bubble customer">Olá, vocês atendem fora do horário comercial?</div>
          <div class="bubble bot">Sim. Posso responder dúvidas e qualificar leads 24 horas.</div>
          <div class="bubble agent">Quando necessário, transfiro para a equipe certa.</div>
        </div>
      </aside>
    </main>`;
}

function layout() {
  const active = nav.find((item) => item[0] === state.route);
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">A</span><span>AtendeIA</span></div>
        <nav>${nav.map(([id, label, ico]) => `<button class="${state.route === id ? "active" : ""}" data-route="${id}">${icon(ico)}${label}</button>`).join("")}</nav>
        <div class="account">
          <strong>Wellington Tavares</strong>
          <span>Administrador</span>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <button class="icon-button" data-toggle-menu aria-label="Alternar menu">${icon("grid")}</button>
          <strong>${active[1]}</strong>
          <div class="top-actions">
            ${badge("WhatsApp online", "green")}
            <button class="icon-button" aria-label="Notificações">${icon("activity")}</button>
          </div>
        </header>
        <main class="content">${views[state.route]()}</main>
      </section>
    </div>`;
}

const views = {
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
  inbox: () => {
    const filtered = conversations.filter((c) =>
      (state.conversationStatus === "todos" || c.status === state.conversationStatus) &&
      (state.tag === "todas" || c.tag === state.tag) &&
      (state.assignee === "todos" || c.assignee === state.assignee)
    );
    const selected = conversations.find((c) => c.id === state.conversationId) || filtered[0] || conversations[0];
    return `
      <section class="inbox-layout">
        <aside class="conversation-list">
          <div class="filters">
            ${select("conversationStatus", ["todos", "aberta", "pendente", "encerrada"], state.conversationStatus)}
            ${select("tag", ["todas", "novo lead", "suporte", "premium", "campanha"], state.tag)}
            ${select("assignee", ["todos", ...agents.map((a) => a[0])], state.assignee)}
          </div>
          ${filtered.map((c) => `<button class="conversation ${selected.id === c.id ? "active" : ""}" data-conversation="${c.id}"><strong>${c.name}</strong><span>${c.last}</span><small>${badge(c.status, c.status === "pendente" ? "red" : "green")} ${c.department}</small></button>`).join("")}
        </aside>
        <section class="chat-panel">
          <header><div><h2>${selected.name}</h2><p>${selected.phone} · ${selected.channel}</p></div><div>${badge(selected.tag, "blue")} ${badge(`Score ${selected.score}`, "green")}</div></header>
          <div class="chat-tools">
            ${select("assignChat", agents.map((a) => a[0]), selected.assignee)}
            ${select("deptChat", ["Comercial", "Suporte", "Financeiro", "Atendimento"], selected.department)}
            <button class="secondary" data-close-chat>Encerrar</button>
          </div>
          <div class="messages">${selected.messages.map(([who, text]) => `<p class="message ${who}"><span>${who === "customer" ? selected.name : who === "bot" ? "Chatbot IA" : selected.assignee}</span>${text}</p>`).join("")}</div>
          <form class="reply"><input placeholder="Digite uma resposta manual..." /><button class="primary">${icon("send")} Enviar</button></form>
        </section>
      </section>`;
  },
  chatbot: () => chatbotView(),
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
  settings: () => `
    <section class="page-head"><div><h1>Configurações</h1><p>Dados da empresa, canais, integrações e notificações.</p></div>${badge("2 canais conectados", "green")}</section>
    <section class="settings-grid">
      <article class="panel form-panel"><label>Empresa<input value="Catuense Soluções Digitais" /></label><label>Email técnico<input value="integracao@empresa.com" /></label><label>Webhook/API<textarea>https://api.empresa.com/webhooks/whatsapp</textarea></label><label class="switch"><input type="checkbox" checked /> Notificar novos leads qualificados</label></article>
      <article class="panel qr-panel"><h2>Conexão WhatsApp</h2><div class="qr" aria-label="QR Code simulado"></div><p>Escaneie para conectar um canal de WhatsApp.</p><button class="secondary">Reconectar canal</button></article>
      <article class="panel form-panel"><h2>OpenAI</h2><label for="openai-api-key">Chave de API da OpenAI</label><input id="openai-api-key" type="password" placeholder="sk-..." autocomplete="off" spellcheck="false" autocapitalize="none" aria-describedby="openai-key-help" /><div><button type="button" class="secondary" data-toggle-api-key aria-controls="openai-api-key" aria-pressed="false">Mostrar chave</button></div><small id="openai-key-help">A chave fica somente na memória desta página e é apagada ao atualizar ou fechar a aba. A conexão com a OpenAI ainda não está integrada.</small></article>
    </section>`,
  plans: () => `
    <section class="page-head"><div><h1>Planos e assinatura</h1><p>Compare limites e simule a contratação de um plano.</p></div>${badge("Assinatura ativa", "green")}</section>
    <section class="plans">${[
      ["Iniciante", "R$ 97/mês", "1 canal", "3 usuários", "3 fluxos", "2 campanhas"],
      ["Profissional", "R$ 247/mês", "3 canais", "12 usuários", "15 fluxos", "20 campanhas"],
      ["Premium", "R$ 497/mês", "10 canais", "40 usuários", "Fluxos ilimitados", "Campanhas ilimitadas"],
    ].map((p, i) => `<article class="plan ${i === 1 ? "featured" : ""}"><h2>${p[0]}</h2><strong>${p[1]}</strong><p>${p.slice(2).join(" · ")}</p><button class="${i === 1 ? "primary" : "secondary"}">Assinar</button></article>`).join("")}</section>`,
};

function contactRow(c) {
  return `<div class="contact-row"><span class="avatar">${c[0].split(" ").map((x) => x[0]).slice(0, 2).join("")}</span><div><strong>${c[0]}</strong><small>${c[3]} · ${c[4]}</small></div></div>`;
}

function simpleTable(title, headers, rows) {
  return `<div class="panel-title"><h2>${title}</h2></div><div class="table"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((cell) => `<td>${String(cell).match(/aberta|ativo|qualificado|cliente|enviada|agendada/) ? badge(cell, "green") : String(cell).match(/pendente|rascunho/) ? badge(cell, "red") : cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function select(name, options, value) {
  return `<select data-select="${name}" aria-label="${name}">${options.map((o) => `<option ${o === value ? "selected" : ""}>${o}</option>`).join("")}</select>`;
}

function bindEvents() {
  const apiKeyInput = document.querySelector("#openai-api-key");
  if (apiKeyInput) {
    apiKeyInput.value = openaiApiKey;
    apiKeyInput.addEventListener("input", () => { openaiApiKey = apiKeyInput.value; });
    document.querySelector("[data-toggle-api-key]").addEventListener("click", event => {
      const show = apiKeyInput.type === "password";
      apiKeyInput.type = show ? "text" : "password";
      event.currentTarget.textContent = show ? "Ocultar chave" : "Mostrar chave";
      event.currentTarget.setAttribute("aria-pressed", String(show));
    });
  }
  bindChatbotEvents();
  document.querySelector("[data-auth-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.loggedIn = true;
    render();
  });
  document.querySelectorAll("[data-login]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-login]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  }));
  document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => {
    state.route = button.dataset.route;
    render();
  }));
  document.querySelectorAll("[data-conversation]").forEach((button) => button.addEventListener("click", () => {
    state.conversationId = button.dataset.conversation;
    render();
  }));
  document.querySelectorAll("[data-select]").forEach((selectEl) => selectEl.addEventListener("change", () => {
    if (["conversationStatus", "tag", "assignee"].includes(selectEl.dataset.select)) {
      state[selectEl.dataset.select] = selectEl.value;
      render();
    }
  }));
  document.querySelector("[data-close-chat]")?.addEventListener("click", () => {
    const current = conversations.find((c) => c.id === state.conversationId);
    if (current) current.status = "encerrada";
    render();
  });
  document.querySelector(".reply")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    const current = conversations.find((c) => c.id === state.conversationId);
    if (input.value.trim() && current) {
      current.messages.push(["agent", input.value.trim()]);
      current.last = input.value.trim();
      input.value = "";
      render();
    }
  });
}

render();

