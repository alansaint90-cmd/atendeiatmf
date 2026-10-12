import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentSettings } from "@/components/agent-settings";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test("não exibe prompt de orquestrador e aponta para o chatbot SDR", () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ workerEnabled: false, enabled: false, queued: 0 })));
  const change = vi.fn();
  render(<AgentSettings values={{}} disabled={false} onChange={change} />);
  expect(screen.getByLabelText("Respostas automáticas")).toHaveValue("false");
  expect(screen.getByText(/respostas usam somente o prompt do chatbot SDR/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Contexto geral do orquestrador")).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});
test("diagnóstico identifica instância e pausa e permite consultar o resultado atualizado", async () => {
  const consulta = vi.fn().mockResolvedValueOnce(Response.json({ worker: { lastResult: "pausa_manual", lastInstance: "levaelava" } }))
    .mockResolvedValueOnce(Response.json({ worker: { lastResult: "enviada", lastInstance: "levaelava", lastFlow: "Promoção" } }));
  vi.stubGlobal("fetch", consulta);
  render(<AgentSettings values={{}} disabled={false} onChange={() => {}} />);
  expect(await screen.findByText(/O atendente deve enviar manualmente/)).toHaveTextContent("Instância: levaelava");
  fireEvent.click(screen.getByRole("button", { name: "Atualizar diagnóstico" }));
  expect(await screen.findByText(/Fluxo acionado: Promoção/)).toHaveTextContent("Último resultado: enviada");
  expect(consulta).toHaveBeenCalledTimes(2);
});
test("diagnóstico é consultado automaticamente pela sessão e exibe erro", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Redis indisponível" }, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AgentSettings values={{}} disabled={false} onChange={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Redis indisponível");
  expect(fetchMock).toHaveBeenCalledWith("/api/settings/agent", { cache: "no-store" });
});
