# Arquivos e editor

## Acrescentar e organizar arquivos

- **Solte arquivos na janela** e eles são copiados para a **Entrada** — até 40 arquivos, 200 MB cada (pastas são ignoradas).
- **Solte um arquivo numa pasta** da árvore para copiá-lo para lá; **arraste um arquivo** da árvore para outra pasta para movê-lo.
- **Botão direito** (ou o menu ⋯) para: novo arquivo ou pasta, **renomear** (F2), mostrar na pasta, copiar o caminho ou um link, **exportar uma cópia** (só arquivos: salva onde você escolher, sem mudanças), **usar no terminal** (arquivos do Contexto e de Notas: a IA lê como contexto para o que você pedir em seguida), e **apagar** — para a lixeira.
- **Levar um Markdown comentado para outro Moki:** exporte uma cópia e envie; a outra pessoa solta o arquivo na janela ou numa pasta. Os comentários, com autores e datas, vão dentro do `.md`. Comentários de HTML e de diagramas ficam guardados com o projeto e não vão com a cópia.
- As pastas fixas (Contexto, Entrada, Notas, Temporários, Arquivos de execuções) são esvaziadas, nunca removidas. Os arquivos que a IA salva aparecem na árvore assim que chegam.

## Markdown: um editor para ler, escrever e comentar

