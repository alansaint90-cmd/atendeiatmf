import nodemailer from "nodemailer";
import { z } from "zod";

const configuracao = z.strictObject({
  host: z.string().trim().min(1), port: z.coerce.number().int().min(1).max(65535),
  secure: z.enum(["true", "false"]), user: z.string().min(1), pass: z.string().min(1),
  from: z.email(), origin: z.url(),
});
export function configuracaoEmail() {
  const config = configuracao.parse({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE, user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM, origin: process.env.AUTH_ORIGIN });
  const origem = new URL(config.origin);
  if (origem.origin !== config.origin || (origem.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && origem.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origem.hostname)))) {
    throw new Error("Origem de recuperação inválida.");
  }
  return config;
}
export async function enviarRecuperacao(destinatario: string, token: string) {
  const config = configuracaoEmail();
  const transporte = nodemailer.createTransport({ host: config.host, port: config.port,
    secure: config.secure === "true", requireTLS: config.secure !== "true",
    auth: { user: config.user, pass: config.pass }, connectionTimeout: 10000,
    greetingTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  // Fragmento não é enviado ao servidor nem ao Referer; a tela o remove ao carregar.
  const link = `${config.origin}/recuperar-senha#${encodeURIComponent(token)}`;
  try {
    await transporte.sendMail({ from: config.from, to: destinatario, subject: "Redefina sua senha do Atende AI",
      text: `Recebemos um pedido para redefinir sua senha.\n\nAbra o link abaixo e escolha uma nova senha:\n${link}\n\nO link expira em 15 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail; sua senha permanece igual.` });
  } finally { transporte.close(); }
}
