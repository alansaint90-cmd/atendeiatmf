# ADR-0012: Configuração vigente e transferência humana

Status: aceito. Complementa ADR-0003 e ADR-0011.

O painel já persistia a configuração por instância, mas o histórico curto reenviava
apresentações da persona antiga e não havia prioridade explícita para os campos
atuais. A opção de transferência era apenas uma instrução textual.

As instruções atuais têm prioridade explícita. Cada fala concluída recebe o hash
das instruções; somente falas da IA com a mesma revisão são reenviadas ao modelo.
Falas do cliente e histórico persistido são preservados. A revisão é metadado local,
removido no adaptador OpenAI. Falas legadas da IA sem revisão ficam fora do contexto.

A transferência habilitada expõe uma função sem argumentos, com schema estrito,
na Responses API. O modelo não escolhe destinatário nem texto: o servidor usa os
valores salvos do chatbot. Imagens e documentos habilitados dispensam geração.
A conversa é encaminhada ao departamento em transação com versão e auditoria;
o Redis grava a pausa de 30 minutos e cancela follow-up sob a lease existente.
O aviso cadastrado só é enviado depois dessas operações. Falha interrompe a saída;
o checkpoint de envio evita repetição automática em quedas ou entrega incerta.

Banco e Redis não constituem transação distribuída: falha intermediária pode
exigir intervenção, sem confirmação falsa ao contato. Nenhuma chamada real a
WhatsApp é feita nos testes. O CI cobre a pausa e o isolamento com Redis local.

Correção em 2026-10-07: a descrição da função e as instruções gerais deixam de
encaminhar imediatamente qualquer menção a uma pessoa. O procedimento específico
do prompt/fluxo tem prioridade; o fallback vale somente sem orientação aplicável.
Insistência em falar diretamente com humano continua permitindo encaminhamento.
O aviso salvo permanece literal após transferência efetiva.

Complemento: somente a instrução de prioridade não impedia chamadas indevidas da
função. Antes de executar uma proposta textual, o adaptador realiza uma revisão
sem ferramentas com o mesmo prompt, pedido e histórico. Retorna resposta ou decisão
de encaminhar acompanhada de trecho literal validado das instruções. JSON inválido
ou fundamento inexistente bloqueia a ação, sem aviso falso nem pausa humana.
A revisão considera nomes com variações de grafia e procedimentos anteriores ao
encaminhamento. Não adiciona uma resposta comercial fixa nem altera o prompt salvo.
Somente propostas de transferência têm essa chamada adicional; as duas chamadas
compartilham o mesmo AbortSignal de 45 segundos para preservar a lease do worker.
Transferência direta de mídia, destino, aviso literal e pausa de 30 minutos permanecem.

Pedido posterior do usuário: solicitação direta de falar com Wellington deve
encaminhar e confirmar a espera, sem pergunta intermediária. Regra local aplica-se
para qualquer chatbot configurado, sem exigir menção ao nome nas instruções nem
ativação da opção genérica de transferência humana. Essa exceção para o pedido
direto de Wellington foi determinada pelo usuário; usa o setor cadastrado,
registra o encaminhamento e só então envia o aviso específico. A opção do painel
continua governando os demais pedidos de transferência.
Dispensa geração para esse pedido e usa aviso específico; perguntas informativas
mantêm a revisão. Encaminhamento validado precede o aviso, enviado na mesma execução
mesmo com a pausa criada pela própria ação. Mantém prevenção de entregas duplicadas.

Referência: [Function calling na Responses API](https://developers.openai.com/api/docs/guides/function-calling).
