import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PausaIa } from "@/components/chatbots/pausa-ia";
const actions = vi.hoisted(() => ({ consultar: vi.fn(), pausar: vi.fn() }));
vi.mock("@/lib/actions/pausa-ia", () => ({ consultarPausaIa: actions.consultar, pausarIaInstancia: actions.pausar }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

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
