import { beforeAll, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatbotEditor } from "@/components/chatbots/editor";
import { chatbotExample } from "@/lib/chatbots/defaults";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
test("salva frases de ativação junto às instruções e permite editar sem perder o prompt", () => {
  const salvar = vi.fn();
  render(<ChatbotEditor initial={{ ...chatbotExample, context: "Prompt principal preservado",
    flows: [{ name: "Promoção", description: "Explique a promoção", triggers: ["Frase anterior"] }] }} creating={false} onSave={salvar} onClose={() => {}} error="" />);
  fireEvent.change(screen.getByLabelText(/Frases de ativação/), { target: { value: "Novo gatilho\n\nOutra frase" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ context: "Prompt principal preservado",
    flows: [{ name: "Promoção", description: "Explique a promoção", triggers: ["Novo gatilho", "Outra frase"] }] }));
});
test("não salva lista acima de vinte frases e mantém a edição visível", () => {
  const salvar = vi.fn();
  render(<ChatbotEditor initial={{ ...chatbotExample, flows: [{ name: "Promoção", description: "Instruções" }] }} creating={false} onSave={salvar} onClose={() => {}} error="" />);
  const frases = Array.from({ length: 21 }, (_, i) => `Frase ${i}`).join("\n");
  fireEvent.change(screen.getByLabelText(/Frases de ativação/), { target: { value: frases } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(salvar).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
  expect(screen.getByLabelText(/Frases de ativação/)).toHaveValue(frases);
});
