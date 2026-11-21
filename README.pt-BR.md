# Moki

🇺🇸 [Read in English](README.md)

<p align="center"><img src="app/public/hero.png" alt="Moki" width="280" /></p>

<p align="center">
  <a href="https://github.com/Orsi88/Moki/releases/download/v0.7.4/Moki.Setup.0.7.4.exe"><b>⬇️ Baixar o Moki para Windows</b></a>
  &nbsp;·&nbsp; <a href="https://github.com/Orsi88/Moki/releases">releases</a>
  &nbsp;·&nbsp; <a href="https://github.com/Orsi88/moki/wiki">documentação</a>
</p>

O Moki é um espaço de trabalho local para trabalhar com IA. Ele transforma uma pasta em um projeto vivo, com contexto, arquivos, notas, atividades reutilizáveis, skills, agentes, ferramentas externas e o registro do que foi entregue.

Você escolhe o trabalho e a ferramenta de IA. O Moki prepara o pedido, mantém o projeto organizado e permite continuar depois — até em outra ferramenta. Não há conta do Moki, servidor do Moki nem dependência de uma plataforma.

Ele trabalha com a IA que você já usa: Claude Code, Codex, Gemini, Cursor, Antigravity, Copilot Chat ou um chat da web.

## O que o Moki oferece

### Projetos e contexto

- Organize vários projetos dentro de workspaces independentes.
- Mantenha juntos o contexto confirmado, os arquivos da entrada, as notas, os temporários e os resultados entregues.
- Vincule uma pasta existente sem copiá-la.
- Use tags para compartilhar contexto selecionado entre projetos, mantendo o isolamento.
- Retome o trabalho a partir dos arquivos e do estado registrados em cada execução.
- Mescle um projeto em outro quando os dois forem um só: nada é sobrescrito, e títulos de notas, links, comentários e tags acompanham.
- Mova arquivos e pastas na árvore arrastando, ou use Ctrl+clique para mover ou excluir vários de uma vez; um arquivo entregue pode sair de Entregas depois que a atividade dele terminou.
- Abra uma pasta com mais de 20 arquivos como visão de pasta: lista com nome, data, tipo e tamanho, ou grade de miniaturas, com busca; pastas com dezenas de milhares de arquivos abrem na hora.
- Veja imagens e vídeos em tamanho grande sem abrir uma aba, passando pela pasta com as setas; os vídeos tocam ali, e uma imagem pode ser copiada para colar numa nota ou documento.

### Notas e assistentes rápidos

As notas são um lugar próprio para pensar, planejar e reunir material antes que ele vire uma entrega.

- Crie notas avulsas ou notas dentro de um projeto; elas salvam sozinhas.
- Escreva Markdown formatado, use comandos `/`, cite arquivos do projeto com `@` e cole imagens.
- Abra notas numa janela própria de bloco de notas, marque favoritas e compartilhe notas de projeto por tags.
- Mova uma nota de projeto para outro projeto, com título, tags e estrela.
- Envie uma nota para um terminal de IA como contexto, exporte como PDF, Markdown ou texto, ou crie uma nota a partir de um trecho selecionado num PDF.
- Use assistentes de um clique para melhorar a escrita, resumir, pesquisar ou revisar criticamente uma nota.
- Revise a sugestão antes de aceitá-la: nada muda até você aprovar.

