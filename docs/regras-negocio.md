# Regras do protótipo

- O contexto geral do orquestrador, salvo em Configurações somente pelo super administrador, fornece informações comuns da operação. O chatbot SDR vinculado à instância Evolution fornece persona, missão, prompt de atendimento, fallback, transferência e fluxos; em conflito, a configuração do chatbot tem prioridade. Alterações do chatbot salvas por gerente ou super administrador valem para as próximas mensagens processadas.
- O aplicativo não fornece catálogo de produtos nem roteiro comercial embutido. Um navegador com dados antigos não importa prompts para o servidor automaticamente; somente um gerente ou super administrador salva instruções explicitamente em Chatbot IA.
- `carregarChatbots` e `salvarChatbot` exigem sessão de gerente ou superior, usam o PostgreSQL compartilhado e vinculam o chatbot salvo à instância Evolution configurada. `sairDoSistema` encerra e audita a sessão atual antes de apagar o cookie.

- Configurações de chatbot são compartilhadas no PostgreSQL com os usuários autorizados; salvar o prompt atualiza também o chatbot vinculado à instância Evolution.
- Identificadores de chatbot são obrigatórios e únicos, sem distinção entre maiúsculas e minúsculas.
- Cada chatbot permite até três personalidades distintas e até 50 fluxos com nome e descrição preenchidos.
- Atraso: inteiro entre 0 e 3600 segundos. Temperatura: entre 0 e 1. Contexto: até 200 mil caracteres.
- Toda leitura e gravação passa pela validação centralizada. Dados inválidos não são substituídos automaticamente.
- Uma gravação é recusada se outro usuário ou aba alterou os dados desde a leitura. A versão é conferida na transação do banco; o usuário deve recarregar antes de tentar novamente.
- O painel exige sessão individual. A página Configurações, a consulta de integrações e o estado do agente são exclusivos do super administrador; o gerente configura o chatbot SDR em Chatbot IA. Respostas por IA dependem da ativação explícita no servidor e nas configurações.

## Credenciais de integrações

- `DATABASE_URL` e `SETTINGS_ENCRYPTION_KEY` (32 bytes em base64) habilitam a persistência. Esses valores são definidos no ambiente, nunca pelo formulário público.
- A sessão individual concede acesso conforme o papel ativo no banco (ADR-0008). Tokens administrativos antigos não autorizam nenhuma operação.
- Drizzle/PostgreSQL cria tabelas próprias com inicialização transacional serializada, sem modificar tabelas existentes. Tabelas possuem auditoria, soft delete e referências RESTRICT. O usuário de banco precisa de permissão para criá-las.
- Credenciais são criptografadas com AES-256-GCM e não são devolvidas ao navegador, registradas em logs nem na auditoria. Auditoria registra somente campos alterados, versão, data e administrador. Faça backup do banco e da chave de criptografia separadamente. Alterar a chave sem migrar os dados impede sua leitura.
- Campos vazios preservam valores existentes; valores salvos prevalecem sobre o ambiente. A versão impede sobrescritas concorrentes. A confirmação de gravação aguarda 3 segundos.
- O webhook lê a configuração persistida quando a chave de criptografia está definida. Falhas no banco ou na descriptografia retornam 503, sem recorrer silenciosamente a credenciais antigas. As credenciais podem vir do ambiente, mas o registro operacional de mensagens exige DATABASE_URL.
- Salvar não testa conexão com provedores. O agente usa as chaves OpenAI/Evolution no servidor, sem devolvê-las ao navegador. Ativar exige contexto, modelo e credenciais completos.

## Estrutura PostgreSQL

