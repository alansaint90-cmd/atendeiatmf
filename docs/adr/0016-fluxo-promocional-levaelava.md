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
somente o gatilho manual do atendente libera atendimento, conforme ADR-0014.

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
