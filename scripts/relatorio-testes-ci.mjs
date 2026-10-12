// Anotações do GitHub para testes simulados; não lê configurações ou credenciais.
const escapar = texto => String(texto).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");

export default async function* relatorioTestesCi(eventos) {
  for await (const evento of eventos) {
    if (evento.type !== "test:fail") continue;
    const erro = evento.data.details?.error;
    const causa = erro?.cause ?? erro;
    const detalhe = causa?.stack ?? causa?.message ?? "Teste reprovado.";
    yield `::error::${escapar(`${evento.data.name}\n${detalhe}`)}\n`;
  }
}