- A instalação atual é de uma única empresa. O schema Drizzle em `src/lib/db/schema.ts` define usuários, sessões, departamentos, membros, contatos, etiquetas, vínculos de etiquetas, chatbots, fluxos, canais, conversas, mensagens, campanhas, destinatários e auditoria. Com as extensões de identidade, CRM, agendamentos e recibos de webhook, mais as tabelas de configuração e migrações, são 32 tabelas.
- As migrações SQL versionadas são aplicadas pelo servidor na inicialização, quando existe `DATABASE_URL`, ou pelo comando `pnpm db:migrate`. O banco deve existir (PostgreSQL 16) e o usuário deve poder criar tabelas. Não há conexão nem alteração do banco durante o build.
- O Docker inclui os arquivos de migração. A aplicação usa uma transação e trava PostgreSQL para serializar deploys; checksum impede editar uma migração já aplicada. Novas mudanças exigem novas migrações (`pnpm db:generate`). Não executar `drizzle-kit push` sobre produção.
- O bootstrap preserva as tabelas e os valores de credenciais das versões anteriores. As migrações não importam os exemplos da interface ou prompts salvos no navegador.
- Dados iniciais: quatro departamentos e um ator de sistema desabilitado, sem email ou senha. Não há conta com senha padrão nem autenticação de usuários habilitada por essa migração. Configurações preservam o ator técnico legado e registram também o usuário humano na auditoria.
- Todas as tabelas possuem criação/alteração/exclusão lógica e rastreio de autor com FK RESTRICT. As tabelas operacionais têm `version` para futuras atualizações otimistas. Repositórios devem filtrar `is_deleted=false`, comparar versão, incrementar versão e registrar campos alterados na auditoria, sem armazenar segredos no log.
- Contatos usam telefone normalizado E.164; emails de usuários e nomes de chatbots/etiquetas/departamentos são únicos entre registros ativos, sem distinção de maiúsculas. Conversas permitem apenas um atendimento aberto/pendente por canal e JID. Identidade externa de mensagens é única dentro da conversa, mesmo após exclusão lógica.
- Sessões guardam apenas hash de token; senhas devem ser hashes, nunca texto simples. A tabela de auditoria guarda nomes de campos alterados, sem cópias dos conteúdos das mensagens ou das credenciais.
- Planos e campanhas ainda não possuem operação integrada. Equipe gerencia usuários reais. Dashboard, contatos e caixa de entrada consultam as tabelas operacionais mediante sessão de SDR ou superior (ADR-0008). Criar tabelas não ativa envio de campanhas ou respostas de IA.
- Testes executam migrações e restrições em PostgreSQL isolado via PGlite (WASM). A implantação deve validar também conexão, permissões e persistência no PostgreSQL 16 real do EasyPanel.

## Recepção de eventos Evolution

- `POST /api/webhooks/evolution` autentica o serviço pelo header `x-webhook-secret`, comparado com `EVOLUTION_WEBHOOK_SECRET` (mínimo de 32 caracteres).
- O super administrador pode usar `POST /api/settings/evolution-webhook` para sincronizar o webhook da instância configurada com a Evolution: a aplicação mantém os eventos existentes, inclui os três eventos aceitos, define a URL do `AUTH_ORIGIN`, desliga By Events/Base64 e envia `x-webhook-secret` como cabeçalho personalizado. A operação só confirma sucesso após consultar novamente a Evolution e verificar URL, eventos e cabeçalho; nunca exibe a chave.
- Aceita apenas a instância definida em `EVOLUTION_INSTANCE_NAME` e os eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e `CONNECTION_UPDATE`.
- Exige JSON, com no máximo 1 MiB; rejeita envelopes inválidos e remove campos extras do envelope, incluindo a chave de API da Evolution.
- Retorna 202 apenas após gravação no stream Redis `atendeia:{evolution}:events`. Cada registro contém data de recebimento e origem. Redis indisponível ou fila cheia resultam em 503, sem alegar recebimento.
- Eventos idênticos são deduplicados por 24 horas; transições de conexão/status sem timestamp não são deduplicadas para não perder ocorrências legítimas.
- O stream comporta até 1000 eventos. O consumidor arquiva o resultado antes de confirmar e remover cada evento da fila, atomicamente. Após atingir a capacidade, novas entregas recebem 503.
- Usar Redis dedicado com volume persistente, AOF e política `noeviction` para evitar perda por reinício ou pressão de memória. A aplicação confirma a gravação no Redis, não a sincronização em disco.
- O endpoint não fornece mensagens a usuários sem autenticação. O GET público só identifica a rota; não testa credenciais nem a conexão Redis. O painel operacional exige sessão de SDR ou superior para consultar o histórico persistido desses eventos.

