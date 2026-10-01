# ADR-0011: Prompts independentes por número

- Status: Aceito.
- Data: 2026-10-01

O usuário passou a precisar de variantes A/B. Substituímos o compartilhamento de
prompt da ADR-0010 por um chatbot próprio por instância Evolution configurada.
O seletor de Chatbot IA usa o nome da instância; prompt e editor operam nesse vínculo.

Ao abrir a página por Server Action autenticada de gerente ou superior, uma
transação prepara os vínculos: preserva o chatbot principal e copia a configuração
para o segundo quando necessário. A operação é idempotente, serializada por lock
transacional e auditada. Não importa dados do navegador nem modifica o prompt
original. Sem chatbot existente não cria conteúdo fictício.

O salvamento valida a instância contra as configurações do servidor e recusa editar
um chatbot pertencente a outro número. A versão protege contra edição concorrente.
Vinculação cria o canal quando ainda não houve evento, evitando perder o vínculo.
O worker consulta e revalida o chatbot da instância de origem, inclusive antes de
enviar. Histórico, pausa manual de 30 minutos e follow-ups continuam separados.

Os testes cobrem cópia inicial, idempotência, persistência independente, tentativa
de alteração cruzada, seletor da interface e processamento dos dois prompts no Redis.
