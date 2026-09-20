"use client";
interface AdminAccessProps { busy: boolean; onLoad: () => void }
export function AdminAccess({ busy, onLoad }: AdminAccessProps) {
  return <div className="panel admin-access">
    <button className="secondary" disabled={busy} onClick={onLoad}>{busy ? "Carregando…" : "Carregar dados"}</button>
    <small>O acesso usa sua sessão e as permissões do seu perfil.</small>
  </div>;
}
