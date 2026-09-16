"use client";
import { useState } from "react";
import { loadChatbots, errorMessage } from "@/lib/chatbots/repository";
import type { Chatbot } from "@/lib/chatbots/schema";

interface AgentSettingsProps {
  values: Record<string, string>;
  disabled: boolean;
  token: string;
  onChange: (name: string, value: string) => void;
}

export function AgentSettings({ values, disabled, token, onChange }: AgentSettingsProps) {
  const [bots, setBots] = useState<Chatbot[]>([]);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [loading, setLoading] = useState(false);
  async function check() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/settings/agent", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha ao consultar agente.");
      setDiagnostic(`Processador: ${result.workerEnabled ? "habilitado" : "desabilitado no servidor"}. Respostas: ${result.enabled ? "ativadas" : "desativadas"}. Fila: ${result.queued}. Estado: ${result.worker?.status ?? "sem sinal do processador"}. Último resultado: ${result.worker?.lastResult ?? "nenhum"}. Código: ${result.worker?.lastCode ?? "nenhum"}.`);
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  return <fieldset disabled={disabled} className="form-panel">
    <legend>Agente de IA no WhatsApp</legend>
    <label>Respostas automáticas<select value={values.AI_ENABLED || "false"} onChange={event => onChange("AI_ENABLED", event.target.value)}>
      <option value="false">Desativadas</option><option value="true">Ativadas</option>
    </select></label>
    <label>Contexto geral do agente<textarea rows={14} maxLength={200000} value={values.AI_SYSTEM_PROMPT ?? ""}
      onChange={event => onChange("AI_SYSTEM_PROMPT", event.target.value)} placeholder="Escreva o prompt de atendimento que será usado no WhatsApp." /></label>
    <small>Este é o contexto usado no servidor. Alterações nos chatbots locais precisam ser copiadas novamente e salvas aqui. Somente texto individual recente é respondido.</small>
    <button type="button" className="secondary" onClick={() => {
      try { setBots(loadChatbots(localStorage).bots); setError(""); }
      catch (error) { setError(errorMessage(error)); }
    }}>Buscar contextos dos chatbots deste navegador</button>
    {bots.length > 0 ? <label>Copiar contexto de<select defaultValue="" onChange={event => {
      const bot = bots.find(item => item.id === event.target.value);
      if (bot) onChange("AI_SYSTEM_PROMPT", [`Nome do assistente: ${bot.persona}`, `Estilo: ${bot.personalities.join(", ")}`,
        `Missão: ${bot.mission}`, bot.context, `Quando não souber: ${bot.fallback}`].join("\n\n"));
    }}><option value="">Selecione um chatbot</option>{bots.map(bot => <option key={bot.id} value={bot.id}>{bot.identifier}</option>)}</select></label>
      : <small>Nenhum contexto local carregado. Você também pode escrever o prompt acima.</small>}
    <button type="button" className="secondary" disabled={loading} onClick={() => void check()}>{loading ? "Consultando…" : "Verificar agente e fila"}</button>
    {diagnostic && <p role="status">{diagnostic}</p>}{error && <p role="alert">{error}</p>}
  </fieldset>;
}
