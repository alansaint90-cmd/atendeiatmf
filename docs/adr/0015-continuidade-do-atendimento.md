# ADR-0015: Continuidade do atendimento após a retomada

- **Status**: Aceito
- **Data**: 2026-10-08
- **Decisores**: usuário, que solicitou continuidade do assunto ao retomar.

## Contexto

O Redis guardava somente 12 turnos concluídos pela IA por 24 horas. Mensagens
humanas e entradas arquivadas durante a pausa eram persistidas no PostgreSQL,
mas não chegavam ao modelo. Uma retomada podia parecer primeiro contato e
acrescentar uma apresentação e uma segunda pergunta de nome.

## Decisão

O worker recupera até 40 textos anteriores do mesmo chip e telefone, dentro de
100 dias, nas tabelas operacionais existentes. Filtra exclusão lógica de mensagem,
conversa, contato e canal; não inclui a mensagem atual nem mensagens posteriores.
Mescla o resultado com Redis pela identidade do provedor; cache legado usa
correspondência de papel e conteúdo. Origem, identidade e instante são metadados
locais, removidos ao montar a requisição do modelo. O cache passa a 40 turnos por
100 dias, preservando revisões e transcrições sem repetir mensagens.

Saídas humanas mantêm o contexto; saídas identificadas como IA exigem a revisão
atual das instruções para entrar no modelo. O nome recuperado exige apresentação
explícita ou resposta do cliente a uma pergunta de nome no histórico. O nome de
exibição continua sem servir como nome confirmado. Em conversa já iniciada não
se acrescenta pergunta de nome e as instruções exigem continuar a última dúvida.

## Alternativas consideradas

- Somente ampliar o TTL não recupera o atendimento humano já persistido.
- Usar todas as saídas sem origem/revisão poderia restaurar persona e roteiros antigos.
- Responder entradas arquivadas viola a pausa manual e a barreira de retomada.

## Consequências

Uma consulta adicional por geração depende do PostgreSQL. Falha na leitura não
permite responder sem contexto como se fosse um cliente novo. O histórico fica
limitado em quantidade e tempo, sem promessa de memória ilimitada. Não há nova
migração, alteração de credenciais ou envio real nos testes. A pausa e a prevenção
de repetição de entregas incertas permanecem. Substitui a retenção de histórico
da ADR-0003; complementa ADR-0012 e ADR-0014.
