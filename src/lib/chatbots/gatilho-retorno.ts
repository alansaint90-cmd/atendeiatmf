export const gatilhoRetomada = "Se precisar de algo mais, é só falar.";

export function ehGatilhoRetomada(texto: string, frase = gatilhoRetomada) {
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,!?:;]/g, "").replace(/\s+/g, " ").trim();
  const gatilho = normalizar(frase);
  return Boolean(gatilho) && normalizar(texto) === gatilho;
}
