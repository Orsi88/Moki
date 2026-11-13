# Rotinas e notificações

Uma rotina consulta as fontes de um projeto, compara com a última leitura bem-sucedida e informa o que entrou, mudou ou saiu. Ela pode avisar você ou pedir a uma IA que prepare uma análise para revisão. Aplicar alterações propostas em arquivos sempre exige sua aprovação.

## Antes de começar

Abra o workspace e o projeto corretos. Para uma consulta externa, primeiro [conecte e teste um servidor MCP de leitura](mcp-servers.md#conectar-um-servidor-passo-a-passo) disponível para esse projeto. Tenha o nome real da ferramenta, os parâmetros e a query ou filtro. Para análise por IA, instale e faça login na ferramenta em **Configurações › Minhas IAs**.

O relógio funciona enquanto o Moki está em execução. Manter o Moki em segundo plano e iniciá-lo ao entrar no sistema são preferências separadas; ambas começam desligadas.

## Criar uma rotina

1. Abra **Configurações › Rotinas e notificações › Nova rotina**.
2. Preencha **Nome** e **Projeto**. Em **O que esta rotina deve fazer**, descreva a análise desejada, como resumir requisitos alterados e apontar possíveis impactos. Use seu objetivo e as regras confirmadas do projeto.
3. Em **O que acompanhar?**, escolha uma fonte na tabela abaixo. **Adicionar outra fonte** permite acompanhar mais de uma fonte na mesma rotina.
4. Em **Quando executar?**, escolha a agenda: manual, diária, semanal, mensal ou por intervalo. Para verificar a cada hora, selecione intervalo e informe `60` minutos. Confira o fuso horário. A agenda semanal também pede os dias da semana; a mensal, o dia do mês.
5. Escolha o modo de resposta. **Acompanhar e avisar** compara as fontes sem iniciar IA. O modo de preparar análise para revisão usa a **Ferramenta de IA** escolhida. Mantenha a opção de analisar somente quando algo mudar se a primeira leitura deve criar a referência inicial e as mudanças posteriores devem chamar a IA.
6. Escolha separadamente as notificações no Moki e no sistema e clique em **Salvar rotina**.
7. Clique em **Executar agora** e confira o resultado no **Histórico** antes de depender do agendamento.

Cada fonte tem sua própria configuração:

| Fonte | O que preencher |
|---|---|
| Consulta numa conexão | Uma conexão de leitura, a ferramenta que lê a query e um parâmetro `nome: valor` por linha |
| Arquivos do projeto | Um caminho relativo ao projeto por linha, como `context/business-rules.md` |
| Pasta do projeto | Uma pasta relativa ao projeto, como `context`, e a opção de incluir subpastas |

As fontes de arquivos e pastas ficam dentro desse projeto. Caminhos ocultos e pastas de execução ficam fora do acompanhamento.

## Exemplo: acompanhar uma query salva do Azure DevOps

Os valores abaixo são marcadores, não identificadores reais. Substitua pelos valores do seu provedor.

1. Crie ou teste a conexão MCP local do Azure DevOps seguindo [Servidores MCP](mcp-servers.md#exemplo-mcp-local-do-azure-devops). Ela precisa estar ligada, configurada para leitura e disponível para o projeto.
2. Crie uma rotina, escolha **Consulta numa conexão** e selecione essa conexão.
3. Se o servidor testado oferece `wit_query`, informe esse nome em **Ferramenta desse servidor**. Outras versões podem oferecer ferramentas diferentes: use o contrato que o seu servidor realmente expõe.
4. Em **O que buscar (opcional)**, preencha:

   ```text
   action: get_results
   id: YOUR_SAVED_QUERY_ID
   project: YOUR_AZURE_PROJECT
   top: 1000
   ```

   O projeto do Moki e o projeto do Azure DevOps podem ter nomes diferentes. O parâmetro `project` acima é o projeto real do Azure DevOps. `{{project.name}}` substitui pelo nome do projeto no Moki; use somente quando os nomes coincidirem.

5. Para uma query hierárquica com esse contrato, deixe vazios **Campo com a lista**, **Campo com o id de cada item** e os campos de paginação. Textos como `value` e `id`, exibidos como dicas, não são valores salvos. O Moki valida o envelope de conteúdo não confiável do servidor, reúne os IDs de origem e destino sem repetições e busca campos e revisões por `wit_work_item`, ação `get_batch`, na mesma conexão de leitura. Sua conta precisa conseguir ler esses itens.
6. Salve e clique em **Executar agora**. A primeira leitura bem-sucedida conclui com **Baseline recorded. Nothing to approve yet.**: a referência inicial foi registrada e ainda não há nada para aprovar. As leituras seguintes comparam a revisão e o conteúdo dos itens e detectam entradas e saídas da query.

O limite padrão da query do servidor é `top: 50`. Defina um limite explícito adequado à consulta. Se a quantidade de itens únicos atingir esse limite, o Moki interrompe a leitura: esse contrato não oferece cursor de continuação, então não é possível comprovar que o resultado está completo. Aumente `top` ou restrinja o filtro até obter o resultado completo abaixo do limite. Uma rotina aceita até 10.000 registros e aproximadamente 50 MB de dados serializados. Lotes incompletos ou inválidos falham; nunca substituem uma referência inicial bem-sucedida.

## Campos avançados para outros formatos

O Moki encontra automaticamente as listas e os IDs mais comuns. Use **Avançado** somente depois de conferir a resposta real da ferramenta:

| Campo | Significado |
|---|---|
| Campo com a lista | Caminho com pontos até o array, como `data.items` |
| Campo com o id de cada item | Identificador estável e único dentro de cada registro, como `key` |
| Parâmetro da próxima página | Argumento no primeiro nível da ferramenta que recebe o cursor |
| Campo com a próxima página | Caminho com pontos até o próximo cursor na resposta |

Preencha os dois campos de paginação juntos. Fontes com cursor param em 100 páginas e recusam cursores repetidos. Campos explícitos de lista ou identificador mantêm a interpretação personalizada escolhida e desativam o leitor automático da query hierárquica do Azure DevOps. Em resultados planos do Azure que contêm apenas IDs e URLs, o leitor genérico compara essas referências, sem buscar os campos internos ou revisões do item.

## Entender a primeira leitura e as análises

Abra o **Histórico** e expanda a execução para ver o resultado ou erro. A primeira leitura bem-sucedida cria a referência para as comparações seguintes; com análise somente nas mudanças, ela não inicia IA nem pede aprovação. Uma fonte sem mudanças informa **No change since the last successful check.**

No modo de análise, uma mudança inicia a operação vinculada. A execução permanece aguardando enquanto a IA prepara a saída. **Aprovações** só permite agir depois que a análise e o handoff da operação forem entregues. Confira os resultados e o conteúdo exato proposto para os arquivos antes de aprovar. Abrir uma notificação ou marcá-la como lida nunca aprova uma proposta.

No sino, você pode marcar todas como lidas, fechar uma notificação pelo × ou usar **Limpar todas**. Fechar avisos não arquiva a rotina nem aprova suas propostas. Uma próxima execução relevante pode criar uma nova notificação.

## Manter as verificações e gerenciar a rotina

Em **Preferências**, habilite o agendamento e, se necessário, a execução em segundo plano e a inicialização ao entrar no sistema. O limite de análises simultâneas controla quantas IAs podem trabalhar em segundo plano; `0` pausa a análise por IA enquanto o acompanhamento continua. A retenção define quantas execuções guardar por rotina.

No menu de ações adicionais da rotina, **Pausar** interrompe sua agenda, **Retomar** volta a habilitá-la, **Duplicar** cria outra rotina e **Arquivar** tira a rotina da lista ativa preservando o histórico. Uma verificação perdida pode executar uma vez quando o Moki voltar, se essa opção estiver ligada.

## Resolver problemas

A mensagem da execução orienta a próxima verificação:

| Sintoma | O que conferir |
|---|---|
| A conexão não aparece no formulário | Ela precisa estar ligada, ser de leitura e incluir o projeto no workspace atual |
| Testar MCP funciona, mas a query falha | Nome real da ferramenta, ação, id da query, projeto no provedor e permissões da conta para query e itens |
| A query não retornou uma lista | Confira o formato real e o caminho avançado, se preenchido; use Moki 0.5.7 ou mais novo para o envelope Azure DevOps e o leitor hierárquico suportados |
| A query atingiu o limite de resultados | Aumente `top` ou restrinja o filtro; o padrão é 50 |
| O lote de itens veio incompleto ou inválido | Confira permissões e disponibilidade dos itens e tente novamente após resolver; a última referência bem-sucedida permanece intacta |
| A primeira execução não chama a IA | É esperado quando a análise ocorre somente nas mudanças; a primeira leitura cria a referência inicial |
| A análise fica aguardando | Confira a ferramenta de IA, seu login, a saída e o handoff da operação e o limite de análises simultâneas |
| A agenda para quando a janela fecha | Habilite a execução em segundo plano e mantenha o processo do Moki em execução |

## Veja também

- [Servidores MCP](mcp-servers.md)
- [Configurações](settings.md)
- [Agentes e operações](../agents.md)
- [Execuções e entregas](runs.md)
