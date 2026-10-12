import test from "node:test";
import assert from "node:assert/strict";
import relatorio from "../scripts/relatorio-testes-ci.mjs";

test("CI publica causa do teste com escape de comandos e ignora sucesso", async () => {
  const erro = new Error("Falha simulada\ncom 100% de cobertura");
  const resultados: string[] = [];
  const eventos = [
    { type: "test:pass", data: { name: "Passou" } },
    { type: "test:fail", data: { name: "Teste da fila", details: { error: { cause: erro } } } },
  ];
  for await (const linha of relatorio(eventos)) resultados.push(linha);
  assert.equal(resultados.length, 1);
  assert.match(resultados[0], /^::error::Teste da fila%0AError: Falha simulada%0Acom 100%25/);
  assert.equal(resultados[0].split("\n").length, 2, "Só uma linha de comando GitHub.");
});
