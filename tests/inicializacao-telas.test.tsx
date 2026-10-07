import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ChatbotsPage } from "@/components/chatbots/page";
import { Settings } from "@/components/settings";
import { chatbotExample } from "@/lib/chatbots/defaults";
const actions = vi.hoisted(() => ({ carregar: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/actions/chatbots", () => ({ carregarChatbots: actions.carregar, salvarChatbot: actions.salvar }));
vi.mock("@/components/chatbots/pausa-ia", () => ({ PausaIa: () => null }));

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

test("seleciona instância pelo nome e salva apenas o prompt daquele número", async () => {
  const a = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Prompt A" }, versao: 0 };
  const b = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Prompt B" }, versao: 0 };
  const c = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Prompt C" }, versao: 0 };
  actions.carregar.mockResolvedValue({ ok: true, dados: { itens: [a, b, c], instancias: [
    { nome: "thaistmf01", chatbotId: a.id }, { nome: "thaistmf02", chatbotId: b.id }, { nome: "levaelava", chatbotId: c.id }] } });
  actions.salvar.mockResolvedValue({ ok: true, dados: { ...b, configuracao: { ...b.configuracao, context: "Variante B" }, versao: 1 } });
  render(<ChatbotsPage />);
  const seletor = await screen.findByLabelText("Número / instância");
  expect(screen.getByLabelText("Prompt de atendimento")).toHaveValue("Prompt A");
  fireEvent.change(seletor, { target: { value: "levaelava" } });
  expect(screen.getByLabelText("Prompt de atendimento")).toHaveValue("Prompt C");
  actions.salvar.mockResolvedValue({ ok: true, dados: { ...c, configuracao: { ...c.configuracao, context: "Variante C" }, versao: 1 } });
  fireEvent.change(screen.getByLabelText("Prompt de atendimento"), { target: { value: "Variante C" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(actions.salvar).toHaveBeenLastCalledWith(expect.objectContaining({ id: c.id, instancia: "levaelava" })));
  await waitFor(() => expect(seletor).toBeEnabled());
  fireEvent.change(seletor, { target: { value: "thaistmf02" } });
  expect(screen.getByLabelText("Prompt de atendimento")).toHaveValue("Prompt B");
  actions.salvar.mockResolvedValue({ ok: true, dados: { ...b, configuracao: { ...b.configuracao, context: "Variante B" }, versao: 1 } });
  fireEvent.change(seletor, { target: { value: "thaistmf02" } });
  expect(screen.getByLabelText("Prompt de atendimento")).toHaveValue("Prompt B");
  fireEvent.change(screen.getByLabelText("Prompt de atendimento"), { target: { value: "Variante B" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(actions.salvar).toHaveBeenCalledWith(expect.objectContaining({ id: b.id, instancia: "thaistmf02" })));
  await waitFor(() => expect(seletor).toBeEnabled());
  fireEvent.change(seletor, { target: { value: "thaistmf01" } });
  expect(screen.getByLabelText("Prompt de atendimento")).toHaveValue("Prompt A");
});

test("não importa silenciosamente prompt antigo do navegador para o servidor", async () => {
  localStorage.setItem("atendeia.chatbots.v1", JSON.stringify([{ ...chatbotExample, context: "Mentoria em grupo legada" }]));
  actions.carregar.mockResolvedValue({ ok: true, dados: { itens: [], instancias: [] } });
  render(<ChatbotsPage />);
  expect(await screen.findByText("Nenhum chatbot cadastrado. Crie o primeiro assistente.")).toBeInTheDocument();
  expect(actions.salvar).not.toHaveBeenCalled();
  expect(screen.queryByText(/Mentoria em grupo legada/)).not.toBeInTheDocument();
});

test("prompt do servidor carrega, continua editável e volta ao servidor", async () => {
  const registro = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Atendimento personalizado" }, versao: 0 };
  actions.carregar.mockResolvedValue({ ok: true, dados: { itens: [registro], instancias: [{ nome: "chip-a", chatbotId: registro.id }] } });
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
  actions.carregar.mockResolvedValue({ ok: true, dados: { itens: [registro], instancias: [{ nome: "chip-a", chatbotId: registro.id }] } });
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

test("confirma gravação perdida somente após reler a versão e a configuração da instância", async () => {
  const registro = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Anterior" }, versao: 2 };
  const resposta = (item: typeof registro) => ({ ok: true, dados: { itens: [item], instancias: [{ nome: "chip-a", chatbotId: item.id }] } });
  const texto = "Instrução cadastrada com emojis 😊 e acentos.\n".repeat(500);
  actions.carregar.mockResolvedValueOnce(resposta(registro)).mockResolvedValueOnce(resposta({ ...registro, versao: 3, configuracao: { ...registro.configuracao, context: texto } }));
  actions.salvar.mockRejectedValue(new Error("resposta perdida"));
  render(<ChatbotsPage />);
  const campo = await screen.findByLabelText("Prompt de atendimento");
  fireEvent.change(campo, { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuração salva para chip-a"));
  expect(campo).toHaveValue(texto);
  expect(screen.queryByText(/Alterações não salvas/)).not.toBeInTheDocument();
  expect(actions.salvar).toHaveBeenCalledTimes(1);
});

test("salva a edição e continua no novo vínculo sem recarregar a tela", async () => {
  const anterior = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Anterior" }, versao: 2 };
  const novo = { id: crypto.randomUUID(), configuracao: { ...anterior.configuracao, context: "Minha edição" }, versao: 0 };
  actions.carregar.mockResolvedValue({ ok: true, dados: { itens: [anterior], instancias: [{ nome: "chip-a", chatbotId: anterior.id }] } });
  actions.salvar.mockResolvedValue({ ok: true, dados: novo });
  render(<ChatbotsPage />);
  const campo = await screen.findByLabelText("Prompt de atendimento");
  fireEvent.change(campo, { target: { value: "Minha edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuração salva para chip-a"));
  expect(campo).toHaveValue("Minha edição");
  expect(actions.carregar).toHaveBeenCalledTimes(1);
  fireEvent.change(campo, { target: { value: "Próxima edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(actions.salvar).toHaveBeenLastCalledWith(expect.objectContaining({ id: novo.id, versao: 0 })));
});

test("confirmação perdida não aceita conteúdo de outra versão e preserva a edição na tela", async () => {
  const registro = { id: crypto.randomUUID(), configuracao: { ...chatbotExample, context: "Anterior" }, versao: 2 };
  const resposta = (item: typeof registro) => ({ ok: true, dados: { itens: [item], instancias: [{ nome: "chip-a", chatbotId: item.id }] } });
  actions.carregar.mockResolvedValueOnce(resposta(registro)).mockResolvedValueOnce(resposta({ ...registro, versao: 3, configuracao: { ...registro.configuracao, context: "Edição de outro usuário" } }));
  actions.salvar.mockRejectedValue(new Error("resposta perdida"));
  render(<ChatbotsPage />);
  const campo = await screen.findByLabelText("Prompt de atendimento");
  fireEvent.change(campo, { target: { value: "Minha edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar prompt de atendimento" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sua edição permanece nesta tela"));
  expect(campo).toHaveValue("Minha edição");
  expect(screen.getByRole("button", { name: "Salvar prompt de atendimento" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Baixar edição do prompt" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).not.toHaveTextContent("Configuração salva");
  expect(actions.salvar).toHaveBeenCalledTimes(1);
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

test("configura o terceiro número e permite desativá-lo enviando campo vazio", async () => {
  let terceira = "";
  const requisicao = vi.fn(async (_entrada: RequestInfo | URL, inicio?: RequestInit) => {
    if (inicio?.method === "PUT") terceira = JSON.parse(String(inicio.body)).values.EVOLUTION_THIRD_INSTANCE_NAME;
    return Response.json({ version: 1, configured: {}, values: { EVOLUTION_THIRD_INSTANCE_NAME: terceira } });
  });
  vi.stubGlobal("fetch", requisicao);
  render(<Settings />);
  const campo = await screen.findByLabelText(/Instância Evolution do terceiro número/);
  for (const valor of ["levaelava", ""]) {
    fireEvent.change(campo, { target: { value: valor } });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Salvar configurações" }));
    for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirmar e salvar" })));
    vi.useRealTimers();
    expect(terceira).toBe(valor);
    expect(campo).toHaveValue(valor);
  }
});
