"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

async function requisitar<T>(entrada: unknown): Promise<T> {
  const resposta = await fetch("/api/auth/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
  if (!resposta.ok) throw new Error("Não foi possível autenticar. Confira o acesso e tente novamente.");
  return resposta.json() as Promise<T>;
}
export function FormularioPasskey() {
  const router = useRouter();
  const [convite, setConvite] = useState(""); const [erro, setErro] = useState(""); const [carregando, setCarregando] = useState(false);
  async function entrar(registro: boolean) {
    setErro(""); setCarregando(true);
    try {
      if (registro) {
        const { options } = await requisitar<{ options: PublicKeyCredentialCreationOptionsJSON }>({ acao: "iniciar_registro", convite });
        const resposta = await startRegistration({ optionsJSON: options });
        await requisitar({ acao: "concluir_registro", resposta }); setConvite("");
      } else {
        const { options } = await requisitar<{ options: PublicKeyCredentialRequestOptionsJSON }>({ acao: "iniciar_login" });
        const resposta = await startAuthentication({ optionsJSON: options });
        await requisitar({ acao: "concluir_login", resposta });
      }
      router.push("/crm"); router.refresh();
    } catch { setErro("Não foi possível concluir o acesso. Verifique sua passkey ou o convite e tente novamente."); }
    finally { setCarregando(false); }
  }
  return <section className="form-card"><h1>Acesso individual</h1><p>Use a passkey cadastrada no seu dispositivo para acessar o CRM.</p>
    {erro && <p role="alert">{erro}</p>}<button className="primary" disabled={carregando} onClick={() => void entrar(false)}>{carregando ? "Aguardando verificação…" : "Entrar com passkey"}</button>
    <details><summary>Primeiro acesso com convite</summary><label>Convite<input type="password" autoComplete="off" value={convite} maxLength={43} onChange={e => setConvite(e.target.value)} /></label>
      <button disabled={carregando || convite.length !== 43} onClick={() => void entrar(true)}>Cadastrar minha passkey</button></details>
    <Link href="/">Voltar ao painel existente</Link>
  </section>;
}
