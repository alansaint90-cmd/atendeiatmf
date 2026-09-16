const chatbotStorageKey = "atendeia.chatbots.v1";
const contextRevision = "17a9efaa-8a74-4a0e-a760-8dad96655ae8";
const chatbotExample = {
  id: "tmf-thais", identifier: "TMF - THAÍS", persona: "Thaís", gender: "Feminino",
  personalities: ["Vendedor", "Direto ao ponto", "Profissional"],
  mission: "Fornecer atendimento de vendas aos pais, atletas e clientes que buscam informações sobre como adquirir aulas, mentorias, cursos, livros, palestras.",
  context: "CHAVE PIX: CNPJ 35071957/0001-03\nAction3 Treinamentos\nWellington Tavares Nobrega Junior\nBANCO C6 Bank\n\n- Mentoria TreinaMenteFut\n(+ de 100 vídeo/aulas para o seu atleta)\n- Como se preparar para uma competição\n(Preparação completa para os atletas em competição)\n- DVC - Despertando os Verdadeiros Campeões\n(Treinamento Mental e Comportamental completo)\n\nBônus\n- Ebook - As 7 peneiras que todo atleta precisa passar\n- Guia Prático 01 - Como ajudar o meu filho em uma competição\n- Guia Prático 1 - Como lidar com a PRESSÃO na hora do jogo",
  fallback: "Se desculpe por não saber falar sobre. Ofereça uma nova ajuda com outro assunto.",
  delay: 3, transferMedia: false, transferHuman: true, destination: "Atendimento humano",
  transferNotice: "Não tenho essa resposta, mas estarei transferindo pra outro atendimento. Aguarde nosso retorno sobre esta dúvida...",
  closingPhrase: "Precisar de mim só chamar", flows: [], temperature: 0.2,
};

chatbotExample.context = agentGeneralContext;
chatbotExample.contextRevision = contextRevision;

