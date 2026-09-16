"use client";
import { useState } from "react";
export function Settings({ apiKey, onApiKey }: { apiKey: string; onApiKey: (value: string) => void }) {
  const [show, setShow] = useState(false);
  return <><section className="page-head"><div><h1>Configurações</h1><p>Dados da empresa e integrações do protótipo.</p></div><span className="badge">Modo demonstração</span></section>
    <section className="settings-grid"><article className="panel form-panel">
      <label>Empresa<input defaultValue="Catuense Soluções Digitais" /></label>
      <label>Email técnico<input type="email" defaultValue="integracao@empresa.com" /></label>
      <label>Webhook/API<textarea defaultValue="https://api.empresa.com/webhooks/whatsapp" /></label>
      <small>Dados de demonstração; integração e salvamento no servidor ainda não configurados.</small>
    </article><article className="panel qr-panel"><h2>Conexão WhatsApp</h2><div className="qr" aria-label="QR Code ilustrativo" /><p>QR Code ilustrativo. Nenhum canal está conectado.</p></article>
    <article className="panel form-panel"><h2>OpenAI</h2><label htmlFor="openai-api-key">Chave de API da OpenAI</label><input id="openai-api-key" type={show ? "text" : "password"} value={apiKey} onChange={event => onApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" spellCheck={false} aria-describedby="openai-key-help" />
      <div><button className="secondary" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Ocultar chave" : "Mostrar chave"}</button></div>
      <small id="openai-key-help">A chave fica somente na memória desta página e é apagada ao atualizar ou fechar a aba. A conexão com a OpenAI ainda não está integrada.</small>
    </article></section></>;
}
