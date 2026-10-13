import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POST } from "../src/app/api/auth/recuperacao/route";
import { recuperacaoInsegura } from "../scripts/auditar-recuperacao.mjs";

test("recuperação pública rejeita origem estrangeira e corpo excessivo antes de acessar banco", async () => {
  const anterior = { AUTH_LOGIN_ENABLED: process.env.AUTH_LOGIN_ENABLED, AUTH_ORIGIN: process.env.AUTH_ORIGIN };
  process.env.AUTH_LOGIN_ENABLED = "true"; process.env.AUTH_ORIGIN = "https://atende.example.test";
  try {
    const chamar = (origin: string, body: string) => POST(new Request("https://atende.example.test/api/auth/recuperacao", {
      method: "POST", headers: { origin, "content-type": "application/json" }, body }));
    const estrangeira = await chamar("https://outra.example.test", '{"acao":"solicitar","email":"pessoa@example.test"}');
    assert.equal(estrangeira.status, 403); assert.equal(estrangeira.headers.get("cache-control"), "no-store");
    assert.equal((await chamar(process.env.AUTH_ORIGIN, "x".repeat(4097))).status, 413);
    assert.equal((await chamar(process.env.AUTH_ORIGIN, '{"acao":"redefinir","token":"inválido","senha":"curta"}')).status, 400);
  } finally {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor;
    }
  }
});
test("auditor reprova remoção das guardas de recuperação e do consumo de uso único", () => {
  const rota = "src/app/api/auth/recuperacao/route.ts";
  const servico = "src/lib/auth/recuperacao.ts";
  const fonteRota = readFileSync(rota, "utf8"); const fonteServico = readFileSync(servico, "utf8");
  assert.equal(recuperacaoInsegura(rota, fonteRota), false);
  assert.equal(recuperacaoInsegura(servico, fonteServico), false);
  assert.equal(recuperacaoInsegura(rota, fonteRota.replace('request.headers.get("origin") !== process.env.AUTH_ORIGIN', "false")), true);
  assert.equal(recuperacaoInsegura(servico, fonteServico.replaceAll("usado_em IS NULL AND expira_em>now()", "true")), true);
});
