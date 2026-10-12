import test from "node:test";
import assert from "node:assert/strict";
import { selecionarEvento } from "../src/lib/agent/fila";

const evento = (id: string, instancia: string) => [id, ["payload", JSON.stringify({ instance: instancia })]] as [string, string[]];

test("falha pendente de um chip não monopoliza os outros dois, preservando ordem de cada chip", () => {
  const fila = [evento("1-0", "primeiro"), evento("2-0", "primeiro"), evento("3-0", "segundo"), evento("4-0", "terceiro")];
  assert.equal(selecionarEvento(fila, null)?.[0], "1-0");
  assert.equal(selecionarEvento(fila, "primeiro")?.[0], "3-0");
  assert.equal(selecionarEvento(fila, "segundo")?.[0], "4-0");
  assert.equal(selecionarEvento(fila, "terceiro")?.[0], "1-0");
  assert.equal(selecionarEvento(fila.slice(2), "primeiro")?.[0], "3-0");
  assert.equal(selecionarEvento(fila.slice(0, 2), "primeiro")?.[0], "1-0");
});

test("evento inválido participa da seleção para ser arquivado, sem bloquear os chips", () => {
  const invalido: [string, string[]] = ["0-0", ["payload", "{invalido"]];
  assert.equal(selecionarEvento([invalido, evento("1-0", "primeiro")], null)?.[0], "0-0");
  assert.equal(selecionarEvento([invalido, evento("1-0", "primeiro")], "")?.[0], "1-0");
  assert.equal(selecionarEvento([], null), null);
});
