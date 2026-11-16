# O que é o Moki

O Moki é um **espaço de trabalho local para trabalhar com IA**. Ele não traz uma IA própria: trabalha com a que você já usa — Claude Code, Codex, Gemini, Cursor, Antigravity, Copilot Chat ou um chat da web — e entrega a ela o contexto, os arquivos, as notas, as ferramentas e um pedido claro do projeto.

Tudo fica **no seu computador**, em pastas comuns e arquivos Markdown que qualquer programa abre. O Moki organiza o trabalho; a sua ferramenta de IA faz o trabalho.

## A ideia

Um workspace contém projetos. Um projeto guarda o que se sabe, o que você entrega, o que você anota e o que a IA produz. Quando você escolhe uma atividade, agente, skill ou operação, o Moki prepara um pedido com o material certo do projeto. A IA trabalha nele e o resultado fica ali.

## As palavras que você vai ver

| Palavra | O que significa |
|---|---|
| **Workspace** | Uma pasta com seus próprios projetos, tags e configurações — por exemplo, uma por empresa, cliente ou área de trabalho. Os projetos de um workspace nunca enxergam outro. |
| **Projeto** | Um conjunto de trabalho: um produto, código, cliente, assunto de pesquisa ou sistema. Tem uma pasta com `context/`, `inbox/`, `notes/` e `runs/`. |
| **Contexto** | O que está *confirmado* sobre o projeto: regras, glossário, decisões, fluxos, ambientes e outros conhecimentos. A IA só trata isso como sabido. |
| **Entrada (inbox)** | Os arquivos que você entrega à IA: um documento, log, planilha, PDF, imagem ou qualquer material necessário. |
| **Nota** | Um lugar para pensar, rascunhar, resumir, pesquisar ou reunir material. Pode ser avulsa ou fazer parte de um projeto. |
| **Skill** | Um procedimento que a IA segue passo a passo, com regras, saída e pontos de aprovação. |
| **Agente** | Um papel com instruções e skills opcionais. |
| **Atividade** | Um pedido pronto que você escolhe no **Chamar…**: o que pedir, para quem e com quais arquivos ou contexto. |
| **Operação** | Vários agentes ligados por setas, cada um no seu terminal, passando o trabalho para o próximo. |
| **Execução** | Um trabalho que produziu um resultado ou espera a sua aprovação. As entregas dela são o que você vê na árvore. |
| **Rotina** | Uma verificação só de leitura em arquivos, pastas ou numa fonte MCP que pode avisar quando algo muda. |

## Como o Moki se comporta

- 🏠 **Local primeiro.** Os projetos ficam em `Documentos\Moki` ou na pasta que você escolher. Nada é enviado para lugar nenhum, a não ser pela sua IA ou por uma integração que você configurou explicitamente.
- 🧱 **Projetos são isolados.** A IA lê o projeto ativo e só os arquivos compartilhados que você liberar por tags. Veja [Privacidade e isolamento](../privacy-and-isolation.md).
- 📝 **As notas fazem parte do workspace.** Elas salvam sozinhas, podem ser enviadas a um projeto ou terminal de IA, exportadas e melhoradas pelos assistentes rápidos.
- ✋ **Você aprova os passos importantes.** Atividades e operações param nos pontos de aprovação em vez de alterar ou publicar algo silenciosamente.
- 💬 **As respostas vêm na conversa.** Perguntas, definições e pequenas mudanças podem ficar no chat. Um arquivo é criado quando você pede ou quando o trabalho produz uma entrega.
- 🗂️ **Os arquivos são a memória.** As ferramentas de IA não compartilham memória. Uma execução registra onde parou, então dá para continuar amanhã ou em outra ferramenta.
- 🧭 **Nada é inventado.** O que falta vira pergunta ou pendência, nunca um palpite apresentado como fato.

## O que o Moki não é

- Ele **não é uma IA** e não precisa de uma conta própria: a sua ferramenta de IA mantém o login e o plano dela.
- Ele **não é um serviço de nuvem**: não existe um servidor do Moki guardando seus projetos.
- Ele **não substitui suas ferramentas de IA**: prepara o projeto e o pedido, enquanto a IA escolhida faz o trabalho.
- Ele **não se limita a um domínio**: os fluxos de qualidade vêm com o Moki, junto com fluxos de pesquisa, documentação, engenharia, APIs, dados, interfaces e outros trabalhos.

## Próximo passo

➡️ [Primeiros passos](getting-started.md) — instale o Moki e crie seu primeiro projeto.