Um `.md` abre num editor formatado ([TipTap](https://tiptap.dev)): títulos, listas, checklists, tabelas, imagens, links, código e diagramas. Ele **salva sozinho** enquanto você digita.

- **Qualquer `.md` é editável**, mesmo um que a IA escreveu com HTML, um bloco de propriedades no topo (`---`), notas de rodapé ou destaques. O que o editor não desenha fica **exatamente como foi escrito** — um bloco vira um cartão que você edita como texto, um trecho no meio da frase vira uma etiqueta — e salvar reescreve só o parágrafo que você mudou.
- **Digite `/`** para o menu de comandos: títulos, listas, tabela, citação, divisor, link, bloco de código, um **diagrama** Mermaid ou um **desenho** Excalidraw.
- **Tabelas**: com o cursor numa tabela, uma barra acrescenta ou tira linhas e colunas.
- **O código-fonte**: **Ctrl+E** mostra o Markdown, também editável; Ctrl+E de novo volta.
- **O modo de leitura**: o botão do olho mostra o arquivo como um leitor o vê.
- **Um arquivo grande** (mais de 1 MB) abre como texto editável, para continuar rápido; um aviso explica.
- **Alterado fora do Moki**: se a IA muda um arquivo enquanto você edita, nada é sobrescrito — um aviso oferece **Ver a versão nova** ou **Manter a minha**.

### Comentários

Selecione um trecho dentro de um parágrafo e um botão **Comentário** aparece ao lado. Os comentários ficam ao lado do texto, ligados às palavras, com cor, respostas, edição e exclusão. Eles moram dentro do próprio arquivo, invisíveis para outros leitores de Markdown, então viajam junto com ele.

### Diagramas e desenhos

Um bloco ` ```mermaid ` é desenhado como diagrama, e um bloco ` ```excalidraw ` como desenho editável — clique no lápis para editar no [Excalidraw](https://excalidraw.com). Um arquivo `.excalidraw` abre como esse mesmo desenho, ocupando a página, e as edições voltam para o arquivo. Segure **Ctrl** e role para dar zoom. As IAs são orientadas a desenhar diagramas assim, dentro do documento, em vez de gerar imagens ou PDFs.

### Links entre arquivos do projeto

Um link para outro arquivo do projeto — um título, um comentário, uma página de PDF — abre aquele ponto no Moki. **Ctrl+clique** abre um link da web. Veja [Links do projeto](internal-links.md).

## PDF

Os PDFs abrem com texto selecionável. Você pode:

- **destacar e comentar** um trecho, responder comentários e trocar a cor deles;
- **editar páginas** — girar, mover, inserir, apagar — e o título e o autor;
- selecionar um texto e **Criar nota daqui**: uma nota no projeto com a citação e de onde ela veio.

Um arquivo da entrada, e qualquer edição de página, é salvo como uma cópia `-edited.pdf`, para o original ficar como estava.

## Word e Excel

- O **Word** (`.docx`) permite editar o texto dos parágrafos. Negrito, itálico, sublinhado e Enter valem para aquele parágrafo, e o arquivo mantém a formatação nativa. O **Excel** (`.xlsx`) permite editar valores e fórmulas das células mantendo estilos e mesclagens. As mudanças salvam sozinhas; o status fica ao lado do ícone de tag.
- Os **comentários** usam o mesmo botão de seleção, caixa, cores e cartões do Markdown. No Word, selecione um trecho dentro de um parágrafo; no Excel, selecione uma célula. Clique em **Comentar** junto da seleção, escreva e salve. Os cartões ficam na altura do trecho ou da célula, ligados a eles, e acompanham a rolagem e o zoom. Responda, edite, troque a cor ou exclua pelo cartão. Fechar a coluna deixa marcadores que a reabrem. O Word mantém o trecho exato e a formatação; o texto é um comentário nativo do Word ou uma nota do Excel, com cores e respostas dentro do arquivo.
- Segure **Ctrl** e role o mouse para dar zoom; clique na porcentagem na barra do arquivo para restaurá-lo. A planilha carrega linhas conforme você rola, até o limite da prévia de 2.000 linhas e 200 colunas.
- O programa de planilhas recalcula as fórmulas ao abrir o arquivo salvo; o Moki não faz esse cálculo. Planilhas protegidas, arquivos assinados, modelos e formatos com macros ficam somente para leitura. Campos complexos e fórmulas compartilhadas ou matriciais precisam do programa original.
- **Arquivos antigos** (`.doc`, `.xls`): ao abrir, o Moki converte com o Microsoft Word/Excel ou o LibreOffice instalado para um `.docx`/`.xlsx` e avisa. O original permanece intacto. Se essa cópia já existe, o Moki a abre em vez de criar outra.

## Páginas HTML

O **HTML** executa JavaScript local, módulos e arquivos web relativos numa prévia isolada, sem acesso ao Moki nem a recursos externos de rede. A barra única do arquivo reúne o seletor de largura (painel, tablet ou celular), comentários, recarregar e abrir no navegador.

Para comentar, **selecione um trecho na prévia** e clique no botão flutuante **Comentar**. A caixa e os cartões são os mesmos do Markdown: escolha uma cor, escreva, responda, edite ou exclua. Os cartões acompanham os trechos visíveis durante a rolagem da prévia; clicar num deles leva até o trecho. O ícone de balão mostra a contagem total e abre ou fecha a coluna; com ela fechada, os marcadores reabrem os comentários. Os comentários ficam no projeto, separados do código HTML; copie o projeto para levá-los junto. Se a página mudar e o trecho não for mais encontrado, o comentário continua com um aviso.

## Arquivos de diagrama

Mermaid (`.mmd`, `.mermaid`), PlantUML (`.puml`, `.plantuml`), D2 (`.d2`) e Graphviz DOT (`.dot`, `.gv`) abrem no visualizador de diagramas. O Mermaid pode ser desenhado offline pelo renderizador incluído no Moki. As configurações de provedor do visualizador também permitem usar um [servidor Kroki configurado](https://docs.kroki.io/kroki/setup/usage/) para essas quatro linguagens. Abrir um arquivo não o envia para um serviço público: um servidor fora deste computador exige autorização explícita para o endereço configurado daquele projeto. Nenhum serviço público vem habilitado por padrão.

Use **Ctrl + rolagem** para ampliar ao redor do ponteiro, rolagem normal para mover na vertical, **Shift + rolagem** na horizontal ou a ferramenta mão para arrastar. A barra também ajusta o diagrama à tela ou à largura, restaura a visualização, mostra o código-fonte, abre em tela cheia e exporta SVG ou PNG. A cópia de imagem usa a área de transferência do sistema.

A ferramenta de comentário marca um ponto ou uma região arrastada. A caixa, as cores, as respostas e os cartões são compartilhados com os outros visualizadores. Os comentários podem ser resolvidos e reabertos; o painel filtra discussões abertas e resolvidas. As coordenadas, o zoom e a posição da rolagem ficam no projeto, no armazenamento externo de comentários de documentos já existente. A revisão nunca altera o código-fonte. Renomear ou mover um arquivo pelo Moki leva esses dados junto.

Quando o código-fonte muda, o visualizador é atualizado pelo mecanismo de observação de arquivos já existente. Os comentários são preservados; posições que não puderem ser confirmadas no desenho novo ficam sinalizadas para revisão. Comentários posicionais não significam que todo renderizador forneça identificadores semânticos estáveis para os nós. Este visualizador não acrescenta ferramentas de desenho livre nem comparação semântica de versões.

O Kroki é um serviço separado, não uma dependência JavaScript embarcada no Moki. O [guia oficial de instalação](https://docs.kroki.io/kroki/setup/about-docker-podman/) cobre Docker no Windows e Docker ou Podman no Linux; alguns motores usam contêineres auxiliares. O Moki não instala nem inicia esses serviços automaticamente. Se um servidor configurado estiver indisponível, o código-fonte do arquivo e o restante do Moki continuam acessíveis.

## Imagens e outros arquivos

**Imagens** abrem num visualizador. O botão ↗ abre um arquivo no programa dele; **⋯ › Abrir com…** deixa escolher qual para Excel, Word e PDF, e lembra a escolha.

## Abas, grupos e telas divididas

- As abas **reabrem** na mesma ordem quando você volta a um projeto, com o arquivo ativo, o modo de visualização e a posição da rolagem.
- Cada terminal de IA começa o seu próprio **grupo**, com nome e cor; os arquivos que ele entrega abrem no grupo dele com uma bolinha até você olhar. Botão direito num grupo para renomear, trocar a cor ou fechar os arquivos; botão direito numa aba para movê-la para outro grupo.
- O botão de **dividir** (canto superior direito) divide a tela em até quatro visões, cada uma com seus grupos e abas — o terminal de um lado e o arquivo que você revisa do outro. Arraste abas entre as visões e os divisores para redimensionar.

| Atalho | O que faz |
|---|---|
| Ctrl+S | Salvar (a maioria dos arquivos salva sozinha) |
| Ctrl+W | Fechar a aba |
| Ctrl+E | Código-fonte Markdown ↔ formatado |
| Ctrl+Shift+K | **Chamar…** |
| Ctrl+Shift+F | Buscar no workspace |

## Veja também

- [Notas e assistentes rápidos](notes.md)
- [Terminais de IA](ai-terminals.md)
