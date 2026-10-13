import { after } from "next/server";
import { setTimeout as esperar } from "node:timers/promises";
import { db } from "@/lib/db/client";
import { ensureDatabase } from "@/lib/db/migrate";
import { contextoAuth, contextoRequisicao } from "@/lib/auth/contexto";
import { limitarAuth } from "@/lib/auth/repositorio";
import { emitirRecuperacao, redefinirSenha, mensagemRecuperacao } from "@/lib/auth/recuperacao";
import { configuracaoEmail, enviarRecuperacao } from "@/lib/auth/email-recuperacao";
import { z } from "zod";
import { novaSenha } from "@/lib/auth/senhas";
import { ErroDeNegocio } from "@/lib/acao";

export const runtime = "nodejs";
const entrada = z.discriminatedUnion("acao", [
  z.strictObject({ acao: z.literal("solicitar"), email: z.email().max(254) }),
  z.strictObject({ acao: z.literal("redefinir"), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), senha: novaSenha }),
]);
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const inicio = Date.now();
  return contextoAuth.run({ ...contextoRequisicao(request), meio: "recuperacao_senha" }, async () => {
    try {
      if (process.env.AUTH_LOGIN_ENABLED !== "true") return json({ erro: "Recuperação indisponível neste ambiente." }, 503);
      if (!process.env.AUTH_ORIGIN || request.headers.get("origin") !== process.env.AUTH_ORIGIN
        || request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ erro: "Requisição inválida." }, 403);
      const leitor = request.body?.getReader();
      if (!leitor) return json({ erro: "Informe os dados solicitados." }, 400);
      const partes: Uint8Array[] = []; let tamanho = 0;
      try {
        for (;;) {
          const { done, value } = await leitor.read(); if (done) break;
          tamanho += value.byteLength;
          if (tamanho > 4096) { await leitor.cancel(); return json({ erro: "Requisição muito grande." }, 413); }
          partes.push(value);
        }
      } finally { leitor.releaseLock(); }
      const dados = entrada.safeParse(JSON.parse(Buffer.concat(partes).toString("utf8")));
      if (!dados.success) return json({ erro: "Confira os dados. A nova senha deve ter entre 15 e 256 caracteres." }, 400);
      if (dados.data.acao === "solicitar") {
        try { configuracaoEmail(); } catch { return json({ erro: "O envio de recuperação ainda não está configurado. Entre em contato com o responsável pelo sistema." }, 503); }
      }
      await ensureDatabase();
      await limitarAuth(db(), `recuperacao:origem:${contextoAuth.getStore()?.ip ?? "compartilhada"}`, 20);
      if (dados.data.acao === "solicitar") {
        const envio = await emitirRecuperacao(db(), { email: dados.data.email });
        if (envio) after(async () => {
          try { await enviarRecuperacao(envio.email, envio.token); }
          catch { console.error("Atende AI: falha no envio de recuperação; confira o SMTP no servidor."); }
        });
        return json({ mensagem: mensagemRecuperacao });
      }
      const resultado = await redefinirSenha(db(), { token: dados.data.token, senha: dados.data.senha });
      return json({ mensagem: "Senha alterada. Entre com sua nova senha.", aviso: resultado.aviso });
    } catch (erro) {
      return json({ erro: erro instanceof ErroDeNegocio ? erro.message : "Não foi possível concluir a recuperação. Tente novamente em instantes." }, 400);
    } finally { await esperar(Math.max(0, 800 - (Date.now() - inicio))); }
  });
}
