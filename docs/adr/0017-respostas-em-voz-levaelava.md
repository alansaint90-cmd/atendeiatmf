# ADR-0017: Respostas em voz da Leva e Lava

- Status: publicado e em teste controlado no telefone autorizado; ativação geral não autorizada.
- Data: 2026-11-01.
- Regra confirmada pelo usuário: responder em voz somente quando o cliente mandar áudio.

## Inspeção e escolha

O agente existente gera texto com OpenAI Responses por fetch. A entrada de áudio
usa `gpt-4o-mini-transcribe`. Não havia sintetizador de voz. A fila é serializada
por lease Redis de 120 segundos; o diário registra partes/IDs e conserva entrega
incerta sem retentativa. Chatbots e preferências por instância ficam no JSON do
PostgreSQL, com versão e auditoria. As credenciais já são geridas no servidor.

Consulta pública de leitura ao servidor Evolution existente confirmou `version:
2.3.7`, HTTP 200. O canal Baileys aparece nos logs anteriores; sem usar credenciais
de produção não consultamos os dados privados atuais da instância. Antes de cada
síntese, o adaptador confirma versão e canal atuais por GET. Somente 2.3.7 com
`WHATSAPP-BAILEYS` é homologado pelo contrato implementado. Outro canal/versão ou
falha de consulta usa texto. Não presume que qualquer integração Evolution seja PTT.

A documentação oficial consultada confirma que `gpt-4o-mini-tts`, `tts-1` e
`tts-1-hd` encerram em 6 de janeiro de 2027. Não há integração TTS anterior a
reaproveitar. A opção escolhida é `gpt-realtime-2.1-mini` no Realtime WebSocket,
em uma sessão curta por síntese, sem ferramentas, áudio de entrada ou histórico
comercial. Não é enviada requisição desse modelo a `/v1/audio/speech`.

O narrador recebe somente o texto comercial pronto, com instrução pt-BR e
pronúncia LE-va e LA-va. Apenas formatação/emoji e o símbolo `&` são normalizados
para fala. Não resume nem altera propostas. A transcrição da saída é comparada
por palavras, ignorando pontuação/caixa. Divergência ou resposta incompleta usa
texto. Essa comparação não substitui a homologação auditiva da pronúncia.

## Entrega e limites

O plano conserva balões e envia um aviso explícito de IA somente antes da primeira
voz da conversa. Marca Redis sem expiração por chip/cliente reserva esse aviso antes
da chamada externa e confirma com o ID aceito. Histórico de saída com o aviso
legado também confirma a divulgação. Aviso incerto bloqueia novas narrações e
repetição do aviso; o atendimento continua em texto. Balões
copiáveis ficam em texto; os curtos sem valores/URLs/endereço/procedimento podem
virar voz. Não manda a transcrição inteira junto ao áudio. Avisos de transferência,
follow-ups e agendamentos preservam o envio textual existente.

A geração comercial termina em um tick; o plano e cada saída são processados nos
ticks seguintes. Assim download/transcrição/geração não acumulam com a síntese na
mesma lease. Cada síntese tem no máximo uma tentativa; conexão 8 s, total 25 s,
PCM mono 24 kHz/16 bits até 45 s. FFmpeg/libopus deve estar disponível antes de
qualquer chamada paga. A conversão por pipes tem 10 s, limita saída a 1 MiB e gera
contêiner Ogg real, Opus mono 48 kHz/32 kbps. Não usa shell nem arquivos de conversa.
O Dockerfile instala FFmpeg; `FFMPEG_PATH` permite indicar o binário local.

Na Evolution 2.3.7/Baileys, `POST /message/sendWhatsAppAudio/{instance}` aceita
base64. `encoding:false` evita reconversão, e o código oficial define `ptt:true`
com `audio/ogg; codecs=opus`. Não usa `sendMedia`, URLs públicas ou anexo comum.
Envio tem 20 s. Confirmar exige `key.id`; aceitações são registradas como aceitas,
sem alegar entrega ou reprodução. A atribuição/identificação de ecos reutiliza
o registro de cada parte do agente.

