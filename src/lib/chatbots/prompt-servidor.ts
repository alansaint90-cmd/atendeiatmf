import type { Chatbot } from "./schema";

export function montarInstrucoesDoAgente(chatbot: Chatbot | null): string {
  if (!chatbot?.context.trim()) return "";
  const promptDaThais = /wellington\s+junior/i.test(chatbot.context);
  const contexto = promptDaThais && /Você está buscando um atendimento individual ou uma mentoria em grupo\?/iu.test(chatbot.context)
    ? chatbot.context
      .replace(/Primeiro pergunte:\s*"Claro![^"\n]*mentoria em grupo\?"/giu,
        'Primeiro explique:\n"Claro! 😊 O atendimento e a mentoria com Wellington Junior são individuais e personalizados."')
      .replace(/Se responder individual:/giu, "Sobre o atendimento individual:")
    : chatbot.context;
  const fluxos = chatbot.flows.length
    ? chatbot.flows.map(fluxo => `- ${fluxo.name}: ${fluxo.description}`).join("\n")
    : "Nenhum fluxo específico cadastrado.";
  return [
    "CONFIGURAÇÃO DO CHATBOT SDR:",
    `Identificador: ${chatbot.identifier}`,
    `Persona: ${chatbot.persona} (${chatbot.gender})`,
    `Personalidade: ${chatbot.personalities.join(", ") || "não definida"}`,
    `Missão: ${chatbot.mission}`,
    "Prompt de atendimento obrigatório:",
    contexto,
    ...(promptDaThais ? ["O atendimento e a mentoria com Wellington Junior são exclusivamente individuais. Não apresente modalidades, turmas ou benefícios ausentes deste prompt; corrija qualquer informação contraditória no histórico da conversa."] : []),
    `Se não souber responder: ${chatbot.fallback}`,
    `Transferência humana: ${chatbot.transferHuman ? `habilitada para ${chatbot.destination}. Diga: ${chatbot.transferNotice}` : "desabilitada"}`,
    "Fluxos inteligentes:",
    fluxos,
  ].join("\n");
}
