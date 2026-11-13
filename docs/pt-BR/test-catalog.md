# Catálogo de testes

Todos os cenários de teste automatizado do Moki, um por linha: 624 cenários. O cenário é o título do teste, que diz o comportamento verificado; os títulos vêm de `docs/pt-BR/test-scenarios.json` (o original, em inglês, está no código). Como as suítes rodam e como os testes são escritos: [Testes automatizados](testing.md).

> Gerado pelo `npm run test-catalog` a partir dos arquivos de teste; não edite à mão. Rode de novo depois de criar ou renomear um teste.

## Totais

| Tipo | Cenários |
|---|---|
| Unidade | 315 |
| Integração | 188 |
| Interface | 121 |

| Área | Unidade | Integração | Interface |
|---|---|---|---|
| [Projetos](#projetos) | 11 | 7 |  |
| [Arquivos e confinamento](#arquivos-e-confinamento) | 28 | 12 |  |
| [Abrir com](#abrir-com) | 1 | 1 |  |
| [PDF (PdfCraft)](#pdf-pdfcraft) | 4 | 4 |  |
| [Notas](#notas) | 7 | 5 |  |
| [Renderização](#renderização) | 99 | 3 |  |
| [Busca](#busca) | 2 | 6 |  |
| [Workspaces](#workspaces) | 5 | 1 |  |
| [Abas e visões](#abas-e-visões) | 11 |  |  |
| [Tema](#tema) | 3 |  |  |
| [Diálogos](#diálogos) | 4 |  |  |
| [Tags](#tags) | 5 | 1 |  |
| [Abrir as ferramentas de IA](#abrir-as-ferramentas-de-ia) | 38 | 10 |  |
| [Encontrar as ferramentas de IA](#encontrar-as-ferramentas-de-ia) | 6 | 6 |  |
| [Atividades](#atividades) | 10 | 4 |  |
| [Favoritos](#favoritos) | 2 | 1 |  |
| [Atividades e execuções](#atividades-e-execuções) | 3 | 11 |  |
| [Agentes](#agentes) |  | 8 |  |
| [Operações multiagente](#operações-multiagente) |  | 8 |  |
| [Skills e configuração](#skills-e-configuração) |  | 18 |  |
| [Pasta vinculada](#pasta-vinculada) |  | 4 |  |
| [Servidores MCP](#servidores-mcp) | 14 | 8 |  |
| [Ponte do app (IPC)](#ponte-do-app-ipc) |  | 1 |  |
| [Instalador](#instalador) |  | 2 |  |
| [Uso na barra de status](#uso-na-barra-de-status) | 16 |  |  |
| [Traduções](#traduções) | 5 |  |  |
| [IDE: API do painel](#ide-api-do-painel) |  | 11 |  |
| [IDE: contexto e servidor MCP](#ide-contexto-e-servidor-mcp) |  | 10 |  |
| [Ícone da IDE](#ícone-da-ide) | 2 |  |  |
| [Framework](#framework) | 24 | 3 |  |
| [Documentação](#documentação) | 4 |  |  |
| [Configurador](#configurador) | 1 | 2 |  |
| [Download dos apps ArtCraft](#download-dos-apps-artcraft) | 3 | 10 |  |
| [Diagrams](#diagrams) | 3 | 16 |  |
| [Routines](#routines) | 4 | 15 |  |
| [ (UI)](#-ui) |  |  | 5 |
| [Configurações (UI)](#configurações-ui) |  |  | 8 |
| [Tags (UI)](#tags-ui) |  |  | 2 |
| [Workspaces (UI)](#workspaces-ui) |  |  | 4 |
| [Árvore do projeto (UI)](#árvore-do-projeto-ui) |  |  | 8 |
| [Operações num projeto (UI)](#operações-num-projeto-ui) |  |  | 3 |
| [Terminais que continuam fora do projeto (UI)](#terminais-que-continuam-fora-do-projeto-ui) |  |  | 4 |
| [Lista de servidores MCP (UI)](#lista-de-servidores-mcp-ui) |  |  | 2 |
| [Comentários em PDF (UI)](#comentários-em-pdf-ui) |  |  | 8 |
| [Atividades (UI)](#atividades-ui) |  |  | 4 |
| [Configurações sem projeto (UI)](#configurações-sem-projeto-ui) |  |  | 1 |
| [Favoritos (UI)](#favoritos-ui) |  |  | 1 |
| [Minhas IAs e o painel do projeto (UI)](#minhas-ias-e-o-painel-do-projeto-ui) |  |  | 6 |
| [Painel de detalhes da execução (UI)](#painel-de-detalhes-da-execução-ui) |  |  | 2 |
| [Renomear na árvore (UI)](#renomear-na-árvore-ui) |  |  | 4 |
| [Renomear na tela inicial (UI)](#renomear-na-tela-inicial-ui) |  |  | 3 |
| [Seleção no Markdown (UI)](#seleção-no-markdown-ui) |  |  | 3 |
| [Comentários no editor (UI)](#comentários-no-editor-ui) |  |  | 5 |
| [Uma visão para o Markdown (UI)](#uma-visão-para-o-markdown-ui) |  |  | 5 |
| [Tabelas no editor (UI)](#tabelas-no-editor-ui) |  |  | 3 |
| [Pedidos (UI)](#pedidos-ui) |  |  | 3 |
| [Padrões do projeto (UI)](#padrões-do-projeto-ui) |  |  | 6 |
| [Grupos de abas e visões divididas (UI)](#grupos-de-abas-e-visões-divididas-ui) |  |  | 9 |
| [Renderização (UI)](#renderização-ui) |  |  | 7 |
| [Atividades e execuções (UI)](#atividades-e-execuções-ui) |  |  | 2 |
| [Notas (UI)](#notas-ui) |  |  | 3 |
| [Projetos (UI)](#projetos-ui) |  |  | 3 |
| [Abrir ferramentas de IA (UI)](#abrir-ferramentas-de-ia-ui) |  |  | 2 |
| [Documentação (UI)](#documentação-ui) |  |  | 4 |
| [Editores de documentos (UI)](#editores-de-documentos-ui) |  |  | 1 |

## Testes de unidade e de integração

Rodam com `npm test`.

### Projetos

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | projetos e criação de projeto | Integração | [desktop.test.ts:91](../../tests/desktop.test.ts#L91) |
| 2 | excluir um projeto exige a palavra "delete" e remove só a pasta dele | Integração | [desktop.test.ts:102](../../tests/desktop.test.ts#L102) |
| 3 | a árvore lista o projeto, esconde arquivos com ponto e anota as atividades | Integração | [desktop.test.ts:119](../../tests/desktop.test.ts#L119) |
| 4 | atualizar o nome e a descrição do projeto preserva todas as outras configurações do projeto | Integração | [desktop.test.ts:647](../../tests/desktop.test.ts#L647) |
| 5 | as configurações do projeto guardam o nome, as linhas da descrição, os padrões e as instruções do início; um agente padrão é ligado | Integração | [desktop.test.ts:761](../../tests/desktop.test.ts#L761) |
| 6 | uma IA aberta no projeto começa com os padrões dele: uma atividade sem arquivos roda, qualquer outra coisa espera | Integração | [desktop.test.ts:785](../../tests/desktop.test.ts#L785) |
| 7 | as configurações do projeto e as do workspace se espelham pela tag do próprio projeto | Integração | [desktop.test.ts:812](../../tests/desktop.test.ts#L812) |
| 8 | arrastar o divisor dá a altura à seção para a qual ele se move | Unidade | [home-sections.test.ts:5](../../tests/home-sections.test.ts#L5) |
| 9 | uma seção não pode ser arrastada abaixo do mínimo | Unidade | [home-sections.test.ts:12](../../tests/home-sections.test.ts#L12) |
| 10 | os padrões são lidos como uma lista de tipos e ids; qualquer outra coisa, e as repetições, ficam de fora | Unidade | [project-defaults.test.ts:8](../../tests/project-defaults.test.ts#L8) |
| 11 | sem nada definido não se pede nada; operações não fazem parte do início | Unidade | [project-defaults.test.ts:14](../../tests/project-defaults.test.ts#L14) |
| 12 | um agente: a IA assume o papel, diz o que está configurado e o que precisa, e espera | Unidade | [project-defaults.test.ts:19](../../tests/project-defaults.test.ts#L19) |
| 13 | vários agentes, skills, atividades e as instruções chegam todos ao início | Unidade | [project-defaults.test.ts:27](../../tests/project-defaults.test.ts#L27) |
| 14 | só as instruções também iniciam a IA; um padrão que não existe mais fica de fora | Unidade | [project-defaults.test.ts:42](../../tests/project-defaults.test.ts#L42) |
| 15 | as skills e agentes do projeto iniciam a IA sozinhos: onde cada um está e para que serve, nenhum repetido, nenhum que sumiu | Unidade | [project-defaults.test.ts:50](../../tests/project-defaults.test.ts#L50) |
| 16 | o prompt inicial fica curto: descrições longas são cortadas e, acima de 40 itens, só os nomes são listados | Unidade | [project-defaults.test.ts:63](../../tests/project-defaults.test.ts#L63) |
| 17 | uma skill, um agente ou arquivos: um pedido para digitar numa IA, sem contexto compartilhado e sem execução | Unidade | [project-defaults.test.ts:73](../../tests/project-defaults.test.ts#L73) |
| 18 | a atividade "skill" lê a skill onde ela está: a pasta do Moki por padrão, o caminho dado para uma skill do projeto ou global | Unidade | [project-defaults.test.ts:87](../../tests/project-defaults.test.ts#L87) |

### Arquivos e confinamento

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o readFile renderiza cada tipo de arquivo | Integração | [desktop.test.ts:129](../../tests/desktop.test.ts#L129) |
| 2 | o acesso a arquivos nunca sai da pasta do projeto | Integração | [desktop.test.ts:165](../../tests/desktop.test.ts#L165) |
| 3 | a edição é limitada a arquivos Markdown/texto já existentes | Integração | [desktop.test.ts:172](../../tests/desktop.test.ts#L172) |
| 4 | um salvamento a partir do texto de que partiu nunca sobrescreve uma mudança feita nesse meio tempo (a IA escrevendo o arquivo) | Integração | [desktop.test.ts:180](../../tests/desktop.test.ts#L180) |
| 5 | arquivos soltos no workspace são copiados para a entrada e ficam lá | Integração | [desktop.test.ts:296](../../tests/desktop.test.ts#L296) |
| 6 | um arquivo muda de pasta, e um soltar pode cair numa; os arquivos de execução ficam de fora | Integração | [desktop.test.ts:314](../../tests/desktop.test.ts#L314) |
| 7 | um arquivo ou pasta é renomeado no lugar, mantém a extensão, as tags e as notas do PDF; os itens do próprio Moki mantêm os nomes | Integração | [desktop.test.ts:339](../../tests/desktop.test.ts#L339) |
| 8 | abrir pasta / abrir com o programa padrão ficam confinados e filtrados | Integração | [desktop.test.ts:405](../../tests/desktop.test.ts#L405) |
| 9 | excluir manda um arquivo para a lixeira, esvazia uma pasta fixa e mantém o project.json | Integração | [desktop.test.ts:414](../../tests/desktop.test.ts#L414) |
| 10 | arquivos e pastas novos: Markdown, texto, planilha e Word vazios, nomes seguros, nunca dentro das atividades | Integração | [desktop.test.ts:432](../../tests/desktop.test.ts#L432) |
| 11 | onde um item está neste computador: mostrado na pasta dele ou pelo caminho completo, só dentro do projeto | Integração | [desktop.test.ts:463](../../tests/desktop.test.ts#L463) |
| 12 | isolamento do fs-guard e regras de tipo de arquivo | Unidade | [desktop.test.ts:2828](../../tests/desktop.test.ts#L2828) |
| 13 | ids de projeto: só um nome de pasta simples com um project.json é um projeto | Unidade | [desktop.test.ts:3230](../../tests/desktop.test.ts#L3230) |
| 14 | o moki-file serve o arquivo inteiro com tipo, tamanho e Accept-Ranges, e o HEAD responde o mesmo sem corpo | Unidade | [file-protocol.test.ts:58](../../tests/file-protocol.test.ts#L58) |
| 15 | o moki-file responde um único Range com 206 e exatamente esses bytes | Unidade | [file-protocol.test.ts:78](../../tests/file-protocol.test.ts#L78) |
| 16 | o moki-file responde um Range inválido ou não atendível com 416 e Content-Range */tamanho | Unidade | [file-protocol.test.ts:93](../../tests/file-protocol.test.ts#L93) |
| 17 | o moki-file ignora um Range múltiplo ou outra unidade e envia o arquivo inteiro (uma resposta válida) | Unidade | [file-protocol.test.ts:103](../../tests/file-protocol.test.ts#L103) |
| 18 | o parseRange cobre as formas de um único intervalo e um arquivo vazio | Unidade | [file-protocol.test.ts:112](../../tests/file-protocol.test.ts#L112) |
| 19 | o moki-file serve um arquivo vazio inteiro, sem corpo | Unidade | [file-protocol.test.ts:123](../../tests/file-protocol.test.ts#L123) |
| 20 | o moki-file se recusa a liberar o que está fora do projeto: .., caminhos absolutos, links simbólicos para fora, outros projetos | Unidade | [file-protocol.test.ts:132](../../tests/file-protocol.test.ts#L132) |
| 21 | o moki-file se recusa a liberar o que não é PDF nem imagem, o que não é arquivo, o que não existe ou passa do limite de tamanho | Unidade | [file-protocol.test.ts:144](../../tests/file-protocol.test.ts#L144) |
| 22 | todo pedido que não nomeia um arquivo servível recebe o mesmo 404 | Unidade | [file-protocol.test.ts:150](../../tests/file-protocol.test.ts#L150) |
| 23 | o caminho depois do token é ignorado: ele nunca escolhe um arquivo | Unidade | [file-protocol.test.ts:161](../../tests/file-protocol.test.ts#L161) |
| 24 | só GET e HEAD são atendidos | Unidade | [file-protocol.test.ts:170](../../tests/file-protocol.test.ts#L170) |
| 25 | um link simbólico posto no lugar do arquivo depois da liberação impede que ele seja servido | Unidade | [file-protocol.test.ts:180](../../tests/file-protocol.test.ts#L180) |
| 26 | um arquivo que passou do limite, virou pasta ou sumiu deixa de ser servido | Unidade | [file-protocol.test.ts:191](../../tests/file-protocol.test.ts#L191) |
| 27 | uma liberação morre com a sua janela e não afeta a de outra janela | Unidade | [file-protocol.test.ts:201](../../tests/file-protocol.test.ts#L201) |
| 28 | uma janela que muda de projeto perde o que lhe foi liberado para os outros | Unidade | [file-protocol.test.ts:214](../../tests/file-protocol.test.ts#L214) |
| 29 | um projeto que desaparece, ou outro workspace sendo aberto, encerra todas as liberações | Unidade | [file-protocol.test.ts:226](../../tests/file-protocol.test.ts#L226) |
| 30 | o mesmo arquivo e carimbo mantêm um só token; um arquivo alterado recebe um novo; uma janela guarda um número limitado | Unidade | [file-protocol.test.ts:240](../../tests/file-protocol.test.ts#L240) |
| 31 | os tokens têm 192 bits aleatórios em hexadecimal e nunca se repetem | Unidade | [file-protocol.test.ts:255](../../tests/file-protocol.test.ts#L255) |
| 32 | o serviço de comentários HTML limita chamadas a uma página existente do próprio projeto | Integração | [html-comments.test.ts:53](../../tests/html-comments.test.ts#L53) |
| 33 | a prévia HTML serve módulos e arquivos locais, recusa segredos, caminhos externos e escrita, e expira com janela, workspace ou projeto | Unidade | [html-preview.test.ts:8](../../tests/html-preview.test.ts#L8) |
| 34 | uma mudança numa pasta aninhada é informada uma vez por rajada, e uma pasta ignorada não é observada | Unidade | [project-watch.test.ts:15](../../tests/project-watch.test.ts#L15) |
| 35 | além do maxDirs, as pastas extras ficam sem observação, em silêncio e sem erro | Unidade | [project-watch.test.ts:33](../../tests/project-watch.test.ts#L33) |
| 36 | só um renomear varre a pasta de novo; uma mudança simples apenas informa | Unidade | [project-watch.test.ts:51](../../tests/project-watch.test.ts#L51) |
| 37 | uma subpasta criada depois do início é observada | Unidade | [project-watch.test.ts:75](../../tests/project-watch.test.ts#L75) |
| 38 | uma pasta criada depois do início continua respeitando o maxDirs | Unidade | [project-watch.test.ts:92](../../tests/project-watch.test.ts#L92) |
| 39 | mudanças contínuas são informadas dentro do maxWaitMs, em vez de adiadas para sempre | Unidade | [project-watch.test.ts:110](../../tests/project-watch.test.ts#L110) |
| 40 | uma pasta que é link simbólico não é seguida | Unidade | [project-watch.test.ts:130](../../tests/project-watch.test.ts#L130) |

### Abrir com

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | "abrir com" lista os programas do sistema e só abre com um deles | Integração | [desktop.test.ts:482](../../tests/desktop.test.ts#L482) |
| 2 | saída do gio mime: o programa padrão e depois os recomendados | Unidade | [desktop.test.ts:501](../../tests/desktop.test.ts#L501) |

### PDF (PdfCraft)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as associações de notas de PDF ficam no projeto, acompanham as páginas e rejeitam caminhos inválidos | Integração | [desktop.test.ts:202](../../tests/desktop.test.ts#L202) |
| 2 | scripts do PdfCraft: abrir, alterar, salvar no lugar ou numa cópia, listar | Integração | [desktop.test.ts:510](../../tests/desktop.test.ts#L510) |
| 3 | pdfcraft-cli fora do PATH: pastas de instalação no Windows, pastas bin de sempre nos outros sistemas | Unidade | [desktop.test.ts:538](../../tests/desktop.test.ts#L538) |
| 4 | as alterações de PDF vindas da interface são conferidas | Integração | [desktop.test.ts:546](../../tests/desktop.test.ts#L546) |
| 5 | os cartões de comentário ao lado de um PDF: cada um no seu lugar, empurrado para baixo quando cobriria o de cima | Unidade | [desktop.test.ts:565](../../tests/desktop.test.ts#L565) |
| 6 | uma seleção nas páginas desenhadas vira quadriláteros em pontos | Unidade | [desktop.test.ts:571](../../tests/desktop.test.ts#L571) |
| 7 | os comentários em PDF passam pelo PdfCraft, dentro do projeto, sem nunca alterar o arquivo da entrada | Integração | [desktop.test.ts:581](../../tests/desktop.test.ts#L581) |
| 8 | sem o PdfCraft, o próprio Moki destaca, comenta, responde, edita e exclui no PDF | Unidade | [pdf-local.test.ts:32](../../tests/pdf-local.test.ts#L32) |

### Notas

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | notas: a seção sempre aparece e as notas novas recebem nomes únicos | Integração | [desktop.test.ts:194](../../tests/desktop.test.ts#L194) |
| 2 | notas: uma é excluída pela tela inicial; nada fora de notes/ é excluído | Integração | [desktop.test.ts:228](../../tests/desktop.test.ts#L228) |
| 3 | notas: uma seleção de PDF vira uma nota com título de arquivo e página, com a sua origem | Integração | [desktop.test.ts:237](../../tests/desktop.test.ts#L237) |
| 4 | notas: exportadas como md, txt e pdf para o arquivo que o diálogo de salvar devolve; nada mais é exportado | Integração | [desktop.test.ts:245](../../tests/desktop.test.ts#L245) |
| 5 | janelas de nota: só notes/<arquivo>.md de um projeto listado ou o id de uma nota avulsa, uma janela por nota | Integração | [desktop.test.ts:2809](../../tests/desktop.test.ts#L2809) |
| 6 | note-assist: o pedido leva a nota e a tarefa e usa o idioma escolhido como padrão | Unidade | [note-assist.test.ts:6](../../tests/note-assist.test.ts#L6) |
| 7 | note-assist: nenhuma ferramenta escreve ou executa comandos; só a pesquisa busca na web | Unidade | [note-assist.test.ts:15](../../tests/note-assist.test.ts#L15) |
| 8 | note-assist: remove a cerca ao redor da resposta inteira e posiciona a resposta conforme o assistente | Unidade | [note-assist.test.ts:29](../../tests/note-assist.test.ts#L29) |
| 9 | note-assist: as diferenças mantêm palavras comuns e marcam remoções e inclusões | Unidade | [note-assist.test.ts:39](../../tests/note-assist.test.ts#L39) |
| 10 | note-assist: a execução lê a nota pela entrada padrão e responde em Markdown | Unidade | [note-assist.test.ts:51](../../tests/note-assist.test.ts#L51) |
| 11 | note-assist: a falha mostra as últimas linhas de erro; cancelar ou atingir o tempo limite encerra a execução | Unidade | [note-assist.test.ts:57](../../tests/note-assist.test.ts#L57) |
| 12 | um comando com barra substitui só a barra digitada | Unidade | [slash-apply.test.ts:8](../../tests/slash-apply.test.ts#L8) |

### Renderização

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | destacar uma linha mantém todos os caracteres e marca as palavras | Unidade | [code-highlight.test.ts:5](../../tests/code-highlight.test.ts#L5) |
| 2 | bash colore o comando, um texto entre aspas, um comentário e um símbolo | Unidade | [code-highlight.test.ts:12](../../tests/code-highlight.test.ts#L12) |
| 3 | palavras-chave de SQL valem em maiúsculas ou minúsculas | Unidade | [code-highlight.test.ts:23](../../tests/code-highlight.test.ts#L23) |
| 4 | tags HTML e comentários CSS ganham cor e o texto continua inteiro | Unidade | [code-highlight.test.ts:29](../../tests/code-highlight.test.ts#L29) |
| 5 | uma string e um comentário Python são marcados e o texto continua juntando | Unidade | [code-highlight.test.ts:39](../../tests/code-highlight.test.ts#L39) |
| 6 | um debouncer roda uma vez, depois da última chamada de uma rajada | Unidade | [debounce.test.ts:5](../../tests/debounce.test.ts#L5) |
| 7 | o flush roda a chamada pendente na hora, uma única vez, e não faz nada quando não há pendência | Unidade | [debounce.test.ts:22](../../tests/debounce.test.ts#L22) |
| 8 | o cancel descarta a chamada pendente, e uma chamada posterior volta a funcionar | Unidade | [debounce.test.ts:38](../../tests/debounce.test.ts#L38) |
| 9 | o flushEdits descarrega todo editor registrado até ele se desregistrar | Unidade | [debounce.test.ts:54](../../tests/debounce.test.ts#L54) |
| 10 | as tabelas de Markdown desenham células mescladas (<< e ^^) como uma célula só | Unidade | [desktop.test.ts:2652](../../tests/desktop.test.ts#L2652) |
| 11 | a renderização de Markdown escapa HTML e injeção de atributos | Unidade | [desktop.test.ts:2658](../../tests/desktop.test.ts#L2658) |
| 12 | imagens relativas do Markdown só são embutidas de dentro do projeto | Unidade | [desktop.test.ts:2666](../../tests/desktop.test.ts#L2666) |
| 13 | a extração de docx mantém títulos, listas e tabelas | Unidade | [desktop.test.ts:2684](../../tests/desktop.test.ts#L2684) |
| 14 | a extração de docx mantém formatação, listas numeradas, links, notas, comentários e imagens | Unidade | [desktop.test.ts:2695](../../tests/desktop.test.ts#L2695) |
| 15 | os formatos de número das planilhas mostram os valores como os programas de planilha mostram | Unidade | [desktop.test.ts:2729](../../tests/desktop.test.ts#L2729) |
| 16 | um diagrama guardado é um acerto, um desconhecido é uma falha | Unidade | [diagram-cache.test.ts:6](../../tests/diagram-cache.test.ts#L6) |
| 17 | idioma, tema e fonte geram chaves diferentes e nunca compartilham um desenho | Unidade | [diagram-cache.test.ts:14](../../tests/diagram-cache.test.ts#L14) |
| 18 | o limite de entradas descarta o diagrama usado há mais tempo | Unidade | [diagram-cache.test.ts:30](../../tests/diagram-cache.test.ts#L30) |
| 19 | o limite de bytes descarta diagramas antigos, e um que não cabe não é guardado | Unidade | [diagram-cache.test.ts:42](../../tests/diagram-cache.test.ts#L42) |
| 20 | um acerto é servido com o id da nova renderização | Unidade | [diagram-cache.test.ts:60](../../tests/diagram-cache.test.ts#L60) |
| 21 | montar os mesmos diagramas de novo não chama o renderizador | Unidade | [diagram-cache.test.ts:82](../../tests/diagram-cache.test.ts#L82) |
| 22 | outro tema, uma fonte editada e uma renderização que falhou são desenhados de novo | Unidade | [diagram-cache.test.ts:99](../../tests/diagram-cache.test.ts#L99) |
| 23 | um desenho ou diagrama fechado sai do texto e volta a se juntar a ele | Unidade | [diagram-source.test.ts:5](../../tests/diagram-source.test.ts#L5) |
| 24 | uma imagem embutida continua sendo imagem e volta ao mesmo markdown | Unidade | [diagram-source.test.ts:12](../../tests/diagram-source.test.ts#L12) |
| 25 | um bloco de diagrama só é tomado a partir do início do texto | Unidade | [diagram-source.test.ts:19](../../tests/diagram-source.test.ts#L19) |
| 26 | um bloco inacabado e qualquer outro bloco de código ficam no texto | Unidade | [diagram-source.test.ts:29](../../tests/diagram-source.test.ts#L29) |
| 27 | substituir um desenho não mexe no outro diagrama | Unidade | [diagrams.test.ts:8](../../tests/diagrams.test.ts#L8) |
| 28 | um desenho é exibido enquanto o diagrama abaixo dele ainda carrega | Unidade | [diagrams.test.ts:21](../../tests/diagrams.test.ts#L21) |
| 29 | um diagrama que falha ao carregar não esconde o desenho | Unidade | [diagrams.test.ts:42](../../tests/diagrams.test.ts#L42) |
| 30 | um diagrama que não pode ser desenhado deixa o desenho | Unidade | [diagrams.test.ts:56](../../tests/diagrams.test.ts#L56) |
| 31 | um desenho que não pode ser exibido não impede o diagrama | Unidade | [diagrams.test.ts:70](../../tests/diagrams.test.ts#L70) |
| 32 | uma nota só com um desenho nunca carrega o Mermaid | Unidade | [diagrams.test.ts:84](../../tests/diagrams.test.ts#L84) |
| 33 | a imagem de um diagrama substitui só o bloco que foi desenhado | Unidade | [diagrams.test.ts:96](../../tests/diagrams.test.ts#L96) |
| 34 | doc-check: um documento limpo não tem problemas | Unidade | [doc-check.test.mjs:7](../../tests/doc-check.test.mjs#L7) |
| 35 | doc-check: o que o Moki mostra errado é um erro (callouts, HTML, links para títulos) | Unidade | [doc-check.test.mjs:17](../../tests/doc-check.test.mjs#L17) |
| 36 | doc-check: títulos que pulam um nível ou repetem o título do documento; o texto dentro de blocos de código é ignorado | Unidade | [doc-check.test.mjs:22](../../tests/doc-check.test.mjs#L22) |
| 37 | doc-check: tabelas precisam de separador e do mesmo número de células; tabelas largas geram aviso | Unidade | [doc-check.test.mjs:27](../../tests/doc-check.test.mjs#L27) |
| 38 | doc-check: blocos Mermaid informam o tipo, não têm HTML nem click e continuam pequenos | Unidade | [doc-check.test.mjs:35](../../tests/doc-check.test.mjs#L35) |
| 39 | doc-check: blocos Excalidraw trazem uma cena; um bloco não fechado é um erro | Unidade | [doc-check.test.mjs:43](../../tests/doc-check.test.mjs#L43) |
| 40 | doc-check: fontes citadas precisam de uma linha na bibliografia; links e imagens locais precisam existir | Unidade | [doc-check.test.mjs:50](../../tests/doc-check.test.mjs#L50) |
| 41 | doc-render: as renderizações vão sempre para a pasta temporária do projeto do documento, nunca ao lado dele | Unidade | [doc-render.test.mjs:10](../../tests/doc-render.test.mjs#L10) |
| 42 | doc-render: --clean remove só as renderizações daquele arquivo | Unidade | [doc-render.test.mjs:24](../../tests/doc-render.test.mjs#L24) |
| 43 | excalidraw: uma especificação vira uma cena que o Moki aceita (tipo excalidraw, lista de elementos) | Unidade | [excalidraw-spec.test.mjs:19](../../tests/excalidraw-spec.test.mjs#L19) |
| 44 | excalidraw: os rótulos ficam presos às formas e as setas às duas pontas | Unidade | [excalidraw-spec.test.mjs:28](../../tests/excalidraw-spec.test.mjs#L28) |
| 45 | excalidraw: os níveis seguem as ligações; um ciclo não entra em laço; a mesma especificação gera a mesma cena | Unidade | [excalidraw-spec.test.mjs:46](../../tests/excalidraw-spec.test.mjs#L46) |
| 46 | excalidraw: uma especificação inválida é recusada com os motivos | Unidade | [excalidraw-spec.test.mjs:56](../../tests/excalidraw-spec.test.mjs#L56) |
| 47 | excalidraw: o bloco é um bloco excalidraw com o JSON da cena | Unidade | [excalidraw-spec.test.mjs:67](../../tests/excalidraw-spec.test.mjs#L67) |
| 48 | os títulos do Markdown recebem âncoras estáveis e únicas a partir do texto visível | Unidade | [heading-anchors.test.ts:7](../../tests/heading-anchors.test.ts#L7) |
| 49 | os IDs dos títulos não dependem da renderização dos comentários e recomeçam em cada documento | Unidade | [heading-anchors.test.ts:12](../../tests/heading-anchors.test.ts#L12) |
| 50 | comentários HTML persistem sem alterar o código, acompanham a renomeação de pasta e recusam âncoras inválidas | Unidade | [html-comments.test.ts:11](../../tests/html-comments.test.ts#L11) |
| 51 | cores, respostas e edições de comentários em HTML sobrevivem a reabrir e mover, sem alterar o fonte nem comentários antigos | Unidade | [html-comments.test.ts:29](../../tests/html-comments.test.ts#L29) |
| 52 | um link relativo ao documento leva ao arquivo que ele nomeia | Unidade | [internal-links.test.ts:9](../../tests/internal-links.test.ts#L9) |
| 53 | um caminho do projeto funciona a partir de qualquer documento, com ou sem a raiz (a menção @ da nota) | Unidade | [internal-links.test.ts:15](../../tests/internal-links.test.ts#L15) |
| 54 | um caminho que passa pela pasta deste projeto, como as IAs escrevem, é cortado no projeto | Unidade | [internal-links.test.ts:21](../../tests/internal-links.test.ts#L21) |
| 55 | o que não é um lugar deste projeto não leva a lugar nenhum | Unidade | [internal-links.test.ts:27](../../tests/internal-links.test.ts#L27) |
| 56 | um link para outro projeto nunca é resolvido dentro deste | Unidade | [internal-links.test.ts:37](../../tests/internal-links.test.ts#L37) |
| 57 | um arquivo ausente ainda resolve (para dizer que não foi encontrado), relativo ao documento primeiro | Unidade | [internal-links.test.ts:42](../../tests/internal-links.test.ts#L42) |
| 58 | âncoras: um título, um comentário, uma página de PDF; # sozinho é o mesmo documento | Unidade | [internal-links.test.ts:46](../../tests/internal-links.test.ts#L46) |
| 59 | os slugs de títulos seguem o GitHub: acentos mantidos, pontuação removida, repetições numeradas | Unidade | [internal-links.test.ts:55](../../tests/internal-links.test.ts#L55) |
| 60 | hrefTo escreve um link relativo ao documento, que resolveInternal lê de volta | Unidade | [internal-links.test.ts:62](../../tests/internal-links.test.ts#L62) |
| 61 | findPaths acha palavras com forma de arquivo, não palavras comuns, sem o ponto final | Unidade | [internal-links.test.ts:82](../../tests/internal-links.test.ts#L82) |
| 62 | um módulo sob demanda roda o import uma vez e guarda o módulo | Unidade | [lazy-module.test.ts:5](../../tests/lazy-module.test.ts#L5) |
| 63 | cargas simultâneas compartilham o mesmo import | Unidade | [lazy-module.test.ts:16](../../tests/lazy-module.test.ts#L16) |
| 64 | um import que falhou é esquecido, então a próxima carga tenta de novo | Unidade | [lazy-module.test.ts:26](../../tests/lazy-module.test.ts#L26) |
| 65 | warm inicia o import antes, não o roda de novo na carga e engole uma falha | Unidade | [lazy-module.test.ts:35](../../tests/lazy-module.test.ts#L35) |
| 66 | lazyHeavy importa na hora só quando a chave de carga sob demanda está desligada (eager) | Unidade | [lazy-module.test.ts:51](../../tests/lazy-module.test.ts#L51) |
| 67 | um comentário marca o trecho dele e vai para o bloco no final; qualquer visualizador de Markdown esconde os dois | Unidade | [md-comments.test.ts:20](../../tests/md-comments.test.ts#L20) |
| 68 | respostas, edições e exclusões mantêm o texto do próprio arquivo | Unidade | [md-comments.test.ts:36](../../tests/md-comments.test.ts#L36) |
| 69 | as cores dos comentários persistem entre edições e respostas, e os comentários antigos ficam como estavam | Unidade | [md-comments.test.ts:53](../../tests/md-comments.test.ts#L53) |
| 70 | o editor formatado mantém um comentário quando o texto ao redor muda | Unidade | [md-comments.test.ts:64](../../tests/md-comments.test.ts#L64) |
| 71 | ler os comentários de um texto com uma sequência muito longa de linhas em branco leva tempo linear e dá o mesmo corpo de antes | Unidade | [md-comments.test.ts:80](../../tests/md-comments.test.ts#L80) |
| 72 | md-preserve: uma edição reescreve só o seu trecho; as quebras de linha do Windows e o espaçamento original ficam | Unidade | [md-preserve.test.ts:8](../../tests/md-preserve.test.ts#L8) |
| 73 | md-preserve: o arquivo é dividido no texto desenhado, na sua cauda (linhas em branco, bloco de comentários) e na sua quebra de linha | Unidade | [md-preserve.test.ts:16](../../tests/md-preserve.test.ts#L16) |
| 74 | md-preserve: mesmo com a escrita própria do editor, a edição reescreve só os blocos alterados | Unidade | [md-preserve.test.ts:25](../../tests/md-preserve.test.ts#L25) |
| 75 | md-preserve: mantém quebras de linha do Windows e o arquivo inteiro ao acrescentar no fim | Unidade | [md-preserve.test.ts:35](../../tests/md-preserve.test.ts#L35) |
| 76 | md-raw: o editor formatado grava ${name} exatamente como estava | Unidade | [md-raw.test.ts:30](../../tests/md-raw.test.ts#L30) |
| 77 | md-raw: br numa célula e a definição de referência mantêm todas as palavras e o texto original | Unidade | [md-raw.test.ts:35](../../tests/md-raw.test.ts#L35) |
| 78 | md-raw: protege o bloco que perderia palavras e o devolve sem mudanças | Unidade | [md-raw.test.ts:42](../../tests/md-raw.test.ts#L42) |
| 79 | md-raw: editar um parágrafo de um arquivo da IA reescreve só esse parágrafo | Unidade | [md-raw.test.ts:52](../../tests/md-raw.test.ts#L52) |
| 80 | a prévia Word mantém fontes, tamanhos, cores e alinhamento; a edição de texto preserva estilos e partes restantes | Unidade | [office-editor.test.ts:27](../../tests/office-editor.test.ts#L27) |
| 81 | a edição Word preserva texto ao apagar entre trechos, inserir no limite e preencher parágrafos vazios | Unidade | [office-editor.test.ts:40](../../tests/office-editor.test.ts#L40) |
| 82 | comentários Word são partes nativas com âncora e podem ser removidos sem mudar o texto | Unidade | [office-editor.test.ts:48](../../tests/office-editor.test.ts#L48) |
| 83 | comentários de seleção no Word mantêm intervalos nativos exatos entre trechos formatados, comentários sobrepostos e edições posteriores | Unidade | [office-editor.test.ts:60](../../tests/office-editor.test.ts#L60) |
| 84 | comentários de seleção no Word preservam quebras de linha, tabulações, entidades XML e conteúdo que não é texto, e recusam intervalos inválidos | Unidade | [office-editor.test.ts:79](../../tests/office-editor.test.ts#L79) |
| 85 | um parágrafo pode receber marca e um parágrafo novo pode ser acrescentado depois dele | Unidade | [office-editor.test.ts:93](../../tests/office-editor.test.ts#L93) |
| 86 | comentários de Word e planilha guardam cor e respostas junto do texto nativo | Unidade | [office-editor.test.ts:104](../../tests/office-editor.test.ts#L104) |
| 87 | a edição não desfaz campos ou controle de alterações do Word e nunca expande entidades XML | Unidade | [office-editor.test.ts:125](../../tests/office-editor.test.ts#L125) |
| 88 | a prévia de planilha lê fontes e preenchimentos; editar um valor mantém estilos, células e abas restantes | Unidade | [office-editor.test.ts:132](../../tests/office-editor.test.ts#L132) |
| 89 | notas de planilha são comentários nativos e VML, uma por célula e sem arquivo auxiliar | Unidade | [office-editor.test.ts:142](../../tests/office-editor.test.ts#L142) |
| 90 | editar planilhas acrescenta células e fórmulas e pede recálculo sem mudar a parte de estilos | Unidade | [office-editor.test.ts:155](../../tests/office-editor.test.ts#L155) |
| 91 | o serviço Office recusa gravações desatualizadas e caminhos fora do projeto ativo | Integração | [office-editor.test.ts:164](../../tests/office-editor.test.ts#L164) |
| 92 | arquivos Office protegidos ou assinados não podem ser alterados | Unidade | [office-editor.test.ts:183](../../tests/office-editor.test.ts#L183) |
| 93 | abrir um documento antigo converte uma vez e a abertura seguinte usa essa cópia | Unidade | [office-editor.test.ts:198](../../tests/office-editor.test.ts#L198) |
| 94 | a conversão de formatos antigos preserva o original e não sobrescreve destinos existentes | Integração | [office-editor.test.ts:220](../../tests/office-editor.test.ts#L220) |
| 95 | Word e Excel abrem arquivos editados com comentários nativos e convertem cópias reais dos formatos antigos | Integração | [office-native.test.ts:17](../../tests/office-native.test.ts#L17) |
| 96 | parse worker: o worker lê um arquivo Word e uma planilha exatamente como a leitura direta faz | Unidade | [parse-worker.test.ts:39](../../tests/parse-worker.test.ts#L39) |
| 97 | parse worker: um arquivo corrompido é erro do arquivo, lançado como está e não lido duas vezes | Unidade | [parse-worker.test.ts:52](../../tests/parse-worker.test.ts#L52) |
| 98 | parse worker: um worker que não inicia, cai, responde lixo ou nunca responde volta para a leitura direta | Unidade | [parse-worker.test.ts:62](../../tests/parse-worker.test.ts#L62) |
| 99 | parse worker: sem resposta a tempo, o worker é encerrado e a leitura é direta; depois de falhas repetidas o worker não é mais tentado | Unidade | [parse-worker.test.ts:87](../../tests/parse-worker.test.ts#L87) |
| 100 | parse worker: um worker ocioso é encerrado e o próximo arquivo inicia um novo | Unidade | [parse-worker.test.ts:98](../../tests/parse-worker.test.ts#L98) |
| 101 | parse worker: os arquivos esperam a vez e cada um recebe a sua resposta | Unidade | [parse-worker.test.ts:110](../../tests/parse-worker.test.ts#L110) |
| 102 | parse worker: um arquivo grande não bloqueia o event loop (a leitura direta bloqueia) | Unidade | [parse-worker.test.ts:121](../../tests/parse-worker.test.ts#L121) |

### Busca

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | busca: projetos por nome, arquivos por nome e texto, filtros por tag | Integração | [desktop.test.ts:2895](../../tests/desktop.test.ts#L2895) |
| 2 | busca expandida: os prefixos distinguem projetos, nomes de arquivo e conteúdos | Integração | [desktop.test.ts:2925](../../tests/desktop.test.ts#L2925) |
| 3 | o texto extraído só é reaproveitado para a mesma versão do arquivo | Unidade | [search-cache.test.ts:6](../../tests/search-cache.test.ts#L6) |
| 4 | o texto usado há mais tempo sai primeiro quando o limite é passado | Unidade | [search-cache.test.ts:13](../../tests/search-cache.test.ts#L13) |
| 5 | busca expandida: acha por nome e conteúdo, lê um PDF e não segue links simbólicos | Integração | [search.test.ts:11](../../tests/search.test.ts#L11) |
| 6 | busca: o limite de tamanho de arquivo é respeitado (no limite e acima dele) | Integração | [search.test.ts:40](../../tests/search.test.ts#L40) |
| 7 | busca: o event loop não fica preso enquanto muitos arquivos são lidos | Integração | [search.test.ts:62](../../tests/search.test.ts#L62) |
| 8 | busca: o cedente só dá a vez ao event loop depois da sua fatia de trabalho | Integração | [search.test.ts:85](../../tests/search.test.ts#L85) |

### Workspaces

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | workspaces: cada um tem os próprios projetos; os pedidos citam um workspace fora do padrão | Integração | [desktop.test.ts:2848](../../tests/desktop.test.ts#L2848) |
| 2 | uma aba aberta só é lida de novo quando o tamanho ou a data de modificação do arquivo mudou | Unidade | [tab-refresh.test.ts:6](../../tests/tab-refresh.test.ts#L6) |
| 3 | uma aba sem carimbo conhecido, ou um arquivo ausente da árvore, é lida de novo (o lado seguro) | Unidade | [tab-refresh.test.ts:13](../../tests/tab-refresh.test.ts#L13) |
| 4 | uma aba de imagem ou PDF toma o carimbo do conteúdo, qualquer outra aba do carimbo da árvore que guardou | Unidade | [tab-refresh.test.ts:20](../../tests/tab-refresh.test.ts#L20) |
| 5 | uma aba de PDF não guarda bytes: o carimbo é o tamanho e a data do stat tirado antes de a URL ser liberada | Unidade | [tab-refresh.test.ts:30](../../tests/tab-refresh.test.ts#L30) |
| 6 | o throttle chama na hora e depois reduz uma rajada a uma chamada no fim da janela | Unidade | [tab-refresh.test.ts:39](../../tests/tab-refresh.test.ts#L39) |

### Abas e visões

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | cada terminal abre o próprio grupo, com cor própria; um arquivo aberto à mão entra no grupo da visão em foco | Unidade | [tab-groups.test.ts:10](../../tests/tab-groups.test.ts#L10) |
| 2 | uma entrega abre no grupo do terminal dela sem tomar a tela, marcada como nova até ser vista | Unidade | [tab-groups.test.ts:23](../../tests/tab-groups.test.ts#L23) |
| 3 | divisão: o mesmo grupo em duas visões (terminal \| arquivo), ou outro grupo em cada uma | Unidade | [tab-groups.test.ts:35](../../tests/tab-groups.test.ts#L35) |
| 4 | arrastar um terminal para uma visão de outro grupo leva o grupo dele junto; um arquivo entra no grupo da visão | Unidade | [tab-groups.test.ts:59](../../tests/tab-groups.test.ts#L59) |
| 5 | grupos: renomear, colorir, mover um arquivo à mão, novo grupo; fechar abas e descartar um grupo vazio | Unidade | [tab-groups.test.ts:72](../../tests/tab-groups.test.ts#L72) |
| 6 | fechar a aba ativa mostra a vizinha; um arquivo renomeado mantém o lugar | Unidade | [tab-groups.test.ts:91](../../tests/tab-groups.test.ts#L91) |
| 7 | um quadro salvo volta conferido e perde o que não existe mais | Unidade | [tab-groups.test.ts:103](../../tests/tab-groups.test.ts#L103) |
| 8 | o estado da visão preserva a ordem das abas, o arquivo ativo e a rolagem sem cruzar os limites de workspace e projeto | Unidade | [workspace-view-state.test.ts:42](../../tests/workspace-view-state.test.ts#L42) |
| 9 | armazenamento malformado ou mais novo e localStorage indisponível voltam com segurança a abas vazias | Unidade | [workspace-view-state.test.ts:52](../../tests/workspace-view-state.test.ts#L52) |
| 10 | caminhos inválidos e abas duplicadas são descartados, a rolagem é limitada e uma aba ativa ausente tem alternativa | Unidade | [workspace-view-state.test.ts:63](../../tests/workspace-view-state.test.ts#L63) |
| 11 | só os metadados da visão são gravados: nenhum conteúdo, rascunho ou campo antigo é guardado | Unidade | [workspace-view-state.test.ts:82](../../tests/workspace-view-state.test.ts#L82) |

### Tema

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as configurações de tema mantêm a paleta do Moki e os modos da CLI e dos documentos independentes | Unidade | [theme.test.ts:46](../../tests/theme.test.ts#L46) |
| 2 | a preferência de tema antiga do Moki é migrada e as outras configurações usam padrões seguros | Unidade | [theme.test.ts:54](../../tests/theme.test.ts#L54) |
| 3 | as janelas já abertas acompanham a mudança de tema feita em outra janela, inclusive o reset | Unidade | [theme.test.ts:60](../../tests/theme.test.ts#L60) |

### Diálogos

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as confirmações esperam uma decisão explícita e o cancelamento não executa a ação | Unidade | [dialogs.test.ts:11](../../tests/dialogs.test.ts#L11) |
| 2 | aceitar uma confirmação a resolve uma vez, sem aceitar o próximo pedido da fila | Unidade | [dialogs.test.ts:27](../../tests/dialogs.test.ts#L27) |
| 3 | um aviso entra na fila como uma confirmação, e a mensagem continua como texto simples | Unidade | [dialogs.test.ts:44](../../tests/dialogs.test.ts#L44) |
| 4 | quem acompanha vê as mudanças da fila e deixa de receber depois de cancelar a assinatura | Unidade | [dialogs.test.ts:55](../../tests/dialogs.test.ts#L55) |

### Tags

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as tags compartilham contexto entre projetos; a abertura lista esse contexto e aplica as exclusões | Integração | [desktop.test.ts:892](../../tests/desktop.test.ts#L892) |
| 2 | uma regra só: sem tag = todos os projetos; a tag do próprio projeto; uma tag compartilhada | Unidade | [tags.test.ts:39](../../tests/tags.test.ts#L39) |
| 3 | agentes: as listas antigas por projeto viram tags, e cada projeto mantém exatamente o que tinha | Unidade | [tags.test.ts:46](../../tests/tags.test.ts#L46) |
| 4 | templates: os estilos antigos viram uma lista; cada projeto usa o padrão dele, senão o que não tem tag | Unidade | [tags.test.ts:67](../../tests/tags.test.ts#L67) |
| 5 | um arquivo-base fica ao lado do seu template, nunca vira o visual, é trocado no lugar e apagado junto | Unidade | [tags.test.ts:97](../../tests/tags.test.ts#L97) |
| 6 | visto de um projeto: como um item chega até ele, e ligar ou desligar ali pela tag do próprio projeto | Unidade | [tags.test.ts:123](../../tests/tags.test.ts#L123) |

### Abrir as ferramentas de IA

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | nenhum switch padrão está ligado nesta versão, e nenhum pode desligar a GPU | Unidade | [chromium-switches.test.ts:8](../../tests/chromium-switches.test.ts#L8) |
| 2 | sem QA_ELECTRON_ARGS nada é aplicado, então a GPU fica ligada | Unidade | [chromium-switches.test.ts:14](../../tests/chromium-switches.test.ts#L14) |
| 3 | o main.ts nunca desliga a GPU por conta própria | Unidade | [chromium-switches.test.ts:19](../../tests/chromium-switches.test.ts#L19) |
| 4 | com os padrões entregues (vazios) nada é aplicado sem o usuário pedir, exatamente como só com QA_ELECTRON_ARGS | Unidade | [chromium-switches.test.ts:24](../../tests/chromium-switches.test.ts#L24) |
| 5 | os padrões são aplicados, e o usuário soma switches com outros nomes | Unidade | [chromium-switches.test.ts:38](../../tests/chromium-switches.test.ts#L38) |
| 6 | o valor do usuário sobrescreve o padrão de mesmo nome, uma entrada por nome | Unidade | [chromium-switches.test.ts:44](../../tests/chromium-switches.test.ts#L44) |
| 7 | QA_NO_DEFAULT_SWITCHES=1, ou um QA_ELECTRON_ARGS que existe mas está em branco, desliga os padrões | Unidade | [chromium-switches.test.ts:49](../../tests/chromium-switches.test.ts#L49) |
| 8 | um padrão não permitido é rejeitado e reportado, nunca aplicado | Unidade | [chromium-switches.test.ts:63](../../tests/chromium-switches.test.ts#L63) |
| 9 | --in-process-gpu é permitido; --disable-gpu-compositing e --no-sandbox não são | Unidade | [chromium-switches.test.ts:71](../../tests/chromium-switches.test.ts#L71) |
| 10 | a linha de QA_PERF lista o que foi aplicado e se os padrões estavam ligados | Unidade | [chromium-switches.test.ts:77](../../tests/chromium-switches.test.ts#L77) |
| 11 | a abertura confere cada escolha contra listas fixas | Integração | [desktop.test.ts:635](../../tests/desktop.test.ts#L635) |
| 12 | chamar dentro de um terminal usa o pedido de abertura validado, sem abrir outra ferramenta | Integração | [desktop.test.ts:682](../../tests/desktop.test.ts#L682) |
| 13 | a abertura monta o pedido; arquivos Word são extraídos | Integração | [desktop.test.ts:879](../../tests/desktop.test.ts#L879) |
| 14 | plugins por projeto: o caveman é salvo no project.json e só chega às aberturas daquele projeto | Integração | [desktop.test.ts:1560](../../tests/desktop.test.ts#L1560) |
| 15 | pedidos com caracteres não ASCII chegam às ferramentas no Windows por um arquivo de pedido em UTF-8 | Integração | [desktop.test.ts:2522](../../tests/desktop.test.ts#L2522) |
| 16 | os plugins do app só carregam nas sessões do app: no Claude por pasta, no Codex como uma linha de instrução *(pulado no Windows)* | Integração | [desktop.test.ts:2533](../../tests/desktop.test.ts#L2533) |
| 17 | o lançador mantém o texto do usuário fora de qualquer linha de comando de shell | Unidade | [desktop.test.ts:2564](../../tests/desktop.test.ts#L2564) |
| 18 | planos de instalação: comandos fixos do fabricante por sistema para toda IA de terminal; editores são baixados, não instalados | Integração | [desktop.test.ts:2572](../../tests/desktop.test.ts#L2572) |
| 19 | uma ferramenta instalável ausente abre o run-tool na aba; o pedido leva a ferramenta e um argumento de prompt *(pulado no Windows)* | Integração | [desktop.test.ts:2589](../../tests/desktop.test.ts#L2589) |
| 20 | run-tool: uma ferramenta ausente mostra as instruções e pergunta; qualquer resposta diferente de y não instala nada *(pulado no Windows)* | Integração | [desktop.test.ts:2615](../../tests/desktop.test.ts#L2615) |
| 21 | as abas de terminal só iniciam a ferramenta escolhida, na raiz do framework, com o pedido como um único argumento *(pulado no Windows)* | Integração | [desktop.test.ts:2631](../../tests/desktop.test.ts#L2631) |
| 22 | QA_ELECTRON_ARGS: não definido, vazio ou em branco não aplica nada | Unidade | [electron-args.test.ts:5](../../tests/electron-args.test.ts#L5) |
| 23 | QA_ELECTRON_ARGS: as opções permitidas voltam sem os hífens iniciais, ignorando espaços extras | Unidade | [electron-args.test.ts:9](../../tests/electron-args.test.ts#L9) |
| 24 | QA_ELECTRON_ARGS: opções com valor o mantêm, inclusive um valor que tem o próprio = (--js-flags) | Unidade | [electron-args.test.ts:15](../../tests/electron-args.test.ts#L15) |
| 25 | QA_ELECTRON_ARGS: --in-process-gpu é permitido sem valor, e não com valor | Unidade | [electron-args.test.ts:25](../../tests/electron-args.test.ts#L25) |
| 26 | QA_ELECTRON_ARGS: uma opção insegura injetada é descartada e reportada, e a permitida continua | Unidade | [electron-args.test.ts:30](../../tests/electron-args.test.ts#L30) |
| 27 | QA_ELECTRON_ARGS: um item sem -- é rejeitado | Unidade | [electron-args.test.ts:38](../../tests/electron-args.test.ts#L38) |
| 28 | QA_ELECTRON_ARGS: opção sem valor ou com valor fora do esperado, valor vazio e valor inseguro são rejeitados | Unidade | [electron-args.test.ts:42](../../tests/electron-args.test.ts#L42) |
| 29 | QA_ELECTRON_ARGS: um item acima do limite de tamanho e itens além do limite de quantidade são rejeitados | Unidade | [electron-args.test.ts:47](../../tests/electron-args.test.ts#L47) |
| 30 | terminal-drop: os caminhos são digitados como arquivos soltos no terminal, com aspas quando necessário e espaço no fim | Unidade | [terminal-drop.test.ts:5](../../tests/terminal-drop.test.ts#L5) |
| 31 | terminal-drop: o Codex recebe o caminho da imagem como colagem; o Claude continua recebendo digitado | Unidade | [terminal-drop.test.ts:13](../../tests/terminal-drop.test.ts#L13) |
| 32 | terminal-drop: só uma colagem com imagens e sem texto é tratada como imagens | Unidade | [terminal-drop.test.ts:23](../../tests/terminal-drop.test.ts#L23) |
| 33 | os links do terminal atravessam linhas quebradas depois de um glifo largo e ficam na linha pedida | Unidade | [terminal-links.test.ts:7](../../tests/terminal-links.test.ts#L7) |
| 34 | os caminhos de projeto impressos incluem destinos Windows, Unix e Markdown codificados, não URLs | Unidade | [terminal-links.test.ts:25](../../tests/terminal-links.test.ts#L25) |
| 35 | os links copiados escapam rótulos e caminhos, mantendo a identidade do comentário a partir de qualquer documento | Unidade | [terminal-links.test.ts:32](../../tests/terminal-links.test.ts#L32) |
| 36 | a cauda da saída do terminal guarda só os últimos caracteres, entre blocos | Unidade | [terminals.test.ts:6](../../tests/terminals.test.ts#L6) |
| 37 | chamar dentro de um terminal de IA preserva o rascunho e nunca envia Enter nem controles do terminal | Unidade | [terminals.test.ts:28](../../tests/terminals.test.ts#L28) |
| 38 | chamar recusa outros projetos, shells, editores, terminais fechados e texto inválido | Unidade | [terminals.test.ts:45](../../tests/terminals.test.ts#L45) |
| 39 | a cauda da saída do terminal mantém a ordem em muitos blocos pequenos e grandes | Unidade | [terminals.test.ts:65](../../tests/terminals.test.ts#L65) |
| 40 | o agrupador da saída do terminal junta blocos num só envio, em ordem | Unidade | [terminals.test.ts:73](../../tests/terminals.test.ts#L73) |
| 41 | no agrupador da saída do terminal, o flush envia na hora e o cancel descarta o que espera | Unidade | [terminals.test.ts:85](../../tests/terminals.test.ts#L85) |
| 42 | o controle de fluxo do terminal pausa acima do limite alto e retoma abaixo do limite baixo | Unidade | [terminals.test.ts:105](../../tests/terminals.test.ts#L105) |
| 43 | o controle de fluxo do terminal nunca conta abaixo de zero e ignora confirmações não confiáveis | Unidade | [terminals.test.ts:122](../../tests/terminals.test.ts#L122) |
| 44 | o controle de fluxo do terminal retoma no reset, no release e no dispose, e depois fica livre | Unidade | [terminals.test.ts:135](../../tests/terminals.test.ts#L135) |
| 45 | o controle de fluxo do terminal retoma uma janela que não confirma nada, e volta a contar depois que ela confirma | Unidade | [terminals.test.ts:151](../../tests/terminals.test.ts#L151) |
| 46 | o controle de fluxo do terminal mantém pausada uma janela lenta mas que confirma, sem o tempo limite de travamento | Unidade | [terminals.test.ts:165](../../tests/terminals.test.ts#L165) |
| 47 | o controle de fluxo do terminal sobrevive a um processo que não consegue pausar nem retomar | Unidade | [terminals.test.ts:173](../../tests/terminals.test.ts#L173) |
| 48 | cada terminal recebe o próprio id como QA_TERMINAL, além do ambiente com que foi preparado | Unidade | [terminals.test.ts:183](../../tests/terminals.test.ts#L183) |

### Encontrar as ferramentas de IA

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | minhas IAs: caminho e versão das ferramentas instaladas, nada é executado para as que faltam | Integração | [desktop.test.ts:3165](../../tests/desktop.test.ts#L3165) |
| 2 | minhas IAs: a extensão do Moki da versão do app é baixada, conferida, instalada e o editor abre | Integração | [desktop.test.ts:3178](../../tests/desktop.test.ts#L3178) |
| 3 | o atalho da IDE instala uma vez e reutiliza a extensão compatível nas próximas aberturas | Integração | [desktop.test.ts:3192](../../tests/desktop.test.ts#L3192) |
| 4 | minhas IAs: só editores instalados que aceitam a extensão, e só um vsix que o GitHub garante | Integração | [desktop.test.ts:3203](../../tests/desktop.test.ts#L3203) |
| 5 | minhas IAs: num checkout, o vsix gerado em release/ é instalado sem download | Integração | [desktop.test.ts:3216](../../tests/desktop.test.ts#L3216) |
| 6 | minhas IAs: as ferramentas são achadas pelo PATH, mantidas enquanto ele é o mesmo, e o aiTools procura de novo | Integração | [desktop.test.ts:3261](../../tests/desktop.test.ts#L3261) |
| 7 | PATH: o PATH mais recente e as pastas de ferramentas de sempre se juntam ao atual, sem repetições | Unidade | [tool-path.test.ts:17](../../tests/tool-path.test.ts#L17) |
| 8 | PATH: as pastas globais do npm e dos instaladores estão entre as de sempre | Unidade | [tool-path.test.ts:26](../../tests/tool-path.test.ts#L26) |
| 9 | which: o primeiro executável no PATH, resolvido em JS (síncrono e assíncrono concordam) | Unidade | [tool-path.test.ts:34](../../tests/tool-path.test.ts#L34) |
| 10 | which: o Windows acrescenta o PATHEXT a menos que o nome já tenha um (simulado numa pasta POSIX) | Unidade | [tool-path.test.ts:52](../../tests/tool-path.test.ts#L52) |
| 11 | detectTools: o síncrono e o assíncrono acham as mesmas ferramentas de IA pelo PATH, sem iniciar um processo | Unidade | [tool-path.test.ts:66](../../tests/tool-path.test.ts#L66) |
| 12 | PATH: o shell é lido de forma assíncrona e do mesmo jeito que a leitura bloqueante, marcadores e ruído incluídos | Unidade | [tool-path.test.ts:82](../../tests/tool-path.test.ts#L82) |

### Atividades

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as ações do app e as atividades que vêm com o Moki: uma lista só, com os mesmos ids de antes | Unidade | [activities.test.ts:37](../../tests/activities.test.ts#L37) |
| 2 | o texto do pedido: linhas com {files} só com arquivos, linhas com {no-files} só sem, {project}; um texto vazio pede o alvo dela | Unidade | [activities.test.ts:46](../../tests/activities.test.ts#L46) |
| 3 | um arquivo é conferido: o que ele usa, a regra de arquivos, o id e o nome | Unidade | [activities.test.ts:56](../../tests/activities.test.ts#L56) |
| 4 | as suas atividades: salvas na biblioteca, chegam aos projetos por tags, nunca usam um id do Moki; favoritas | Unidade | [activities.test.ts:65](../../tests/activities.test.ts#L65) |
| 5 | serviço: Configurações lista, cria, duplica e exclui; um alvo que não existe é recusado | Integração | [activities.test.ts:81](../../tests/activities.test.ts#L81) |
| 6 | abrir: o texto da sua atividade, a atividade de um agente age como ele, a atividade de uma operação abre o formulário dela | Integração | [activities.test.ts:103](../../tests/activities.test.ts#L103) |
| 7 | abrir: "talk" é uma conversa com um agente, nunca listada onde se escolhe uma atividade | Integração | [activities.test.ts:121](../../tests/activities.test.ts#L121) |
| 8 | abrir: "skill" nomeia uma skill utilizável e fica fora da lista de atividades | Integração | [activities.test.ts:137](../../tests/activities.test.ts#L137) |
| 9 | atividades só de texto exigem um pedido, vão e voltam sem "uses" e mantêm os arquivos e as substituições do projeto | Unidade | [activities.test.ts:147](../../tests/activities.test.ts#L147) |
| 10 | várias skills vão e voltam em "uses", todas chegam ao pedido mesmo com texto próprio, e combinações inválidas são recusadas | Unidade | [activities.test.ts:169](../../tests/activities.test.ts#L169) |
| 11 | o serviço valida cada skill escolhida, mantém todas ao copiar e editar, e monta o mesmo pedido para a CLI | Unidade | [activities.test.ts:181](../../tests/activities.test.ts#L181) |
| 12 | uma segunda skill ainda planejada torna a atividade inteira indisponível no app e no menu do terminal | Unidade | [activities.test.ts:197](../../tests/activities.test.ts#L197) |
| 13 | um agente pode ficar sem skills: a validação, o salvamento do perfil e as atividades ainda mantêm o papel dele | Unidade | [activities.test.ts:208](../../tests/activities.test.ts#L208) |
| 14 | os pedidos de atividade são restaurados com fidelidade e correlacionados só pelo identificador exato | Unidade | [activity-launches.test.ts:5](../../tests/activity-launches.test.ts#L5) |

### Favoritos

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | uma lista por tipo, separadas, na ordem em que foram marcadas; desmarcar tira o item | Unidade | [favorites.test.ts:14](../../tests/favorites.test.ts#L14) |
| 2 | só os tipos conhecidos e ids seguros | Integração | [favorites.test.ts:31](../../tests/favorites.test.ts#L31) |
| 3 | mais usados: contados por tipo, os 5 primeiros, empates pelo id, ids inseguros ignorados | Unidade | [favorites.test.ts:41](../../tests/favorites.test.ts#L41) |

### Atividades e execuções

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | detalhes da execução e atividades em aberto | Integração | [desktop.test.ts:628](../../tests/desktop.test.ts#L628) |
| 2 | o rastreamento de atividade é opcional, validado e nunca cria uma execução | Integração | [desktop.test.ts:669](../../tests/desktop.test.ts#L669) |
| 3 | uma execução registra a atividade de origem; os pedidos e a árvore a mostram, e o cenário dela | Integração | [desktop.test.ts:711](../../tests/desktop.test.ts#L711) |
| 4 | a execução mostra seu título e só as entregas na árvore: estado, entradas, logs e pastas vazias ficam fora | Integração | [desktop.test.ts:739](../../tests/desktop.test.ts#L739) |
| 5 | npm run new-run grava --activity e recusa uma atividade que o projeto não vê | Integração | [desktop.test.ts:850](../../tests/desktop.test.ts#L850) |
| 6 | sobras: arquivos temporários antigos e arquivos auxiliares de execuções concluídas saem ao abrir o projeto; saídas não entregues são limpas sob pedido | Integração | [desktop.test.ts:2232](../../tests/desktop.test.ts#L2232) |
| 7 | limpeza após o contexto: as saídas de uma execução concluída vão para a lixeira só quando o projeto pede e todas as entregas estão em context/ | Integração | [desktop.test.ts:2272](../../tests/desktop.test.ts#L2272) |
| 8 | hudson: o novo nome mantém a extensão e não contém pasta | Integração | [hudson.test.ts:13](../../tests/hudson.test.ts#L13) |
| 9 | hudson: o pedido lista cada arquivo com sua execução e prévia e pede apenas JSON | Integração | [hudson.test.ts:21](../../tests/hudson.test.ts#L21) |
| 10 | hudson: aceita apenas arquivos listados com ação conhecida e mantém o que estiver incerto | Integração | [hudson.test.ts:30](../../tests/hudson.test.ts#L30) |
| 11 | hudson: o serviço oferece os arquivos deixados pelas execuções, sem estado, entradas ou registros, e aplica só os oferecidos | Integração | [hudson.test.ts:53](../../tests/hudson.test.ts#L53) |
| 12 | uma execução vinda de uma atividade é nomeada por ela e pelas palavras do slug | Unidade | [run-origin.test.ts:8](../../tests/run-origin.test.ts#L8) |
| 13 | um pedido feito direto à IA não tem atividade; o slug de acompanhamento do app não nomeia cenário | Unidade | [run-origin.test.ts:15](../../tests/run-origin.test.ts#L15) |
| 14 | uma atividade que não existe mais ainda nomeia as execuções dela (o id); ids estranhos ficam como estão | Unidade | [run-origin.test.ts:21](../../tests/run-origin.test.ts#L21) |

### Agentes

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | biblioteca de agentes: os agentes prontos são só leitura, as cópias são editáveis e validadas | Integração | [desktop.test.ts:938](../../tests/desktop.test.ts#L938) |
| 2 | agentes nas operações: entradas, saídas, servidores MCP e IA são lidos, validados e salvos | Integração | [desktop.test.ts:966](../../tests/desktop.test.ts#L966) |
| 3 | agentes por projeto: a lista de habilitados no project.json controla a abertura | Integração | [desktop.test.ts:1540](../../tests/desktop.test.ts#L1540) |
| 4 | agentes criados em Skills e agentes só usam skills instaladas na própria pasta | Integração | [desktop.test.ts:1768](../../tests/desktop.test.ts#L1768) |
| 5 | ${agent}: a atividade começa a descoberta sem arquivo e a CLI escolhe o mesmo papel | Integração | [specialists.test.ts:42](../../tests/specialists.test.ts#L42) |
| 6 | ${agent}: as fontes escolhidas ficam no projeto ativo | Integração | [specialists.test.ts:54](../../tests/specialists.test.ts#L54) |
| 7 | o api-tester continua utilizável independentemente do Sentinela | Integração | [specialists.test.ts:62](../../tests/specialists.test.ts#L62) |
| 8 | a escolha explícita de um especialista respeita a configuração de agentes do projeto | Integração | [specialists.test.ts:68](../../tests/specialists.test.ts#L68) |

### Operações multiagente

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | operações: uma linha de agentes; as setas passam as saídas, o resto vai para o formulário inicial; salvas na biblioteca | Integração | [desktop.test.ts:1036](../../tests/desktop.test.ts#L1036) |
| 2 | receita de operação Pente-fino: o revisor de rodadas e o Wiggins se encadeiam sem erro, pedindo só a MF no início | Integração | [desktop.test.ts:1095](../../tests/desktop.test.ts#L1095) |
| 3 | operações num projeto: vinculadas, iniciadas pelo formulário inicial, executadas passo a passo por arquivos | Integração | [desktop.test.ts:1116](../../tests/desktop.test.ts#L1116) |
| 4 | as operações desviam pelo resultado de um agente, voltam em loop até um limite e perguntam ao usuário quando nada serve | Integração | [desktop.test.ts:1225](../../tests/desktop.test.ts#L1225) |
| 5 | operações: um passo cujo terminal fecha falha até ser tentado de novo, um passo reprovado volta com os motivos, cancelar fecha o terminal | Integração | [desktop.test.ts:1325](../../tests/desktop.test.ts#L1325) |
| 6 | operações: a pergunta de um passo é respondida pelo Moki, no terminal dele ou reabrindo o passo quando o terminal não existe mais | Integração | [desktop.test.ts:1424](../../tests/desktop.test.ts#L1424) |
| 7 | operações: um passo cuja ferramenta de IA não abre falha uma vez (sem loop de tentativas) e é tentado de novo com outra IA | Integração | [desktop.test.ts:1484](../../tests/desktop.test.ts#L1484) |
| 8 | operações: na primeira vez, um exemplo no idioma do app; excluído, ele não volta | Integração | [desktop.test.ts:1524](../../tests/desktop.test.ts#L1524) |

### Skills e configuração

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | registro de skills: busca paginada, instalação verificada por projeto ou global, o pedido cita as skills do projeto | Integração | [desktop.test.ts:1723](../../tests/desktop.test.ts#L1723) |
| 2 | criar skill: a ferramenta de IA redige uma proposta no projeto; instalar copia a proposta revisada | Integração | [desktop.test.ts:1810](../../tests/desktop.test.ts#L1810) |
| 3 | aba global e tela inicial: lista, abre e remove (para a lixeira) só o que está instalado para todos os projetos | Integração | [desktop.test.ts:1841](../../tests/desktop.test.ts#L1841) |
| 4 | configurar: descrição e skills globais vinculadas por referência; os pedidos citam essas skills | Integração | [desktop.test.ts:1888](../../tests/desktop.test.ts#L1888) |
| 5 | configurar: as skills ArtCraft do framework podem ser vinculadas; os pedidos citam essas skills a partir da raiz do framework | Integração | [desktop.test.ts:1913](../../tests/desktop.test.ts#L1913) |
| 6 | configurar: o painel do projeto lista as skills e agentes que o projeto usa, da própria pasta, as globais que ele vincula e os padrões do Moki | Integração | [desktop.test.ts:1947](../../tests/desktop.test.ts#L1947) |
| 7 | configurar: uma skill ou um agente é digitado no terminal da IA sem Enter, só da lista do projeto, sem contexto compartilhado e sem execução | Integração | [desktop.test.ts:1961](../../tests/desktop.test.ts#L1961) |
| 8 | configurar: os arquivos do projeto vão para a IA, o contexto primeiro; pastas, nomes ocultos, credenciais e caminhos de fora são recusados | Integração | [desktop.test.ts:1984](../../tests/desktop.test.ts#L1984) |
| 9 | configurar: uma IA aberta sem escolha é avisada das skills e agentes do projeto; a aba não diz nada quando só eles existem | Integração | [desktop.test.ts:2015](../../tests/desktop.test.ts#L2015) |
| 10 | projeto em branco: sem arquivos de contexto de QA; o plano da IA é filtrado e aprovado em Configurar | Integração | [desktop.test.ts:2036](../../tests/desktop.test.ts#L2036) |
| 11 | envio de skills e agentes: a prévia não grava nada, bloqueia por item e instala só o que foi confirmado | Integração | [desktop.test.ts:2133](../../tests/desktop.test.ts#L2133) |
| 12 | trazer para um projeto: um envio encontra skills, agentes e atividades, põe no workspace para todos os projetos e vincula ao projeto | Integração | [desktop.test.ts:2303](../../tests/desktop.test.ts#L2303) |
| 13 | trazer para um projeto: mantidos só para o projeto, a skill e o agente ficam na pasta do projeto, sem vínculo, sem tag e sem registro | Integração | [desktop.test.ts:2360](../../tests/desktop.test.ts#L2360) |
| 14 | configurar: o painel do projeto lista um agente geral trazido por este projeto, e não um trazido por outro | Integração | [desktop.test.ts:2391](../../tests/desktop.test.ts#L2391) |
| 15 | envio por .zip: formatos aceitos, limites, caminhos inseguros, e uma falha desfaz tudo | Integração | [desktop.test.ts:2417](../../tests/desktop.test.ts#L2417) |
| 16 | envio de skills e agentes: agentes em subpastas de .claude/agents são oferecidos um a um, nomes repetidos são bloqueados e todos os escolhidos são instalados | Integração | [desktop.test.ts:2454](../../tests/desktop.test.ts#L2454) |
| 17 | envio de skills e agentes: marcar todos e desmarcar valem por grupo e nunca marcam um item bloqueado | Integração | [desktop.test.ts:2509](../../tests/desktop.test.ts#L2509) |
| 18 | configurar: uma skill ou um agente arrastado do painel só é aceito por um terminal do próprio projeto, e só como { kind, name } | Integração | [desktop.test.ts:3242](../../tests/desktop.test.ts#L3242) |

### Pasta vinculada

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | pasta vinculada: vincular registra a pasta e faz backup das configurações de IA dentro dela | Integração | [desktop.test.ts:1571](../../tests/desktop.test.ts#L1571) |
| 2 | abrir pasta: o nome é seu, a pasta aparece ao vivo na árvore como @folder e abre numa IDE | Integração | [desktop.test.ts:1624](../../tests/desktop.test.ts#L1624) |
| 3 | pasta vinculada: dá para criar um projeto a partir de uma pasta existente escolhida na janela | Integração | [desktop.test.ts:1683](../../tests/desktop.test.ts#L1683) |
| 4 | aba do repositório: instalações, agentes e remoções num .claude vinculado exigem confirmação e backup; writeAllowed: false recusa | Integração | [desktop.test.ts:2077](../../tests/desktop.test.ts#L2077) |

### Servidores MCP

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | MCPs: a última seção lista os servidores configurados onde as ferramentas de IA iniciam | Integração | [desktop.test.ts:284](../../tests/desktop.test.ts#L284) |
| 2 | um catálogo: os ids são estáveis e únicos, os nomes podem se repetir | Unidade | [mcp.test.ts:55](../../tests/mcp.test.ts#L55) |
| 3 | credenciais nunca são guardadas: só ${VARIAVEL} | Unidade | [mcp.test.ts:67](../../tests/mcp.test.ts#L67) |
| 4 | onde um servidor vale: global, ou só nos projetos escolhidos; desligado, não chega a nenhum projeto | Unidade | [mcp.test.ts:80](../../tests/mcp.test.ts#L80) |
| 5 | um agente recebe só os servidores que o contrato dele cita e que o projeto tem ligados | Unidade | [mcp.test.ts:95](../../tests/mcp.test.ts#L95) |
| 6 | importação: formatos Claude/Cursor, VS Code e mapas simples; credenciais viram variáveis | Unidade | [mcp.test.ts:101](../../tests/mcp.test.ts#L101) |
| 7 | configurações para o Claude Code e o Cursor; a mesclagem mantém as entradas da pessoa | Unidade | [mcp.test.ts:113](../../tests/mcp.test.ts#L113) |
| 8 | OAuth: um servidor HTTP mantém o cliente público dele para o Claude Code; nunca um segredo; nada muda sem ele | Unidade | [mcp.test.ts:126](../../tests/mcp.test.ts#L126) |
| 9 | OAuth: a importação mantém o cliente de uma configuração do Claude Code e deixa de fora o segredo do cliente | Unidade | [mcp.test.ts:146](../../tests/mcp.test.ts#L146) |
| 10 | as variáveis só são lidas quando um servidor inicia; quando falta uma, diz qual, nunca um valor | Unidade | [mcp.test.ts:154](../../tests/mcp.test.ts#L154) |
| 11 | o Claude Code aberto pelo Moki recebe --mcp-config com os servidores do projeto e o do próprio Moki | Integração | [mcp.test.ts:162](../../tests/mcp.test.ts#L162) |
| 12 | o Codex iniciado pelo Moki recebe os -c deste projeto e não grava uma variável como valor | Unidade | [mcp.test.ts:176](../../tests/mcp.test.ts#L176) |
| 13 | Gemini e Antigravity iniciados pelo Moki recebem os servidores deste projeto em <root>/.gemini/settings.json | Unidade | [mcp.test.ts:188](../../tests/mcp.test.ts#L188) |
| 14 | o Gemini iniciado pelo Moki recebe os agentes deste projeto em <root>/.gemini/agents e preserva um arquivo escrito pela pessoa | Unidade | [mcp.test.ts:204](../../tests/mcp.test.ts#L204) |
| 15 | uma skill de projeto que já está em .claude/skills é copiada para .agents/skills uma vez | Unidade | [mcp.test.ts:222](../../tests/mcp.test.ts#L222) |
| 16 | o Cursor aberto pelo Moki: as entradas moki do <raiz>/.cursor/mcp.json, mantendo as da pessoa | Integração | [mcp.test.ts:233](../../tests/mcp.test.ts#L233) |
| 17 | sincronizar com o Cursor na pasta vinculada: pergunta antes, respeita o writeAllowed, faz backup | Integração | [mcp.test.ts:241](../../tests/mcp.test.ts#L241) |
| 18 | Codex: o Moki grava só a própria região do .codex/config.toml; as tabelas da pessoa ficam; uma variável nunca é gravada como valor | Unidade | [mcp.test.ts:256](../../tests/mcp.test.ts#L256) |
| 19 | serviço: um catálogo com onde cada servidor vale, resultados dos testes guardados sem valores | Integração | [mcp.test.ts:284](../../tests/mcp.test.ts#L284) |
| 20 | uma execução de operação mantém os servidores com que começou | Integração | [mcp.test.ts:303](../../tests/mcp.test.ts#L303) |
| 21 | o IDE Companion lista os servidores ligados, sem comando nem variáveis | Integração | [mcp.test.ts:314](../../tests/mcp.test.ts#L314) |
| 22 | teste de conexão: um servidor stdio real (o do próprio Moki) e um HTTP | Integração | [mcp.test.ts:320](../../tests/mcp.test.ts#L320) |

### Ponte do app (IPC)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | os pedidos da interface só executam métodos do serviço e devolvem os erros como mensagens | Integração | [desktop.test.ts:2798](../../tests/desktop.test.ts#L2798) |

### Instalador

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | a sincronização do framework pelo instalador atualiza os arquivos do framework e nunca mexe em workspace/ | Integração | [desktop.test.ts:2751](../../tests/desktop.test.ts#L2751) |
| 2 | as cópias instaladas mantêm o framework no QA_ROOT, na pasta antiga ou em <Documentos>/Moki | Integração | [desktop.test.ts:2782](../../tests/desktop.test.ts#L2782) |

### Uso na barra de status

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as janelas de uso do plano do Claude vêm de limits[], com o modelo de um limite restrito | Unidade | [usage.test.ts:9](../../tests/usage.test.ts#L9) |
| 2 | as janelas de uso do plano do Codex são nomeadas pela duração | Unidade | [usage.test.ts:28](../../tests/usage.test.ts#L28) |
| 3 | um terminal conta a memória de tudo o que ele iniciou, uma vez só | Unidade | [usage.test.ts:35](../../tests/usage.test.ts#L35) |
| 4 | a memória é listada por projeto e, dentro dele, por terminal | Unidade | [usage.test.ts:42](../../tests/usage.test.ts#L42) |
| 5 | a lista de processos é lida uma vez por ttl, não a cada consulta | Unidade | [usage.test.ts:56](../../tests/usage.test.ts#L56) |
| 6 | o PSS vem da linha Pss do smaps_rollup, não de Rss nem de Pss_Anon | Unidade | [usage.test.ts:82](../../tests/usage.test.ts#L82) |
| 7 | o PSS de vários pids é lido em paralelo; um pid que não pode ser lido mantém o RSS | Unidade | [usage.test.ts:88](../../tests/usage.test.ts#L88) |
| 8 | o leitor de PSS é assíncrono: espera um leitor que ainda não respondeu | Unidade | [usage.test.ts:100](../../tests/usage.test.ts#L100) |
| 9 | no Linux a barra mede PSS do Moki e dos terminais, e mantém o RSS ao lado | Unidade | [usage.test.ts:109](../../tests/usage.test.ts#L109) |
| 10 | no macOS os números continuam RSS das mesmas fontes, e nenhum smaps_rollup é lido | Unidade | [usage.test.ts:128](../../tests/usage.test.ts#L128) |
| 11 | no Windows a barra mede bytes privados, o RSS continua sendo o conjunto de trabalho, e nenhum smaps_rollup é lido | Unidade | [usage.test.ts:141](../../tests/usage.test.ts#L141) |
| 12 | a coluna de kilobytes privados é lida quando existe e deixada de fora quando não existe | Unidade | [usage.test.ts:155](../../tests/usage.test.ts#L155) |
| 13 | o Moki aparece por papel, à parte das ferramentas de IA, cada um na medida da barra | Unidade | [usage.test.ts:161](../../tests/usage.test.ts#L161) |
| 14 | um número simples de bytes para o Moki continua aceito | Unidade | [usage.test.ts:182](../../tests/usage.test.ts#L182) |
| 15 | a árvore de um terminal lista seus processos uma vez, só os que existem | Unidade | [usage.test.ts:187](../../tests/usage.test.ts#L187) |
| 16 | no Linux o smaps_rollup real deste processo dá um PSS positivo que não passa do RSS | Unidade | [usage.test.ts:193](../../tests/usage.test.ts#L193) |

### Traduções

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | todo texto do app tem uma tradução em ${lang} | Unidade | [i18n.test.ts:36](../../tests/i18n.test.ts#L36) |
| 2 | as traduções em ${lang} mantêm os {placeholders} do texto em inglês | Unidade | [i18n.test.ts:46](../../tests/i18n.test.ts#L46) |
| 3 | ${expected.lang} é selecionado, gravado e restaurado com o idioma de conversa padrão certo | Unidade | [i18n.test.ts:83](../../tests/i18n.test.ts#L83) |
| 4 | trocar entre todos os idiomas da interface substitui o dicionário e preserva um idioma de conversa explícito | Unidade | [i18n.test.ts:100](../../tests/i18n.test.ts#L100) |
| 5 | um idioma guardado ausente ou sem suporte continua voltando ao inglês | Unidade | [i18n.test.ts:111](../../tests/i18n.test.ts#L111) |

### IDE: API do painel

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | só existem as chamadas do painel; o serviço inteiro nunca fica acessível | Integração | [companion-api.test.ts:81](../../tests/companion-api.test.ts#L81) |
| 2 | estado: o projeto conectado, a lista para trocar, os servidores MCP ligados | Integração | [companion-api.test.ts:88](../../tests/companion-api.test.ts#L88) |
| 3 | agentes: só os que o projeto usa | Integração | [companion-api.test.ts:96](../../tests/companion-api.test.ts#L96) |
| 4 | contexto: desligar um arquivo deixa ele fora dos pedidos e do que a IA lê | Integração | [companion-api.test.ts:101](../../tests/companion-api.test.ts#L101) |
| 5 | abrir: o Claude Code com o pedido, as exclusões e o --mcp-config, só para o projeto ativo | Integração | [companion-api.test.ts:114](../../tests/companion-api.test.ts#L114) |
| 6 | favoritos e mais usados: as estrelas são compartilhadas, uma abertura conta como uso, retomar não conta | Integração | [companion-api.test.ts:127](../../tests/companion-api.test.ts#L127) |
| 7 | copiar para o chat: o mesmo pedido copiado, nada é aberto | Integração | [companion-api.test.ts:138](../../tests/companion-api.test.ts#L138) |
| 8 | conectar ao Claude Code: pergunta antes, grava só as entradas do Moki, faz backup e esconde do Git | Integração | [companion-api.test.ts:147](../../tests/companion-api.test.ts#L147) |
| 9 | conectar ao Cursor e ao Codex pelo mesmo menu: cada um no próprio arquivo da pasta | Integração | [companion-api.test.ts:166](../../tests/companion-api.test.ts#L166) |
| 10 | sem projeto, o painel pede um | Integração | [companion-api.test.ts:178](../../tests/companion-api.test.ts#L178) |
| 11 | operações pelo painel: iniciadas, cada passo no próprio terminal, avançadas pelo loop | Integração | [companion-api.test.ts:186](../../tests/companion-api.test.ts#L186) |

### IDE: contexto e servidor MCP

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | a pasta aberta encontra o projeto dela: a pasta vinculada primeiro, subpastas também | Integração | [companion.test.ts:47](../../tests/companion.test.ts#L47) |
| 2 | recursos: contexto e notas do próprio projeto, o contexto compartilhado espera a pessoa, nenhum segredo | Integração | [companion.test.ts:56](../../tests/companion.test.ts#L56) |
| 3 | isolamento: ids de outros projetos ou caminhos fora são recusados | Integração | [companion.test.ts:75](../../tests/companion.test.ts#L75) |
| 4 | os fontes de diagramas são recursos de contexto legíveis, mantendo as regras de seleção compartilhada e de arquivos sensíveis | Integração | [companion.test.ts:84](../../tests/companion.test.ts#L84) |
| 5 | recursos manuais ficam escondidos até serem selecionados; os modos são salvos no companion.json | Integração | [companion.test.ts:124](../../tests/companion.test.ts#L124) |
| 6 | pacote de contexto: primeiro o texto selecionado, dentro do limite, depois as referências relacionadas | Integração | [companion.test.ts:141](../../tests/companion.test.ts#L141) |
| 7 | MCP: initialize, tools/list, tools/call, e toda chamada é registrada | Integração | [companion.test.ts:155](../../tests/companion.test.ts#L155) |
| 8 | MCP: a sessão fica presa a um projeto, ou explica por que não | Integração | [companion.test.ts:175](../../tests/companion.test.ts#L175) |
| 9 | servidor MCP por stdio | Integração | [companion.test.ts:187](../../tests/companion.test.ts#L187) |
| 10 | um PDF e um arquivo fora das pastas padrão continuam legíveis, e o contexto fica na frente | Integração | [companion.test.ts:203](../../tests/companion.test.ts#L203) |

### Ícone da IDE

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o gato da barra de status: um glifo em U+E000, nas medidas do codicon | Unidade | [icon-font.test.mjs:24](../../tests/icon-font.test.mjs#L24) |
| 2 | conversão dos caminhos: linhas, curvas e arcos terminam onde o SVG termina | Unidade | [icon-font.test.mjs:39](../../tests/icon-font.test.mjs#L39) |

### Framework

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o repositório real passa na validação | Integração | [framework.test.mjs:36](../../tests/framework.test.mjs#L36) |
| 2 | a cópia de teste passa na validação, incluindo os espelhos | Integração | [framework.test.mjs:40](../../tests/framework.test.mjs#L40) |
| 3 | o validador recusa problemas de estrutura | Unidade | [framework.test.mjs:45](../../tests/framework.test.mjs#L45) |
| 4 | o validador confere os workflows | Unidade | [framework.test.mjs:71](../../tests/framework.test.mjs#L71) |
| 5 | o validador aceita atividades só de texto e confere cada skill de uma atividade combinada | Unidade | [framework.test.mjs:92](../../tests/framework.test.mjs#L92) |
| 6 | a divergência das cópias geradas é detectada | Unidade | [framework.test.mjs:106](../../tests/framework.test.mjs#L106) |
| 7 | leitor de frontmatter | Unidade | [framework.test.mjs:117](../../tests/framework.test.mjs#L117) |
| 8 | agentes só leitura viram subagentes do Claude Code sem as ferramentas de edição | Unidade | [framework.test.mjs:125](../../tests/framework.test.mjs#L125) |
| 9 | os agentes do framework servem só para desenvolver o Moki: nenhum projeto pode usá-los | Unidade | [framework.test.mjs:133](../../tests/framework.test.mjs#L133) |
| 10 | verificação de artefatos | Unidade | [framework.test.mjs:140](../../tests/framework.test.mjs#L140) |
| 11 | verificação de segredos | Unidade | [framework.test.mjs:157](../../tests/framework.test.mjs#L157) |
| 12 | schema do estado das execuções | Unidade | [framework.test.mjs:170](../../tests/framework.test.mjs#L170) |
| 13 | ida e volta de xlsx e aviso de planilha ausente | Unidade | [framework.test.mjs:191](../../tests/framework.test.mjs#L191) |
| 14 | o preenchimento de xlsx mantém o modelo, limpa as linhas de exemplo e mapeia os cabeçalhos | Unidade | [framework.test.mjs:203](../../tests/framework.test.mjs#L203) |
| 15 | docx: imagens, links, marcadores e modelos de exemplo | Unidade | [framework.test.mjs:217](../../tests/framework.test.mjs#L217) |
| 16 | verificação das saídas | Unidade | [framework.test.mjs:241](../../tests/framework.test.mjs#L241) |
| 17 | assistente qa: atividades, pedidos, caminhos, cópias para a entrada | Integração | [framework.test.mjs:259](../../tests/framework.test.mjs#L259) |
| 18 | Markdown: listas aninhadas, títulos setext, linhas horizontais e links automáticos | Unidade | [framework.test.mjs:287](../../tests/framework.test.mjs#L287) |
| 19 | os diagramas do markdown ficam escapados até o app desenhá-los | Unidade | [framework.test.mjs:303](../../tests/framework.test.mjs#L303) |
| 20 | Markdown para HTML | Unidade | [framework.test.mjs:312](../../tests/framework.test.mjs#L312) |
| 21 | bateria de memória: smaps_rollup dá RSS, PSS e USS (privada limpa + suja) em kB | Unidade | [perf-proc-stats.test.ts:16](../../tests/perf-proc-stats.test.ts#L16) |
| 22 | bateria de memória: um texto sem linha Pss não é uma leitura | Unidade | [perf-proc-stats.test.ts:20](../../tests/perf-proc-stats.test.ts#L20) |
| 23 | bateria de memória: readProc recorre ao RSS do statm (pss e uss desconhecidos) e a zero quando nada é legível | Unidade | [perf-proc-stats.test.ts:25](../../tests/perf-proc-stats.test.ts#L25) |
| 24 | bateria de memória: os tipos de processo do Electron viram os grupos do relatório, o resto é other | Unidade | [perf-proc-stats.test.ts:33](../../tests/perf-proc-stats.test.ts#L33) |
| 25 | bateria de memória: os processos são somados por grupo e no total, um campo que ninguém tinha fica null | Unidade | [perf-proc-stats.test.ts:37](../../tests/perf-proc-stats.test.ts#L37) |
| 26 | bateria de memória: a mediana de várias leituras é tirada por grupo e campo, e vira bt_<grupo>_<campo>_mb | Unidade | [perf-proc-stats.test.ts:49](../../tests/perf-proc-stats.test.ts#L49) |
| 27 | bateria de memória: a quebra do compare lista cada grupo e campo com a variação em MB e % | Unidade | [perf-proc-stats.test.ts:57](../../tests/perf-proc-stats.test.ts#L57) |

### Documentação

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | toda página do docs/wiki.json é gerada, com a Home, a barra lateral e o rodapé | Unidade | [wiki.test.mjs:12](../../tests/wiki.test.mjs#L12) |
| 2 | a página inicial vem do documento de início nos dois idiomas, com créditos de código aberto e navegação bilíngue | Unidade | [wiki.test.mjs:20](../../tests/wiki.test.mjs#L20) |
| 3 | os links viram páginas da wiki ou links do GitHub; uma página diz onde é editada e aponta para a tradução | Unidade | [wiki.test.mjs:33](../../tests/wiki.test.mjs#L33) |
| 4 | outra branch recebe o aviso de versão em desenvolvimento; um link quebrado para a geração | Unidade | [wiki.test.mjs:49](../../tests/wiki.test.mjs#L49) |

### Configurador

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o plano mantém só tipos conhecidos com dados em objeto; passos de rotina e de projeto exigem um projeto | Unidade | [configurator.test.ts:29](../../tests/configurator.test.ts#L29) |
| 2 | aplicar usa as validações do app: os passos válidos são feitos e um inválido falha sozinho, com o motivo | Integração | [configurator.test.ts:49](../../tests/configurator.test.ts#L49) |
| 3 | npm run configure aplica um arquivo de plano pelo terminal do mesmo jeito | Integração | [configurator.test.ts:64](../../tests/configurator.test.ts#L64) |

### Download dos apps ArtCraft

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | apps Craft: lista fixa com ids únicos e um repositório storytold | Unidade | [desktop.test.ts:2958](../../tests/desktop.test.ts#L2958) |
| 2 | apps Craft: família de pacotes do Linux lida do os-release | Unidade | [desktop.test.ts:2965](../../tests/desktop.test.ts#L2965) |
| 3 | apps Craft: os arquivos de cada sistema, o recomendado primeiro, e só nomes exatos | Unidade | [desktop.test.ts:2977](../../tests/desktop.test.ts#L2977) |
| 4 | download Craft: lista os 16 apps e mostra o que seria baixado | Integração | [desktop.test.ts:3032](../../tests/desktop.test.ts#L3032) |
| 5 | download Craft: o digest do GitHub confere e a pasta é mostrada | Integração | [desktop.test.ts:3043](../../tests/desktop.test.ts#L3043) |
| 6 | download Craft: o SHA256SUMS.txt é usado quando não há digest | Integração | [desktop.test.ts:3054](../../tests/desktop.test.ts#L3054) |
| 7 | download Craft: sem digest e sem checksum listado, recusa antes do diálogo | Integração | [desktop.test.ts:3060](../../tests/desktop.test.ts#L3060) |
| 8 | download Craft: um hash que não confere remove o arquivo | Integração | [desktop.test.ts:3068](../../tests/desktop.test.ts#L3068) |
| 9 | download Craft: erros do GitHub e falta de rede dizem o que fazer | Integração | [desktop.test.ts:3074](../../tests/desktop.test.ts#L3074) |
| 10 | download Craft: sem arquivo para este sistema, e nomes inseguros são ignorados | Integração | [desktop.test.ts:3084](../../tests/desktop.test.ts#L3084) |
| 11 | download Craft: no Fedora se oferece rpm primeiro, AppImage depois, nunca deb nem nomes desconhecidos | Integração | [desktop.test.ts:3090](../../tests/desktop.test.ts#L3090) |
| 12 | download Craft: uma versão mais nova depois da revisão, e um diálogo cancelado | Integração | [desktop.test.ts:3109](../../tests/desktop.test.ts#L3109) |
| 13 | download Craft: a URL é montada pelo Moki, a extensão é acrescentada, uma gravação que falha não deixa nada | Integração | [desktop.test.ts:3119](../../tests/desktop.test.ts#L3119) |

### Diagrams

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | revisões de diagramas e comentários antigos de HTML reabrem do mesmo armazenamento, sem alterar os fontes | Integração | [diagram-comments.test.ts:23](../../tests/diagram-comments.test.ts#L23) |
| 2 | as conversas do diagrama preservam autor, âncora original e datas em edições, respostas, cores e resolução | Integração | [diagram-comments.test.ts:37](../../tests/diagram-comments.test.ts#L37) |
| 3 | mudanças no fonte mantêm todas as âncoras da revisão, e a visualização salva registra o fonte atual à parte | Integração | [diagram-comments.test.ts:52](../../tests/diagram-comments.test.ts#L52) |
| 4 | registros só de visualização reabrem, acompanham renomeações de arquivo e pasta e sobrevivem à remoção do último comentário | Integração | [diagram-comments.test.ts:65](../../tests/diagram-comments.test.ts#L65) |
| 5 | as APIs de HTML e de diagrama recusam as âncoras uma da outra e nunca editam outro tipo de revisão | Integração | [diagram-comments.test.ts:80](../../tests/diagram-comments.test.ts#L80) |
| 6 | os contratos do diagrama recusam hashes, coordenadas, regiões, cores, valores de resolução e limites de visualização malformados | Integração | [diagram-comments.test.ts:95](../../tests/diagram-comments.test.ts#L95) |
| 7 | a visualização e as âncoras gravadas contêm só o contrato revisado, sem fonte nem rascunhos enviados por quem chama | Integração | [diagram-comments.test.ts:110](../../tests/diagram-comments.test.ts#L110) |
| 8 | os limites antigos de comentários e respostas também protegem as revisões de diagramas, e dados gravados malformados não são substituídos | Integração | [diagram-comments.test.ts:121](../../tests/diagram-comments.test.ts#L121) |
| 9 | extensões de diagrama aparecem como fonte somente leitura, e ler um arquivo nunca chama um renderizador | Integração | [diagram-render.test.ts:37](../../tests/diagram-render.test.ts#L37) |
| 10 | as configurações do Kroki ficam no seu projeto, e enviar o fonte para fora exige consentimento explícito com HTTPS | Integração | [diagram-render.test.ts:63](../../tests/diagram-render.test.ts#L63) |
| 11 | o Kroki recebe por POST só fonte sintético nas quatro rotas SVG fixas, com respostas de tamanho limitado | Integração | [diagram-render.test.ts:83](../../tests/diagram-render.test.ts#L83) |
| 12 | redirecionamentos, respostas que não são SVG, corpos grandes, erros HTTP e tempo esgotado falham sem alternativa | Integração | [diagram-render.test.ts:102](../../tests/diagram-render.test.ts#L102) |
| 13 | carregadores de recursos no fonte são recusados antes de renderizar, e o Mermaid local não faz chamada HTTP | Integração | [diagram-render.test.ts:125](../../tests/diagram-render.test.ts#L125) |
| 14 | a exportação SVG aceita primitivas de desenho e referências locais, mas recusa XML ativo, CSS e namespaces | Integração | [diagram-render.test.ts:145](../../tests/diagram-render.test.ts#L145) |
| 15 | exportar e copiar validam PNGs e SVGs, usam destinos nativos e preservam o fonte | Integração | [diagram-render.test.ts:155](../../tests/diagram-render.test.ts#L155) |
| 16 | o serviço de diagramas limita renderizações simultâneas no Kroki e libera as vagas ao terminar | Integração | [diagram-render.test.ts:184](../../tests/diagram-render.test.ts#L184) |
| 17 | ajustar e dar zoom manual no diagrama respeitam a faixa de ampliação suportada | Unidade | [diagram-viewport.test.ts:5](../../tests/diagram-viewport.test.ts#L5) |
| 18 | o zoom em volta do cursor preserva as coordenadas normalizadas do diagrama | Unidade | [diagram-viewport.test.ts:14](../../tests/diagram-viewport.test.ts#L14) |
| 19 | os comentários do diagrama usam limites normalizados, sem depender da posição da visualização | Unidade | [diagram-viewport.test.ts:24](../../tests/diagram-viewport.test.ts#L24) |

### Routines

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | a próxima execução diária é às 08:00 naquele fuso, inclusive no horário de verão | Unidade | [routines.test.ts:48](../../tests/routines.test.ts#L48) |
| 2 | um horário perdido roda uma vez; "pular" e "próxima" ainda rodam um horário em dia | Unidade | [routines.test.ts:52](../../tests/routines.test.ts#L52) |
| 3 | dias da semana, fim de mês e intervalos usam os valores configurados | Unidade | [routines.test.ts:61](../../tests/routines.test.ts#L61) |
| 4 | a primeira leitura é a linha de base; conteúdo idêntico conta como inalterado | Unidade | [routines.test.ts:66](../../tests/routines.test.ts#L66) |
| 5 | um item alterado inicia a IA em segundo plano e só fica para revisão depois da análise entregue | Integração | [routines.test.ts:73](../../tests/routines.test.ts#L73) |
| 6 | as preferências de aviso interno e do sistema são independentes | Integração | [routines.test.ts:97](../../tests/routines.test.ts#L97) |
| 7 | trocar de workspace interrompe a verificação sem gravar no outro workspace | Integração | [routines.test.ts:109](../../tests/routines.test.ts#L109) |
| 8 | uma edição feita durante uma leitura agendada é preservada | Integração | [routines.test.ts:125](../../tests/routines.test.ts#L125) |
| 9 | um limite de IA zero é mantido e impede iniciar a IA sem perder a mudança | Integração | [routines.test.ts:134](../../tests/routines.test.ts#L134) |
| 10 | um conflito no segundo arquivo deixa os dois arquivos intactos | Integração | [routines.test.ts:145](../../tests/routines.test.ts#L145) |
| 11 | as mudanças exatas revisadas podem ser aplicadas, inclusive texto vazio; o registro não vira outra proposta | Integração | [routines.test.ts:158](../../tests/routines.test.ts#L158) |
| 12 | ids de proposta inválidos e arquivos executáveis como destino são recusados | Integração | [routines.test.ts:170](../../tests/routines.test.ts#L170) |
| 13 | uma análise que falhou não pode virar proposta aprovável | Integração | [routines.test.ts:181](../../tests/routines.test.ts#L181) |
| 14 | arquivar mantém o histórico e tira a rotina da lista de ativas | Integração | [routines.test.ts:189](../../tests/routines.test.ts#L189) |
| 15 | uma aplicação de arquivos interrompida retoma pelo registro sem repetir gravações | Integração | [routines.test.ts:197](../../tests/routines.test.ts#L197) |
| 16 | um erro da ferramenta MCP é uma leitura que falhou e nunca vira linha de base | Integração | [routines.test.ts:211](../../tests/routines.test.ts#L211) |
| 17 | uma consulta acompanha todos os registros que devolve (novos, alterados e removidos), com o nome do projeto nos parâmetros | Integração | [routines.test.ts:219](../../tests/routines.test.ts#L219) |
| 18 | uma fonte de pasta mostra arquivos novos, editados e apagados e recusa caminhos fora do projeto | Integração | [routines.test.ts:237](../../tests/routines.test.ts#L237) |
| 19 | uma fonte de arquivos acompanha só os arquivos que ela cita | Integração | [routines.test.ts:255](../../tests/routines.test.ts#L255) |

## Testes de interface

Rodam com `npm run test:ui`. Cada área é um bloco de `tests/ui/app.spec.ts`; os cenários dela rodam em ordem, na mesma janela.

###  (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o Moki restaura as abas de documentos, o modo ativo e a rolagem depois de sair, recarregar e apagar um arquivo | Interface | [ui/app.spec.ts:64](../../tests/ui/app.spec.ts#L64) |
| 2 | o Moki restaura a rolagem depois que as páginas do PDF carregam de forma assíncrona | Interface | [ui/app.spec.ts:137](../../tests/ui/app.spec.ts#L137) |
| 3 | as notas rápidas do Moki continuam disponíveis sobre um projeto, a barra lateral recolhida e as configurações, sem trocar a tela atual | Interface | [ui/app.spec.ts:164](../../tests/ui/app.spec.ts#L164) |
| 4 | as confirmações com o tema do Moki esperam uma decisão, prendem o foco e preservam o arquivo quando canceladas | Interface | [ui/app.spec.ts:246](../../tests/ui/app.spec.ts#L246) |
| 5 | os diálogos do Moki seguem todas as paletas nos dois modos e atualizam um caderno já aberto | Interface | [ui/app.spec.ts:310](../../tests/ui/app.spec.ts#L310) |

### Configurações (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | Templates rola e os controles dela têm o mesmo tamanho | Interface | [ui/app.spec.ts:392](../../tests/ui/app.spec.ts#L392) |
| 2 | um logo escolhido aparece no formulário e na prévia | Interface | [ui/app.spec.ts:414](../../tests/ui/app.spec.ts#L414) |
| 3 | um texto de marca d'água aparece na página de prévia | Interface | [ui/app.spec.ts:423](../../tests/ui/app.spec.ts#L423) |
| 4 | templates são uma lista: um novo, marcado com um projeto, vale só para ele | Interface | [ui/app.spec.ts:428](../../tests/ui/app.spec.ts#L428) |
| 5 | Skills é uma lista como as outras abas: abas de filtro, busca, um detalhe; Adicionar skill tem página própria | Interface | [ui/app.spec.ts:451](../../tests/ui/app.spec.ts#L451) |
| 6 | um agente mostra o que precisa e entrega; a sua cópia edita isso, incluindo MCPs e IA | Interface | [ui/app.spec.ts:475](../../tests/ui/app.spec.ts#L475) |
| 7 | o seu agente: descrição e instruções em campos de texto, skills buscadas e acrescentadas, um Salvar só; as tags dizem a quais projetos ele chega | Interface | [ui/app.spec.ts:501](../../tests/ui/app.spec.ts#L501) |
| 8 | uma operação liga agentes com setas: aprovação, qual saída responde qual entrada, salva na lista | Interface | [ui/app.spec.ts:550](../../tests/ui/app.spec.ts#L550) |

### Tags (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | uma tag de projeto traz o outro projeto para o contexto da atividade | Interface | [ui/app.spec.ts:692](../../tests/ui/app.spec.ts#L692) |
| 2 | o ES traduz o seletor de workspace e o resto do app, sobrevive ao recarregar e mantém o EN e o PT-BR funcionando | Interface | [ui/app.spec.ts:718](../../tests/ui/app.spec.ts#L718) |

### Workspaces (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o app abre na escolha de workspace; um workspace novo abre vazio e dá para voltar ao anterior | Interface | [ui/app.spec.ts:784](../../tests/ui/app.spec.ts#L784) |
| 2 | um projeto oculto só é excluído de vez depois de digitar delete | Interface | [ui/app.spec.ts:844](../../tests/ui/app.spec.ts#L844) |
| 3 | criar um projeto abre direto, sem configuração nem planejamento por IA | Interface | [ui/app.spec.ts:867](../../tests/ui/app.spec.ts#L867) |
| 4 | uma nota avulsa é criada pela barra fixa; as notas salvas abrem no app e nas abas do caderno | Interface | [ui/app.spec.ts:882](../../tests/ui/app.spec.ts#L882) |

### Árvore do projeto (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o clique direito num item da árvore copia o caminho completo dele | Interface | [ui/app.spec.ts:947](../../tests/ui/app.spec.ts#L947) |
| 2 | o menu ⋯ cria um arquivo que abre pronto para escrever, e uma pasta na raiz do projeto | Interface | [ui/app.spec.ts:957](../../tests/ui/app.spec.ts#L957) |
| 3 | a barra lateral é em blocos: pastas, Acompanhamento e Outros arquivos, depois Configurações do projeto e MCPs; o card de Operações fica no painel do projeto | Interface | [ui/app.spec.ts:993](../../tests/ui/app.spec.ts#L993) |
| 4 | a barra lateral de arquivos redimensiona, recolhe e lembra a largura dela independentemente do painel da direita | Interface | [ui/app.spec.ts:1033](../../tests/ui/app.spec.ts#L1033) |
| 5 | uma pasta vinculada aparece primeiro na árvore, ao vivo, com Abrir na IDE; os arquivos dela abrem no app | Interface | [ui/app.spec.ts:1088](../../tests/ui/app.spec.ts#L1088) |
| 6 | digitar / numa nota lista os comandos de formatação; um checklist continua no Enter | Interface | [ui/app.spec.ts:1116](../../tests/ui/app.spec.ts#L1116) |
| 7 | a estrela transforma uma nota numa favorita dourada, a primeira da pasta de notas | Interface | [ui/app.spec.ts:1162](../../tests/ui/app.spec.ts#L1162) |
| 8 | uma nota do projeto abre dentro do app, e no caderno dele com cada nota do projeto como uma aba | Interface | [ui/app.spec.ts:1194](../../tests/ui/app.spec.ts#L1194) |

### Operações num projeto (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | uma operação é iniciada pelo formulário e avança conforme cada agente entrega os arquivos | Interface | [ui/app.spec.ts:1271](../../tests/ui/app.spec.ts#L1271) |
| 2 | uma operação começa pelo cartão do assistente: os passos mantêm o agente e cada IA é trocada com a mesma escolha | Interface | [ui/app.spec.ts:1374](../../tests/ui/app.spec.ts#L1374) |
| 3 | o resultado escolhe a seta: rejected vai para o fixer e volta para a revisão; sem resultado válido, pergunta ao usuário | Interface | [ui/app.spec.ts:1398](../../tests/ui/app.spec.ts#L1398) |

### Terminais que continuam fora do projeto (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | sair do projeto não fecha o terminal dele; abrir o projeto de novo traz a aba de volta | Interface | [ui/app.spec.ts:1459](../../tests/ui/app.spec.ts#L1459) |
| 2 | o + das abas abre categorias no lugar; Arquivo cria uma planilha vazia na Entrada e a mostra | Interface | [ui/app.spec.ts:1482](../../tests/ui/app.spec.ts#L1482) |
| 3 | o menu + fica dentro da janela quando o + está na borda direita, em todos os níveis | Interface | [ui/app.spec.ts:1504](../../tests/ui/app.spec.ts#L1504) |
| 4 | o menu + oferece os apps ArtCraft: 16 apps, o lançador primeiro e um botão Baixar para cada um | Interface | [ui/app.spec.ts:1531](../../tests/ui/app.spec.ts#L1531) |

### Lista de servidores MCP (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | um servidor fica global ou é dado a projetos escolhidos a partir da linha dele | Interface | [ui/app.spec.ts:1567](../../tests/ui/app.spec.ts#L1567) |
| 2 | um servidor HTTP aceita um cliente OAuth opcional (id e porta de retorno) em Headers, salvo sem nenhum segredo | Interface | [ui/app.spec.ts:1604](../../tests/ui/app.spec.ts#L1604) |

### Comentários em PDF (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | todo controle da barra de ferramentas do PDF tem a mesma altura | Interface | [ui/app.spec.ts:1697](../../tests/ui/app.spec.ts#L1697) |
| 2 | uma seleção é comentada direto na página; o comentário fica ao lado, ligado por uma linha | Interface | [ui/app.spec.ts:1710](../../tests/ui/app.spec.ts#L1710) |
| 3 | notas podem ser inseridas entre páginas do PDF, editadas e restauradas | Interface | [ui/app.spec.ts:1770](../../tests/ui/app.spec.ts#L1770) |
| 4 | um arquivo .md abre no editor e é comentado ali; o comentário fica dentro do arquivo, invisível para outros leitores | Interface | [ui/app.spec.ts:1851](../../tests/ui/app.spec.ts#L1851) |
| 5 | a edição visual de Markdown mantém títulos, negrito, listas e quebras de linha do Windows | Interface | [ui/app.spec.ts:1915](../../tests/ui/app.spec.ts#L1915) |
| 6 | a edição visual preserva o espaçamento original e os comentários quando um título encosta numa lista | Interface | [ui/app.spec.ts:1943](../../tests/ui/app.spec.ts#L1943) |
| 7 | a edição visual preserva títulos e lista adjacentes com quebras de linha do Windows | Interface | [ui/app.spec.ts:1966](../../tests/ui/app.spec.ts#L1966) |
| 8 | o visualizador nativo tem ícone e as propriedades do PDF continuam visíveis e são salvas | Interface | [ui/app.spec.ts:1978](../../tests/ui/app.spec.ts#L1978) |

### Atividades (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | uma atividade nova é criada em Configurações, marcada com estrela, e aparece primeiro ao abrir a ferramenta de IA | Interface | [ui/app.spec.ts:2034](../../tests/ui/app.spec.ts#L2034) |
| 2 | atividades só de texto exigem um pedido e o mantêm na edição | Interface | [ui/app.spec.ts:2061](../../tests/ui/app.spec.ts#L2061) |
| 3 | várias skills sobrevivem ao salvar e reabrir, e o pedido preparado inclui todas | Interface | [ui/app.spec.ts:2081](../../tests/ui/app.spec.ts#L2081) |
| 4 | um agente pode ser criado com instruções e sem skills | Interface | [ui/app.spec.ts:2105](../../tests/ui/app.spec.ts#L2105) |

### Configurações sem projeto (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | Skills lista as skills do Moki; sem projeto, só o envio de skills adiciona (para todos os projetos) | Interface | [ui/app.spec.ts:2137](../../tests/ui/app.spec.ts#L2137) |

### Favoritos (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | agentes, operações, templates e skills são marcados com estrela pelo card e aparecem primeiro | Interface | [ui/app.spec.ts:2183](../../tests/ui/app.spec.ts#L2183) |

### Minhas IAs e o painel do projeto (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | a IA padrão é definida em Minhas IAs e uma atividade que escolhe outra a mantém | Interface | [ui/app.spec.ts:2229](../../tests/ui/app.spec.ts#L2229) |
| 2 | um catálogo Chamar lista atividades, agentes, skills e operações por tipo | Interface | [ui/app.spec.ts:2266](../../tests/ui/app.spec.ts#L2266) |
| 3 | a busca do catálogo Chamar conta resultados por tipo e informa quando não encontra nada | Interface | [ui/app.spec.ts:2284](../../tests/ui/app.spec.ts#L2284) |
| 4 | o painel mostra o nome e a descrição do projeto; eles são editados nas configurações do projeto | Interface | [ui/app.spec.ts:2299](../../tests/ui/app.spec.ts#L2299) |
| 5 | um pedido de atividade aparece nas execuções e acompanha a execução registrada | Interface | [ui/app.spec.ts:2319](../../tests/ui/app.spec.ts#L2319) |
| 6 | chamar uma atividade mantém os arquivos obrigatórios, o agente opcional e as escolhas de destino | Interface | [ui/app.spec.ts:2350](../../tests/ui/app.spec.ts#L2350) |

### Painel de detalhes da execução (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o cartão de execuções mostra todas as execuções concluídas de atividades e operações nas abas certas | Interface | [ui/app.spec.ts:2371](../../tests/ui/app.spec.ts#L2371) |
| 2 | mostra só a atividade ou operação selecionada e distingue nomes de arquivo repetidos | Interface | [ui/app.spec.ts:2407](../../tests/ui/app.spec.ts#L2407) |

### Renomear na árvore (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | Renomear digita o nome sobre a linha, mantém a extensão, e a aba aberta acompanha com o texto | Interface | [ui/app.spec.ts:2500](../../tests/ui/app.spec.ts#L2500) |
| 2 | F2 inicia o renomear e Esc volta; um nome recusado é explicado sob a linha e o campo continua aberto | Interface | [ui/app.spec.ts:2538](../../tests/ui/app.spec.ts#L2538) |
| 3 | uma nota é renomeada pelo título: o arquivo dela, e os links para ele, continuam | Interface | [ui/app.spec.ts:2567](../../tests/ui/app.spec.ts#L2567) |
| 4 | o que mantém o nome mostra Renomear desativado, com o motivo embaixo; F2 ali explica o porquê | Interface | [ui/app.spec.ts:2581](../../tests/ui/app.spec.ts#L2581) |

### Renomear na tela inicial (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | uma nota avulsa é renomeada pelo menu de contexto, no lugar, sem mudar de posição na lista | Interface | [ui/app.spec.ts:2651](../../tests/ui/app.spec.ts#L2651) |
| 2 | uma nota de projeto é renomeada pelo título (F2), e o arquivo dela continua | Interface | [ui/app.spec.ts:2671](../../tests/ui/app.spec.ts#L2671) |
| 3 | um projeto ganha um novo nome; a pasta e o id continuam | Interface | [ui/app.spec.ts:2687](../../tests/ui/app.spec.ts#L2687) |

### Seleção no Markdown (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | selecionar desde o início não move nada: o botão Comentar flutua, desativado, com o motivo | Interface | [ui/app.spec.ts:2731](../../tests/ui/app.spec.ts#L2731) |
| 2 | uma seleção dentro de um parágrafo ainda é copiada com Ctrl+C; a caixa só abre pelo botão | Interface | [ui/app.spec.ts:2746](../../tests/ui/app.spec.ts#L2746) |
| 3 | o botão some quando a seleção some | Interface | [ui/app.spec.ts:2768](../../tests/ui/app.spec.ts#L2768) |

### Comentários no editor (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | o editor mostra os comentários ao lado do texto, ligados às palavras deles | Interface | [ui/app.spec.ts:2825](../../tests/ui/app.spec.ts#L2825) |
| 2 | texto com formatação dentro é comentado pelo editor e salvo na hora | Interface | [ui/app.spec.ts:2832](../../tests/ui/app.spec.ts#L2832) |
| 3 | uma seleção em dois parágrafos, ou em código, não pode ser comentada: o motivo está no botão | Interface | [ui/app.spec.ts:2849](../../tests/ui/app.spec.ts#L2849) |
| 4 | um comentário é respondido, recolorido e apagado pelo editor; as palavras ficam | Interface | [ui/app.spec.ts:2858](../../tests/ui/app.spec.ts#L2858) |
| 5 | um comentário feito durante a edição salva as edições digitadas antes dele | Interface | [ui/app.spec.ts:2879](../../tests/ui/app.spec.ts#L2879) |

### Uma visão para o Markdown (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | Ctrl+E mostra o código Markdown editável como texto e permite copiá-lo inteiro | Interface | [ui/app.spec.ts:2937](../../tests/ui/app.spec.ts#L2937) |
| 2 | uma mudança feita fora do Moki durante a edição nunca é sobrescrita: manter a minha, ou ver a nova versão | Interface | [ui/app.spec.ts:2958](../../tests/ui/app.spec.ts#L2958) |
| 3 | todo arquivo abre editável no editor formatado, sem aviso, qualquer que seja seu conteúdo | Interface | [ui/app.spec.ts:2984](../../tests/ui/app.spec.ts#L2984) |
| 4 | um arquivo grande abre no código editável e o modo de leitura o mostra formatado | Interface | [ui/app.spec.ts:2994](../../tests/ui/app.spec.ts#L2994) |
| 5 | um clique em um link coloca o cursor ali; Ctrl+clique o abre | Interface | [ui/app.spec.ts:3003](../../tests/ui/app.spec.ts#L3003) |

### Tabelas no editor (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | linhas e colunas são adicionadas e removidas pelo balão da tabela, e salvas | Interface | [ui/app.spec.ts:3053](../../tests/ui/app.spec.ts#L3053) |
| 2 | a linha de cabeçalho não ganha uma linha acima nem pode ser apagada: uma tabela Markdown precisa dela | Interface | [ui/app.spec.ts:3080](../../tests/ui/app.spec.ts#L3080) |
| 3 | Tab na última célula adiciona uma linha; uma linha e depois a tabela são apagadas | Interface | [ui/app.spec.ts:3090](../../tests/ui/app.spec.ts#L3090) |

### Pedidos (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | cada pedido mostra a atividade de origem e o cenário dele, ou que foi um pedido livre | Interface | [ui/app.spec.ts:3135](../../tests/ui/app.spec.ts#L3135) |
| 2 | os pedidos são filtrados por atividade, e o filtro só aparece quando eles vêm de mais de um lugar | Interface | [ui/app.spec.ts:3155](../../tests/ui/app.spec.ts#L3155) |
| 3 | o Chamar do Moki cola no terminal de IA atual e espera o Enter | Interface | [ui/app.spec.ts:3170](../../tests/ui/app.spec.ts#L3170) |

### Padrões do projeto (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | as configurações abrem pelo menu do projeto e pelo painel, uma seção por tipo | Interface | [ui/app.spec.ts:3267](../../tests/ui/app.spec.ts#L3267) |
| 2 | um agente e uma skill padrão com instruções: uma nova IA assume o papel, usa a skill e espera | Interface | [ui/app.spec.ts:3283](../../tests/ui/app.spec.ts#L3283) |
| 3 | uma IA ainda pode abrir sem os padrões do projeto | Interface | [ui/app.spec.ts:3318](../../tests/ui/app.spec.ts#L3318) |
| 4 | uma atividade que não pede arquivos, como único padrão, começa sozinha; os padrões vêm primeiro no Chamar | Interface | [ui/app.spec.ts:3325](../../tests/ui/app.spec.ts#L3325) |
| 5 | atividades e modelos são vinculados aqui ou nas configurações do workspace, as mesmas tags vistas dos dois lados | Interface | [ui/app.spec.ts:3342](../../tests/ui/app.spec.ts#L3342) |
| 6 | trazer para este projeto: um envio é separado por tipo, vinculado aqui e marcado nas configurações do workspace | Interface | [ui/app.spec.ts:3383](../../tests/ui/app.spec.ts#L3383) |

### Grupos de abas e visões divididas (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | cada IA abre o próprio grupo; um grupo é renomeado e colorido como um grupo de abas do navegador | Interface | [ui/app.spec.ts:3457](../../tests/ui/app.spec.ts#L3457) |
| 2 | uma entrega da execução de um terminal abre no grupo dele sozinha, marcada como nova, sem tomar a tela | Interface | [ui/app.spec.ts:3478](../../tests/ui/app.spec.ts#L3478) |
| 3 | a tela se divide: cada visão tem o próprio grupo e as próprias abas; uma aba é arrastada para a outra visão | Interface | [ui/app.spec.ts:3497](../../tests/ui/app.spec.ts#L3497) |
| 4 | uma nota no topo (sobre as Configurações) é redimensionada pelo canto inferior direito | Interface | [ui/app.spec.ts:3521](../../tests/ui/app.spec.ts#L3521) |
| 5 | com muitas abas, só as abas rolam: os botões de dividir e Novo ficam fixos no fim, do mesmo tamanho | Interface | [ui/app.spec.ts:3538](../../tests/ui/app.spec.ts#L3538) |
| 6 | configuração de rotinas: navegação intuitiva, agendas completas e formulário responsivo | Interface | [ui/app.spec.ts:3583](../../tests/ui/app.spec.ts#L3583) |
| 7 | avisos de rotinas: abrir uma proposta nunca a aplica, e mudanças exatas pedem confirmação | Interface | [ui/app.spec.ts:3670](../../tests/ui/app.spec.ts#L3670) |
| 8 | templates: enviar um arquivo-base, vê-lo na lista e dizer à IA o que seguir | Interface | [ui/app.spec.ts:3716](../../tests/ui/app.spec.ts#L3716) |
| 9 | Configurador: dizer o que configurar, conferir o plano e aplicar pelas validações do app | Interface | [ui/app.spec.ts:3747](../../tests/ui/app.spec.ts#L3747) |

### Renderização (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | Minhas IAs distribui os cartões pela largura disponível | Interface | [ui/diagrams.spec.ts:59](../../tests/ui/diagrams.spec.ts#L59) |
| 2 | o Mermaid local tem zoom, movimento com a mão e conversas por região que persistem, sem alterar o fonte | Interface | [ui/diagrams.spec.ts:77](../../tests/ui/diagrams.spec.ts#L77) |
| 3 | um Kroki local configurado renderiza cada formato, e o SVG devolvido é limpo | Interface | [ui/diagrams.spec.ts:150](../../tests/ui/diagrams.spec.ts#L150) |
| 4 | links do projeto navegam por títulos, comentários Markdown e PDF, páginas e menções sem reescrever as fontes | Interface | [ui/internal-links.spec.ts:13](../../tests/ui/internal-links.spec.ts#L13) |
| 5 | um Markdown escrito pela IA abre no editor formatado, preserva o que não desenha e salva só o parágrafo alterado | Interface | [ui/md-edit.spec.ts:78](../../tests/ui/md-edit.spec.ts#L78) |
| 6 | um Markdown grande abre no código editável com um aviso explicando o motivo | Interface | [ui/md-edit.spec.ts:111](../../tests/ui/md-edit.spec.ts#L111) |
| 7 | um arquivo alterado fora do Moki durante a edição mostra o aviso de conflito e suas duas opções | Interface | [ui/md-edit.spec.ts:129](../../tests/ui/md-edit.spec.ts#L129) |

### Atividades e execuções (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | arquivos de execução mostram cada execução pelo título e apenas suas entregas | Interface | [ui/hudson.spec.ts:55](../../tests/ui/hudson.spec.ts#L55) |
| 2 | Hudson propõe, a pessoa desmarca um item e somente as ações mantidas são aplicadas | Interface | [ui/hudson.spec.ts:65](../../tests/ui/hudson.spec.ts#L65) |

### Notas (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | melhorar a escrita é uma sugestão: mostra as diferenças e só Aceitar altera a nota | Interface | [ui/note-assist.spec.ts:71](../../tests/ui/note-assist.spec.ts#L71) |
| 2 | a pesquisa acrescenta sua seção ao fim da nota quando aceita | Interface | [ui/note-assist.spec.ts:97](../../tests/ui/note-assist.spec.ts#L97) |
| 3 | nota avulsa: renomeia o título no cabeçalho junto do projeto de destino, sem campo de título nem lápis de código | Interface | [ui/note-assist.spec.ts:108](../../tests/ui/note-assist.spec.ts#L108) |

### Projetos (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | fases de execução são botões separados e o mais não é uma delas | Interface | [ui/notes-layout.spec.ts:57](../../tests/ui/notes-layout.spec.ts#L57) |
| 2 | seções da tela inicial mantêm os títulos e rolam de forma independente | Interface | [ui/notes-layout.spec.ts:65](../../tests/ui/notes-layout.spec.ts#L65) |
| 3 | a nota formatada pode ser editada com o título ao lado do projeto de destino | Interface | [ui/notes-layout.spec.ts:90](../../tests/ui/notes-layout.spec.ts#L90) |

### Abrir ferramentas de IA (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | uma captura colada no terminal de IA é salva e seu caminho digitado; colagem de texto continua sendo texto | Interface | [ui/terminal-images.spec.ts:48](../../tests/ui/terminal-images.spec.ts#L48) |
| 2 | arrastar um arquivo da árvore para o terminal de IA digita seu caminho completo, sem copiá-lo | Interface | [ui/terminal-images.spec.ts:77](../../tests/ui/terminal-images.spec.ts#L77) |

### Documentação (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | tela do projeto com uma história aberta no editor | Interface | [ui/wiki-shots.spec.ts:128](../../tests/ui/wiki-shots.spec.ts#L128) |
| 2 | Chamar: uma lista de atividades, agentes, skills e operações | Interface | [ui/wiki-shots.spec.ts:136](../../tests/ui/wiki-shots.spec.ts#L136) |
| 3 | nota com sugestão de um assistente rápido | Interface | [ui/wiki-shots.spec.ts:144](../../tests/ui/wiki-shots.spec.ts#L144) |
| 4 | Hudson organizando os arquivos deixados por uma execução | Interface | [ui/wiki-shots.spec.ts:159](../../tests/ui/wiki-shots.spec.ts#L159) |

### Editores de documentos (UI)

| # | Cenário | Tipo | Onde |
|---|---|---|---|
| 1 | edição e comentários Office nativos, HTML executável isolado e atalho da IDE na barra fixa funcionam no app | Interface | [ui/workspace-features.spec.ts:38](../../tests/ui/workspace-features.spec.ts#L38) |
