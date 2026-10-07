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
    "Antes do fallback ou da transferência, consulte as orientações específicas do prompt e dos fluxos cadastrados. Uma intenção prevista nessas instruções não é falta de conhecimento.",
    `Somente se não houver orientação aplicável para responder: ${chatbot.fallback}`,
    `Transferência humana: ${chatbot.transferHuman ? `habilitada para ${chatbot.destination}. Siga primeiro o procedimento específico do prompt para o pedido do cliente; acione transferir_para_humano quando esse procedimento determinar o encaminhamento, quando o cliente insistir em falar diretamente com uma pessoa ou quando não houver orientação aplicável. O servidor enviará o aviso salvo; não invente confirmação de transferência.` : "desabilitada. Não prometa transferir nem diga que transferiu."}`,
    "Fluxos inteligentes:",
    fluxos,
    "CONFIGURAÇÃO ATUAL — prevalece sobre exemplos do prompt e falas anteriores:",
    `Seu nome é ${chatbot.persona}. Apresente-se exclusivamente com esse nome, no gênero ${chatbot.gender}. O identificador ${chatbot.identifier} é interno, não é o nome do cliente.`,
    `Adote o tom ${chatbot.personalities.join(", ") || "profissional"} e a missão cadastrada acima. Não mantenha uma identidade antiga mencionada no histórico.`,
    "O histórico serve apenas para compreender o cliente, nunca para substituir estas configurações atuais.",
  ].join("\n");
}
