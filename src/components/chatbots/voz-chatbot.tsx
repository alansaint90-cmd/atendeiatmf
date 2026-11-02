"use client";
import { vozDesativada, vozes, type ConfiguracaoVoz } from "@/lib/voz/configuracao";

interface VozChatbotProps {
  valor?: ConfiguracaoVoz;
  onChange: (valor: ConfiguracaoVoz) => void;
}
export function VozChatbot({ valor = vozDesativada, onChange }: VozChatbotProps) {
  return <section className="bot-section"><h2>Respostas em voz — Leva e Lava</h2>
    <p>Somente em resposta a áudio do cliente. O agente narra o texto já preparado, sem mudar o conteúdo do atendimento.</p>
    <div className="bot-settings-grid">
      <label>Modo de resposta<select value={valor.modo} onChange={event => onChange({ ...valor,
        modo: event.target.value as ConfiguracaoVoz["modo"], habilitada: false })}>
        <option value="texto">Somente texto</option><option value="audio_recebido">Voz ao receber áudio</option>
      </select></label>
      <label>Voz<select value={valor.voz} onChange={event => onChange({ ...valor,
        voz: event.target.value as ConfiguracaoVoz["voz"], habilitada: false, homologada: false })}>
        {vozes.map(voz => <option key={voz} value={voz}>{voz.charAt(0).toUpperCase() + voz.slice(1)}</option>)}
      </select></label>
    </div>
    <p>Links, valores, endereços, procedimentos e respostas longas continuam em texto. Antes da voz, o cliente recebe um aviso de que ela é gerada por IA.</p>
    <label className="bot-switch"><input type="checkbox" checked={valor.homologada} onChange={event => onChange({ ...valor,
      homologada: event.target.checked, habilitada: event.target.checked ? valor.habilitada : false })} />
      Validei a pronúncia de “Leva e Lava” e a reprodução como mensagem de voz no WhatsApp com um destinatário de teste autorizado.
    </label>
    <label className="bot-switch"><input type="checkbox" checked={valor.habilitada} disabled={!valor.homologada || valor.modo !== "audio_recebido"}
      onChange={event => onChange({ ...valor, habilitada: event.target.checked })} />Habilitar respostas em voz nesta instância</label>
    <small>Inicialmente desligado. Salvar a ativação exige confirmação. A liberação no servidor depende da aprovação de publicação. Esta tela não gera nem envia áudio de teste.</small>
  </section>;
}
