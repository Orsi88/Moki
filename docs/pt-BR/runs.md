# Execuções e entregas

## Primeiro a resposta; arquivo só quando importa

A maior parte do que você pede é respondida **na conversa**: uma dúvida, uma explicação, uma definição, uma investigação, uma pequena mudança. Nada disso cria arquivo.

A IA só cria uma **execução** — uma pasta em *Entregas* — quando:

- você **pede um arquivo**; ou
- o resultado da atividade **é um documento** — uma matriz de revisão, casos de teste, um relatório, evidências, um bug; ou
- o trabalho **para numa aprovação** e precisa ser continuado depois.

Ela nunca escreve documentos de apoio que ninguém pediu (anotações, resumos, planos) nem registros do próprio trabalho. Quando um deles ajudaria, ela oferece numa linha e espera o seu sim.

## O que aparece em Entregas

**Entregas** lista **só os arquivos que você pediu** — o que cada execução entregou —, direto dentro dela, os mais novos primeiro. Não há pastas de execução para abrir: os arquivos internos (o estado que permite retomar, as entradas, os arquivos de apoio) ficam escondidos, mas continuam no disco.

O cartão **Atividades** do painel do projeto mostra primeiro as atividades **fixadas** neste projeto (📌 no **Chamar…**; um clique chama a IA com ela) e depois o que está **em andamento**. O que espera por você — uma aprovação, uma resposta — vem primeiro, com um ▶ para continuar na sua IA. Atividades concluídas e canceladas não aparecem. O 📌 é do projeto; a ⭐ das listas de Configurações vale para o workspace inteiro.

As operações multiagente têm o próprio cartão **Operações**, logo abaixo.

## Aprovações e voltar depois

Uma skill para nos seus pontos de aprovação e pergunta no terminal. Se você fechar o app, a execução guarda onde parou: peça à IA para continuar — na mesma ferramenta ou em outra — e ela lê onde estava e segue.

## Só o que você pediu

A IA entrega só os arquivos que você pediu, no formato pedido; quando o formato não está definido, ela pergunta. Nada de cópias em outros formatos, nada de print de planilha. Arquivos de apoio vão para a pasta `work/` da execução e são apagados quando ela termina. Qualquer extra que ainda caia junto das entregas aparece na página da execução em **Sobras**, para mandar para a lixeira.

## O Hudson organiza o que as execuções deixam

Quando os arquivos se acumulam, use **botão direito em Entregas › Organizar com o Hudson**.

![O plano do Hudson: levar para o contexto do projeto, renomear, apagar para a lixeira, manter](../assets/wiki/pt-BR/hudson.png)

1. A sua IA (Claude Code ou Codex) olha os arquivos que as execuções deixaram — nunca o estado, as entradas ou os diários delas — e propõe, **arquivo por arquivo e com o motivo**:
   - **Levar para o contexto do projeto** — conhecimento confirmado que vale guardar;
   - **Renomear** — uma entrega cujo nome não diz o que ela é;
   - **Apagar** — anotações de apoio, rascunhos, duplicatas — **para a lixeira**;
   - **Manter** — o que você pediu, ou qualquer coisa de que ela não tenha certeza.
2. **Desmarque** o que você não quiser.
3. **Aplique.** Quem faz as mudanças é o Moki; a IA não mexe em nada. Um arquivo levado para o contexto entra no `context/index.md`.

O Hudson também é um agente: num terminal, peça para ele organizar o projeto e ele mostra o mesmo plano numa tabela e espera a sua aprovação.

## Limpeza automática

Arquivos de rascunho não ficam guardados: usou, são **apagados de vez** (não vão para a lixeira).

- A pasta `work/` de uma execução é apagada assim que ela é concluída ou cancelada (e, se o Moki estava fechado nessa hora, quando o projeto abre).
- `temporary/` (pedidos enviados à IA, prints colados, renders de inspeção) é esvaziada quando o último terminal de IA do projeto fecha, e quando o projeto abre sem nenhum terminal dele rodando.
- Os rascunhos do próprio workspace (pedidos de abertura, configuração de MCP de um terminal) são apagados quando o Moki abre e quando os terminais dele fecham.
- Opcional, nas configurações do projeto (**Limpeza**): a pasta `outputs/` de uma atividade concluída vai para a lixeira quando o projeto abre, se todos os arquivos que ela entregou estiverem em `context/` (movidos para lá ou como cópia idêntica). Vem desligada.

## Veja também

- [Chamar atividades, agentes e skills](call.md)
- [Projetos e workspaces](projects.md) — o contexto, para onde o Hudson leva documentos confirmados.
