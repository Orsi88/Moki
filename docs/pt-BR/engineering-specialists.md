# Especialistas de engenharia

Quatro agentes conectam desenho de soluções, dados, interfaces e validação de APIs. São **drafts utilizáveis**: os checks do framework não substituem pilotos de comportamento nem validação em duas ferramentas de IA.

| Agente | Atividade | Skills |
|---|---|---|
| [Cartógrafo](../../agents/engineering/cartografo.md) (`cartografo`) | Modelar dados com o Cartógrafo | [data-modeling](../../skills/data-modeling/SKILL.md), [database-engineering](../../skills/database-engineering/SKILL.md) |
| [Inventor](../../agents/engineering/inventor.md) (`inventor`) | Desenhar uma solução com o Inventor | [solution-design](../../skills/solution-design/SKILL.md); revisão formal de história quando pedida |
| [Artesão](../../agents/engineering/artesao.md) (`artesao`) | Prototipar uma interface com o Artesão | [interface-prototyping](../../skills/interface-prototyping/SKILL.md) |
| [Sentinela](../../agents/quality/sentinela.md) (`sentinela`) | Validar uma API com o Sentinela | [api-assessment](../../skills/api-assessment/SKILL.md), [api-testing](../../skills/api-testing/SKILL.md); desenho formal de casos quando pedido |

Escolha a atividade em **Chamar…** ou peça à IA que leia o agente. Os arquivos de entrada são opcionais: uma descrição pode iniciar a descoberta. O agente pergunta o que falta e combina o formato da entrega, sem produzir uma coleção de documentos por padrão. Os identificadores técnicos não têm acentos; os nomes das atividades têm.

## Cartógrafo: do significado dos dados à implementação

Modela entidades, identidade, atributos, cardinalidade, obrigatoriedade, integridade e ciclo de vida. Pode trabalhar nos níveis conceitual, lógico e físico. Quando diagrama, dicionário e SQL são pedidos juntos, precisam representar a mesma estrutura em seus respectivos níveis.

Para SQL, migrações e diagnósticos, identifica o produto, mecanismo e versão reais e mantém as ferramentas do projeto. Diferencia código preparado, revisão estática, teste isolado e mudança aplicada. Avalia compatibilidade, bloqueios, transformação dos dados, retomada e limites da recuperação. Uma execução com resultado incerto precisa ser reconciliada antes de repetir a escrita.

Exemplo: “Modele reservas em um Markdown com DER e dicionário. Ainda não escolhemos o banco.” Pedir SQL depois não autoriza conectá-lo ou aplicá-lo automaticamente.

## Inventor: requisitos, alternativas e decisões

Começa pelo problema, usuários, resultado e restrições. Liga requisitos a responsabilidades da solução e formas de verificação. Compara opções viáveis pelos mesmos critérios e explica consequências e incertezas. Separa fatos observados, hipóteses, requisitos propostos e decisões aprovadas.

Escolhe os diagramas e registros de decisão úteis para o pedido. Metas de qualidade precisam de condições e medidas; números desconhecidos ficam pendentes. Cada incremento do plano tem resultado verificável e dependências. A revisão formal de histórias mantém seu próprio procedimento quando solicitada.

Exemplo: “Compare formas de adicionar reservas ao sistema existente; entregue uma proposta com arquitetura e plano por etapas. Não implemente.” A aprovação do desenho não autoriza alterações no repositório.

## Artesão: composição visual e comportamento funcional

Assume hierarquia, tipografia, espaçamento, composição responsiva e ajustes visuais rotineiros. Preserva o design system e a tecnologia existentes. Constrói as interações combinadas e os estados relevantes de sucesso, erro, vazio e carregamento, identificando dados sintéticos e integrações simuladas.

O build não substitui a conferência no navegador. Exercita fluxos, larguras representativas, conteúdo longo, formulários, teclado e foco quando as ferramentas permitem; informa o que não foi verificado. Um protótipo não ganha garantia de produção ou acessibilidade completa por passar numa ferramenta automática.

Exemplo: “Construa um único HTML local com filtro, modal de detalhes e formulário validado. Só dados sintéticos, sem API nem nova dependência.” Edições em repositório vinculado seguem o plano aprovado e preservam alterações manuais.

## Sentinela: garantias e evidências

Avalia contrato, versão/dialeto, regras, identidade, permissões e riscos dos fluxos. Separa lacuna de especificação, divergência demonstrada, problema de execução e risco ainda não verificado.

Reutiliza o executor existente; o [api-tester](../../agents/quality/api-tester.md) continua disponível para execução focada. Casos negativos documentados com 401/403 são avaliados pelo esperado. Um parser de JSON sozinho não valida schema; checks obrigatórios incompletos impedem Passed. Passar contra mock não comprova o serviço real.

Exemplo: “Avalie este OpenAPI e as respostas mascaradas anexadas. Entregue só achados e cobertura; não chame a API.” A execução mantém as aprovações de ambiente/plano e a confirmação dos resultados pelo QA.

## Cooperação e atualização das fontes

Cada especialista funciona sozinho. Quando uma sequência ajudar, o Inventor fornece requisitos aceitos, o Cartógrafo responde pelo significado dos dados, o Artesão pelo comportamento da interface e o Sentinela pelas garantias da API. Um especialista em documentação pode melhorar a apresentação; o responsável técnico confere a fidelidade depois. Nenhum agente de pesquisa ou documentação é dependência obrigatória deste conjunto.

Quando houver MF ou outro item vinculado, o agente usa as leituras configuradas e autorizadas ao iniciar/retomar para comparar o item atual com a base aceita anteriormente. Registra versão/horário e impactos. Comentários ou critérios novos não viram regras confirmadas sem decisão; falha de leitura não significa ausência de mudanças. É um procedimento da IA, não um serviço de monitoramento em segundo plano ou um conector novo.

Os agentes não fixam ids de MCP. Para usar um conector do projeto numa operação, duplique/configure o contrato com os ids e modos de acesso daquele projeto, conforme o [guia de agentes e operações](../agents.md). Chamadas a banco/API e publicação externa continuam exigindo o plano e a autorização específicos.

## Referências e validação

Cada skill aponta para referências técnicas e candidatas externas aplicáveis. Elas orientam o método; não foram instaladas como dependências nem copiadas como pacotes de instruções. Uma incorporação futura precisa respeitar licença, ferramentas, isolamento, aprovações e compartilhamento do projeto.

Há cenários sintéticos de aceitação para [modelagem](../../examples/data-modeling/README.md), [banco](../../examples/database-engineering/README.md), [soluções](../../examples/solution-design/README.md), [interfaces](../../examples/interface-prototyping/README.md) e [APIs](../../examples/api-assessment/README.md), incluindo ambiguidades e erros plantados. Os resultados reais devem ser registrados nos [testes de compatibilidade](../compatibility-tests.md); criar os exemplos não equivale a executá-los.
