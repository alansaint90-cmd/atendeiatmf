export const nomeCookieSessao = () => process.env.NODE_ENV === "production" ? "__Host-atendeia-sessao" : "atendeia-sessao";
export const nomeCookieDesafio = () => process.env.NODE_ENV === "production" ? "__Host-atendeia-desafio" : "atendeia-desafio";
export const opcoesCookie = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge });
