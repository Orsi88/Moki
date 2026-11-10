# Usando o Moki

## Dentro de um projeto

**Continuar de onde parou.** As abas de documentos reabrem na ordem salva ao voltar ao projeto ou recarregar o Moki, restaurando o arquivo ativo, o modo de visualização do Markdown e a posição vertical de rolagem. Essa preferência fica separada por workspace e projeto neste computador. Abas fechadas continuam fechadas; arquivos ausentes ou sem acesso são ignorados. Só são guardados os dados de visualização, nunca o conteúdo dos arquivos ou rascunhos não salvos. A restauração de rolagem abrange as visualizações do Moki, incluindo áreas de texto, grades de planilhas e suas páginas de PDF, mas não o conteúdo dos visualizadores nativos isolados de PDF/HTML. Notas abertas separadamente e processos de terminal mantêm o funcionamento atual.

**Dentro de um projeto.** A árvore do projeto: contexto, entrada (inbox), atividades, notas. Solte arquivos sobre a janela e eles são copiados para o inbox — até 40 arquivos, 200 MB cada. Pastas são ignoradas. Arraste um arquivo para outra pasta para movê-lo, ou solte um arquivo do computador sobre uma pasta para copiá-lo para ela. Arquivos de execuções ficam de fora das duas coisas. Markdown aparece formatado num editor TipTap, e um desenho ou diagrama ali continua um cartão que é desenhado. Qualquer arquivo .md pode ser editado ali: o que o editor não desenha (HTML, o bloco de propriedades no topo, notas de rodapé, marcas de destaque) fica exatamente como foi escrito, num cartão ou etiqueta que dá para editar como texto, e uma edição reescreve só o parágrafo que mudou. Um arquivo com mais de 1 MB abre como texto editável. **Ctrl+E** troca para o código, também editável, **Ctrl+S** salva, **Ctrl+W** fecha. O botão de atualizar o arquivo lê de novo o que está no disco, então a versão que a IA acabou de gravar aparece sem fechar a aba. O menu ⋯ e o botão direito mandam um arquivo ou pasta para a lixeira; as pastas fixas (contexto, entrada, notas, temporários, arquivos de execuções) são esvaziadas e continuam, e o `project.json` não se apaga por aí. Excluir um projeto de vez fica na lista de projetos e não vai para a lixeira. O cartão do assistente também começa citando uma skill: o pedido abre na IA escolhida e nomeia essa skill. Arquivos Word viram texto para qualquer IA conseguir ler. Excel mostra os valores e PDF abre com texto selecionável; com o PdfCraft instalado dá para destacar e comentar, e editar as páginas (girar, mover, inserir, excluir), o título e o autor (um arquivo do inbox, e qualquer edição de página, vai para uma cópia `-edited.pdf`). O botão ao lado abre qualquer um no programa dele, e o "…" deixa escolher qual (Excel, Word e PDF). Os arquivos que a IA salva aparecem na árvore assim que chegam.

**Grupos e tela dividida.** Cada terminal que você abre começa o seu próprio grupo, com nome e cor, como os grupos de abas do navegador: a aba dele e os arquivos daquele trabalho ficam juntos. As entregas das execuções que uma IA cria abrem sozinhas no grupo dela, sem tirar você do que está vendo, com um pontinho até você olhar (só entregas: nunca os arquivos de apoio). Um arquivo que você abre entra no grupo que está na tela. Clique com o botão direito na etiqueta de um grupo para renomear, trocar a cor ou fechar os arquivos dele; na aba, para mover para outro grupo. O botão de dividir (no canto de cima, à direita) divide a tela em até 4 partes; cada uma tem a sua fileira de grupos e abas, então um grupo pode estar dos dois lados (o terminal de um, o arquivo que você revisa do outro) ou cada parte pode mostrar outro grupo. Arraste uma aba para outra parte e arraste as divisórias para mudar o tamanho.

**Chamar…**, no painel do projeto ou acima do terminal de IA, abre uma busca única de Atividades, Agentes, Skills e Operações. O atalho **Ctrl+Shift+K** (macOS: **Cmd+Shift+K**) abre a mesma lista.

1. Escolha o que chamar.
2. Escolha arquivos da Entrada, contexto compartilhado e um agente opcional, quando aplicável.
3. Acrescente uma observação opcional e escolha **Neste terminal** ou **Num terminal novo**.

**Neste terminal** cola no cursor, sem enviar nem apagar o que você escreveu. Acrescente contexto e pressione Enter quando quiser. Essa opção exige um terminal de IA em execução neste projeto. **Num terminal novo** permite escolher a ferramenta; a padrão vem de **Configurações › Minhas IAs**, e uma escolha diferente vale só para este pedido.