Veja [Notas e assistentes rápidos](https://github.com/Orsi88/moki/wiki/Notas-e-assistentes-rápidos).

### Trabalho com IA, atividades e operações

O Moki transforma instruções reutilizáveis em trabalhos que você pode iniciar pelo app, por um terminal ou pela IDE:

- **Atividades** são pedidos prontos com seus arquivos, contexto e instruções.
- **Skills** são procedimentos com regras, entregas e pontos de aprovação.
- **Agentes** são papéis que combinam instruções e skills.
- **Operações** encadeiam vários agentes, cada um no próprio terminal, passando o trabalho para a próxima etapa.
- **Execuções** registram o que aconteceu, onde o trabalho parou e quais arquivos foram entregues.
- **Mycroft** transforma o que você ensina ("da próxima vez, faça assim") em versões novas de agentes, skills e atividades que você aprova, com histórico e o original sempre a um clique.
- Etapas importantes esperam sua aprovação em vez de alterar o projeto ou publicar algo silenciosamente.

Você pode usar os fluxos que já vêm com o Moki ou criar suas próprias atividades, skills e agentes.

### Chat do projeto

Abra o **Chat** do projeto pelo ícone na barra ou por **Ctrl+L**. Cada conversa tem sua própria aba, com Claude Code ou Codex (ChatGPT), histórico com busca e acesso aos arquivos, às skills e aos MCPs do projeto. **Chamar… › No chat** inicia o pedido em uma conversa nova; **Só chamar** abre a IA com o contexto do projeto, sem atividade.

As respostas permitem seções organizadas, cartões, diagramas, gráficos, escolhas e aprovações clicáveis. Imagens geradas aparecem junto do trecho relacionado e ficam com a conversa até você salvar uma em Entregas com um clique; arquivos e artefatos do Claude abrem a partir da conversa. Anexe material por colar, arrastar ou `@`. Escolha o modelo no topo de cada conversa e gerencie várias contas de IA em **Configurações › Minhas IAs**. Veja [Terminais de IA e chat do projeto](docs/pt-BR/ai-terminals.md).

### Documentos, PDFs e diagramas

O Moki também é um espaço para ler, editar e revisar o material com que a IA trabalha:

- Abra e edite Markdown e texto, visualize HTML e trabalhe com Word, Excel, PDF e imagens.
- Leia PDFs, selecione trechos, crie notas, faça comentários e edições de página com o PdfCraft.
- Comente Markdown, HTML, Word, Excel, PDFs e diagramas, com comentários presos ao trecho ou à região relevante.
- Abra, examine, amplie, mova, exporte e comente diagramas Mermaid, PlantUML, D2 e Graphviz.
- Crie e edite desenhos e diagramas Excalidraw dentro de documentos e notas.
- Leia arquivos de código com as cores do seu editor, comente linhas, prenda notas a elas e abra o arquivo na sua IDE com um clique.
- Marque trechos, blocos ou áreas com os seus próprios marcadores (um ícone, um nome e o que ele significa) pelo botão direito — em Markdown, código, PDFs e páginas HTML. A IA lê o que cada marcador significa.

### Rotinas, notificações e integrações

- Agende verificações somente de leitura em arquivos, pastas ou fontes MCP.
- Veja o que é novo, mudou ou sumiu, com uma referência que só é substituída por uma verificação completa bem-sucedida.
- Receba o resultado como notificação, compare a versão antiga e a nova num relatório e inicie dali a atividade de atualização quando estiver pronto.
- Conecte ferramentas do projeto por MCP, incluindo navegadores, trackers e outros serviços externos.
- Ative o plugin opcional **codegraph** por projeto para entregar à IA um índice local do código da pasta vinculada, com telemetria desligada; ele exige instalação separada. Veja [Configurações](docs/pt-BR/settings.md).
- Use o mesmo contexto, agentes, skills e servidores MCP pelo [Moki na IDE](docs/pt-BR/ide.md): escolha o que a IA lê, confira as conexões MCP e inicie agentes nativos compatíveis em uma aba de chat separada.

### Fluxos para vários tipos de trabalho

O Moki inclui fluxos prontos para qualidade de software, requisitos, pesquisa, documentação, engenharia, APIs, dados, interfaces e evidências. QA é uma parte da biblioteca — o modelo de projetos, as notas, a orquestração de IA, o espaço de documentos e as integrações servem para muito mais.

## Como funciona

1. Escolha ou crie um **workspace**.
2. Crie um **projeto** ou abra uma pasta existente como projeto.
3. Adicione arquivos, notas e contexto confirmado.
4. Escolha **Chamar…**, uma atividade, agente, skill ou operação, e depois a ferramenta de IA.
5. Revise o resultado, aprove as etapas importantes e continue quando quiser.

## Instalação

1. Baixe o [Moki.Setup.0.7.4.exe](https://github.com/Orsi88/Moki/releases/download/v0.7.4/Moki.Setup.0.7.4.exe) (ou o arquivo mais recente em [Releases](https://github.com/Orsi88/Moki/releases)).
2. Instale pelo menos uma ferramenta de IA que você queira usar.
3. Para o VS Code, baixe o [moki-0.7.4.vsix](https://github.com/Orsi88/Moki/releases/download/v0.7.4/moki-0.7.4.vsix) e instale com `code --install-extension moki-0.7.4.vsix`.

Por padrão, seus projetos ficam em **Documentos\Moki**. Um instalador mais novo atualiza o app sem mexer nos seus workspaces. Para macOS, Linux e execução a partir do código, veja [Primeiros passos](https://github.com/Orsi88/moki/wiki/Primeiros-passos).

## Documentação

A documentação completa está na [wiki](https://github.com/Orsi88/moki/wiki):

| Guia | O que cobre |
|---|---|
| [O que é o Moki](https://github.com/Orsi88/moki/wiki/O-que-é-o-Moki) | O modelo, o vocabulário e o comportamento do Moki |
| [Primeiros passos](https://github.com/Orsi88/moki/wiki/Primeiros-passos) | Instalação, workspaces e primeiro projeto |
| [Projetos e workspaces](https://github.com/Orsi88/moki/wiki/Projetos-e-workspaces) | Contexto, tags, pastas vinculadas e isolamento |
| [Notas e assistentes rápidos](https://github.com/Orsi88/moki/wiki/Notas-e-assistentes-rápidos) | Notas, bloco de notas, exportações e assistentes de IA |
| [Arquivos e editor](https://github.com/Orsi88/moki/wiki/Arquivos-e-editor) | Documentos, prévias, comentários, PDFs e diagramas |
| [Chamar atividades, agentes e skills](https://github.com/Orsi88/moki/wiki/Chamar-atividades,-agentes-e-skills) | Pedidos reutilizáveis e como iniciá-los |
| [Execuções e entregas](https://github.com/Orsi88/moki/wiki/Execuções-e-entregas) | Estado, resultados e continuidade |
| [Moki na IDE](https://github.com/Orsi88/moki/wiki/Moki-na-IDE) | VS Code, Cursor e IA com contexto do projeto |
| [Servidores MCP](https://github.com/Orsi88/moki/wiki/Servidores-MCP) | Ferramentas externas disponíveis para cada projeto |
| [Rotinas e notificações](https://github.com/Orsi88/moki/wiki/Rotinas-e-notificações) | Verificações agendadas, referências e propostas |
| [Ensinar o Moki com o Mycroft](https://github.com/Orsi88/moki/wiki/Ensinar-o-Moki-com-o-Mycroft) | Aprendizados, versões propostas, histórico e restaurar o original |
| [Fluxos especializados](https://github.com/Orsi88/moki/wiki/Skills-de-QA-e-agentes) | Fluxos prontos de QA, pesquisa, documentação e engenharia |

## Privacidade

Os projetos ficam no seu computador e nunca fazem parte deste repositório. A IA lê o projeto ativo e somente os arquivos compartilhados que você libera por tags. O Moki não guarda seu projeto num serviço de nuvem.

## Contribuir

```bash
git clone https://github.com/Orsi88/moki.git
cd moki
npm run setup
npm run qa
```

Antes de um commit: `npm run build`, `npm run typecheck`, `npm run check` e `npm test`. As mudanças de documentação vão em [docs/](docs/), que é a fonte da wiki. Mantenha [README.md](README.md) e [README.pt-BR.md](README.pt-BR.md) juntos. Mais: [Contribuir](https://github.com/Orsi88/moki/wiki/Contributing).

## Licença

[MIT](LICENSE)
