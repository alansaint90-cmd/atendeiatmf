import { beforeAll, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ChatbotEditor } from "@/components/chatbots/editor";
import { ChatbotsPage } from "@/components/chatbots/page";
import { chatbotExample } from "@/lib/chatbots/defaults";
import type { Chatbot } from "@/lib/chatbots/schema";

const actions = vi.hoisted(() => ({ carregar: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/actions/chatbots", () => ({ carregarChatbots: actions.carregar, salvarChatbot: actions.salvar }));
vi.mock("@/components/chatbots/pausa-ia", () => ({ PausaIa: () => null }));
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
test("voz começa desligada na levaelava, exige homologação e mudança de voz a invalida", () => {
  render(<ChatbotEditor initial={chatbotExample} instancia="levaelava" creating={false} onSave={() => {}} onClose={() => {}} error="" />);
  const habilitar = screen.getByRole("checkbox", { name: /Habilitar respostas em voz/ });
  expect(habilitar).not.toBeChecked(); expect(habilitar).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Validei a pronúncia/ }));
  expect(habilitar).toBeEnabled(); fireEvent.click(habilitar); expect(habilitar).toBeChecked();
  fireEvent.change(screen.getByLabelText("Voz"), { target: { value: "cedar" } });
  expect(habilitar).not.toBeChecked(); expect(habilitar).toBeDisabled();
});
test("outros números não mostram configuração de voz", () => {
  render(<ChatbotEditor initial={chatbotExample} instancia="taistmf" creating={false} onSave={() => {}} onClose={() => {}} error="" />);
  expect(screen.queryByText("Respostas em voz — Leva e Lava")).not.toBeInTheDocument();
});
test("ativação no painel aguarda confirmação de três segundos e conserva prompt", async () => {
  const id = "13a0a8ce-94c7-4bd0-92ff-f1cbcf35ab7e";
  const configuracao = { ...chatbotExample, id, context: "Prompt comercial original" };
  actions.carregar.mockResolvedValue({ ok: true, dados: { itens: [{ id, configuracao, versao: 0 }], instancias: [{ nome: "levaelava", chatbotId: id }] } });
  actions.salvar.mockImplementation(async (entrada: { configuracao: Chatbot }) => ({ ok: true, dados: { id, configuracao: entrada.configuracao, versao: 1 } }));
  render(<ChatbotsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Configurar" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Validei a pronúncia/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Habilitar respostas em voz/ }));
  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const confirmar = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Salvar ativação de voz" });
    expect(confirmar).toBeDisabled(); expect(actions.salvar).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000); });
    fireEvent.click(confirmar); await act(async () => {});
    expect(actions.salvar).toHaveBeenCalledWith(expect.objectContaining({ instancia: "levaelava", configuracao: expect.objectContaining({
      context: "Prompt comercial original", voz: { habilitada: true, homologada: true, modo: "audio_recebido", voz: "marin" },
    }) }));
  } finally { vi.useRealTimers(); }
});