function readChatbots() {
  try {
    const saved = JSON.parse(localStorage.getItem(chatbotStorageKey));
    if (Array.isArray(saved)) return saved.map(bot => ({ ...chatbotExample, ...bot,
      ...(bot.id === "tmf-thais" && bot.contextRevision !== contextRevision
        ? { context: agentGeneralContext, contextRevision } : {}) }));
  } catch (_) { /* Keep the example available if storage is unavailable. */ }
  return [structuredClone(chatbotExample)];
}
let chatbots = readChatbots();
function botEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function chatbotView() {
  return `<section class="page-head"><div><h1>Chatbots de IA</h1><p>Crie assistentes com a personalidade e o conhecimento do seu negócio.</p></div><button class="primary" data-new-bot>+ Novo chatbot de IA</button></section>
    <article class="panel"><div class="panel-title"><h2>Seus assistentes</h2><span class="badge green">${chatbots.length} configurado(s)</span></div>
    <p class="bot-local-note">As configurações são salvas neste navegador. A conexão com a IA e o WhatsApp depende de integração.</p>
    <div class="table"><table><thead><tr><th>Identificador</th><th>Persona</th><th>Personalidade</th><th>Ações</th></tr></thead><tbody>${chatbots.map(bot => `<tr><td><strong>${botEscape(bot.identifier)}</strong></td><td>${botEscape(bot.persona)}</td><td>${bot.personalities.map(p => `<span class="badge green">${botEscape(p)}</span>`).join(" ")}</td><td><button class="secondary" data-edit-bot="${botEscape(bot.id)}">Configurar</button></td></tr>`).join("")}</tbody></table></div>
    </article>
    ${chatbots.length ? `<form class="panel form-panel" data-context-form><div><h2>Contexto geral</h2><p class="bot-local-note">Prompt de atendimento do chatbot. Edite aqui as instruções, os produtos, os links e as respostas que o assistente deve conhecer.</p></div>
      <label>Chatbot<select name="contextBot">${chatbots.map(bot => `<option value="${botEscape(bot.id)}">${botEscape(bot.identifier)}</option>`).join("")}</select></label>
      <label>Prompt de atendimento<textarea name="generalContext" rows="18" style="width:100%;line-height:1.65">${botEscape(chatbots[0].context)}</textarea></label>
      <div><button class="primary" type="submit">Salvar contexto geral</button></div><p role="status" data-context-status></p></form>` : ""}
    <p id="bot-status" role="status"></p>`;
}
function bindChatbotEvents() {
  const contextForm = document.querySelector("[data-context-form]");
  contextForm?.elements.contextBot.addEventListener("change", () => {
    contextForm.elements.generalContext.value = chatbots.find(bot => bot.id === contextForm.elements.contextBot.value).context;
    contextForm.querySelector("[data-context-status]").textContent = "";
  });
  contextForm?.addEventListener("submit", event => {
    event.preventDefault();
    const next = chatbots.map(bot => bot.id === contextForm.elements.contextBot.value
      ? { ...bot, context: contextForm.elements.generalContext.value, contextRevision } : bot);
    const status = contextForm.querySelector("[data-context-status]");
    try {
      localStorage.setItem(chatbotStorageKey, JSON.stringify(next));
      chatbots = next;
      status.textContent = "Contexto geral salvo neste navegador.";
    } catch (_) { status.textContent = "Não foi possível salvar. Verifique as permissões de armazenamento do navegador."; }
  });
  document.querySelector("[data-new-bot]")?.addEventListener("click", () => openBotEditor());
  document.querySelectorAll("[data-edit-bot]").forEach(button => button.addEventListener("click", () => openBotEditor(chatbots.find(bot => bot.id === button.dataset.editBot))));
}
function openBotEditor(existing) {
  const bot = existing ? structuredClone(existing) : {
    ...structuredClone(chatbotExample), id: crypto.randomUUID(), identifier: "", persona: "", mission: "", context: "", personalities: ["Profissional"],
  };
  const opener = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "bot-dialog";
  dialog.setAttribute("aria-labelledby", "bot-dialog-title");
  const input = (name, title, extra = "") => `<label>${title}<input name="${name}" value="${botEscape(bot[name])}" ${extra}></label>`;
  const textarea = (name, title, extra = "") => `<label>${title}<textarea name="${name}" ${extra}>${botEscape(bot[name])}</textarea></label>`;
  dialog.innerHTML = `<form class="bot-form">
    <header class="bot-dialog-head"><div><h2 id="bot-dialog-title">${existing ? "Configuração" : "Criação"} de chatbot inteligente</h2><p>Crie aqui um assistente completo, com as características mais adequadas para atender o seu público.</p></div><button type="button" class="icon-button" data-dismiss aria-label="Fechar janela">×</button></header>
    <div class="bot-dialog-body">
      <div class="bot-identifier">${input("identifier", "Identificador do chatbot", 'required maxlength="100" autofocus')}</div>
      <section class="bot-section"><h2>Persona</h2><p>Aqui vamos definir quem é o seu chatbot.</p>
        <div class="bot-persona-grid">${input("persona", "Nome da persona", 'required maxlength="100"')}
        <label>Gênero<select name="gender">${["Feminino", "Masculino", "Neutro"].map(item => `<option ${bot.gender === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
        <fieldset class="bot-personalities"><legend>Personalidade (escolha até 3)</legend><div>${["Vendedor", "Direto ao ponto", "Profissional", "Amigável", "Empático", "Descontraído"].map(item => `<label><input type="checkbox" name="personalities" value="${item}" ${bot.personalities.includes(item) ? "checked" : ""}><span>${item}</span></label>`).join("")}</div></fieldset></div>
        ${textarea("mission", "Missão do chatbot", 'rows="2"')}
        <details class="bot-examples"><summary>Exemplos de missão (para copiar e alterar)</summary><p>Atender clientes, esclarecer dúvidas sobre produtos e serviços e orientar cada pessoa até a melhor solução.</p><button type="button" class="secondary" data-example="mission">Usar exemplo</button></details>
      </section>
      <section class="bot-section"><h2>Contexto e conhecimento do chatbot</h2><p>O seu assistente saberá responder sobre o que está aqui. Inclua as informações que ele precisa conhecer.</p>
        ${textarea("context", "Contexto geral", 'rows="12"')}
        ${textarea("fallback", "Como agir se não tiver a resposta?", 'rows="2"')}
        <details class="bot-examples"><summary>Exemplos de textos (para copiar e alterar)</summary><p>Não tenho essa informação no momento. Posso ajudar com outro assunto ou encaminhar você para nossa equipe?</p><button type="button" class="secondary" data-example="fallback">Usar exemplo</button></details>
      </section>
      <section class="bot-section"><h2>Ajustes gerais</h2><p>Configure suas preferências de atendimento.</p>
        <div class="bot-settings-grid"><div>${input("delay", "Atraso na resposta (em segundos)", 'type="number" min="0" step="1" required')}<small>Digite 0 para responder imediatamente ou informe o tempo de espera.</small></div>
        <label class="bot-switch"><input type="checkbox" name="transferMedia" ${bot.transferMedia ? "checked" : ""}>Transferir a conversa ao receber imagens ou documentos</label></div>
        <label class="bot-switch"><input type="checkbox" name="transferHuman" ${bot.transferHuman ? "checked" : ""}>Transferir a conversa quando o contato solicitar atendimento humano</label>
        <div class="bot-transfer-fields"><label>Transferir para?<select name="destination">${["Atendimento humano", "Comercial", "Suporte", "Financeiro"].map(item => `<option ${bot.destination === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
        ${textarea("transferNotice", "Aviso de transferência para atendimento humano", 'rows="2"')}<small>Escreva literalmente o que o chatbot irá dizer no momento da transferência para o atendimento humano.</small>
        ${input("closingPhrase", "Frase secreta para encerrar atendimento humano")}
        <small>Sempre que uma pessoa falar no canal, o chatbot iniciará o atendimento. Caso você responda diretamente pelo Whatsapp do seu celular, o chatbot não atuará mais, considerando então este atendimento como atendimento humano. Para encerrar o atendimento humano via plataforma, basta clicar no botão de mesmo nome. Porém, caso você esteja no seu celular, poderá cadastrar uma frase aqui que, ao ser enviada por você, encerrará automaticamente o atendimento. Tente algo como 'Se precisar de mim é só chamar'. Você precisará falar exatamente a mesma frase.</small></div>
      </section>
      <section class="bot-section"><h2>Fluxos inteligentes</h2><p>Configure fluxos que a IA pode acionar automaticamente durante a conversa. Descreva quando cada fluxo deve ser usado.</p><div data-flow-list></div><button type="button" class="primary" data-add-flow>+ Adicionar fluxo</button></section>
      <section class="bot-section"><h2>Temperatura</h2><p>Quanto maior, mais criativas e variadas são as respostas. Valores menores priorizam precisão. Sugestão: 0,5 para uso geral; próximo de 0 para orçamentos ou cálculos; próximo de 0,8 para comunicação criativa.</p><label class="bot-temperature">Criatividade das respostas <output for="bot-temperature">${Number(bot.temperature).toFixed(1).replace(".", ",")}</output><input id="bot-temperature" name="temperature" type="range" min="0" max="1" step="0.1" value="${bot.temperature}"></label><div class="bot-range-labels"><span>0 · Mais preciso</span><span>1 · Mais criativo</span></div></section>
    </div><footer class="bot-dialog-footer"><button type="button" class="secondary" data-dismiss>Cancelar</button><p role="alert" data-bot-error></p><button type="submit" class="primary">Salvar</button></footer>
  </form>`;
  document.body.append(dialog);
  document.body.classList.add("bot-modal-open");
  const form = dialog.querySelector("form");
  const error = dialog.querySelector("[data-bot-error]");
  dialog.addEventListener("close", () => { dialog.remove(); document.body.classList.remove("bot-modal-open"); opener?.focus(); });
  dialog.querySelectorAll("[data-dismiss]").forEach(button => button.addEventListener("click", () => dialog.close()));
  dialog.querySelectorAll("[data-example]").forEach(button => button.addEventListener("click", () => { form.elements[button.dataset.example].value = button.parentElement.querySelector("p").textContent; }));
  const personalities = [...form.querySelectorAll('[name="personalities"]')];
  const limitPersonalities = () => { const count = personalities.filter(el => el.checked).length; personalities.forEach(el => { el.disabled = count >= 3 && !el.checked; }); };
  personalities.forEach(el => el.addEventListener("change", limitPersonalities));
  limitPersonalities();
  const updateTransfer = () => { dialog.querySelectorAll(".bot-transfer-fields input, .bot-transfer-fields textarea, .bot-transfer-fields select").forEach(el => { el.disabled = !form.elements.transferHuman.checked && !form.elements.transferMedia.checked; }); };
  form.elements.transferHuman.addEventListener("change", updateTransfer);
  form.elements.transferMedia.addEventListener("change", updateTransfer);
  updateTransfer();
  form.elements.temperature.addEventListener("input", event => { dialog.querySelector("output").value = Number(event.target.value).toFixed(1).replace(".", ","); });
  function addFlow(flow = { name: "", description: "" }) {
    const row = document.createElement("div");
    row.className = "bot-flow-row";
    row.innerHTML = `<label>Nome do fluxo<input data-flow-name required value="${botEscape(flow.name)}" placeholder="Ex.: Agendar uma mentoria"></label><label>Quando acionar este fluxo?<textarea data-flow-description required rows="2" placeholder="Descreva a intenção do cliente que deve iniciar este fluxo.">${botEscape(flow.description)}</textarea></label><button type="button" class="secondary" aria-label="Remover fluxo">Remover</button>`;
    row.querySelector("button").addEventListener("click", () => row.remove());
    dialog.querySelector("[data-flow-list]").append(row);
    return row;
  }
  bot.flows.forEach(addFlow);
  dialog.querySelector("[data-add-flow]").addEventListener("click", () => addFlow().querySelector("input").focus());
  form.addEventListener("submit", event => {
    event.preventDefault();
    const updated = { ...bot };
    for (const name of ["identifier", "persona", "gender", "mission", "context", "fallback", "destination", "transferNotice", "closingPhrase"]) updated[name] = form.elements[name].value.trim();
    if (!updated.identifier || !updated.persona) { error.textContent = "Preencha o identificador e o nome da persona."; return; }
    if (chatbots.some(item => item.id !== bot.id && item.identifier.toLowerCase() === updated.identifier.toLowerCase())) { error.textContent = "Já existe um chatbot com esse identificador."; return; }
    updated.personalities = personalities.filter(el => el.checked).map(el => el.value);
    updated.delay = Number(form.elements.delay.value);
    updated.temperature = Number(form.elements.temperature.value);
    updated.transferMedia = form.elements.transferMedia.checked;
    updated.transferHuman = form.elements.transferHuman.checked;
    updated.flows = [...dialog.querySelectorAll(".bot-flow-row")].map(row => ({ name: row.querySelector("input").value.trim(), description: row.querySelector("textarea").value.trim() }));
    if (updated.flows.some(flow => !flow.name || !flow.description)) { error.textContent = "Preencha o nome e a descrição de cada fluxo."; return; }
    const next = existing ? chatbots.map(item => item.id === bot.id ? updated : item) : [...chatbots, updated];
    try { localStorage.setItem(chatbotStorageKey, JSON.stringify(next)); } catch (_) { error.textContent = "Não foi possível salvar neste navegador. Verifique o espaço e as permissões de armazenamento."; return; }
    chatbots = next;
    dialog.close();
    render();
    document.querySelector("#bot-status").textContent = "Configurações salvas neste navegador.";
    [...document.querySelectorAll("[data-edit-bot]")].find(button => button.dataset.editBot === bot.id)?.focus();
  });
  dialog.showModal();
}
