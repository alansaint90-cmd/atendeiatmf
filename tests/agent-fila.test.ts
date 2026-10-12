import test from "node:test";
import assert from "node:assert/strict";
import { selecionarEvento } from "../src/lib/agent/fila";

const evento = (id: string, instancia: string) => [id, ["payload", JSON.stringify({ instance: instancia })]] as [string, string[]];
const instancias = ["primeiro", "segundo", "terceiro"];

test("falha pendente de um chip não monopoliza os outros dois, preservando ordem de cada chip", () => {
  const fila = [evento("1-0", "primeiro"), evento("2-0", "primeiro"), evento("3-0", "segundo"), evento("4-0", "terceiro")];
  assert.equal(selecionarEvento(fila, null, instancias)?.[0], "1-0");
  assert.equal(selecionarEvento(fila, "primeiro", instancias)?.[0], "3-0");
  assert.equal(selecionarEvento(fila, "segundo", instancias)?.[0], "4-0");
  assert.equal(selecionarEvento(fila, "terceiro", instancias)?.[0], "1-0");
  assert.equal(selecionarEvento(fila.slice(2), "primeiro", instancias)?.[0], "3-0");
  assert.equal(selecionarEvento(fila.slice(0, 2), "primeiro", instancias)?.[0], "1-0");
  assert.equal(selecionarEvento([fila[0], fila[1], fila[3]], "segundo", instancias)?.[0], "4-0", "Chip que terminou não muda a alternância.");
});

test("evento inválido participa da seleção para ser arquivado, sem bloquear os chips", () => {
  const invalido: [string, string[]] = ["0-0", ["payload", "{invalido"]];
  assert.equal(selecionarEvento([invalido, evento("1-0", "primeiro")], null, instancias)?.[0], "0-0");
  assert.equal(selecionarEvento([invalido, evento("1-0", "primeiro")], "", instancias)?.[0], "1-0");
  assert.equal(selecionarEvento([], null, instancias), null);
});
