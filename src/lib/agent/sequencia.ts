import type { Chatbot } from "../chatbots/schema";
import { ProviderError } from "./providers";

/** Somente URLs já escritas no prompt; nunca monta localização nem segue redirects. */
export function mapsDoPrompt(prompt: string): string | null {
  const encontrados = new Set<string>();
  for (const candidato of prompt.match(/https:\/\/[^\s<>"\[\]]+/gu) ?? []) {
    const texto = candidato.replace(/[).,;!?*]+$/u, "");
    try {
      const url = new URL(texto);
      if (url.username || url.password || url.port) continue;
      if (url.hostname === "maps.app.goo.gl" && url.pathname.length > 1
        || url.hostname === "goo.gl" && url.pathname.startsWith("/maps/")
        || ["www.google.com", "google.com", "www.google.com.br", "google.com.br"].includes(url.hostname) && url.pathname.startsWith("/maps")
        || url.hostname === "maps.google.com") encontrados.add(texto);
    } catch { /* Texto que não é URL não fornece localização. */ }
  }
  return encontrados.size === 1 ? [...encontrados][0] : null;
}

export function partesDoFluxo(fluxo: Chatbot["flows"][number], prompt: string): string[] {
  const mensagens = fluxo.sequencia!.mensagens;
  const precisaMaps = mensagens.some(texto => texto.includes("{{GOOGLE_MAPS}}"));
  const maps = precisaMaps ? mapsDoPrompt(prompt) : null;
  if (precisaMaps && !maps) throw new ProviderError("fluxo_maps_pendente");
  return mensagens.map(texto => texto.replaceAll("{{GOOGLE_MAPS}}", maps ?? ""));
}
