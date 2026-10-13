import { afterEach, expect, test, vi } from "vitest";
const transporte = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue({}), close: vi.fn() }));
const criar = vi.hoisted(() => vi.fn());
vi.mock("nodemailer", () => ({ default: { createTransport: criar } }));
import { configuracaoEmail, enviarRecuperacao } from "../src/lib/auth/email-recuperacao";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
test("envio exige TLS e usa origem fixa com token somente no fragmento do link", async () => {
  criar.mockReturnValue(transporte);
  for (const [chave, valor] of Object.entries({ SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_SECURE: "false",
    SMTP_USER: "usuario-teste", SMTP_PASSWORD: "credencial-simulada", SMTP_FROM: "acesso@example.test", AUTH_ORIGIN: "https://atende.example.test" })) vi.stubEnv(chave, valor);
  await enviarRecuperacao("pessoa@example.test", "t".repeat(43));
  expect(criar).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, disableFileAccess: true, disableUrlAccess: true }));
  expect(transporte.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "pessoa@example.test",
    text: expect.stringContaining(`https://atende.example.test/recuperar-senha#${"t".repeat(43)}`) }));
  expect(transporte.close).toHaveBeenCalled();
  vi.stubEnv("SMTP_HOST", ""); expect(() => configuracaoEmail()).toThrow();
});
