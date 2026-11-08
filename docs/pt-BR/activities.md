# Atividades

Uma **atividade** é um modelo de pedido reutilizável: o item que você escolhe em **Chamar…** (também disponível numa nota ou no painel do VS Code). Pode ser só texto, um agente com ou sem skills, uma ou várias skills, um fluxo ou uma operação. Ela diz **o que pedir, para quem e com o quê**.

| Peça | O que é | Numa cozinha |
|---|---|---|
| **Skill** | O procedimento: passos, regras, saída, onde parar para aprovação | A receita |
| **Agente** | Um papel com instruções e skills opcionais | O cozinheiro |
| **Operação** | Agentes encadeados por setas, cada passo no próprio terminal | A linha da cozinha |
| **Atividade** | O modelo do pedido: nome, arquivos da entrada, skills, agente, fluxo ou operação opcionais, e o texto enviado à IA | O item do cardápio, que vira a comanda |

## Chamar pelo painel ou pela conversa

**Chamar…** abre uma lista com busca de Atividades, Agentes, Skills e Operações no painel do projeto e acima de um terminal de IA em execução. O atalho **Ctrl+Shift+K** (macOS: **Cmd+Shift+K**) abre a mesma lista.

Escolha um item e informe os arquivos da Entrada, o contexto compartilhado e uma observação, conforme necessário. **Neste terminal** cola o pedido no cursor, sem enviar e sem apagar o que você já escreveu; acrescente contexto e pressione Enter quando quiser. Essa opção exige um terminal de IA em execução neste projeto. **Num terminal novo** mantém a escolha da ferramenta e a abertura habitual.

Uma operação, inclusive uma atividade que aponta para ela, sempre abre seu próprio formulário: cada etapa usa seu próprio terminal. A lista explica isso antes da escolha. Um pedido colado fica como *preparado* até que uma execução correspondente seja registrada; o Moki não presume que você o enviou.

## Três origens, uma lista

| Origem | Onde | Dá para mudar? |
|---|---|---|
| **Ações do Moki** | No código do app: *Só abrir o projeto*, *Contexto do projeto*, *Preparar o projeto*, *Planejar o projeto com a IA*, *Retomar uma execução* | Não: os pedidos delas dependem do app (o plano do projeto, a execução a retomar). Dá para marcar com estrela |
| **Vem com o Moki** | [activities/](../../activities/) no framework: *Revisar histórias de usuário*, *Desenhar testes*, *Revisar e depois desenhar testes*, *Pré-análise de falha*, *Montar evidências de teste*, *Investigar com o Sherlock*, *Contestar com o Moriarty*, *Automação* | Só leitura: **Duplicar para editar** cria uma cópia que é sua |
| **Suas** | `workspace/library/activities/<id>.md` | Sim, em **Configurações › Atividades** |

As suas atividades chegam aos projetos por **tags**, como os agentes e os templates: sem tag, vale para todos os projetos do workspace; a tag de um projeto ou uma tag compartilhada limita a esses projetos.

## Configurações › Atividades

A aba lista todas as atividades, com filtros (Todos, Favoritas, Vem com o Moki, Suas, Ações do Moki) e busca.

- **Nova atividade**: nome, descrição, categoria, modelo (Só texto, Agente, Skills, Fluxo ou Operação), quais arquivos da entrada precisa (obrigatórios, opcionais ou nenhum), o pedido enviado à IA, uma dica para a observação e as tags. Em Skills, selecione uma ou várias.
- **A estrela** torna uma atividade favorita: as favoritas aparecem primeiro em todo lugar onde se escolhe uma atividade.
- Uma atividade de **operação** abre o formulário de início da operação, em vez de um pedido; a operação precisa estar vinculada ao projeto (no painel Operações dele).
- Uma atividade de **agente** pede à IA que aja como aquele agente, a menos que você escolha outro agente ao abrir.
- O agente mantém suas próprias instruções e lista de skills; essa lista pode estar vazia. Escolher skills numa atividade não edita um agente.
- **Só texto** exige um pedido preenchido e não obriga a usar skill ou agente.

## O arquivo

Cada atividade é um arquivo Markdown: um frontmatter e, depois, o pedido.

```markdown
---
label: "Design tests"
description: "scenario mapping, then test cases"
category: "QA"
uses: skill:test-design
files: required
note: ""
tags: ""
---

Use the test-design skill to map the test scenarios for: {files}.
```

| Campo | Valores |
|---|---|
| `label` | O nome na lista (obrigatório) |
| `description`, `category`, `note` | Texto livre (a `note` é a dica mostrada para a observação da pessoa) |
| `uses` | Opcional: `skill:<nome>`, várias skills distintas separadas por vírgulas (`skill:requirements-review, skill:test-design`), `agent:<nome>`, `workflow:<id>` (um workflow do `qa-orchestrator`) ou `operation:<id>`. Omita para só texto; nesse caso, o pedido é obrigatório. Não é permitido misturar tipos |
| `files` | `required`, `optional` ou `none` |
| `tags` | Tags separadas por vírgula; vazio = todos os projetos |

No pedido, `{files}` vira os arquivos da entrada escolhidos (uma linha com `{files}` some quando não há arquivos), uma linha que começa com `{no-files}` só fica quando não há arquivos, e `{project}` vira o id do projeto. Um pedido vazio pede a skill, o workflow ou o agente que a atividade usa. O app acrescenta o resto do pedido como em qualquer atividade: o projeto, a pasta vinculada, o agente, o contexto compartilhado, os arquivos deixados de fora, a sua observação e o idioma.

Com várias skills, o pedido sempre inclui todas e preserva os procedimentos e pontos de aprovação de cada uma, mesmo com texto personalizado. Se alguma skill do framework estiver indisponível, a atividade não inicia. Os arquivos antigos com um único `uses` continuam válidos, sem migração.

O `npm run check` valida os arquivos de `activities/`: cada um precisa ser lido sem erro, ter um id que não seja de uma ação do Moki e conter um pedido só de texto ou apontar para skills, workflow ou agente existentes no framework (uma operação vive num workspace, então só as suas atividades podem usar uma).

## Exceções

| O que aparece | Por quê | O que fazer |
|---|---|---|
| *An activity that comes with Moki cannot be changed: duplicate it.* | As atividades do framework são só leitura | **Duplicar para editar** |
| *There is no agent "…"* / *There is no workflow "…"* / *There is no operation "…"* | O que a atividade usa não existe | Escolha um da lista |
| *This activity needs at least one file from the inbox.* | O `files` dela é `required` | Escolha um arquivo, ou mude para `optional` |
| *The activity "…" starts the operation …* | Uma atividade de operação não vira um pedido | Escolha pelo app: ela abre o formulário da operação |
| A atividade não aparece num projeto | As tags dela não chegam àquele projeto, ou o que ela usa ainda não está disponível | Confira as tags; uma operação precisa estar vinculada ao projeto |
| Uma atividade aparece como *Ainda não disponível* | A skill dela está planejada, ou o agente dela não pode ser usado | Espere a skill, ou escolha outro alvo |
