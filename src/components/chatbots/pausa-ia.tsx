"use client";
import { useEffect, useState } from "react";
import { consultarPausaIa, pausarIaInstancia } from "@/lib/actions/pausa-ia";
import { ModalConfirmacaoBlock } from "@/components/modal-confirmacao-block";

export function PausaIa({ instancia }: { instancia: string }) {
  const [estado, definirEstado] = useState<{ pausada: boolean; versao: number } | null>(null);
  const [erro, definirErro] = useState("");
  const [ocupado, definirOcupado] = useState(false);
  const [confirmar, definirConfirmar] = useState(false);
  useEffect(() => {
    let ativo = true;
    void consultarPausaIa(instancia).then(r => {
      if (!ativo) return;
      if (r.ok) definirEstado(r.dados); else definirErro(r.erro);
    }).catch(() => { if (ativo) definirErro("Não foi possível consultar a pausa da IA."); });
    return () => { ativo = false; };
  }, [instancia]);
  async function pausar() {
    if (!estado || ocupado) return;
    definirOcupado(true); definirErro("");
    try {
      const r = await pausarIaInstancia({ instancia, versao: estado.versao });
      if (r.ok) { definirEstado(r.dados); definirConfirmar(false); } else definirErro(r.erro);
    } catch { definirErro("Não foi possível confirmar a pausa. Consulte o estado antes de tentar novamente."); }
    finally { definirOcupado(false); }
  }
  async function atualizar() {
    definirOcupado(true); definirErro("");
    try {
      const r = await consultarPausaIa(instancia);
      if (r.ok) definirEstado(r.dados); else { definirEstado(null); definirErro(r.erro); }
    } catch { definirEstado(null); definirErro("Não foi possível consultar a pausa da IA."); }
    finally { definirOcupado(false); }
  }
  return <div>
    <button type="button" className="secondary" disabled={!estado || estado.pausada || ocupado} onClick={() => definirConfirmar(true)}>Pausar IA</button>{" "}
    <button type="button" className="secondary" disabled={ocupado} onClick={() => void atualizar()}>Atualizar estado</button>
    <p aria-live="polite">{estado ? estado.pausada ? `IA pausada em ${instancia}.` : `IA disponível em ${instancia}.` : "Consultando estado da IA…"}</p>
    {estado?.pausada && <p>Para liberar, envie manualmente no WhatsApp: “Se precisar de algo mais, é só falar.”</p>}
    {erro && <p role="alert">{erro}</p>}
    <ModalConfirmacaoBlock aberto={confirmar} titulo={`Pausar IA em ${instancia}`} mensagem="A IA deixará de responder neste número. Os outros números continuam atendendo." onConfirmar={() => void pausar()} onCancelar={() => definirConfirmar(false)} carregando={ocupado} textoConfirmar="Pausar IA" />
  </div>;
}
