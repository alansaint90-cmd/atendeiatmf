# ADR-0011: Prompts independentes por número

- Status: Aceito.
- Data: 2026-10-01

O usuário passou a precisar de variantes A/B. Substituímos o compartilhamento de
prompt da ADR-0010 por um chatbot próprio por instância Evolution configurada.
O seletor de Chatbot IA usa o nome da instância; prompt e editor operam nesse vínculo.

Ao abrir a página por Server Action autenticada de gerente ou superior, uma
transação prepara os vínculos: preserva o chatbot principal e copia a configuração
para cada número adicional quando necessário. A operação é idempotente, serializada por lock
transacional e auditada. Não importa dados do navegador nem modifica o prompt
original. Sem chatbot existente não cria conteúdo fictício.

O salvamento valida a instância contra as configurações do servidor e recusa editar
um chatbot pertencente a outro número. A versão protege contra edição concorrente.
Vinculação cria o canal quando ainda não houve evento, evitando perder o vínculo.
O worker consulta e revalida o chatbot da instância de origem, inclusive antes de
enviar. Histórico, pausa manual de 30 minutos e follow-ups continuam separados.

Os testes cobrem cópia inicial, idempotência, persistência independente, tentativa
de alteração cruzada, seletor da interface e processamento dos prompts no Redis.

Extensão de capacidade em 2026-10-06: até três instâncias na mesma Evolution,
com EVOLUTION_THIRD_INSTANCE_NAME opcional e FOLLOW_UP_THIRD_CONFIG independente.
Mantém o vínculo e a persistência existentes, sem migração de schema. Webhook,
respostas, follow-ups e agendamentos selecionam a instância de origem. O terceiro
chatbot recebe cópia inicial do principal, editável sem alterar os demais.

Confirmação de gravação perdida: a tela relê o servidor uma vez e só confirma a
configuração exata enviada, vinculada à instância, com versão posterior do mesmo
registro editado. Não repete mutação automaticamente. Se não houver confirmação,
conserva o rascunho em memória na própria tela;
não armazena nem importa automaticamente prompts do navegador.

Correção em 2026-10-07: a preparação reservava apenas vínculos dos chips atualmente
configurados. Canais anteriores preservados podiam compartilhar o chatbot do chip
atual, levando o salvamento a recusá-lo por pertencer também a outra instância.
A reserva inicial passa a incluir vínculos vivos fora das configurações atuais.
O chip atual recebe cópia exclusiva auditada; o canal antigo e seu chatbot ficam
preservados. A guarda do salvamento continua rejeitando edições cruzadas.

Edições já abertas também resolvem esse compartilhamento ao salvar: validam o
vínculo atual e a versão original, criam uma cópia com a edição recebida e vinculam
somente a instância atual, na mesma transação auditada. A tela recebe o novo ID e
continua editando normalmente. Não exige download, recarga ou nova colagem do texto.
