"use client";
import { useEffect, useState } from "react";
const fields = [
  ["OPENAI_API_KEY", "Chave de API da OpenAI", true],
  ["OPENAI_MODEL", "Modelo OpenAI", false],
  ["EVOLUTION_API_URL", "URL base da Evolution", false],
  ["EVOLUTION_API_KEY", "Chave de API da Evolution", true],
  ["EVOLUTION_INSTANCE_NAME", "Nome exato da instância Evolution", false],
  ["EVOLUTION_WEBHOOK_SECRET", "Segredo do webhook (32 a 256 caracteres)", true],
  ["REDIS_URL", "URL de conexão Redis", true],
] as const;
type Status = { version: number; configured: Record<string, boolean>; values: Record<string, string> };
export function Settings() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [seconds, setSeconds] = useState(3);
  const [webhook, setWebhook] = useState("");
  useEffect(() => { setWebhook(`${window.location.origin}/api/webhooks/evolution`); }, []);
  useEffect(() => {
    if (!confirm || seconds === 0) return;
    const timer = setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [confirm, seconds]);
  async function request(save: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/settings/integrations", {
        method: save ? "PUT" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(save ? { "Content-Type": "application/json" } : {}) },
        ...(save ? { body: JSON.stringify({ version: status?.version, values: Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()).map(([name, value]) => [name, value.trim()])) }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao acessar o servidor.");
      setStatus(result); setValues(result.values); setConfirm(false);
      setMessage(save ? "Configurações salvas no servidor. Isso não confirma conexão com os provedores." : "Configurações carregadas. Campos secretos vazios preservam os valores existentes.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  return <><section className="page-head"><div><h1>Configurações de integrações</h1><p>Credenciais criptografadas e salvas no servidor.</p></div></section>
    <section className="settings-grid"><article className="panel form-panel"><h2>Acesso administrativo</h2>
      <label>Token de administrador<input type="password" value={token} disabled={busy} autoComplete="off" spellCheck={false} onChange={event => { setToken(event.target.value); setStatus(null); setValues({}); setConfirm(false); }} /></label>
      <small>Use o SETTINGS_ADMIN_TOKEN definido no EasyPanel. O acesso demonstrativo não autoriza alterações. O token não é salvo no navegador.</small>
      <button className="secondary" disabled={busy || token.length < 32} onClick={() => void request(false)}>{busy ? "Aguarde…" : "Carregar configurações"}</button>
      {status && <button className="secondary" disabled={busy} onClick={() => { setToken(""); setStatus(null); setValues({}); setMessage(""); setConfirm(false); }}>Bloquear configurações</button>}
    </article><article className="panel form-panel"><h2>Webhook da Evolution</h2><label>URL de recebimento<input readOnly value={webhook} /></label><p>Configure esta URL na Evolution com By Events desligado. Envie o segredo no cabeçalho <code>x-webhook-secret</code>.</p><small>O webhook recebe eventos no Redis. O processamento e as respostas automáticas por IA ainda não estão disponíveis.</small></article></section>
    <p role="status" aria-live="polite">{message}</p>
    {status && <form className="panel form-panel" onSubmit={event => { event.preventDefault(); setConfirm(true); setSeconds(3); }}>
      {fields.map(([name, label, secret]) => <label key={name}>{label}<input type={secret ? "password" : "text"} autoComplete="off" spellCheck={false} maxLength={4096} disabled={busy || confirm} value={values[name] ?? ""} placeholder={status.configured[name] ? "Configurado — deixe vazio para manter" : "Não configurado"} onChange={event => setValues(previous => ({ ...previous, [name]: event.target.value }))} /><small>{status.configured[name] ? "Valor configurado no servidor" : "Nenhum valor configurado"}</small></label>)}
      <small>Campos vazios mantêm o valor atual. As configurações salvas prevalecem sobre as variáveis de ambiente. Redis deve começar com redis:// ou rediss://.</small>
      <button className="primary" disabled={busy || confirm}>Salvar configurações</button>
      {confirm && <div role="alertdialog" aria-label="Confirmar alterações"><p>Confirmar as novas credenciais? Alterar o segredo do webhook exige atualizar o mesmo valor na Evolution.</p><button type="button" className="primary" disabled={busy || seconds > 0} onClick={() => void request(true)}>{seconds > 0 ? `Confirmar em ${seconds}s` : "Confirmar e salvar"}</button><button type="button" className="secondary" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</button></div>}
    </form>}
  </>;
}
