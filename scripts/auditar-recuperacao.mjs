/** @param {string} arquivo @param {string} fonte */
export function recuperacaoInsegura(arquivo, fonte) {
  if (arquivo === "src/lib/auth/recuperacao.ts") return ![
    /hashToken\(token\)/, /interval '15 minutes'/, /FOR UPDATE/,
    /versao_usuario=\$\{usuario.version\}/, /usado_em IS NULL AND expira_em>now\(\)/,
    /await revogarAcessos\(/, /await auditarIdentidade\(/, /prepararSenha/,
  ].every(padrao => padrao.test(fonte));
  if (arquivo === "src/app/api/auth/recuperacao/route.ts") return ![
    /AUTH_LOGIN_ENABLED/, /request.headers.get\("origin"\) !== process.env.AUTH_ORIGIN/,
    /tamanho > 4096/, /await limitarAuth\(/, /await redefinirSenha\(/, /mensagemRecuperacao/,
  ].every(padrao => padrao.test(fonte));
  return false;
}