Claude Code, Codex, Gemini CLI, Antigravity CLI e Cursor Agent abrem numa aba de terminal. Cole um print ali (Ctrl+V) e ele é salvo em `temporary/pasted/` do projeto, com o caminho digitado no prompt, para a IA ler a imagem; arquivos arrastados para o terminal, do computador ou da árvore do projeto, entram pelo caminho. Cursor e VS Code abrem a pasta com o pedido copiado. Chats web e *Só mostrar a solicitação* preparam texto para copiar. Uma operação sempre abre seu próprio formulário porque cada etapa usa um terminal próprio; a lista explica esse comportamento.

Para conversar sobre uma ideia, escolha um agente em **Chamar…** e acrescente o assunto como observação opcional. Uma execução só começa quando o procedimento ou seu pedido exigir.

As **Configurações do projeto** (o ícone ao lado do nome do projeto no painel, ou o menu ⋯ da pasta do projeto) guardam o nome e a descrição do projeto e com o que uma IA aberta nele começa. Uma seção por tipo:

- **Ao abrir uma IA aqui**: instruções opcionais, enviadas junto com os padrões abaixo para toda IA aberta sem escolher nada.
- **Agentes**: os habilitados no projeto; a estrela torna um deles padrão.
- **Skills**, **Atividades**, **Operações**: os padrões de cada tipo, quantos você quiser.
- **Suas atividades**, **Templates**: marcar um aqui dá a ele a tag do projeto, a mesma que as Configurações mostram (e vice-versa); o que chega por uma tag compartilhada, ou vale para todos os projetos, fica travado com o motivo. O template em uso formata as entregas.
- **Servidores MCP**: os que o projeto recebe, só leitura (mude nas Configurações).

**Trazer para este projeto** (no topo das configurações do projeto) recebe skills, agentes e atividades, um de cada vez (um .md, a pasta de uma skill) ou uma pasta .claude inteira ou um .zip, arrastados ou escolhidos. O Moki separa o que encontrar por tipo, bloqueia o que não for seguro ou já existir, e instala só o que você confirmar: as skills para todos os projetos (ligadas a este), os agentes e as atividades entre os seus, com a tag deste projeto. As configurações gerais também mostram esses itens, com uma marca dizendo de que projeto vieram.

Uma IA aberta no projeto (Novo › IA) começa com eles: se o único padrão for uma atividade que não pede arquivos, ela começa na hora; senão, a IA assume o papel do agente padrão, usa as skills padrão, diz em uma ou duas linhas o que está configurado e o que precisa, e espera. A aba mostra isso ("Claude Code · failure-analyst"). Uma atividade escolhida em **Chamar…** vai sem os padrões e sem as instruções, e o **Chamar…** lista os padrões primeiro. Em Novo › IA, *Sem o padrão do projeto* abre uma IA sem nada disso.

Aí você conversa nessa ferramenta como de costume. O pedido cita o projeto, a pasta vinculada e as skills e os agentes instalados nele.

**Configurações** (a engrenagem) tem sete abas; fora Minhas IAs, cada uma é uma lista com filtros e busca:

| Aba | O que você faz ali |
|---|---|
| **Agentes** | Papéis com instruções e skills opcionais. Duplique um pronto, ou crie o seu; as tags dizem a quais projetos ele chega. |
| **Atividades** | Os pedidos prontos que você escolhe em "Chamar…": os do Moki e os seus (o que pedir, a qual skill, agente, workflow ou operação, com quais arquivos). Veja [Atividades](activities.md). |
| **Minhas IAs** | As IAs que o Moki abre (de terminal e editores), cada uma com a versão (o caminho aparece ao passar o mouse). O ícone do cartão faz a ação principal (instalar, ou instalar ou atualizar a extensão do Moki) e o menu **…** tem as outras, como **Tornar padrão**, que escolhe em qual as atividades começam (numa atividade você ainda pode escolher outra, só para ela). **Instalar** uma IA de terminal que falta: uma aba de terminal mostra o comando oficial e só o roda depois que você digita `y`; depois, **Verificar de novo**. No VS Code e no Cursor, **Instalar a extensão do Moki e abrir** instala a extensão da versão deste app (da release dele, conferida por SHA-256) e abre o editor na pasta ligada do projeto; um editor que falta tem **Baixar**. No Cursor a extensão aparece como *Não verificado*. Uma IA não encontrada, escolhida ao começar uma atividade, traz você para esta aba. |
| **Operações** | Agentes ligados por setas numa operação multiagente. Veja [Agents and operations](../agents.md) (em inglês). |
| **Skills** | O que já está instalado, o que vem com o Moki, os plugins do app (em roxo) e **Adicionar skill**: busque no registro público [SkillMD](https://skillmd.com), descreva uma para a sua ferramenta de IA redigir ou **Envie** skills e agentes de uma pasta `.claude` (ou de um `.zip`) do seu computador. O mesmo envio está em **Configurar projeto** (para o projeto ou para todos os projetos) e na tela inicial sem projeto aberto (para todos os projetos). Você escolhe os itens e confirma antes de qualquer instalação. Caveman e superpowers ficam desligados até você ligá-los na seção Plugins do painel do projeto; ligados, entram em toda sessão de IA aberta a partir desse projeto. |
| **Servidores MCP** | As ferramentas que a IA recebe, globais ou para projetos escolhidos. Veja [MCP servers](../mcp-servers.md) (em inglês). |
| **Templates** | Fonte, cores, cabeçalho, rodapé, logo e marca d'água dos PDF, Word e Excel que as atividades geram; as tags dizem quais projetos usam cada um. |

**Apps ArtCraft.** O menu **+** dos terminais termina com **Baixar apps ArtCraft…**: os 16 apps do [ArtCraft Launcher](https://github.com/storytold/craft-launcher) (o launcher primeiro: ele instala e atualiza os outros). **Baixar** mostra o arquivo, a release e o endereço e pede a sua confirmação; o Moki então baixa o arquivo do seu computador, confere o SHA-256, salva onde você escolher na janela do sistema e mostra a pasta. Quando o seu sistema tem mais de um formato (no Linux, o pacote da sua distribuição, como .rpm ou .deb, um AppImage ou um .tar.gz; no Windows, um .msi ou um .zip portátil), você escolhe qual, com o mais adequado marcado como recomendado. Ele nunca instala nem executa o arquivo: abra-o você mesmo (um .rpm ou .deb roda os scripts de instalação quando você o abre). Mensagens: [Solução de problemas](troubleshooting.md).

**Favoritos.** A estrela num card de Atividades, Agentes, Operações, Templates ou Skills torna o item favorito: os favoritos aparecem primeiro na lista deles, e as atividades favoritas aparecem primeiro em todo lugar onde se escolhe uma atividade. Eles ficam guardados por workspace em `library/favorites.json`.

Notas de um projeto são arquivos Markdown em `notes/` e abrem numa janela própria. Notas avulsas da tela inicial ficam no app até você enviar uma para um projeto. Num PDF, selecionar um texto oferece **Criar nota daqui**: uma nota no `notes/` do mesmo projeto, com o título `<arquivo> p<página>`, a citação e uma linha de origem (arquivo, página, retângulo em pontos); o PDF não é alterado. Uma nota de projeto pode ser exportada pela janela dela em **PDF** (exige Edge, Chrome ou Chromium), **Markdown** ou **texto**: uma janela de salvar pergunta onde, e o arquivo vai para lá (fora do workspace, só por essa escolha); as imagens embutidas na nota ficam no PDF e no Markdown e viram `[descrição]` no texto.

**Notas avulsas rápidas.** O botão de nota na parte inferior da barra fixa de ícones, logo acima do botão de recolher a lateral, abre uma nova nota avulsa na área principal, onde as notas abrem (na tela inicial, ou por cima das abas de um projeto). Nas Configurações, que ocupam a área principal, ela abre por cima e pode ser redimensionada pelo canto. O botão ↗ abre a nota no bloco de notas, numa janela própria. Fechar a nota salva o conteúdo e retorna à mesma tela sem substituir abas de documentos ou terminais. Ela fica neste computador, sem vínculo com um projeto, até você usar explicitamente **Enviar para um projeto**. As notas existentes continuam listadas na tela inicial; o cabeçalho dessa listagem deixa de ter um **+** separado.

## Projetos

**Diálogos e menus.** Os pop-ups usam a paleta e o modo claro/escuro do Moki, independentemente das cores dos documentos e da CLI. Trocar o tema também atualiza as janelas de notas e busca que já estão abertas. As confirmações aparecem dentro do Moki: a ação só é executada após escolher continuar, e Cancelar recebe o foco inicial. Tab permanece dentro de um modal e Esc fecha somente o diálogo de cima (ou o menu aberto nele); o foco retorna ao controle de origem quando ele ainda existe. Diálogos ocupados não fecham durante a execução da operação. As janelas de abrir/salvar arquivos e pastas continuam nativas do sistema.

Um projeto é um trabalho. O id é curto e em minúsculas (`billing-portal`), e a pasta é `workspace/projects/<id>/` — ou `<pasta do workspace>/projects/<id>/` em outro workspace.

Um projeto de qualidade fica assim. Um projeto em branco tem o mesmo esqueleto e só ganha `context/` depois que você aprova o `plan.json`.

```text
workspace/projects/billing-portal/
├── project.json          # nome, idioma, pasta vinculada, quem pode ver os dados
├── context/              # somente conhecimento confirmado
├── proposed-updates.md   # o que a IA notou, esperando você
├── plan.json             # projeto em branco: o plano, até você aprovar
├── tags.json             # tags de arquivos avulsos
├── activity-log.md
├── inbox/                # arquivos que você entrega à IA
├── notes/
└── runs/<run-id>/        # uma pasta por atividade
    ├── state.json        # etapa atual, para parar e retomar
    ├── inputs/  outputs/  evidence/  logs/
```

Durante uma atividade, a IA pode notar algo que parece uma regra geral. Ela grava isso em `proposed-updates.md` e pergunta antes de virar contexto. Texto confirmado é o único texto que ela pode tratar como sabido.

Os entregáveis saem em **inglês**, a menos que você defina `"deliverableLanguage": "pt-BR"` no `project.json` ou peça outro idioma na atividade. A conversa segue o idioma em que você escreve. Mensagens citadas ficam no idioma original.

## Tags

As tags ligam projetos do mesmo workspace. Dê uma tag a um projeto ou a um arquivo (abaixo do nome do projeto, ou na barra acima de um arquivo aberto); digite um nome novo para criar uma.

Um projeto com uma tag pode usar, nas atividades:

- o **contexto confirmado** (`context/`) de todos os outros projetos com aquela tag — não o inbox, as execuções nem as evidências deles;
- todos os **arquivos** marcados com ela, em qualquer projeto.

Ao abrir uma atividade, o passo *Qual contexto a IA deve considerar?* lista esses arquivos, todos marcados. Desmarque o que essa atividade não deve usar; arquivos do próprio projeto também podem ficar de fora ali. O pedido então lista exatamente os arquivos compartilhados que a IA pode ler. Ela só lê, não grava nada nos outros projetos, diz de qual projeto veio cada informação e propõe o conhecimento novo em `proposed-updates.md`, em vez de tratá-lo como confirmado.

O catálogo de tags é o `tags.json` da pasta do workspace; as tags de um projeto ficam no `project.json` dele.

## Compartilhar um projeto

Para compartilhar o contexto com o time, coloque **a pasta daquele projeto** num repositório Git privado. Ela já ignora `runs/`, `inbox/` e `temporary/`. Dados de projeto não entram neste repositório público.

## Voltar depois

Feche a sessão quando quiser. Cada atividade grava o `state.json` no caminho. Peça à IA para continuar aquela execução — na mesma ferramenta ou em outra — e ela lê o arquivo, resume onde você parou e segue dali. As ferramentas não compartilham memória. Os arquivos são a memória. Num chat, envie de novo o `state.json` e o contexto que importa.

## Só o que você pediu

As IAs entregam só os arquivos que você pediu, no formato que você pediu; quando você não diz o formato e a atividade não define um, elas perguntam. Nada de cópia em outro formato, print de planilha ou arquivo de apoio ao lado: os arquivos de apoio vão para a pasta `work/` da execução e são limpos quando ela é concluída. Se ainda assim sobrar algo nas saídas de uma execução, a página dela lista em **Sobras**, para você mandar para a lixeira.

## Onde fica cada coisa

| O quê | Onde |
|---|---|
| A biblioteca do app e os seus projetos, depois do instalador | `Documentos/Moki` |
| Outros workspaces | `workspaces/<nome>/` na pasta do Moki, ou a pasta que você escolheu; a lista é `workspaces/workspaces.json` |
| Um projeto | `workspace/projects/<id>/` (ou `projects/<id>/` em outro workspace) |
| Conhecimento confirmado | `.../context/` |
| Uma atividade | `.../runs/<run-id>/`: entregas em `outputs/`; arquivos de apoio em `work/`, limpos quando a execução é concluída |
| Rascunhos fora de uma execução | `.../temporary/`: o que tem mais de 7 dias vai para a lixeira quando o projeto abre |
| Skills e agentes deste projeto | `workspace/projects/<id>/skills` e `agents`, ou `<pasta vinculada>/.claude/` |
| Skills e agentes de todos os projetos | `~/.claude/skills`, `~/.agents/skills`, `~/.claude/agents` |
| Cópias de agentes prontos | `workspace/library/agents/` |
| Aparência dos documentos | `workspace/document-style.json`, ou o mesmo arquivo dentro de um projeto |
| Tags | `workspace/tags.json` (catálogo), `project.json` → `tags`, e `tags.json` dentro de um projeto (os arquivos dele) |
