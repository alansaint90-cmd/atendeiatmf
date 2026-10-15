/** @param {string} arquivo @param {string} fonte */
export function sequenciaInsegura(arquivo, fonte) {
  const regras = {
    "src/lib/agent/processor.ts": [/sequencia.instancia === config.EVOLUTION_INSTANCE_NAME/, /await port.reservarFluxo\(state.chaveFluxo\)/, /fluxo_maps_pendente/, /fluxoReservado: true/, /partes = partesDaPromocao\(gerada,/],
    "src/lib/agent/promocao-baloes.ts": [/instancia === "levaelava"/, /z.strictObject/, /mapsDoPrompt\(prompt\)/, /fluxo_baloes_invalidos/],
    "src/lib/agent/store.ts": [/async reservarFluxo/, /message.conversation.*chave/, /'NX'/, /client.eval\(owned/],
    "src/lib/chatbots/prompt-servidor.ts": [/filter\(fluxo => !fluxo.sequencia\)/],
  };
  return Object.entries(regras).some(([caminho, padroes]) => caminho === arquivo && !padroes.every(p => p.test(fonte)));
}
