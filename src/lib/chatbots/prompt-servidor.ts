import type { Chatbot } from "./schema";

export function montarInstrucoesDoAgente(contextoGeral: string, chatbot: Chatbot | null): string {
  const base = contextoGeral.trim();
  if (!chatbot) return base;
  const fluxos = chatbot.flows.length
    ? chatbot.flows.map(fluxo => `- ${fluxo.name}: ${fluxo.description}`).join("\n")
    : "Nenhum fluxo específico cadastrado.";
  return [
    "CONTEXTO GERAL DA OPERAÇÃO (serve como referência):",
    base,
    "",
    "CONFIGURAÇÃO DO CHATBOT (estas instruções têm prioridade sobre o contexto geral):",
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
    "Em caso de conflito, siga a configuração do chatbot.",
  ].join("\n");
}
