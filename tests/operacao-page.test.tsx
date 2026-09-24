import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OperacaoPage } from "@/components/operacao/page";
import { carregarOperacao } from "@/lib/actions/operacao";
import { carregarPainel } from "@/lib/actions/painel";
vi.mock("@/lib/actions/operacao", () => ({ carregarOperacao: vi.fn() }));
vi.mock("@/lib/actions/painel", () => ({ carregarPainel: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const painelVazio = { abertas: 0, pendentes: 0, atendimentoIa: 0, atendimentoHumano: 0,
  novas: 0, atendidasIa: 0, atendidasHumano: 0, canais: [], contatos: [], evolucao: [], atualizadoEm: "2026-09-17T10:00:00.000Z" };

test("dashboard autorizado sem dados mostra zeros reais e permite trocar o período", async () => {
  vi.mocked(carregarPainel).mockResolvedValue({ ok: true, dados: painelVazio });
  render(<OperacaoPage rota="dashboard" />);
  expect(await screen.findByText("Nenhum contato com atividade no período.")).toBeInTheDocument();
  expect(carregarPainel).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText("Atendimento com IA").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Atendimento humano").length).toBeGreaterThan(0);
  expect(screen.queryByText("Leads qualificados")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
  expect(await screen.findByText("Nenhum contato com atividade no período.")).toBeInTheDocument();
  expect(carregarPainel).toHaveBeenCalledTimes(2);
});

test("falha de consulta não vira banco vazio e sessão recusada remove dados anteriores", async () => {
  vi.mocked(carregarOperacao).mockResolvedValue({ ok: false, erro: "Acesso recusado." });
  render(<OperacaoPage rota="contacts" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Acesso recusado.");
  expect(screen.queryByText(/0 contatos cadastrados/)).not.toBeInTheDocument();
});

test("falha do painel não mostra zeros como dados consultados", async () => {
  vi.mocked(carregarPainel).mockResolvedValue({ ok: false, erro: "Acesso recusado." });
  render(<OperacaoPage rota="dashboard" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Acesso recusado.");
  expect(screen.queryByLabelText("Resumo geral")).not.toBeInTheDocument();
});
