# Example: requirements-review

Input: [user-story.md](user-story.md) (pt-BR, synthetic). It contains deliberate problems.

Request to the AI tool. To test the original pt-BR labels, first set `"deliverableLanguage": "pt-BR"` in `workspace/projects/acme-library/project.json`; with the default (English) the checklist items apply with the English labels from the skill vocabulary.

> Revise a US do arquivo workspace/projects/acme-library/inbox/user-story.md do projeto acme-library.

## Acceptance checklist

Stage 1–2 (diagnosis, first response):

- [ ] Does **not** ask anything before presenting the diagnosis.
- [ ] Diagnosis has the six sections: USs analisadas, Entendimento, Problemas, Checklist sistêmico, Impactos aparentes, Necessidade de prototipação.
- [ ] Problems use `[REV-XXX]` with Tipo, Origem, Problema, Impacto, Definição necessária.
- [ ] Flags **CA1 × CA6**: limit for teachers vs. readers — contradiction or precedence gap (who is "professor", does CA6 override CA1).
- [ ] Flags **CA4** "usuário autorizado" as ambiguous (which role/permission assignment).
- [ ] Flags the base date for **CA2** (14 days from the original due date or from the renewal date).
- [ ] Flags the **CA2 × RN.011** interaction (renewal landing on a holiday).
- [ ] Flags **CA3** "em atraso" definition (same day? after closing time?) or the CA3 × RN.010 combination.
- [ ] E-mail (**CA5**): trigger, recipient, template, language gaps; e-mail accumulator and e-mail manager evaluated explicitly with status **A CONFIRMAR** (the example project context does not say whether they exist) — **not** NÃO SE APLICA.
- [ ] New screen "Meus empréstimos": permission assignment evaluated; prototype classified 🟡 RECOMENDADO or 🔴 NECESSÁRIO with what must be defined.
- [ ] No final verdict (APTA / NÃO APTA) in the diagnosis.
- [ ] No test cases anywhere.
- [ ] Ends with **exactly one question**, starting the interview, about a contradiction (highest priority).

Stage 3–4:

- [ ] Every interview turn contains exactly one question.
- [ ] Answering "quem tiver permissão" to CA4 is **not** accepted; the agent asks which assignment/rule.
- [ ] Before consolidating, asks the G1 question verbatim and waits.

Stage 5–6:

- [ ] `review-matrix.json` passes `npm run check-output -- review-matrix <run>/outputs/review-matrix.json`.
- [ ] The xlsx has 7 sheets with the pt-BR names; owners not given by the user are `A DEFINIR`.
- [ ] After delivering the xlsx, it waits for the returned matrix and does not produce the PDF.
- [ ] With the returned matrix, asks the G3 question verbatim before the PDF.
- [ ] The PDF reads as a consolidated specification (no Q&A sections, no "decisões tomadas" section).
- [ ] All files are under `workspace/projects/acme-library/runs/<run-id>/`.

## Tracker cases (simulated tracker)

The tester plays Azure DevOps or Jira (or uses a test project). The story of `user-story.md` is item `LIB-210`.

Reading:

- [ ] "Revise a MF" without an id: asks for **the item number or the URL** before anything else.
- [ ] "Revise a MF LIB-210": reads it through `dispatch` (description, criteria, comments, attachments, links), saves the snapshot and the `sources` entry, and reviews it like the pasted story.
- [ ] Tracker down: says so, asks the user to paste the story; the review goes on, `origin: user`.

Round publication (after the matrix):

- [ ] Generating the matrix (G1) does not publish it. The agent offers publication; the preview shows **one consolidated comment** holding only the points that need the team, each identified by its `REV-XXX`, ending with the signature line, plus the matrix as attachment and the target `LIB-210`.
- [ ] Nothing is published before the P1 answer; "só o comentário" publishes only the comment.

Answers from comments (stage 6):

- [ ] Tester adds comments after the round: "REV-002: o limite é 2 renovações" (Ana), "REV-002: são 3 renovações" (Rui), and one with no id: "o bloqueio por multa vale para todos".
- [ ] The table maps the first two to REV-002 and flags them as **contradicting each other** (author, date, link of each); the third gets a proposed REV marked *uncertain*.
- [ ] Stops at GC; no answer becomes a definition before the user confirms; the contradiction goes back to the interview, one question at a time.
- [ ] Reading the comments does not lead to the PDF: G3 is still asked.

Report publication:

- [ ] After G3 and the PDF, the attachment is published only after the P2 preview and answer.

## In an operation (recipe "Pente-fino", docs/operation-recipes.md)

- [ ] First visit of the round-reviewer step: does not create its own run nor touch the operation's `state.json`; reviews up to G1 and the matrix; writes `publication-round-1.md` (target item, the round comment with REV ids, the matrix to attach) in its step's outputs; **publishes nothing**; the handoff starts with `outcome: matrix-ready`.
- [ ] The Wiggins step shows the exact comment and attachment from that file (no text changed, signature added), publishes only after the OK, writes `publication-report.md`, ends `published`.
- [ ] Second visit of the round reviewer (after the arrow "the team answered"): continues from its earlier matrix and REV ids; reads the answers; GC; ends `pending` with `publication-round-2.md`, or asks G3, generates the PDF and ends `report-ready` with `publication-report.md`.
