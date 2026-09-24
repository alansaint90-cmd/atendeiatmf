import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentSettings } from "@/components/agent-settings";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test("explica que o contexto geral não substitui as instruções do chatbot", () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ workerEnabled: false, enabled: false, queued: 0 })));
  const change = vi.fn();
  render(<AgentSettings values={{}} disabled={false} onChange={change} />);
  expect(screen.getByLabelText("Respostas automáticas")).toHaveValue("false");
  expect(screen.getByText(/prompt do chatbot SDR.*tem prioridade/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Contexto geral do orquestrador"), { target: { value: "Informações da empresa" } });
  expect(change).toHaveBeenCalledWith("AI_SYSTEM_PROMPT", "Informações da empresa");
});
test("diagnóstico é consultado automaticamente pela sessão e exibe erro", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Redis indisponível" }, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AgentSettings values={{}} disabled={false} onChange={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Redis indisponível");
  expect(fetchMock).toHaveBeenCalledWith("/api/settings/agent", { cache: "no-store" });
});
