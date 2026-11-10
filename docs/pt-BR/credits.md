# Créditos e licenças

O Moki é software livre ([MIT](../../LICENSE)) construído sobre outros projetos livres e de código aberto. Esta página agradece a cada um pelo nome, diz o que ele faz no Moki e aponta a licença. Se você mantém algum deles: obrigado. ❤️

> [!TIP]
> Cada pacote abaixo é uma dependência direta no [`package.json`](../../package.json) ou vem dentro de uma (marcado *por meio de …*). O texto completo de cada licença está na pasta do pacote, em `node_modules/`, depois do `npm install`, e no app instalado.

## 🏗️ Frameworks

As bases sobre as quais o Moki é construído.

| Framework | O que ele faz no Moki | Licença |
|---|---|---|
| [Electron](https://www.electronjs.org) | Roda o Moki como app de desktop no Windows, macOS e Linux: as janelas, os menus, as caixas de arquivo e os protocolos locais que levam PDFs, imagens e pré-visualizações de HTML até a tela. | MIT |
| [React](https://react.dev) | Desenha todas as telas: a árvore do projeto, as abas, o painel, as Configurações, as janelas. | MIT |
| [TipTap](https://tiptap.dev) | O editor formatado dos arquivos Markdown e das notas: títulos, listas, tabelas, imagens, links, comentários. | MIT |
| [ProseMirror](https://prosemirror.net) *(por meio do TipTap)* | O motor de edição por baixo do TipTap: o modelo do documento, a seleção e o desfazer. | MIT |
| [Playwright](https://playwright.dev) (Microsoft) | Os testes que abrem o app de verdade e clicam por ele — e que tiram os prints desta wiki. | Apache-2.0 |

## 🧰 Outras ferramentas de código aberto

### Plataforma e linguagem

| Ferramenta | O que ela faz no Moki | Licença |
|---|---|---|
| [Node.js](https://nodejs.org) | Os scripts de linha de comando do Moki (`npm run new-run`, `xlsx`, `docx`, `pdf`…) e o motor dentro do app. | MIT |
| [TypeScript](https://www.typescriptlang.org) | A linguagem em que a maior parte do Moki é escrita, e a checagem de tipos que roda antes de cada commit. | Apache-2.0 |
| [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (`@types/node`, `@types/react`, `@types/react-dom`, `@types/vscode`) | As definições de tipos do Node.js, do React e da API do VS Code usadas na construção. | MIT |

### Documentos

| Ferramenta | O que ela faz no Moki | Licença |
|---|---|---|
| [marked](https://marked.js.org) *(por meio do TipTap)* | Lê o Markdown para o editor poder desenhá-lo. | MIT |
| [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) | Mostra PDFs dentro do Moki com texto selecionável, para destacar, comentar e criar notas a partir de uma página. | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org) | Grava nos PDFs: destaques e comentários que qualquer leitor mostra, respostas, edição de páginas (girar, mover, inserir, apagar) e título e autor — sem precisar do PdfCraft. | MIT |

### Diagramas e desenhos

| Ferramenta | O que ela faz no Moki | Licença |
|---|---|---|
| [Mermaid](https://mermaid.js.org) | Desenha os diagramas escritos como blocos ` ```mermaid ` dentro dos documentos — fluxogramas, sequências, linhas do tempo. | MIT |
| [Excalidraw](https://excalidraw.com) | Os desenhos editáveis no estilo feito à mão (blocos ` ```excalidraw `), abertos no próprio editor dentro do Moki. | MIT |

### Terminais

| Ferramenta | O que ela faz no Moki | Licença |
|---|---|---|
| [xterm.js](https://xtermjs.org) | Desenha os terminais onde rodam o Claude Code, o Codex, o Gemini e as outras ferramentas de IA. | MIT |
| [@xterm/addon-fit](https://github.com/xtermjs/xterm.js) | Mantém cada terminal do tamanho da sua aba. | MIT |
| [node-pty](https://github.com/microsoft/node-pty) (Microsoft) | Dá a esses terminais um processo de shell de verdade no seu computador. | MIT |

### Construção e empacotamento

| Ferramenta | O que ela faz no Moki | Licença |
|---|---|---|
| [Vite](https://vite.dev) | Constrói as telas do app. | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | Permite ao Vite construir as telas em React. | MIT |
| [esbuild](https://esbuild.github.io) | Constrói o processo principal do app e a extensão da IDE. | MIT |
| [electron-builder](https://www.electron.build) | Gera os instaladores (`.exe`, `.dmg`, `.AppImage`, `.deb`, `.rpm`). | MIT |
| [vsce](https://github.com/microsoft/vscode-vsce) (Microsoft) | Empacota a [extensão do VS Code](ide.md). | MIT |

## 🌐 Padrões abertos e ferramentas com que o Moki trabalha

Não estão dentro do Moki, mas o Moki foi feito em torno deles.

| Projeto | Como o Moki usa | Licença |
|---|---|---|
| [Model Context Protocol](https://modelcontextprotocol.io) | O protocolo dos [servidores MCP](../mcp-servers.md) que o Moki dá à IA, e do próprio servidor do Moki para a IDE. | MIT |
| [OpenAI Codex CLI](https://github.com/openai/codex) | Uma das ferramentas de IA que o Moki abre no terminal e usa nos assistentes rápidos e no Hudson. | Apache-2.0 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Uma das ferramentas de IA que o Moki abre no terminal. | Apache-2.0 |
| Agent Skills (`SKILL.md`) | O formato portátil das skills do Moki, lido pelo Claude Code e por outras ferramentas. Veja o [padrão de skill](../skill-standard.md). | — |

## As imagens desta wiki

Os prints são tirados do app de verdade por um teste do Playwright ([`tests/ui/wiki-shots.spec.ts`](../../tests/ui/wiki-shots.spec.ts)), num projeto de exemplo feito para isso. Os diagramas são blocos Mermaid desenhados pelo GitHub.

---

Faltou algum projeto, ou alguma licença está errada? [Abra uma issue](https://github.com/Orsi88/moki/issues) e a gente corrige.
