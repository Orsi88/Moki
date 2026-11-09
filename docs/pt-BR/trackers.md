# Conectar Azure DevOps e Jira

As skills de tracker (`dispatch` e os agentes que a usam) leem e escrevem itens pelos **servidores MCP** que você cadastra em **Configurações › Servidores MCP** ([mcp-servers.md](../mcp-servers.md)). O Moki nunca guarda credenciais: tokens ficam em variáveis de ambiente (`${NOME}`), e o login OAuth acontece na sua ferramenta de IA.

Sem servidor, ou quando ele falha, os agentes pedem que você cole ou anexe o item. Nesse caso eles registram que o conteúdo foi **enviado por você**, não lido do tracker.

> **Nota:** o que cada servidor consegue fazer depende da sua organização (forma de login, escopos, grupos de permissão liberados pelo admin). Na primeira vez que um agente usa um servidor no projeto, ele lista as ferramentas que realmente tem. Cada tipo de escrita é confirmado separadamente na primeira vez que dá certo.

Conferido na documentação dos fornecedores em novembro de 2026: Atlassian *Rovo MCP Server — Getting started* e *Supported tools*; Microsoft *Remote Azure DevOps MCP Server* e o README de `microsoft/azure-devops-mcp`.

## Jira Cloud (Atlassian Rovo MCP Server)

| Campo no Moki | Valor |
|---|---|
| Transporte | HTTP |
| URL | `https://mcp.atlassian.com/v2/mcp` |
| O que ele faz | **Executa** (cria e edita itens; toda escrita continua esperando a sua aprovação nas skills) |

1. Salve o servidor e dê ele ao projeto.
2. Abra o Claude Code pelo Moki no projeto e rode `/mcp`: o navegador abre o login da Atlassian (OAuth 2.1, o método recomendado).
3. Anexos: se o Claude Code restringir a rede, adicione `api.media.atlassian.com` e `*.frontend.public.atl-paas.net` em `network.allowedDomains`.

Login por token de API só funciona se o admin da organização liberou. As ferramentas de exclusão vêm desligadas, e as skills do Moki nunca apagam nada.

## Azure DevOps — servidor remoto (o recomendado pela Microsoft)

O servidor remoto precisa de **um registro de app seu no Microsoft Entra** para o login pelo Claude Code:

1. No portal do Azure, registre um aplicativo:
   - Adicione o redirect `http://localhost:3118/callback` em *Mobile and desktop applications*.
   - Ligue *Allow public client flows*.
   - Adicione a permissão de API *Azure DevOps MCP* (delegada).
   - Conceda o consentimento de admin. Talvez um admin do tenant precise fazer essa parte.
2. Copie o *Application (client) ID*.
3. No Moki, cadastre o servidor:

| Campo no Moki | Valor |
|---|---|
| Transporte | HTTP |
| URL | `https://mcp.dev.azure.com/<organização>` |
| Cabeçalhos › Client id (OAuth) | o Application (client) ID (público, não é segredo) |
| Cabeçalhos › Porta de callback | `3118` |
| Cabeçalhos (opcional) | `X-MCP-Insiders=true` para liberar consultas WIQL (`wit_query_by_wiql` só existe no Insiders) |
| O que ele faz | Executa |

4. Abra o Claude Code pelo Moki e rode `/mcp` para entrar.

O bloco OAuth é escrito só para o Claude Code. A Microsoft não suporta Codex nem Claude Desktop no servidor remoto. A organização precisa estar ligada a um tenant do Microsoft Entra.

## Azure DevOps — servidor local (quando não dá para registrar o app)

| Campo no Moki | Valor |
|---|---|
| Transporte | stdio |
| Comando | `npx` |
| Argumentos | `-y`, `@azure-devops/mcp`, `<organização>` (opcional: `-d`, `core`, `work`, `work-items` para carregar só esses domínios; mantenha sempre o `core`) |
| O que ele faz | Executa |

Ele precisa do Node.js 20 ou mais novo. Por padrão, abre o navegador para o login. Outros métodos se escolhem com o argumento `--authentication`:

| Método | Argumento | Ambiente |
|---|---|---|
| Login interativo no navegador | (nenhum) | — |
| Azure CLI | `--authentication`, `azcli` | um `az login` ativo |
| Token de acesso pessoal | `--authentication`, `pat` | `PERSONAL_ACCESS_TOKEN=${PERSONAL_ACCESS_TOKEN}`, com a variável guardando o base64 de `<email>:<pat>` |

A Microsoft diz que o servidor local continua suportado, mas as novidades chegam primeiro no remoto.
