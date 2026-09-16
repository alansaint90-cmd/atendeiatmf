# AtendeIA TMF

Protótipo de atendimento para WhatsApp com painel, conversas, configuração de chatbots, contatos, campanhas e equipe.

## Rodar localmente

Com Python 3 instalado, execute na pasta do projeto:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Abra http://127.0.0.1:8000 e clique em **Entrar no MVP**. O login é demonstrativo.

## Chatbot IA

O campo **Contexto geral** contém o prompt de atendimento da TMF e permite editar e salvar o conteúdo no navegador. O botão **Configurar** abre as opções de persona, conhecimento, transferência, fluxos e temperatura.

## Integrações

Este projeto é um front-end demonstrativo, sem backend ou autenticação real. Os dados de atendimento são simulados. As configurações de chatbot são armazenadas no localStorage deste navegador.

O campo da chave OpenAI em **Configurações** mantém o valor apenas em memória até atualizar ou fechar a página. Não há chamadas à API da OpenAI nem conexão real com WhatsApp. Uma integração de produção deve guardar os segredos no servidor, fora do código-fonte.

## Arquivos

- `index.html`: entrada da aplicação.
- `src/app.js`: telas e navegação.
- `src/chatbot.js`: configuração e edição dos chatbots.
- `src/agent-context.js`: prompt inicial de atendimento.
- `src/styles.css`: estilos e layout responsivo.
