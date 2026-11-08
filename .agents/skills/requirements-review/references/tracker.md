# Working with the tracker

How the review reads the item from Azure DevOps or Jira and publishes to it, always through the `dispatch` skill. Everything here is optional: a review of pasted stories works exactly as before.

## Reading the item (stage 0, step `source`)

1. The user gives the item number or URL ("review MF 1234"); if they asked to review an item without giving one, ask for the number or the URL.
2. Read it through `dispatch`: description, acceptance criteria, relevant fields, comments, attachments and links. Read linked items (parent, related stories, rules) when they matter for the review, and attachments (prototypes, flows) the review needs.
3. The terms MF, US, história and others follow the project's glossary and tracker map; record the item's real tracker type.
4. If this item was used by earlier work in the project, the freshness check reports what changed since then before the review starts.
5. Without a usable MCP, ask the user to paste or attach the item; record that it was sent by the user.

## Publishing a round (step `publish-round`, after the matrix)

Only after G1 and the matrix exist, and only if the user wants it published. One **consolidated comment per round** on the item, plus the matrix as attachment. The interview with the user stays one question at a time; the comment gathers only the points that need the team.

Points in the comment: those whose status needs the team (PENDENTE, A CONFIRMAR, BLOQUEADO, or AMBÍGUO/CONTRADITÓRIO left open), each with its own `REV-XXX` id. Never points already resolved in the interview.

Comment text (deliverable language; pt-BR shown):

```text
Revisão QA — rodada <n> da <MF/US> <id> (run <run-id>)
Responda citando o id de cada ponto (ex.: "REV-003: ...").

REV-001 — <título curto>
Pergunta: <a pergunta, objetiva>
Contexto: <uma ou duas linhas: o que está na história e por que isso importa>

REV-004 — <título curto>
Pergunta: ...
Contexto: ...

Matriz anexada: Matriz de Revisão QA.xlsx
—
Registrado via Moki · run <run-id> · ação A1
```

The `dispatch` preview shows the exact comment, the file and the target; publish only after the user's approval (gate P1). A later round (new questions after stage 6) is a new comment with the next round number.

## Answers from comments (stage 6, alongside or instead of the returned matrix)

1. Read the item's comments posted or edited after the round's comment (through `dispatch`).
2. Associate each answer with its `REV-XXX`: by the id quoted in the comment; an answer that quotes no id gets a proposed association marked *uncertain*.
3. For each answer keep: REV id, author, date, comment link or id, and the excerpt that supports the definition (original language).
4. Classify: **resolves** the point, **still ambiguous**, **contradicts** (another answer, a rule, the story — say which), or **unrelated**.
5. Present the extracted definitions as a table and stop at **GC** (confirmation). A comment is not a definition until the user confirms it; confirmed ones enter the working matrix data with the comment as their source; ambiguous or contradictory ones return to the interview, one question at a time.
6. Then continue stage 6 as usual (cross-check, criteria for formalization) up to G3. Reading comments never authorizes generating the PDF or closing the review.

## Publishing the report (step `publish-report`, after the PDF)

After G3 and the PDF exist, and only if the user wants it: attach the PDF to the item, optionally with a short closing comment (signature included). Preview and approval (gate P2) through `dispatch`.