## Agente de respostas de texto

- O processador inicia com `ATENDEIA_WORKER_ENABLED=true` no processo Next.js persistente (EasyPanel), fora do build. A configuração administrativa `AI_ENABLED=true` também é obrigatória; padrão desativado.
- O campo `AI_SYSTEM_PROMPT` é o contexto usado no servidor. Em Configurações, carregar com token, copiar um chatbot local ou escrever o contexto, selecionar o modelo OpenAI disponível na conta, ativar e confirmar o salvamento. A confirmação bloqueia por três segundos.
- Copiar um chatbot importa persona, estilo, missão, contexto e fallback. Não importa automações, temperatura, atraso ou transferência humana: essas funções ainda não são executadas pelo processador. Edições locais posteriores precisam ser copiadas e salvas novamente.
- Somente `messages.upsert` individual com texto ou áudio, `fromMe=false`, ID, telefone e timestamp é respondido. Grupos, mensagens próprias, outras mídias, lotes e eventos de status não geram resposta. LID requer telefone alternativo válido. Mensagens com mais de cinco minutos ou timestamp mais de um minuto no futuro são arquivadas como ignoradas, evitando responder histórico antigo.
- Áudio é obtido pelo ID na instância Evolution configurada e transcrito pela OpenAI com `gpt-4o-mini-transcribe`, usando a chave já cadastrada. Aceita até 10 MiB e transcrição de até 12 mil caracteres; responde por texto com o contexto habitual. Mantenha Webhook Base64 desligado para respeitar o limite de 1 MiB do webhook. A Evolution precisa conservar a mensagem para consulta por ID.
- Download e transcrição têm limites de 15 e 25 segundos, sem seguir redirects. Não acessamos URLs do evento nem salvamos o binário em disco. A transcrição fica no diário Redis para retomada e no histórico após envio, com as retenções existentes. Falhas recebem códigos seguros (`evolution_audio_http_*`, `openai_audio_http_*`, `audio_*`) e até três tentativas; nunca enviam mensagem de erro ao contato.
- OpenAI Responses recebe contexto separado da mensagem e até 12 turnos de histórico, com `store=false`, limite de saída de 1000 tokens e timeout de 45 segundos. Resposta incompleta/vazia não é enviada.
- Evolution recebe telefone e texto em `POST /message/sendText/{instance}`, com timeout de 20 segundos. Nunca usa URL ou credencial enviada no evento. Não segue redirects com credenciais.
- Uma lease Redis global de dois minutos serializa os eventos. O consumidor fixo recupera pendentes após reinício. Toda mudança de estado e confirmação da fila verifica a posse da lease.
- O diário usa instância + ID de mensagem, com retenção de 30 dias. Geração pode ser tentada até três vezes. Envio é marcado antes da chamada externa: timeout, erro de confirmação ou queda deixa estado incerto, sem repetição automática. Não há garantia de exatamente uma entrega entre dois serviços independentes; casos incertos exigem conferência manual na Evolution.
- Histórico das últimas 12 falas expira após 24 horas sem conversa. O arquivo Redis conserva os últimos 10 mil resultados e textos elegíveis, sem anexos, chaves ou envelope bruto. A fila só libera espaço após arquivar. Use Redis dedicado com AOF, volume e `noeviction`; perda de Redis perde o diário e o histórico.
- `GET /api/settings/agent` exige sessão de super administrador e mostra habilitação, fila, sinal do processador e último código seguro. A tela `AgentSettings` permite consultar sem expor conteúdo de conversas ou credenciais. Códigos `openai_http_401`, `openai_http_429` e `evolution_http_401`, por exemplo, identificam o provedor a revisar.
- A caixa de entrada consulta os eventos registrados no PostgreSQL; áudios aparecem como marcador de mídia. O histórico de contexto e o estado de entrega do processador continuam no Redis. Não há envio de campanhas, respostas em áudio, execução de fluxos ou transferência para equipe nesta etapa.

