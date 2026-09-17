"use client";
interface AdminAccessProps { token: string; busy: boolean; onToken: (value: string) => void; onLoad: () => void }
export function AdminAccess({ token, busy, onToken, onLoad }: AdminAccessProps) {
  return <form className="panel admin-access" onSubmit={event => { event.preventDefault(); onLoad(); }}>
    <label>Token de administrador<input type="password" autoComplete="off" value={token} disabled={busy} onChange={event => onToken(event.target.value)} /></label>
    <button className="secondary" disabled={busy || token.length < 32}>{busy ? "Carregando…" : "Carregar dados"}</button>
    <small>Use o mesmo token das Configurações. Ele fica apenas na memória desta página.</small>
  </form>;
}
