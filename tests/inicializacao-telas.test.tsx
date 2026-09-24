import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ChatbotsPage } from "@/components/chatbots/page";
import { Settings } from "@/components/settings";
import { chatbotExample } from "@/lib/chatbots/defaults";
const actions = vi.hoisted(() => ({ carregar: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/actions/chatbots", () => ({ carregarChatbots: actions.carregar, salvarChatbot: actions.salvar }));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

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

test("falha ao salvar o prompt mantém a edição e mostra erro sem expor detalhes", async () => {
  const registro = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Prompt anterior" }, versao: 2 };
  actions.carregar.mockResolvedValue({ ok: true, dados: [registro] });
  actions.salvar.mockRejectedValue(new Error("detalhe privado do banco"));
  render(<ChatbotsPage />);
  const campo = await screen.findByLabelText("Prompt de atendimento");
  fireEvent.change(campo, { target: { value: "Prompt novo" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar o prompt"));
  expect(screen.getByText(/Alterações não salvas/)).toBeInTheDocument();
  expect(campo).toHaveValue("Prompt novo");
  expect(screen.queryByText(/detalhe privado/)).not.toBeInTheDocument();
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

test("erro ao sincronizar fecha a confirmação e mostra a resposta do servidor", async () => {
  const requisicao = vi.fn(async (_entrada: RequestInfo | URL, inicio?: RequestInit) =>
    inicio?.method === "POST"
      ? Response.json({ error: "Confira em Configurações: segredo do webhook. Salve antes de sincronizar." }, { status: 503 })
      : Response.json({ version: 0, configured: {}, values: {} }));
  vi.stubGlobal("fetch", requisicao);
  render(<Settings />);
  const sincronizar = await screen.findByRole("button", { name: "Sincronizar webhook na Evolution" });
  await waitFor(() => expect(sincronizar).toBeEnabled());
  fireEvent.click(sincronizar);
  const confirmar = screen.getByRole("button", { name: "Confirmar sincronização" });
  await waitFor(() => expect(confirmar).toBeEnabled(), { timeout: 5000 });
  fireEvent.click(confirmar);
  expect(await screen.findByRole("alert")).toHaveTextContent("segredo do webhook");
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(requisicao).toHaveBeenCalledWith("/api/settings/evolution-webhook", { method: "POST" });
});
