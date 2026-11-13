# Servidores MCP

O MCP conecta o Moki e a sua ferramenta de IA a serviços como Azure DevOps, Jira, navegadores e bancos de dados. Cada workspace tem seu próprio catálogo em **Configurações › Servidores MCP**. Uma conexão global alcança todos os projetos desse workspace; uma conexão específica alcança somente os projetos escolhidos.

## Conectar um servidor, passo a passo

1. Abra o workspace do projeto e entre em **Configurações › Servidores MCP › Adicionar servidor**.
2. Dê um nome fácil de reconhecer à conexão. Escolha **Global** para disponibilizá-la em todos os projetos desse workspace ou selecione somente os projetos que podem usá-la.
3. Escolha o transporte que o servidor MCP fornece. Em **stdio**, preencha **Comando** e **Argumentos**, um argumento por linha. Em **HTTP**, preencha a **URL** do endpoint MCP. Use o comando ou endpoint documentado pelo servidor: o endereço normal de um serviço na web pode não ser um endpoint MCP.
4. Para uma conexão usada por rotinas, selecione a opção de leitura de dados e mantenha a conexão ligada. Essa declaração não muda as permissões da sua conta no provedor; use ferramentas de leitura no acompanhamento.
5. Se a autenticação exigir variáveis, abra a aba de ambiente ou cabeçalhos. Em stdio, use uma referência como `API_TOKEN=${MY_API_TOKEN}`; em HTTP, `Authorization=Bearer ${MY_API_TOKEN}`. Defina a variável no computador e reinicie o Moki depois de mudar o ambiente, para o processo receber a variável. Nunca cole o valor da credencial no Moki.
6. Se o provedor exigir login interativo, faça o login pelo fluxo que ele oferece. Os campos opcionais de cliente OAuth em HTTP são para o Claude Code. Veja a configuração específica em [Azure DevOps e Jira](trackers.md).
7. Clique em **Salvar** e depois em **Testar**. Quando funciona, o Moki lista as ferramentas oferecidas pelo servidor. Se falhar, corrija o problema informado: comando, variável, autenticação ou tempo de resposta. O teste lista ferramentas; ele não executa sua query salva nem comprova todas as permissões de cada ferramenta.
8. Confirme que a conexão está ligada e inclui o projeto correto. Abra uma nova sessão de IA a partir desse projeto para receber a configuração atualizada, ou siga para [Criar uma rotina](routines.md#criar-uma-rotina).

### Exemplo: MCP local do Azure DevOps

Com Node.js e `npx` instalados, escolha stdio e informe o comando `npx`. No Windows, se necessário, informe o caminho do `npx.cmd` instalado. Em argumentos, coloque uma linha para cada valor:

```text
-y
@azure-devops/mcp
YOUR_ORGANIZATION
```

`YOUR_ORGANIZATION` é um marcador: substitua pelo nome real da organização. Faça o login do provedor com sua própria conta, salve e teste a conexão. A versão instalada determina os nomes das ferramentas: a versão usada na verificação do Moki 0.5.7 oferecia `wit_query` para consultas e `wit_work_item` para leitura de itens. Use os nomes que o seu resultado de **Testar** realmente mostrar. Depois, configure uma [rotina com query salva](routines.md#exemplo-acompanhar-uma-query-salva-do-azure-devops).

### Importar uma conexão existente

1. Em **Configurações › Servidores MCP**, escolha **Importar JSON** e cole uma configuração compatível com Claude Code, Cursor ou VS Code; ou use **Importar para o Moki** na seção de conexões encontradas nas ferramentas de IA.
2. Escolha os projetos que recebem a conexão. Importar traz a definição para o catálogo do workspace; não importa a sessão de login do provedor.
3. Defina as variáveis de ambiente que o Moki indicar, confira o acesso e os projetos, salve e teste.

## Escopo, acesso e credenciais

As opções de escopo determinam quem recebe cada conexão:

| Opção | Efeito |
|---|---|
| Global | Todos os projetos do workspace, inclusive os criados depois |
| Projetos específicos | Somente os projetos selecionados |
| Desligada | A definição continua salva, mas nenhum projeto recebe a conexão |
| Outro workspace | Usa o catálogo próprio daquele workspace |

O id é estável mesmo quando você renomeia a conexão. Os agentes usam esse id no contrato `mcps` e recebem somente as conexões que o contrato nomeia e que estão ligadas para o projeto. Uma operação em andamento mantém as definições que recebeu ao começar.

O acesso `read` é para consultas. O acesso `execute` permite passos que mudam algo fora do Moki e exige aprovação na operação. Rotinas aceitam conexões de leitura.

O Moki salva referências `${VARIABLE}`, nunca valores de senhas, tokens ou chaves. Valores que parecem credenciais são recusados; na importação, viram referências para você configurar no computador. As variáveis são resolvidas quando o servidor inicia ou é testado. Não entram nos arquivos de configuração nem nos logs do Moki como valores.

O teste fica registrado no catálogo de status do workspace, e as ações no log MCP, sem valores de credenciais. Entre os erros possíveis estão comando não encontrado, variável ausente, credenciais recusadas e ausência de resposta em 15 segundos.

## Fazer a conexão chegar à IA

Os caminhos de integração variam conforme a ferramenta:

| Ferramenta | Como recebe a configuração |
|---|---|
| Claude Code iniciado pelo Moki | Parâmetro `--mcp-config`, com os servidores do projeto e o servidor próprio do Moki |
| Cursor iniciado pelo Moki | Entradas `moki` e `moki-*` no arquivo `.cursor/mcp.json` do Moki |
| Cursor na pasta vinculada | Comando **Moki: Sync MCP Servers to Cursor** no VS Code; pede confirmação, preserva as entradas próprias e faz backup |
| Copilot Chat no VS Code | A extensão registra automaticamente os servidores ligados para o projeto; uma variável ausente faz o servidor ser deixado de fora |
| Claude Code no VS Code | **Connect Claude Code** configura a pasta após confirmação; **Open in Claude Code** inicia com `--mcp-config` |
| Codex iniciado pelo Moki | Uma sessão própria, com `--no-daemon` e opções `-c`; não altera o login nem o arquivo de configuração da pasta pessoal |
| Gemini CLI e Antigravity iniciados pelo Moki | Entradas `moki` e `moki-*` nas configurações de workspace do Gemini mantidas pelo Moki |

O cliente OAuth HTTP opcional é escrito somente para Claude Code; Cursor e Codex não recebem esse bloco. O servidor próprio do Moki é de leitura e vinculado a um projeto: disponibiliza contexto, arquivos, notas, skills, agentes e o texto dos PDFs. Veja [Moki na IDE](ide.md) e, para os detalhes técnicos completos, [MCP servers](../mcp-servers.md).

## Próximo passo

Com a conexão testada, siga [Rotinas e notificações](routines.md) para acompanhar uma consulta, arquivos ou uma pasta e revisar os resultados.
