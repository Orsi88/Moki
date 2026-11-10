# Projetos e workspaces

## Workspaces

Um **workspace** é uma pasta com seus próprios projetos, tags e configurações — um por empresa, cliente ou área, por exemplo. A primeira tela lista todos; o último aberto vem marcado.

- **Criar um workspace** — em `workspaces/<nome>/` dentro da pasta do Moki, ou numa pasta que você escolher.
- **Abrir uma pasta como workspace** — o Moki cria uma pasta `projects/` dentro dela.
- **Trocar** no rodapé da lista de projetos, ou voltar para a lista em *Gerenciar workspaces…*.

Os projetos de um workspace nunca enxergam outro.

## Projetos

Um projeto é um conjunto de trabalho. O id é curto e em minúsculas (`portal-de-cobranca`) e a pasta é `workspace/projects/<id>/`.

**Crie um** pelo **+** da lista de projetos:

| Você clica em | O que acontece |
|---|---|
| **Enter** (*Criar projeto*) | Ele abre na hora, com as pastas de sempre e nada para configurar. Os arquivos de contexto aparecem conforme as atividades precisam. |
| **Criar e personalizar…** | Nome, tags opcionais e como o contexto começa: **Vazio**, ou **Planejado com a IA** — a IA pergunta o que precisa e escreve um plano; os arquivos de contexto só aparecem depois que você aprova. |

**Abra uma pasta** que você já tem (o código do sistema, a documentação dele): uma pasta já vinculada abre o projeto dela; uma pasta nova pede um nome, cria o projeto e o vincula. A pasta vinculada aparece primeiro na árvore, ao vivo — os arquivos são os originais, `.md` e `.txt` são editados ali mesmo, e `.git`, `node_modules`, pastas de build e arquivos ocultos ficam de fora. Configurações de IA encontradas na pasta são copiadas para `.moki-backup/` dentro dela; nada mais muda.

Na tela inicial, **fixe** um projeto para mantê-lo no topo, ou **oculte** um (os arquivos continuam; ele vai para *Ocultos*). **Apagar um projeto de vez** pede que você digite uma palavra, e não usa a lixeira.

### Dentro da pasta de um projeto

```text
workspace/projects/portal-de-cobranca/
├── project.json          # nome, idioma, pasta vinculada, tags, padrões
├── context/              # só conhecimento confirmado
├── proposed-updates.md   # o que a IA notou, esperando por você
├── activity-log.md
├── inbox/                # arquivos que você entrega à IA
├── notes/
├── temporary/            # rascunhos, limpos depois de 7 dias
└── runs/<run-id>/        # uma pasta por trabalho que entregou algo
```

## Skills e agentes no painel do projeto

O cartão **Skills e agentes** lista os itens do projeto, as skills globais vinculadas e os agentes habilitados ou padrão. Clique num item para usá-lo com a IA, ou arraste para um terminal de IA aberto para colar o pedido sem enviar. Uma IA aberta no projeto também recebe a lista dos itens disponíveis. Arquivos de contexto e notas salvas têm **Usar no terminal** no menu; uma nota salva também tem esse ícone no cabeçalho.

## Contexto: o que se sabe

`context/` guarda só o que está **confirmado** sobre o sistema — regras de negócio, glossário, fluxos, permissões, ambientes. É o único texto que a IA trata como sabido.

- Quando você confirma uma definição na conversa, a IA pergunta numa linha: *Salvar isto no contexto do projeto?* — responda sim e ela grava ali.
- O que a IA notou mas você não confirmou vai para as **atualizações propostas** (em *Acompanhamento*) e espera a sua decisão.
- O [Hudson](runs.md#o-hudson-organiza-o-que-as-execuções-deixam) também consegue levar documentos das execuções para o contexto.

## Tags: compartilhar entre projetos

As tags ligam projetos do mesmo workspace. Dê uma tag a um projeto ou a um arquivo (embaixo do nome do projeto, ou na barra acima de um arquivo aberto); digite um nome novo para criar uma.

Um projeto com uma tag pode usar, nas atividades dele:

- o **contexto confirmado** de todos os outros projetos com aquela tag — nunca a entrada, as execuções ou as evidências deles;
- todo **arquivo** marcado com ela, em qualquer projeto.

Quando você começa uma atividade, o passo *Qual contexto a IA deve considerar?* lista esses arquivos, todos marcados; desmarque o que este pedido não deve usar. A IA só lê, não escreve nada nos outros projetos e diz de qual projeto veio cada informação.

## Idioma

A conversa segue o idioma em que você escreve. As entregas saem em **inglês**, a não ser que o projeto tenha `"deliverableLanguage": "pt-BR"` no `project.json` ou você peça outro idioma. Mensagens citadas ficam no idioma original.

## Voltar depois

Feche o app quando quiser. Uma execução que para numa aprovação ou numa pergunta registra onde está; peça à IA para continuar — na mesma ferramenta ou em outra — e ela lê isso, diz onde você parou e segue. As ferramentas de IA não compartilham memória: **os arquivos são a memória**.

## Compartilhar um projeto com o time

Coloque **a pasta daquele projeto** num repositório Git privado só dela. Ela já ignora `runs/`, `inbox/` e `temporary/`. Dados de projeto nunca vão para o repositório público do Moki.

## Onde as coisas ficam

| O quê | Onde |
|---|---|
| O app e os seus projetos, depois do instalador | `Documentos/Moki` |
| Outros workspaces | `workspaces/<nome>/` na pasta do Moki, ou a pasta que você escolheu |
| Um projeto | `workspace/projects/<id>/` |
| Um trabalho | `.../runs/<run-id>/` — as entregas em `outputs/` |
| Skills e agentes de um projeto | `workspace/projects/<id>/skills` e `agents`, ou `<pasta vinculada>/.claude/` |
| Skills e agentes de todos os projetos | `~/.claude/skills`, `~/.agents/skills`, `~/.claude/agents` |
| As suas cópias de agentes nativos | `workspace/library/agents/` |
| Tags | `workspace/tags.json`, `project.json` → `tags`, e `tags.json` dentro de um projeto |

## Veja também

- [Privacidade e isolamento](../privacy-and-isolation.md) — o que a IA pode e não pode ler.
- [Execuções e entregas](runs.md) — o que acontece em `runs/`.
