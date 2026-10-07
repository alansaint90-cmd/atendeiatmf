import type { AgentConfig } from "./config";

export function avisoParaWellington(config: AgentConfig, texto: string): string | null {
  if (!config.atendimento?.transferHuman || !/\bwel{1,2}ington\b/iu.test(config.AI_SYSTEM_PROMPT)) return null;
  if (/\b(?:n[aã]o|nem)\s+(?:quero|preciso|desejo|gostaria|vou)\b/iu.test(texto)) return null;
  const pedido = /\b(?:quero|preciso|desejo|gostaria|posso)\s+(?:de\s+)?(?:falar|conversar)\s+com\s+(?:o\s+)?wel{1,2}ington\b/iu;
  return pedido.test(texto) ? "Vou transferir seu atendimento para o Wellington. Aguarde alguns instantes, por favor." : null;
}
