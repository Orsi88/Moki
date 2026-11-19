# Terminais de IA

O Claude Code, o Codex, o Gemini CLI, o Antigravity CLI e o Cursor Agent rodam em **abas de terminal dentro do Moki**, na pasta do projeto. Você conversa com eles como sempre; o Moki entrega o projeto a eles e mantém o trabalho de cada um junto.

## Abrindo um

- O **+** no fim das abas abre o menu **Novo**: **Terminal** (o seu shell), **IA** (cada ferramenta de IA instalada), **Arquivo** (um arquivo novo e vazio na entrada) e **Apps ArtCraft** (veja [Apps ArtCraft](artcraft.md)).
- Ou clique em **Chamar…** e escolha **Num terminal novo** — o pedido já vai pronto. Veja [Chamar atividades, agentes e skills](call.md).

Uma IA aberta em **Novo › IA** começa com os padrões do projeto (definidos nas configurações do projeto): o papel do agente padrão, as skills padrão e as suas instruções. A aba diz isso — *Claude Code · failure-analyst*. **Sem o padrão do projeto** abre uma IA sem nada disso.

Um terminal **continua rodando** quando você volta para a tela inicial ou vai para outro projeto; abrir o projeto de novo traz a aba de volta. Fechar a aba encerra o terminal.

## Dando imagens e arquivos para a IA

- 📋 **Cole um print** (Ctrl+V): ele é salvo em `temporary/pasted/` do projeto e o caminho é digitado no prompt, para a IA ler a imagem. Colar texto continua colando texto.
- 🖱️ **Arraste arquivos para o terminal** — do computador ou da árvore do projeto: os caminhos completos são digitados no prompt (entre aspas quando têm espaço). Nada é copiado para a entrada.
- 📎 O **Chamar…** com **Neste terminal** cola um pedido pronto onde está o cursor, sem enviar — acrescente o que quiser e aperte Enter.
- 📄 **Usar no terminal** — botão direito num arquivo do **Contexto** ou de **Notas** (ou o botão da nota aberta): a IA é orientada a ler o arquivo e usá-lo como contexto para o que você pedir em seguida. Vai para o terminal de IA em foco, ou abre um novo; um arquivo com cara de credencial é recusado.
- 🧩 No cartão **Skills e agentes** do painel do projeto, o ▶ pede para a IA usar aquela skill ou agente, do mesmo jeito.

## Acompanhando o que a IA faz

- Um **caminho de arquivo** que a IA escreve vira link: **Ctrl+clique** abre no Moki.
- Cada terminal de IA é o seu próprio **grupo de abas**: os arquivos que ele entrega abrem no grupo dele, com uma bolinha até você olhar, sem tomar a tela.
- A barra de status mostra quanto dos seus **planos de IA** você já usou.

## As ferramentas de IA

| Ferramenta | Abre como |
|---|---|
| Claude Code, Codex, Gemini CLI, Antigravity CLI, Cursor Agent | Uma aba de terminal no Moki |
| Cursor, VS Code | O editor, na pasta do projeto, com o pedido copiado — veja [Moki na IDE](ide.md) |
| Um chat da web (ChatGPT, claude.ai, Gemini) | O pedido pronto para copiar, com os arquivos listados |

A sua **IA padrão** fica em **Configurações › Minhas IAs**, que também instala uma IA de terminal que falte: uma aba de terminal mostra o comando oficial e só roda depois que você digita `y`. Codex e Gemini CLI se instalam com npm: sem o Node.js, a aba oferece instalá-lo primeiro (winget no Windows, Homebrew onde ele está instalado), com o próprio `y`; nos outros casos mostra nodejs.org. O Moki nunca usa sudo; `npm install -g` com o Node do sistema no Linux pode exigir permissões.

## Chat do projeto

Use o ícone **Chat** na barra ou **Ctrl+L** (Cmd+L no macOS). Com o foco num terminal, o Ctrl+L continua sendo do terminal (limpar a tela). Existe uma única aba de chat por projeto. Abrir de novo leva à mesma aba; você pode movê-la entre as divisões da tela, como o terminal.

O chat usa o Claude Code instalado, com as instruções, skills, plugins e MCPs do projeto: o mesmo acesso de um terminal do Claude. A resposta aparece conforme chega; as ferramentas usadas ficam recolhidas e o botão **Parar** interrompe a resposta. Nova conversa e histórico ficam na mesma aba. As conversas são salvas na pasta oculta `.chats/` do projeto, fora da árvore e da busca de documentos. Fechar a aba esconde a conversa; uma resposta em andamento continua até terminar, ser interrompida ou o Moki sair. A mensagem seguinte retoma a sessão da IA; se ela não existir mais, o histórico salvo dá contexto à nova sessão.

Quando a resposta indica um artefato do Claude (apresentação, planilha ou página no claude.ai), o link abre num visualizador dentro da aba do chat, com **Voltar à conversa** e **Abrir no navegador**. Entre uma vez na sua conta do claude.ai no visualizador para ver artefatos privados; se o login for bloqueado ali, use **Abrir no navegador**. O visualizador é uma área isolada, sem acesso ao Moki nem aos arquivos do projeto, e os outros links continuam abrindo no navegador.

O **Chamar… › No chat**, disponível com o Claude Code instalado, envia o pedido validado na hora, numa conversa nova da aba de chat (como um terminal novo); o rascunho que você estava escrevendo continua na caixa de mensagem.

## Veja também

- [Chamar atividades, agentes e skills](call.md)
- [Problemas comuns](troubleshooting.md)
