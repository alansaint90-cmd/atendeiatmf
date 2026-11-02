import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vozInsegura } from "../scripts/auditar-voz.mjs";

test("auditor bloqueia remoção das guardas de voz, fidelidade, PTT e envio incerto", () => {
  for (const [arquivo, trecho] of [
    ["src/lib/agent/audio.ts", 'body.set("language", "pt")'],
    ["src/lib/agent/providers.ts", "somenteEspera(resultado)"],
    ["src/lib/voz/configuracao.ts", "instancia === \"levaelava\""],
    ["src/lib/voz/configuracao.ts", "habilitada: false"],
    ["src/lib/voz/configuracao.ts", "numeros.success && numeros.data.includes(numero)"],
    ["src/lib/agent/worker.ts", "numeroLiberadoParaVoz(message.number, process.env.ATENDEIA_VOICE_ALLOWED_NUMBERS)"],
    ["src/lib/voz/realtime.ts", "comparavel(transcrito) !== comparavel(fala)"],
    ["src/lib/voz/sintese.ts", "process.env.ATENDEIA_VOICE_ENABLED !== \"true\""],
    ["src/lib/voz/sintese.ts", "await verificarProvedorVoz(config)"],
    ["src/lib/voz/provedor.ts", "encoding: false"],
    ["src/lib/voz/entrega.ts", "erro instanceof EnvioVozRecusado"],
    ["src/lib/voz/entrega.ts", "port.reservarAvisoVoz()"],
    ["src/lib/agent/store.ts", "voice-disclosure:"],
  ]) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.equal(vozInsegura(arquivo, fonte), false, arquivo);
    assert.equal(vozInsegura(arquivo, fonte.replace(trecho, "removido")), true, trecho);
  }
  const realtime = readFileSync("src/lib/voz/realtime.ts", "utf8");
  assert.equal(vozInsegura("src/lib/voz/realtime.ts", `${realtime}\nconst endpoint = '/v1/audio/speech';`), true);
});
