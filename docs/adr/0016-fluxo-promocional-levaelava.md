# ADR-0016: Fluxo promocional da levaelava

- Status: aceito em 2026-10-12.
- Decisão solicitada pelo usuário: promoção de R$ 13,90, das 00h às 06h;
  endereço e Google Maps do prompt já cadastrado.

O cadastro existente de Fluxos inteligentes já compõe as instruções do chatbot.
A migração de dados 0011 acrescenta somente nesse cadastro o fluxo de recepção
da promoção da madrugada. Não altera schema, prompt principal, persona ou abertura.
Não há catálogo comercial no worker nem nova IA para selecionar o fluxo: a
intenção e os procedimentos são instruções salvas e editáveis pelo gerente.

Revisão em 2026-10-12: a descrição sozinha deixava o reconhecimento do gatilho
ao modelo. Cada fluxo passa a aceitar frases explícitas opcionais no cadastro.
O processador compara a mensagem atual (ou transcrição) às frases do chatbot
da instância e acrescenta o procedimento correspondente ao fim das instruções,
com prioridade para esse pedido. Normaliza caixa, acentos, pontuação e R$ opcional,
preservando o valor. Não busca substrings, não aceita negação adicionada à frase
e não mantém fluxo ativo na próxima pergunta. Fluxos sem frases continuam sendo
orientações semânticas. Não há recepção comercial codificada no processador.

A migração 0012 preenche as frases do fluxo legado sem substituir descrição editada
ou lista de frases já configurada. Se o cadastro não existia ao executar 0011,
acrescenta o fluxo ao vínculo atual, com a mesma separação, versão e auditoria.
O estado de entrega registra o nome do fluxo; o diagnóstico informa instância e
bloqueios sem expor conteúdo ou credenciais. Reconhecimento nunca contorna pausa:
o gatilho manual libera atendimento humano; o botão de retomada libera somente a pausa da instância, conforme ADR-0014.

As instruções de nome não condicionam a explicação do pedido ao nome do cliente;
ele continua sendo perguntado uma única vez no primeiro contato. As instruções
gerais delimitam o fluxo ao pedido correspondente e retomam o
prompt principal nas próximas perguntas. O fluxo exige localização já cadastrada,
sem inventar link ou endereço, e não confirma benefícios ou validade ausentes.
O valor confirmado pelo usuário prevalece sobre os R$ 13,99 do anúncio anexado.

A migração usa a mesma trava de chatbots por instância, bloqueio de registros,
versões e auditoria na transação. Se o chatbot estiver compartilhado, cria cópia
exclusiva e altera somente o vínculo de levaelava. Preserva canais antigos e outros
chatbots. Nome de fluxo existente impede duplicação e preserva edições anteriores.
Cadastro inválido ou limite de 50 fluxos interrompe a migração sem alteração parcial.

Testes usam PostgreSQL isolado via PGlite e provedores simulados. Nenhum envio real,
mudança de credencial ou deploy de produção é realizado nesta implementação.

## Campanha paga da Clara — 2026-10-13

A migração aditiva 0014 cadastra um fluxo distinto com quatro mensagens literais
em `sequencia`, restrito a levaelava. Gatilho é a frase completa do anúncio,
normalizada pelo comparador existente. Nenhum campo anterior é substituído.
Sequências literais ficam fora das instruções do modelo, para não contaminar
saudações, perguntas genéricas ou o fluxo orgânico da promoção.

O processador genérico resolve `{{GOOGLE_MAPS}}` somente a partir de uma URL Google
Maps já presente no prompt principal. Ausência ou múltiplas URLs diferentes deixam
o evento com diagnóstico de configuração pendente, sem iniciar a sequência.
Os textos comerciais ficam no cadastro, não no worker. Os quatro balões usam os
checkpoints de ADR-0013, registrando cada saída e respeitando a pausa.

Antes do primeiro envio, reserva atomicamente a chave instância/cliente/fluxo no
Redis, sob a lease existente. Não expira: a campanha não se repete por corte do
histórico, atualização do prompt ou expiração do diário. Eventos posteriores do
mesmo gatilho não reiniciam a apresentação. Queda entre reserva e checkpoint pode
suprimir o envio, preferindo conferência manual a duplicação. Redis persistente,
AOF e noeviction continuam obrigatórios; perda desse armazenamento perde a reserva.
Uma nova mensagem comum segue o atendimento original. Não modifica o gatilho de
retorno nem libera atendimento humano. Testes validam separadamente os dois fluxos.

## Divisão da promoção original — 2026-10-14

O fluxo original “Promoção da madrugada — R$ 13,90” passa a gerar três campos
validados: acolhimento com promoção, endereço e CTA. O servidor acrescenta o Maps
do prompt ao endereço e entrega cada campo como um balão usando os checkpoints
existentes. Não separa por parágrafo, pois endereço e link devem ficar juntos.
Resposta fora do formato é falha de geração, nunca texto bruto para o WhatsApp.
Não há migração nem alteração do cadastro; a regra é restrita a esse fluxo em
levaelava. A campanha distinta de quatro balões permanece inalterada.
