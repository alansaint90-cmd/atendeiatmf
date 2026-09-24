import type { Chatbot } from "./schema";

export function montarInstrucoesDoAgente(chatbot: Chatbot | null): string {
  if (!chatbot?.context.trim()) return "";
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
    chatbot.context,
    `Se não souber responder: ${chatbot.fallback}`,
    `Transferência humana: ${chatbot.transferHuman ? `habilitada para ${chatbot.destination}. Diga: ${chatbot.transferNotice}` : "desabilitada"}`,
    "Fluxos inteligentes:",
    fluxos,
  ].join("\n");
}
