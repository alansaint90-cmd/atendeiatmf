# Regras do protótipo

- Configurações de chatbot pertencem ao navegador e à origem onde foram salvas; não são compartilhadas com outros usuários.
- Identificadores de chatbot são obrigatórios e únicos, sem distinção entre maiúsculas e minúsculas.
- Cada chatbot permite até três personalidades distintas e até 50 fluxos com nome e descrição preenchidos.
- Atraso: inteiro entre 0 e 3600 segundos. Temperatura: entre 0 e 1. Contexto: até 200 mil caracteres.
- Toda leitura e gravação passa pela validação centralizada. Dados inválidos não são substituídos automaticamente.
- Uma gravação é recusada se outra aba alterou os dados desde a leitura. O usuário deve recarregar antes de tentar novamente. Essa checagem local não substitui transações no futuro backend.
- A chave OpenAI permanece apenas na memória da página. Nunca é gravada no navegador nem enviada a serviços externos pelo protótipo.
- O acesso demonstrativo não representa autenticação ou RBAC. Não há banco de dados nem atendimento real por IA/WhatsApp.
