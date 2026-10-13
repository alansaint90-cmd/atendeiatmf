import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FormularioRecuperacao } from "../src/app/recuperar-senha/_components/formulario";
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
test("solicita recuperação e mostra confirmação sem divulgar conta ou token", async () => {
  const envio = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ mensagem: "Confira seu e-mail." })));
  render(<FormularioRecuperacao />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Confira seu e-mail.");
  expect(JSON.parse(String(envio.mock.calls[0][1]?.body))).toEqual({ acao: "solicitar", email: "pessoa@example.test" });
});
test("remove token da URL, impede senhas diferentes e informa falha sem perder a edição", async () => {
  window.history.replaceState(null, "", `/recuperar-senha#${"t".repeat(43)}`);
  const envio = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ erro: "Link expirado." }), { status: 400 }));
  render(<FormularioRecuperacao />);
  await screen.findByLabelText("Nova senha");
  expect(window.location.hash).toBe("");
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "a".repeat(20) } });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "b".repeat(20) } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  expect(envio).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("As senhas precisam ser iguais.");
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "a".repeat(20) } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Link expirado."));
  expect(screen.getByLabelText("Nova senha")).toHaveValue("a".repeat(20));
});
