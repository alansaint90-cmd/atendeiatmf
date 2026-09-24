import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ChatbotsPage } from "@/components/chatbots/page";
import { Settings } from "@/components/settings";
import { chatbotExample } from "@/lib/chatbots/defaults";
const actions = vi.hoisted(() => ({ carregar: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/actions/chatbots", () => ({ carregarChatbots: actions.carregar, salvarChatbot: actions.salvar }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("prompt do servidor carrega, continua editável e volta ao servidor", async () => {
  const registro = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Atendimento personalizado" }, versao: 0 };
  actions.carregar.mockResolvedValue({ ok: true, dados: [registro] });
  actions.salvar.mockResolvedValue({ ok: true, dados: { ...registro, configuracao: { ...registro.configuracao, context: "Contexto atualizado" }, versao: 1 } });
  expect(renderToString(<ChatbotsPage />)).toContain("Carregando chatbots");
  render(<ChatbotsPage />);
  const field = await screen.findByLabelText("Prompt de atendimento");
  expect(field).toHaveValue("Atendimento personalizado");
  fireEvent.change(field, { target: { value: "Contexto atualizado" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(actions.salvar).toHaveBeenCalledWith(expect.objectContaining({
    id: registro.id, versao: 0, configuracao: expect.objectContaining({ context: "Contexto atualizado" }),
  })));
  expect(await screen.findByRole("status")).toHaveTextContent("agente usará estas instruções");
});

test("falha ao consultar servidor exibe erro e permite nova tentativa posteriormente", async () => {
  actions.carregar.mockResolvedValue({ ok: false, erro: "Não foi possível carregar os chatbots." });
  render(<ChatbotsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os chatbots");
});

test("URL de webhook usa a origem do navegador somente no cliente", () => {
  expect(renderToString(<Settings />)).not.toContain(`${window.location.origin}/api/webhooks/evolution`);
  render(<Settings />);
  expect(screen.getByLabelText("URL de recebimento do Atende AI")).toHaveValue(`${window.location.origin}/api/webhooks/evolution`);
});
