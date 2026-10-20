import { mapsDoPrompt } from "./sequencia";
import type { Turn } from "./providers";

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const assunto = /\b(localizacao|endereco|maps|mapa|como chegar|onde fica|onde voces ficam)\b/u;
export function contemMaps(texto: string): boolean {
  return (texto.match(/https?:\/\/[^\s<>"\[\]]+/gu) ?? []).some(url => Boolean(mapsDoPrompt(url)));
}
export function pediuLocalizacao(texto: string): boolean {
  const normal = normalizar(texto);
  if (/\b(?:dispenso|(?:nao|nem)\s+(?:quero|preciso|precisa|mande|manda|envie|envia|reenvie|enviar|mandar))\b.{0,45}\b(localizacao|endereco|maps|mapa)/u.test(normal)) return false;
  return assunto.test(normal) && /\b(manda|mande|mandem|mandar|envia|envie|enviem|enviar|reenvia|reenvie|reenviem|reenviar|passa|passe|passem|passar|quero|preciso|qual|onde|como chegar|cade)\b/u.test(normal)
    || /^(?:a )?(?:localizacao|endereco|maps|mapa)(?: de novo| novamente)?[?!. ]*$/u.test(normal);
}
export function localizacaoNoHistorico(historico: Turn[]): boolean {
  return historico.some(turno => turno.role === "assistant" && contemMaps(turno.content));
}
export function instrucoesLocalizacao(enviada: boolean, pedido: string): string {
  return `LOCALIZAÇÃO: ${enviada && !pediuLocalizacao(pedido)
    ? "A localização já foi enviada a este cliente. Não repita endereço, link do Google Maps nem ofereça enviá-los novamente; responda à dúvida atual."
    : "Envie a localização quando pertinente ao pedido ou ao fluxo. Inclua o Maps no máximo uma vez."}
Se enviar o Maps nesta resposta, não ofereça enviá-lo novamente no CTA ou nos próximos balões.`;
}

/** A barreira final independe da obediência do modelo e cobre também balões literais. */
export function filtrarLocalizacao(partes: string[], enviada: boolean, pedido: string): string[] {
  let permiteMaps = !enviada || pediuLocalizacao(pedido);
  const naoOferecer = enviada || partes.some(contemMaps);
  return partes.map(parte => {
    if (!permiteMaps && partes.length > 1 && contemMaps(parte)) return "";
    const urls: string[] = [];
    const protegido = parte.replace(/https?:\/\/[^\s<>"\[\]]+/gu, url => {
      urls.push(url); return `URLPROTEGIDA${urls.length - 1}TOKEN`;
    });
    let mudou = false;
    const trechos = protegido.split(/(?<=[.!?])\s+|\n+/u).filter(trecho => {
      const indices = [...trecho.matchAll(/URLPROTEGIDA(\d+)TOKEN/gu)].map(match => Number(match[1]));
      const temMaps = indices.some(indice => contemMaps(urls[indice]));
      if (temMaps) {
        if (!permiteMaps) { mudou = true; return false; }
        permiteMaps = false;
        return true;
      }
      const texto = normalizar(trecho);
      const oferta = assunto.test(texto) && /\b(quer|gostaria|deseja|posso|podemos|envio|enviar|mandar)\b/u.test(texto);
      const introducao = !permiteMaps && assunto.test(texto) && /(?:aqui|segue|confira|link|localizacao)\b.*:?\s*$/u.test(texto);
      if (naoOferecer && (oferta || introducao)) { mudou = true; return false; }
      return true;
    });
    return mudou ? trechos.join("\n\n").replace(/URLPROTEGIDA(\d+)TOKEN/gu, (_, indice: string) => urls[Number(indice)]).trim() : parte;
  }).filter(Boolean);
}
