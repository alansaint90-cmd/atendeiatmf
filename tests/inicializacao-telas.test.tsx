import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ChatbotsPage } from "@/components/chatbots/page";
import { Settings } from "@/components/settings";
import { chatbotExample } from "@/lib/chatbots/defaults";
import { storageKey } from "@/lib/chatbots/repository";

afterEach(() => { cleanup(); localStorage.clear(); });

test("contexto persistido carrega e continua editável após a hidratação", () => {
  localStorage.setItem(storageKey, JSON.stringify([{ ...chatbotExample, context: "Atendimento personalizado" }]));
  expect(renderToString(<ChatbotsPage />)).toContain("Carregando chatbots");
  render(<ChatbotsPage />);
  const field = screen.getByLabelText("Prompt de atendimento");
  expect(field).toHaveValue("Atendimento personalizado");
  fireEvent.change(field, { target: { value: "Contexto atualizado" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar contexto geral" }));
  expect(JSON.parse(localStorage.getItem(storageKey)!)[0].context).toBe("Contexto atualizado");
});

test("dados inválidos continuam preservados e exibem erro", () => {
  localStorage.setItem(storageKey, "inválido");
  render(<ChatbotsPage />);
  expect(screen.getByRole("alert")).toHaveTextContent("Os dados salvos são inválidos");
  expect(localStorage.getItem(storageKey)).toBe("inválido");
  expect(screen.getByRole("button", { name: /Novo chatbot/ })).toBeDisabled();
});

test("URL de webhook usa a origem do navegador somente no cliente", () => {
  expect(renderToString(<Settings />)).not.toContain(`${window.location.origin}/api/webhooks/evolution`);
  render(<Settings />);
  expect(screen.getByLabelText("URL de recebimento")).toHaveValue(`${window.location.origin}/api/webhooks/evolution`);
});
