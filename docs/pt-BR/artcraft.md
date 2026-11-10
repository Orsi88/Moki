# Apps ArtCraft

O [ArtCraft Launcher](https://github.com/storytold/craft-launcher) instala e atualiza a **Craft App Suite**: apps de desktop para documentos, planilhas, apresentações, imagens, vídeo, áudio, PDFs e CAD. O Moki consegue **baixá-los para você**, tem uma **skill para cada ferramenta**, para a IA saber como ela funciona, e **agentes** que escolhem a certa.

## Os apps

| App | Para que serve |
|---|---|
| **ArtCraft Launcher** | Lista, instala, atualiza e abre todos os apps da suíte. Instale primeiro. |
| **WordCraft** | Escrita e documentos — `.docx`, `.odt`, `.rtf` (no espírito do Word) |
| **GridCraft** | Planilhas — `.xlsx`, `.ods`, `.csv`, fórmulas, gráficos (no espírito do Excel) |
| **DeckCraft** | Apresentações — `.pptx`, temas, transições (no espírito do PowerPoint) |
| **PhotoCraft** | Edição de imagens — camadas, máscaras, pincéis, PSD (no espírito do Photoshop) |
| **LightCraft** | Biblioteca de fotos e revelação de raw (no espírito do Lightroom) |
| **VectorCraft** | Ilustração vetorial — SVG, caminhos (no espírito do Illustrator) |
| **FilmCraft** | Edição de vídeo, cor e som (no espírito do Premiere Pro) |
| **EffectCraft** | Motion graphics e efeitos visuais (no espírito do After Effects) |
| **DesignCraft** | Diagramação e publicação (no espírito do InDesign) |
| **PdfCraft** | Ler, organizar e proteger PDFs (no espírito do Acrobat) |
| **SoundCraft** | Gravar, editar e mixar áudio (no espírito do Pro Tools) |
| **FigCraft** | Design de interfaces e protótipos (no espírito do Figma) |
| **CADCraft** | Desenho técnico e CAD — DXF, DWG (no espírito do AutoCAD) |
| **TextureCraft**, **Craft Anything** | Também estão no catálogo do launcher. |

## Baixando um app

1. Num projeto, abra o **+** no fim das abas › **Apps ArtCraft**. Os 16 apps aparecem, o launcher primeiro.
2. **Baixar** mostra o arquivo, a versão e o endereço, e pede a sua confirmação.
3. Quando o seu sistema tem mais de um formato — no Linux, o pacote da sua distribuição (`.rpm` ou `.deb`), um `.AppImage` ou um `.tar.gz`; no Windows, um `.msi` ou um `.zip` portátil —, você escolhe, com o mais indicado marcado como **recomendado**.
4. O Moki baixa, **confere o SHA-256**, salva onde você escolher e mostra a pasta.

O Moki **nunca instala nem roda** o arquivo: abra você mesmo (um `.rpm` ou `.deb` roda os scripts de instalação quando é aberto). Mensagens e soluções: [Problemas comuns](troubleshooting.md).

## O PdfCraft e os PDFs no Moki

Com o **PdfCraft** instalado, o Moki usa ele para os comentários e as edições de página dos PDFs; sem ele, o Moki faz o mesmo sozinho. Nos dois casos, um arquivo da entrada, e qualquer edição de página, vai para uma cópia `-edited.pdf`. Veja [Arquivos e editor](files-and-editor.md#pdf).

## Perguntando à IA sobre uma ferramenta

Cada ferramenta tem uma **skill** (`wordcraft`, `gridcraft`, `photocraft`, `pdfcraft`… e `craft-launcher`) com o que ela é, os formatos, como construir, a linha de comando, o servidor MCP, as verificações e os logs — **conferidos no repositório da ferramenta** antes de responder, nunca de memória.

Quatro agentes encaminham e se especializam:

| Agente | Quando chamar |
|---|---|
| **artcraft-router** | Você cita o ArtCraft, o launcher ou um app Craft — ou descreve uma tarefa (uma planilha, um vídeo, um desenho CAD) sem dizer a ferramenta: ele encontra a certa e carrega só a skill dela. |
| **craft-launcher-specialist** | Instalar, atualizar ou abrir apps Craft; o próprio launcher. |
| **office-apps-specialist** | WordCraft, GridCraft e DeckCraft — recursos, termos e arquivos do Office (`.docx`, `.xlsx`, `.pptx`). |
| **adobe-apps-specialist** | PhotoCraft, LightCraft, VectorCraft, FilmCraft, EffectCraft, DesignCraft e PdfCraft — recursos, termos e arquivos da Adobe. |

Eles só leem: respondem e mostram o caminho. A compatibilidade com arquivos do Office ou da Adobe é tratada como algo a **conferir**, nunca suposto.

> [!TIP]
> **Testando um app Craft?** O trabalho de QA sobre uma ferramenta (revisar as histórias, desenhar os testes, analisar uma falha) usa um projeto cujo id é o nome da skill — `wordcraft`, `pdfcraft`… —, para as skills de QA e a skill da ferramenta trabalharem juntas.

## Veja também

- [Chamar atividades, agentes e skills](call.md)
- [Problemas comuns](troubleshooting.md#baixar-apps-artcraft)
