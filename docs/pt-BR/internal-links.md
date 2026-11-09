# Links dentro de um projeto

Use links Markdown comuns para conectar documentos:

```markdown
[Regras](../inbox/historia.md#regras)
```

O caminho parte do documento que contém o link. O Moki também aceita caminhos a partir da raiz do projeto ativo, como `/inbox/historia.md`, e menções antigas de notas que partem do projeto.

O destino pode ser um arquivo, uma seção de Markdown, um comentário salvo de Markdown ou PDF (`#comment-<id>`) ou uma página de PDF (`#page=3`). Os identificadores das seções usam minúsculas, espaços como hífens e pontuação removida. Seções repetidas recebem sufixos numéricos. Espaços e caracteres reservados em caminhos e ids de comentários devem ser codificados como URL.

Clique no link no **Modo de leitura**, ou use Ctrl+clique (Cmd+clique no macOS) em um link explícito no editor formatado. O destino aparece destacado, mesmo quando o documento já está aberto. Links de comentário abrem a coluna de comentários. Comentários de PDF usam o PdfCraft quando disponível ou o suporte local do Moki; links de página usam o visualizador de páginas do app.

No Modo de leitura, caminhos de arquivos existentes escritos como texto ou código em linha também ficam clicáveis. Blocos de código, links existentes, URLs, e-mails e caminhos de arquivos ausentes permanecem como foram escritos. Isso muda apenas a visualização; o arquivo original não é reescrito.

Menções inseridas com `@` no editor de código-fonte das notas usam caminhos relativos ao documento. As menções antigas relativas ao projeto continuam funcionando. A navegação fica dentro do projeto ativo. Se um arquivo ou âncora não existir, o app exibe uma mensagem.
## Copiar e seguir referências

No menu de um arquivo na árvore, **Copiar link** copia um link Markdown a partir da raiz do projeto ativo. Cartões de comentário de Markdown e PDF têm **Copiar link do comentário**, preservando o id salvo. O link copiado funciona de qualquer documento no mesmo projeto do Moki. Ao escrever uma entrega Markdown portátil para outro visualizador, ajuste o destino para partir daquele documento.

No terminal, use Ctrl+clique (Cmd+clique no macOS) num caminho existente do projeto para abri-lo. O clique simples mantém o terminal ativo. Linhas quebradas e caracteres largos são considerados; caminhos codificados como URL podem representar espaços. Um caminho do computador só é aceito quando identifica a pasta do projeto ativo. Arquivos ausentes e referências a outros projetos não viram links no terminal.
