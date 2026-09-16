import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentSettings } from "@/components/agent-settings";
import { chatbotExample } from "@/lib/chatbots/defaults";
import { storageKey } from "@/lib/chatbots/repository";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
test("importa o contexto editado sem ativar respostas automaticamente", () => {
  localStorage.setItem(storageKey, JSON.stringify([{ ...chatbotExample, context: "Contexto do cliente" }]));
  const change = vi.fn();
  render(<AgentSettings values={{}} disabled={false} token="teste" onChange={change} />);
  expect(screen.getByLabelText("Respostas automáticas")).toHaveValue("false");
  fireEvent.click(screen.getByText("Buscar contextos dos chatbots deste navegador"));
  fireEvent.change(screen.getByLabelText("Copiar contexto de"), { target: { value: chatbotExample.id } });
  expect(change).toHaveBeenCalledWith("AI_SYSTEM_PROMPT", expect.stringContaining("Contexto do cliente"));
  expect(change).not.toHaveBeenCalledWith("AI_ENABLED", "true");
});
test("diagnóstico envia token apenas ao endpoint administrativo e exibe erro", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Redis indisponível" }, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AgentSettings values={{}} disabled={false} token="token-teste" onChange={() => {}} />);
  fireEvent.click(screen.getByText("Verificar agente e fila"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Redis indisponível");
  expect(fetchMock).toHaveBeenCalledWith("/api/settings/agent", { headers: { Authorization: "Bearer token-teste" } });
});
