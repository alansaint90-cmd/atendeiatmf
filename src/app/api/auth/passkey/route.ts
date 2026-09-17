import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setTimeout as esperar } from "node:timers/promises";
import { db } from "@/lib/db/client";
import { ensureDatabase } from "@/lib/db/migrate";
import { systemUserId } from "@/lib/db/bootstrap";
import { auditarIdentidade } from "@/lib/auth/repositorio";
import { entradaAuth } from "@/lib/auth/validacao";
import { configuracaoPasskey, iniciarLogin, iniciarRegistro, concluirLogin, concluirRegistro } from "@/lib/auth/passkeys";
import { nomeCookieDesafio, nomeCookieSessao, opcoesCookie } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const inicio = Date.now();
  try {
    if (process.env.AUTH_LOGIN_ENABLED !== "true") throw new Error("Indisponível");
    const config = configuracaoPasskey();
    if (request.headers.get("origin") !== config.expectedOrigin || !request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Origem");
    // Limite efetivo mesmo para clientes sem Content-Length.
    const reader = request.body?.getReader(); let corpo = ""; const decoder = new TextDecoder(); let tamanho = 0;
    if (!reader) throw new Error("Entrada");
    for (;;) { const trecho = await reader.read(); if (trecho.done) break; tamanho += trecho.value.byteLength;
      if (tamanho > 65536) { await reader.cancel(); throw new Error("Limite"); } corpo += decoder.decode(trecho.value, { stream: true }); }
    corpo += decoder.decode();
    const entrada = entradaAuth.parse(JSON.parse(corpo));
    await ensureDatabase();
    const jar = await cookies();
    if (entrada.acao === "iniciar_login" || entrada.acao === "iniciar_registro") {
      const resultado = entrada.acao === "iniciar_login" ? await iniciarLogin(db()) : await iniciarRegistro(db(), entrada.convite);
      jar.set(nomeCookieDesafio(), resultado.token, opcoesCookie(300));
      return NextResponse.json({ options: resultado.options }, { headers: { "Cache-Control": "no-store" } });
    }
    const desafio = jar.get(nomeCookieDesafio())?.value ?? "";
    jar.set(nomeCookieDesafio(), "", opcoesCookie(0));
    const token = entrada.acao === "concluir_login" ? await concluirLogin(db(), desafio, entrada.resposta) : await concluirRegistro(db(), desafio, entrada.resposta);
    jar.set(nomeCookieSessao(), token, opcoesCookie(86400));
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (process.env.AUTH_LOGIN_ENABLED === "true") {
      try { await auditarIdentidade(db(), systemUserId, "autenticacao_recusada"); } catch { /* Nunca incluir credenciais ou erro do driver na resposta. */ }
    }
    await esperar(Math.max(0, 500 - (Date.now() - inicio)));
    return NextResponse.json({ erro: "Não foi possível autenticar. Confira o acesso e tente novamente." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
