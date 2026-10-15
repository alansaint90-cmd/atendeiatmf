import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sequenciaInsegura } from "../scripts/auditar-sequencia.mjs";

test("auditor protege reserva, Maps e isolamento orgânico da campanha", () => {
  for (const [arquivo, trecho] of [
    ["src/lib/agent/processor.ts", "await port.reservarFluxo(state.chaveFluxo)"],
    ["src/lib/agent/processor.ts", "partes = partesDaPromocao(gerada,"],
    ["src/lib/agent/promocao-baloes.ts", "instancia === \"levaelava\""],
    ["src/lib/agent/store.ts", "'NX'"],
    ["src/lib/chatbots/prompt-servidor.ts", "filter(fluxo => !fluxo.sequencia)"],
  ]) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.equal(sequenciaInsegura(arquivo, fonte), false);
    assert.equal(sequenciaInsegura(arquivo, fonte.replace(trecho, "removido")), true);
  }
});
