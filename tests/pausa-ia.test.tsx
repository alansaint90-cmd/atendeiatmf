import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PausaIa } from "@/components/chatbots/pausa-ia";
const actions = vi.hoisted(() => ({ consultar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }));
vi.mock("@/lib/actions/pausa-ia", () => ({ consultarPausaIa: actions.consultar, pausarIaInstancia: actions.pausar, retomarIaInstancia: actions.retomar }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

test("botão roxo retoma somente a instância selecionada e volta a permitir pausa", async () => {
  actions.consultar.mockResolvedValue({ ok: true, dados: { pausada: true, versao: 8 } });
  actions.retomar.mockResolvedValue({ ok: true, dados: { pausada: false, versao: 9 } });
  render(<PausaIa instancia="taistmf" />);
  const botao = await screen.findByRole("button", { name: "Retomar atendimento com IA" });
  expect(botao).toHaveClass("primary");
  vi.useFakeTimers();
  fireEvent.click(botao);
  const confirmar = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Retomar atendimento com IA" });
  expect(confirmar).toBeDisabled();
  for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000); });
  fireEvent.click(confirmar);
  await act(async () => {});
  expect(actions.retomar).toHaveBeenCalledExactlyOnceWith({ instancia: "taistmf", versao: 8 });
  expect(screen.getByText("IA disponível em taistmf.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pausar IA" })).toBeEnabled();
  expect(actions.pausar).not.toHaveBeenCalled();
});

test("troca de instância descarta estado e confirmação anteriores", async () => {
  actions.consultar.mockResolvedValueOnce({ ok: true, dados: { pausada: true, versao: 8 } });
  const { rerender } = render(<PausaIa instancia="taistmf" />);
  fireEvent.click(await screen.findByRole("button", { name: "Retomar atendimento com IA" }));
  actions.consultar.mockReturnValueOnce(new Promise(() => {}));
  rerender(<PausaIa instancia="levaelava" />);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pausar IA" })).toBeDisabled();
  expect(actions.retomar).not.toHaveBeenCalled();
});

test("falha na retomada mantém a instância pausada e informa o erro", async () => {
  actions.consultar.mockResolvedValue({ ok: true, dados: { pausada: true, versao: 8 } });
  actions.retomar.mockResolvedValue({ ok: false, erro: "Redis indisponível." });
  render(<PausaIa instancia="taistmf" />);
  const botao = await screen.findByRole("button", { name: "Retomar atendimento com IA" });
  vi.useFakeTimers();
  fireEvent.click(botao);
  for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000); });
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Retomar atendimento com IA" }));
  await act(async () => {});
  expect(screen.getByText("IA pausada em taistmf.")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Redis indisponível.");
});

test("confirma e pausa somente a instância selecionada; mostra o gatilho de liberação", async () => {
  actions.consultar.mockResolvedValue({ ok: true, dados: { pausada: false, versao: 7 } });
  actions.pausar.mockResolvedValue({ ok: true, dados: { pausada: true, versao: 8 } });
  render(<PausaIa instancia="levaelava" gatilho="Pode contar comigo." />);
  await screen.findByText("IA disponível em levaelava.");
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Pausar IA" }));
  const dialogo = screen.getByRole("alertdialog");
  const confirmar = within(dialogo).getByRole("button", { name: "Pausar IA" });
  expect(confirmar).toBeDisabled();
  for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000); });
  fireEvent.click(confirmar);
  await act(async () => {});
  expect(actions.pausar).toHaveBeenCalledExactlyOnceWith({ instancia: "levaelava", versao: 7 });
  expect(screen.getByText("IA pausada em levaelava.")).toBeInTheDocument();
  expect(screen.getByText(/Pode contar comigo/)).toBeInTheDocument();
});

test("falha ao consultar estado não permite pausar às cegas", async () => {
  actions.consultar.mockResolvedValue({ ok: false, erro: "Estado indisponível." });
  render(<PausaIa instancia="chip-b" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Estado indisponível.");
  expect(screen.getByRole("button", { name: "Pausar IA" })).toBeDisabled();
  expect(actions.pausar).not.toHaveBeenCalled();
});
