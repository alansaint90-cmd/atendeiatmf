import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { FormularioPasskey } from "../src/app/entrar/_components/formulario";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

beforeEach(() => vi.restoreAllMocks());

function preencherLogin() {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@example.com" } });
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), { target: { value: "senha-de-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar", exact: true }));
}

test("mostra e oculta a senha sem enviar o formulário", () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<FormularioPasskey />);
  const campo = screen.getByLabelText("Senha", { exact: true });
  expect(campo).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
  expect(campo).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
  expect(campo).toHaveAttribute("type", "password");
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  [401, "E-mail ou senha incorretos."],
  [429, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
  [503, "O serviço está temporariamente indisponível. Tente novamente em instantes."],
])("mostra a mensagem adequada ao erro HTTP %i", async (status, mensagem) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status } as Response);
  render(<FormularioPasskey />);
  preencherLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
  expect(screen.queryByText(/Verifique o código do convite/)).not.toBeInTheDocument();
});

test("explica falha de conexão sem exibir detalhes internos", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
  render(<FormularioPasskey />);
  preencherLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
});

test("mostra erro de convite apenas no primeiro acesso", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 } as Response);
  render(<FormularioPasskey />);
  fireEvent.click(screen.getByText("Primeiro acesso com convite"));
  fireEvent.change(screen.getByLabelText("Convite"), { target: { value: "x".repeat(43) } });
  fireEvent.change(screen.getByLabelText("Defina sua senha"), { target: { value: "frase longa exclusiva" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar senha e entrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Convite inválido, expirado ou já utilizado.");
});
