export const gatilhoRetomada = "Se precisar de algo mais, é só falar.";

export function ehGatilhoRetomada(texto: string, frase = gatilhoRetomada) {
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\p{M}\p{Cf}]/gu, "")
    .toLocaleLowerCase("pt-BR").replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
  const gatilho = normalizar(frase);
  return Boolean(gatilho) && normalizar(texto) === gatilho;
}
