import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { TagsPage } from "@/components/tags/page";
import { FollowupsPage } from "@/components/followups/page";
import { defaultFollowup } from "@/lib/followups/schema";
import { carregarTags, salvarTag, excluirTag } from "@/lib/actions/tags";
import { carregarFollowups, salvarFollowups } from "@/lib/actions/followups";

vi.mock("@/lib/actions/tags", () => ({ carregarTags: vi.fn(), salvarTag: vi.fn(), excluirTag: vi.fn() }));
vi.mock("@/lib/actions/followups", () => ({ carregarFollowups: vi.fn(), salvarFollowups: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });
function load() {
  fireEvent.click(screen.getByText("Carregar dados"));
}
test("tags carregam, buscam e exigem confirmação antes de salvar", async () => {
  vi.mocked(carregarTags).mockResolvedValue({ ok: true, dados: [] });
  vi.mocked(salvarTag).mockResolvedValue({ ok: true, dados: { id: "teste", name: "Atleta", color: "#10b981", version: 0 } });
  render(<TagsPage />); load();
  fireEvent.click(await screen.findByText("+ Nova tag"));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Atleta" } });
  vi.useFakeTimers(); fireEvent.click(screen.getByText("Salvar tag"));
  expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  expect(salvarTag).not.toHaveBeenCalled();
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirmar" })); });
  vi.useRealTimers(); expect(await screen.findByText("Tag salva no servidor.")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Busque pelo nome da tag"), { target: { value: "inexistente" } });
  expect(screen.getByText("Nenhuma tag encontrada para essa busca.")).toBeInTheDocument();
  expect(excluirTag).not.toHaveBeenCalled();
});
test("follow-up carrega três mensagens desligadas e valida ativação", async () => {
  vi.mocked(carregarFollowups).mockResolvedValue({ ok: true, dados: { config: structuredClone(defaultFollowup), version: 1, instance: "teste" } });
  render(<FollowupsPage />); load();
  expect(await screen.findByLabelText("Chip")).toHaveValue("teste");
  expect(screen.getByLabelText("Follow-ups automáticos desligados")).not.toBeChecked();
  expect(screen.getByLabelText("Mensagem 3")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Follow-ups automáticos desligados"));
  fireEvent.click(screen.getByText("Salvar follow-ups"));
  expect(screen.getByRole("alert")).toHaveTextContent("ative ao menos uma mensagem");
  expect(salvarFollowups).not.toHaveBeenCalled();
});
test("erro administrativo é exibido sem abrir os campos protegidos", async () => {
  vi.mocked(carregarTags).mockResolvedValue({ ok: false, erro: "Token inválido" });
  render(<TagsPage />); load();
  expect(await screen.findByRole("alert")).toHaveTextContent("Token inválido");
  expect(screen.queryByText("+ Nova tag")).not.toBeInTheDocument();
});