Checkpoints diferenciam síntese pendente/gerando/pronta/texto alternativo e envio
enviando/aceito/recusado/incerto. Queda durante síntese permite usar o texto salvo
sem gerar novamente. HTTP 401/403/404/413/415/422 confirmado permite alternativa
textual em novo tick. Timeout, HTTP 400/5xx, resposta sem ID ou falha após aceitação
nunca autorizam envio automático de texto/áudio novamente. Não há garantia
distribuída de exatamente uma entrega. Cada parte revalida pausa e configuração.
Buffers são zerados no encerramento; o diário nunca contém áudio/base64/chave.

## Custo e esforço

Preços oficiais consultados: Realtime Mini custa US$ 0,60 por milhão de tokens
de texto de entrada, US$ 2,40 por milhão de texto de saída e US$ 20 por milhão de
áudio de saída. Estimativa ilustrativa: 1.000 narrações de 1.000 tokens de áudio
e 500 tokens de texto de entrada cada custariam aproximadamente US$ 20,30,
mais eventuais tokens de texto de saída. Não é uma previsão por duração: depende
do uso real, não inclui geração comercial/transcrição já existentes, hospedagem,
impostos ou câmbio. Não há chamada paga para estimar tokens nesta implementação.

Estimativa de engenharia para esta integração: 2–3 dias de desenvolvimento e
testes, mais 2–4 horas de homologação assistida em ambiente isolado. É estimativa
técnica, não prazo informado pelo provedor. Reaproveitar Speech exigiria depois
uma segunda migração; a implementação direta do adaptador Realtime evita isso.

## Ativação e reversão

Para liberação gradual após a amostra aprovada, o servidor pode definir
`ATENDEIA_VOICE_ALLOWED_NUMBERS` com até 20 telefones E.164 exatos separados por
vírgula. Variável vazia ou inválida bloqueia todas as narrações; ausente preserva
o comportamento normal da habilitação do chatbot. A lista não substitui a flag
global, a homologação, o modo de resposta a áudio ou as pausas. A verificação ocorre
na criação do plano, antes da síntese e antes do envio. Se o telefone sair da lista,
partes ainda não enviadas usam texto sem refazer a geração comercial. Registrar
separadamente as formas de telefone explicitamente fornecidas pela Evolution;
nunca deduzir telefone de LID. Reversão global continua disponível pela flag.

1. Revisar código/testes e aprovar publicação. A entrega local não faz push/deploy.
2. Homologar em ambiente isolado com Evolution 2.3.7/Baileys, uma instância chamada
   `levaelava` e número de teste controlado. Usar credenciais desse ambiente e um
   projeto OpenAI de teste com orçamento. Não usar clientes nem credenciais de produção.
3. Somente após autorização específica para cobrança/envio real, usar o script
   `scripts/homologar-voz.ts` no ambiente isolado, com worker e voz desligados,
   `VOZ_HOMOLOGACAO_ISOLADA=true` e FFmpeg disponível. O script exige as flags
   `--autorizar-sintese-paga --autorizar-envio-teste --numero-teste=TELEFONE_E164`
   e aceita `--voz=marin` (ou a voz escolhida). Executar com
   `pnpm exec tsx --env-file-if-exists=.env scripts/homologar-voz.ts ...`.
   Envia uma única amostra fixa ao número explicitamente indicado, sem retentativa,
   sem habilitar o agente e sem arquivos de mídia. Não executar agora nem informar
   número de cliente. Ouvir “Leva e Lava”, conferir acentuação, clareza e PTT em
   Android/iOS. Então marcar homologação e testar o fluxo completo nesse ambiente:
   áudio recebido, texto recebido, endereço/Maps e preços. Se reprovar, desligar.
