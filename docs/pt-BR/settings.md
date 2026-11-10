# Configurações

## Configurações (a ⚙️ da barra de ícones)

Sete abas; tirando *Minhas IAs*, cada uma é uma lista com filtros e busca. A ☆ num cartão marca como favorito: os favoritos vêm primeiro na lista.

| Aba | O que você faz ali |
|---|---|
| **Agentes** | Papéis com instruções e skills opcionais. Duplique um nativo ou crie o seu; as tags dizem quais projetos ele alcança. Veja [Agentes e operações](../agents.md). |
| **Atividades** | Os pedidos prontos do **Chamar…**: os do Moki e os seus — o que pedir, a qual skill, agente, fluxo ou operação, com quais arquivos. Veja [Atividades](activities.md). |
| **Minhas IAs** | As ferramentas de IA que o Moki abre, cada uma com a versão. **Tornar padrão** define em qual os pedidos começam. **Instalar** uma IA de terminal que falta (ele mostra o comando oficial e só roda depois que você digita `y`). No VS Code e no Cursor, instale a extensão do Moki — veja [Moki na IDE](ide.md). |
| **Operações** | Agentes ligados por setas numa operação com vários agentes. Veja [Agentes e operações](../agents.md). |
| **Skills** | O que está instalado, o que vem com o Moki, e **Adicionar skill**: buscar no registro público [SkillMD](https://skillmd.com), descrever uma para a sua IA rascunhar, ou **enviar** skills e agentes de uma pasta `.claude` (inclusive agentes em subpastas) ou de um `.zip`. Com um projeto aberto, você escolhe **todos os projetos** ou **só este projeto**. Você escolhe e confirma antes de qualquer instalação. |
| **Servidores MCP** | As ferramentas que a IA recebe — navegadores, bancos de dados, trackers — para todos os projetos ou para os escolhidos. Veja [Servidores MCP](../mcp-servers.md). |
| **Templates** | Fonte, cores, cabeçalho, rodapé, logo e marca d'água dos PDFs, Word e Excel que as atividades geram; as tags dizem quais projetos usam cada um. |

## Configurações do projeto

Os controles deslizantes ao lado do nome do projeto no painel (ou o ⋯ da pasta do projeto) abrem as configurações próprias do projeto — uma seção por tipo:

| Seção | O que define |
|---|---|
| **Projeto** | O nome e a descrição. |
| **Ao abrir uma IA aqui** | Instruções opcionais, enviadas a toda IA aberta sem escolher nada. |
| **Agentes** | Os agentes que o projeto habilita; a ★ marca um como padrão. |
| **Skills, Atividades, Operações** | Os padrões de cada tipo — vários, se você quiser. |
| **Suas atividades, Templates** | Marcar um dá a ele a tag do projeto (a mesma tag que as Configurações mostram); o template em uso dá o estilo das entregas. |
| **Servidores MCP** | Os que o projeto recebe (só leitura aqui; mude nas Configurações). |

Uma IA aberta no projeto começa com esses padrões: com **uma atividade que não precisa de arquivos** como único padrão, ela começa na hora; senão, assume o papel do agente padrão, usa as skills padrão, diz numa linha o que está configurado e espera. Uma atividade escolhida no **Chamar…** vai sem eles.

### Trazer para este projeto

No topo das configurações do projeto: solte um `.md`, a pasta de uma skill, uma pasta `.claude` inteira (inclusive agentes em subpastas) ou um `.zip`. O Moki separa o que encontra — skills, agentes, atividades —, bloqueia o que não é seguro ou já existe, e só instala o que você confirmar. **Marcar todos** e **Desmarcar todos** funcionam por tipo e por pasta.

Escolha para onde vai:

- **Todos os projetos** (o padrão) — as skills vão para a sua pasta de usuário e ficam vinculadas aqui; os agentes e as atividades entram entre os seus, então todo projeto os tem;
- **Só este projeto** — tudo vai para as pastas do próprio projeto.

O que o projeto tem passa a aparecer no cartão **Skills e agentes** do painel.

## Veja também

- [Chamar atividades, agentes e skills](call.md)
- [Terminais de IA](ai-terminals.md)
