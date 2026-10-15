import { z } from "zod";
import type { Chatbot } from "../chatbots/schema";
import { ProviderError } from "./providers";
import { mapsDoPrompt } from "./sequencia";

export function dividirPromocao(instancia: string, fluxo: Chatbot["flows"][number] | undefined): boolean {
  return instancia === "levaelava" && !fluxo?.sequencia
    && fluxo?.name === "Promoção da madrugada — R$ 13,90";
}

export const instrucoesPromocaoBaloes = `FORMATO DESTA RESPOSTA: retorne somente JSON com três campos de texto: boasVindas, endereco e cta.
boasVindas: acolhimento breve e explicação da promoção conforme o fluxo cadastrado, respeitando o histórico e o nome já informado.
endereco: endereço e referências existentes no prompt principal. Não invente dados; não inclua URLs, pois o servidor acrescentará o Maps oficial.
cta: convite breve para aproveitar a promoção e continuar tirando dúvidas. Não peça nome nem repita a apresentação.
Cada campo será enviado como uma mensagem separada, nesta ordem. Não inclua títulos de campo no texto para o cliente.`;

const respostaSchema = z.strictObject({
  boasVindas: z.string().trim().min(1).max(2000),
  endereco: z.string().trim().min(1).max(2000),
  cta: z.string().trim().min(1).max(1000),
});

export function partesDaPromocao(resposta: string, prompt: string): string[] {
  const maps = mapsDoPrompt(prompt);
  if (!maps) throw new ProviderError("fluxo_maps_pendente");
  let dados: unknown;
  try { dados = JSON.parse(resposta); } catch { throw new ProviderError("fluxo_baloes_invalidos"); }
  const validado = respostaSchema.safeParse(dados);
  if (!validado.success) throw new ProviderError("fluxo_baloes_invalidos");
  const { boasVindas, endereco, cta } = validado.data;
  if ([boasVindas, endereco, cta].some(texto => /https?:\/\/|\[(?:NOME|NOME DO CLIENTE)\]|\{NOME\}/iu.test(texto))) {
    throw new ProviderError("fluxo_baloes_invalidos");
  }
  return [boasVindas, `${endereco}\n\n📍 ${maps}`, cta];
}
