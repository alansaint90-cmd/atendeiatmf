import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OperacaoPage } from "@/components/operacao/page";
import { carregarOperacao } from "@/lib/actions/operacao";
vi.mock("@/lib/actions/operacao", () => ({ carregarOperacao: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const vazio = { abertas: 0, pendentes: 0, qualificados: 0, taxaResposta: 0, totalContatos: 0, contatos: [], conversas: [], volume: [], atualizadoEm: "2026-09-17T10:00:00.000Z" };

test("painel sem autenticação não inventa métricas e vazio autorizado mostra zero", async () => {
  vi.mocked(carregarOperacao).mockResolvedValue({ ok: true, dados: vazio });
  render(<OperacaoPage rota="dashboard" />);
  expect(screen.queryByText("Conversas abertas")).not.toBeInTheDocument();
  expect(carregarOperacao).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Carregar dados" }));
  expect(await screen.findByText("0%")).toBeInTheDocument();
  expect(screen.getAllByText("0")).toHaveLength(3);
  expect(screen.getByText(/Nenhum contato cadastrado/)).toBeInTheDocument();
});

test("falha de consulta não vira banco vazio e sessão recusada remove dados anteriores", async () => {
  vi.mocked(carregarOperacao).mockResolvedValueOnce({ ok: true, dados: { ...vazio, totalContatos: 1,
    contatos: [{ id: "1", nome: "Contato real", telefone: "+5571999999999", email: null, origem: "WhatsApp", status: "novo" }] } })
    .mockResolvedValueOnce({ ok: false, erro: "Acesso recusado." });
  render(<OperacaoPage rota="contacts" />);
  fireEvent.click(screen.getByRole("button", { name: "Carregar dados" }));
  expect(await screen.findByText("Contato real")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Carregar dados" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Acesso recusado.");
  expect(screen.queryByText(/0 contatos cadastrados/)).not.toBeInTheDocument();
});
