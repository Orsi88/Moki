# Arquivos e editor

## Acrescentar e organizar arquivos

- **Solte arquivos na janela** e eles são copiados para a **Entrada** — até 40 arquivos, 200 MB cada (pastas são ignoradas).
- **Solte um arquivo numa pasta** da árvore para copiá-lo para lá; **arraste um arquivo** da árvore para outra pasta para movê-lo.
- **Botão direito** (ou o menu ⋯) para: novo arquivo ou pasta, **renomear** (F2), mostrar na pasta, copiar o caminho ou um link, **usar no terminal** (arquivos do Contexto e de Notas: a IA lê como contexto para o que você pedir em seguida), e **apagar** — para a lixeira.
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

Um bloco ` ```mermaid ` é desenhado como diagrama, e um bloco ` ```excalidraw ` como desenho editável — clique no lápis para editar no [Excalidraw](https://excalidraw.com). Segure **Ctrl** e role para dar zoom. As IAs são orientadas a desenhar diagramas assim, dentro do documento, em vez de gerar imagens ou PDFs.

### Links entre arquivos do projeto

Um link para outro arquivo do projeto — um título, um comentário, uma página de PDF — abre aquele ponto no Moki. **Ctrl+clique** abre um link da web. Veja [Links do projeto](internal-links.md).

## PDF

Os PDFs abrem com texto selecionável. Você pode:

- **destacar e comentar** um trecho, responder comentários e trocar a cor deles;
- **editar páginas** — girar, mover, inserir, apagar — e o título e o autor;
- selecionar um texto e **Criar nota daqui**: uma nota no projeto com a citação e de onde ela veio.

Um arquivo da entrada, e qualquer edição de página, é salvo como uma cópia `-edited.pdf`, para o original ficar como estava.

## Word e Excel

Arquivos `.docx` e `.xlsx` abrem **com a formatação** — fontes, tamanhos, cores, alinhamento, preenchimentos — e podem ser **editados e comentados** no próprio Moki:

- **Word**: clique num parágrafo para mudar o texto dele; o resto do documento, os estilos e as outras partes ficam como estavam.
- **Excel**: clique numa célula para mudar o valor ou a fórmula; os formatos, as outras células e as outras abas ficam como estavam.
- **Comentários**: selecione um parágrafo ou uma célula e use **Adicionar comentário**. São comentários de verdade do Word e do Excel, gravados dentro do arquivo, então o Word e o Excel também mostram.
- **Salva sozinho**, e nunca por cima de uma versão que outra pessoa salvou nesse meio-tempo. O zoom fica no topo do arquivo.
- Uma aba protegida, ou um arquivo protegido ou com assinatura digital, abre só para leitura. Parágrafos com controle de alterações ou campos são editados no Word.

**Formatos antigos** (`.doc`, `.xls`): **Converter e editar uma cópia** gera uma cópia editável `.docx` ou `.xlsx` usando o Microsoft Office ou o LibreOffice instalado no seu computador. O original é mantido.

## Páginas HTML

Um arquivo `.html` abre **funcionando**, com JavaScript, junto com o CSS, os scripts e as imagens que estão ao lado dele — como um pequeno navegador dentro do Moki:

- a página roda **isolada**: não alcança o Moki, os seus arquivos fora do projeto nem a internet (páginas que carregam bibliotecas de uma CDN precisam delas salvas ao lado da página);
- escolha a largura — **Ajustar ao painel**, **Tablet** ou **Celular** — para conferir um layout, **recarregue**, ou **abra no seu navegador**;
- **selecione um trecho e comente**: os comentários ficam guardados ao lado da página, sem mudar o código dela, e acompanham o trecho quando a página muda.

## Imagens e outros arquivos

- **Imagens** abrem num visualizador.
- O botão ↗ abre o arquivo no programa dele; **⋯ › Abrir com…** deixa escolher qual (Excel, Word e PDF), e lembra a escolha.

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
