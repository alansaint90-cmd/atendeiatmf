import type { Chatbot } from "../chatbots/schema";

// Correspondência de frases cadastradas; preserva o valor e não aceita intenções negadas.
function normalizarFrase(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR")
    .replace(/r\s*\$/gu, "").replace(/(\d)[.,](\d)/gu, "$1,$2")
    .replace(/,(?!\d)|(?<!\d),/gu, " ").replace(/[^\p{L}\p{N},]+/gu, " ").trim().replace(/\s+/gu, " ");
}

export function fluxoAcionado(fluxos: Chatbot["flows"] | undefined, texto: string) {
  const frase = normalizarFrase(texto);
  if (!frase) return undefined;
  return fluxos?.find(fluxo => fluxo.triggers?.some(gatilho => normalizarFrase(gatilho) === frase));
}

export function instrucoesDoFluxo(instrucoes: string, fluxo: Chatbot["flows"][number] | undefined): string {
  if (!fluxo) return instrucoes;
  return `${instrucoes}\nFLUXO ATIVADO PARA ESTA MENSAGEM: ${fluxo.name}\n${fluxo.description}\nO pedido atual corresponde a um gatilho cadastrado. Responda a esse pedido usando o procedimento acima, com prioridade sobre exemplos comerciais e assuntos antigos. Consulte endereço, localização e demais dados no prompt principal. Não invente dados ausentes. Na próxima mensagem, siga o novo pedido pelo prompt principal; não repita esta recepção automaticamente.`;
}
