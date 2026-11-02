/** @param {string} arquivo @param {string} fonte */
export function vozInsegura(arquivo, fonte) {
  const regras = {
    "src/lib/agent/audio.ts": [/config.EVOLUTION_INSTANCE_NAME === "levaelava"\) body.set\("language", "pt"\)/],
    "src/lib/agent/providers.ts": [/somenteEspera\(resultado\)/, /if \(corrigindoEspera\) return/, /generateReply\(config, history, text, request, signal, true\)/],
    "src/lib/voz/configuracao.ts": [/instancia === "levaelava"/, /liberada &&/, /config.homologada/, /recebeuAudio/, /habilitada: false/, /numeros.success && numeros.data.includes\(numero\)/],
    "src/lib/agent/worker.ts": [/numeroLiberadoParaVoz\(message.number, process.env.ATENDEIA_VOICE_ALLOWED_NUMBERS\)/],
    "src/lib/voz/realtime.ts": [/gpt-realtime-2.1-mini/, /comparavel\(transcrito\) !== comparavel\(fala\)/, /socket.terminate\(\)/, /tools: \[\]/, /maxPcm/],
    "src/lib/voz/sintese.ts": [/process.env.ATENDEIA_VOICE_ENABLED !== "true"/, /await verificarProvedorVoz\(config\)/, /await verificarConversorVoz\(\)/, /pcm.fill\(0\)/],
    "src/lib/voz/provedor.ts": [/z.literal\("2.3.7"\)/, /WHATSAPP-BAILEYS/, /encoding: false/, /voz_confirmacao_ausente/],
    "src/lib/voz/entrega.ts": [/await port.write\(state\)/, /erro instanceof EnvioVozRecusado/, /salvar\("incerta"\)/, /audio\?\.fill\(0\)/, /port.reservarAvisoVoz\(\)/, /port.confirmarAvisoVoz\?\.\(id\)/],
    "src/lib/agent/store.ts": [/voice-disclosure:/, /reservado:\$\{message.identity\}/, /confirmado:\$\{id\}/],
  };
  if (arquivo === "src/lib/voz/realtime.ts" && /\/v1\/audio\/speech/u.test(fonte)) return true;
  return Object.entries(regras).some(([caminho, padroes]) => caminho === arquivo && !padroes.every(padrao => padrao.test(fonte)));
}
