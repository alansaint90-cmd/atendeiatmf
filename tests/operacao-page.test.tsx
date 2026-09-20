import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OperacaoPage } from "@/components/operacao/page";
import { carregarOperacao } from "@/lib/actions/operacao";
vi.mock("@/lib/actions/operacao", () => ({ carregarOperacao: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const vazio = { abertas: 0, pendentes: 0, qualificados: 0, taxaResposta: 0, totalContatos: 0, contatos: [], conversas: [], volume: [], atualizadoEm: "2026-09-17T10:00:00.000Z" };

test("painel sem autenticação não inventa métricas e vazio autorizado mostra zero", async () => {
  vi.mocked(carregarOperacao).mockResolvedValue({ ok: true, dados: vazio });
  render(<OperacaoPage rota="dashboard" />);
  expect(await screen.findByText("0%")).toBeInTheDocument();
  expect(carregarOperacao).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText("0")).toHaveLength(3);
  expect(screen.getByText(/Nenhum contato cadastrado/)).toBeInTheDocument();
});

test("falha de consulta não vira banco vazio e sessão recusada remove dados anteriores", async () => {
  vi.mocked(carregarOperacao).mockResolvedValue({ ok: false, erro: "Acesso recusado." });
  render(<OperacaoPage rota="contacts" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Acesso recusado.");
  expect(screen.queryByText(/0 contatos cadastrados/)).not.toBeInTheDocument();
});