## Follow-ups automáticos e tags

- As páginas Follow-ups automáticos e Tags e rótulos exigem sessão individual de gerente ou superior (ADR-0008). Dados são salvos no servidor, não no armazenamento local.
- Tags têm nome único entre registros ativos, cor hexadecimal e busca/paginação. Edição e exclusão lógica conferem versão. Mutação e auditoria são atômicas; excluir preserva contatos e vínculos históricos.
- Follow-ups são desligados por padrão e atuam no chip Evolution configurado, após uma resposta de IA confirmada. Cada ciclo admite até três textos de até 3.000 caracteres, intervalos de um minuto a 30 dias, dias da semana, janela de horário e fuso.
- Cada etapa conta o intervalo a partir da resposta anterior. Fora da janela, aguarda o próximo horário permitido. Mensagem individual nova do contato ou do operador cancela a sequência, inclusive mídia. Ecos do próprio agente não cancelam.
- Qualquer salvamento invalida sequências da configuração anterior. Reativar não recupera sequências antigas. Entrega incerta encerra o ciclo sem retentativa automática. A ativação requer confirmação de três segundos e depende do processador ativo.
- Os cadastros não implementam associação de tags a contatos, nem transferência humana. A fila de eventos tem prioridade sobre follow-ups; cancelar depende do recebimento do webhook e não interrompe um envio externo já iniciado.

## Agendamentos individuais

- A página Mensagens agendadas apresenta data/hora, telefone, chip, texto, status e ações, com busca, filtro de status e dez itens por página.
- Novos agendamentos exigem sessão de gerente ou superior, telefone E.164, chip igual à instância configurada, texto até 6.000 caracteres e horário de um minuto a um ano no futuro. Horários são exibidos no fuso do navegador e persistidos em UTC.
- Salvar e cancelar exigem confirmação de três segundos. Somente pendentes podem ser editados ou cancelados; a versão impede sobrescrita de outra sessão e alterações após início do envio. Cancelamento conserva histórico.
- O worker habilitado executa os textos pela Evolution mesmo se a IA estiver desligada. Indisponibilidade pode atrasar envios, que permanecem pendentes. A tela informa quando o worker está desativado.
- O banco reserva antes de enviar e registra aceitação da Evolution. Queda, timeout ou confirmação incerta não causam reenvio automático. Reservas interrompidas são marcadas incertas após cinco minutos. Consulte a Evolution antes de criar novo envio nesses casos.
- O status Enviado não comprova leitura ou entrega ao destinatário. Use Carregar dados para atualizar a lista. Credenciais nunca são recebidas do formulário de agendamento.

## CRM e identidade individual (ADR-0006, em validação)