4. Após autorização de produção: instalar/reiniciar a versão aprovada, manter a
   chave OpenAI pelo mecanismo existente; definir `ATENDEIA_VOICE_ENABLED=true`.
   No painel: Chatbot IA → `levaelava` → Configurar → Respostas em voz. Escolher
   voz e “Voz ao receber áudio”, registrar homologação, habilitar e salvar com a
   confirmação de três segundos. Mudar a voz desliga e invalida a homologação.
5. Para reverter: desmarcar habilitação e salvar, ou definir a flag como `false`
   e reiniciar. Novas respostas usam texto. Ciclos parcialmente enviados não são
   reiniciados; entregas incertas exigem conferência. Alterar a configuração durante
   uma sequência pode encerrar as partes restantes pelas proteções já existentes.

## Validação e limites de evidência

Em 02/11/2026, após autorização específica, uma amostra avulsa foi aceita pelo
provedor para o telefone de teste do usuário, que confirmou a pronúncia correta.
A versão seguinte foi publicada com backup prévio e lista de telefone restrita,
mantendo os demais clientes em texto. Nenhum número pessoal fica no repositório.

Testes automatizados usam provedores simulados e banco PostgreSQL descartável.
Teste de codec usa um tom sintético local, codifica e decodifica com FFmpeg para
confirmar Ogg/Opus reproduzível. Não prova a pronúncia, nem apresentação PTT em um
aparelho. A amostra real autorizada acima complementa a validação automatizada;
os testes locais continuam sem credenciais de produção ou envios reais.

Saída real da validação final local:

```text
pnpm verificar
  eslint .                          aprovado
  tsc --noEmit                      aprovado
  auditor                           166 arquivos, nenhuma violação
  test:compliance                   51/51 checagens
  testes Node                       178 aprovados, 0 falhas, 12 pulados
  testes Vitest                     54 aprovados em 17 arquivos
  docs:check                        0 referências quebradas, 0 sem cobertura
  código de saída                   0

pnpm build
  Compiled successfully in 9.6s
  Finished TypeScript in 25.9s
  Generating static pages (6/6)
  código de saída                   0
```

Os 12 testes pulados exigem Redis real descartável e `TEST_REDIS_URL`; não foi
usado Redis de produção. Não foi construída a imagem Docker nesta máquina.

## Fontes oficiais consultadas

Validação do aviso único em 02/11/2026:

```text
pnpm verificar: saída 0
  auditor: 166 arquivos sem violações; barreiras: 51/51
  Node: 183 aprovados, 0 falhas, 12 pulados (Redis descartável indisponível)
  Vitest: 54 aprovados em 17 arquivos
  documentação: 0 referências quebradas e 0 lacunas
pnpm build: saída 0; compilação em 10,2 s; seis páginas estáticas
```

Validação da restrição gradual em 02/11/2026: `pnpm verificar` terminou com
código 0 (180 testes Node aprovados, 12 dependentes de Redis descartável pulados,
54 testes Vitest aprovados, auditor 166 arquivos sem violações e 51/51 checagens,
documentação sem divergências). `pnpm build` terminou com código 0, compilação em
29,4 s e seis páginas estáticas. Os testes adicionais comprovam a lista exata,
a recusa de listas inválidas e a revogação antes da síntese sem chamada paga.

- [OpenAI: Text to speech e encerramento](https://developers.openai.com/api/docs/guides/text-to-speech)
- [OpenAI: depreciações](https://developers.openai.com/api/docs/deprecations)
- [OpenAI: Realtime WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets)
- [OpenAI: eventos do cliente](https://developers.openai.com/api/reference/resources/realtime/client-events)
- [OpenAI: eventos do servidor](https://developers.openai.com/api/reference/resources/realtime/server-events)
- [OpenAI: preços](https://developers.openai.com/api/docs/pricing)
- [Evolution 2.3.7: áudio Baileys](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts)
- [Evolution 2.3.7: DTO do áudio](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/dto/sendMessage.dto.ts)
- [Evolution 2.3.7: rota PTT](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/routes/sendMessage.router.ts)
- [Evolution 2.3.7: consulta das instâncias](https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/services/monitor.service.ts)