- CRM usa dados reais em `/crm` e sessão individual; o token administrativo legado não identifica pessoas.
- Papéis e atividade são relidos no banco. Atendentes e visualizadores consultam apenas funis concedidos; administradores e proprietários acessam todos.
- O mesmo escopo restringe Kanban, criação, movimentação, fechamento e agregações financeiras. Valores monetários permanecem strings decimais/numeric.
- Ganho/perda só encerra oportunidade aberta, com trava de atualização. Perda exige motivo ativo. Histórico conserva valor, funil, etapa anterior, responsável, autor e motivo textual mesmo após exclusão lógica do motivo.
- Conversão é ganhas / (ganhas + perdidas), zero quando não há encerradas. Receita considera somente ganhas. Filtros de data têm início inclusivo e fim exclusivo; atalhos da interface usam fuso do navegador.
- Filtros são mantidos por usuário em sessionStorage sem credenciais. Listagem de oportunidades usa páginas de 50; agregações consideram todo o resultado filtrado.
- Passkeys exigem verificação do usuário, origem/RP configurados, convite e desafio de uso único. Sessões são opacas, HttpOnly, armazenadas por hash e expiram em 24 horas ou uma hora de inatividade.
- `AUTH_LOGIN_ENABLED` permanece false até concluir a homologação da identidade. A gestão de usuários, senhas e fatores está implementada (ADR-0008); validar em homologação antes de ativar em produção.
- Provisionamento inicial é manual no servidor e não roda nas migrações. O script `scripts/provisionar-proprietario.ts` exige PROVISIONAR_NOME, PROVISIONAR_EMAIL e PROVISIONAR_ARQUIVO (arquivo privado fora do repositório), DATABASE_URL e AUTH_ORIGIN. Convite expira em 15 minutos; nenhuma senha padrão é criada. Não executar com credenciais de produção durante testes.


## Painel e contatos reais (ADR-0007)

- Não são inseridos nem exibidos números, contatos, conversas ou membros de equipe fictícios. Registros reais existentes são preservados; não há limpeza física do banco.
- O webhook autenticado registra mensagens individuais, contatos e canais antes da fila Redis. Falha de banco ou fila retorna 503 para permitir retentativa. Recibo único por instância/ID impede recontar mensagens, mesmo após encerrar a conversa.
- O histórico recebe texto, legenda ou marcador de mídia, sem guardar binários, URLs privadas ou segredos do envelope. Mensagens enviadas dependem do eco messages.upsert/fromMe da Evolution; não é realizada importação automática dos eventos antigos do Redis.
- Conversas abertas contam status diferente de closed; pendentes são as não encerradas marcadas pending ou cuja última mensagem é recebida.
- O dashboard mostra conversas atendidas por IA somente quando o ID do envio confirmado pelo agente corresponde ao eco da Evolution. O cartão de atendimento humano conta mensagens de autoria `agent` comprovada no histórico. Envios genéricos `system` não são atribuídos automaticamente a uma pessoa; uma conversa pode ter ambos os tipos de atendimento.
- O filtro do dashboard escolhe canal e período (hoje, 7 dias, 30 dias, 3 meses ou intervalo personalizado até 366 dias), usando o fuso do navegador e início inclusivo/fim exclusivo. Os cartões superiores mostram o total geral; os indicadores inferiores e o gráfico mostram novas conversas e conversas atendidas por dia no período escolhido. Últimos contatos mostra atividade no período. Exclusão lógica é respeitada em todas as contagens.
- A action `carregarPainel` consulta um snapshot autorizado. Ausência de acesso ou falha de consulta exibe mensagem, nunca métricas zeradas enganosas. Listas vazias só aparecem após consulta autorizada bem-sucedida.

## Senhas e equipe (ADR-0008)

- Super administrador gerencia integrações, gerentes e SDRs. Gerente gerencia operação e SDRs. SDR usa atendimento e CRM conforme escopo.
- Senhas têm 15 a 256 caracteres e hash Argon2id com salt próprio. O login principal usa e-mail e senha; passkey verificada permanece disponível como fator adicional e para contas que já a cadastraram.
- Primeiro acesso é por convite de uso único de 15 minutos. Ninguém escolhe a senha de outra pessoa.
- Trocas de senha/fator e alterações de conta encerram sessões. Reiniciar acesso invalida fatores e emite novo convite. Proprietários não são alterados pela API comum.
- Cada usuário autenticado pode editar apenas o próprio nome, celular e foto. O e-mail de acesso e o papel não são alterados nessa tela. A foto aceita JPG/PNG de até 2 MiB; fica no cadastro protegido. A gravação usa versão para evitar sobrescrever outra sessão e registra os campos alterados na auditoria sem armazenar a imagem na trilha.
