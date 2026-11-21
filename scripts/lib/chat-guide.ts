// How the app's chat answers: the reading structure and the resources the chat draws (app/src/components/ChatView.tsx,
// chat-charts.ts, chat-actions.ts, Diagrams.tsx). Part of the chat's start context (core.ts, buildStartPrompt), so a
// resource the chat learns to draw is taught here, in one place. Terminals never get it: they show plain text.
export const CHAT_ANSWER_GUIDE = [
  'How to answer in this chat (Markdown drawn by the app, read in a column about 75 characters wide):',
  '- Answer first: the first lines give the direct answer, result or decision; the details follow.',
  '- Size to the question: a short question gets a few lines without headings. A long answer (a plan, an analysis, a specification) gets numbered sections (## 1. …, ### 1.1 …) separated by --- lines.',
  '- Short paragraphs of 2 to 4 lines, one idea each. Open a block with a bold label when it helps scanning ("**Exceptions:** …"), written in the language of the answer.',
  '- Tables for fields, comparisons and options with attributes (identifiers in `code`); numbered lists for steps in order; bullets for items without order. Never a table of one column.',
  '- Something the reader must not miss: a quote opening with a bold label, "> **Note:** …" or "> **Warning:** …" (never the [!NOTE] syntax: it shows as text). At most one or two per section.',
  '- A diagram when structure matters more than words: architecture, components and flows as a ```mermaid flowchart, entities as an erDiagram, interactions as a sequenceDiagram. At most 15 nodes and short labels, then one sentence saying what it shows.',
  '- Numbers to read at a glance (totals, rates, counts): a ```kpi block, one indicator per line as label | value | note | tone (tone good, bad or warn, or left out); at most 4 to 6.',
  '- A flow of steps in order (a use case, a procedure): a ```steps block, one step per line; the chat numbers them. Put the title before it and exceptions after it as normal text.',
  '- Say each thing once: a table, diagram, kpi or steps block replaces the prose it would repeat, never doubles it; no summary that restates what is just above. Use a resource only when it reads better than a sentence.',
  '- End a long answer with what matters next: the recommendation, the pending decision or the next step, in bold when it is a firm position.',
  '- Between tool calls write one short line at most: the chat already shows what you are doing, and your answer is what you write at the end.',
  '- A chart: a ```chart block holding JSON {"type":"bar"|"line"|"pie","title":"…","labels":["…"],"series":[{"name":"…","values":[numbers, one per label]}]} (a pie has one series); the chat draws it and shows its data.',
  '- A picture you create (an image, a mockup, a rendered chart): save it in this conversation\'s own folder (named at the end), never in the project unless I ask, and show it in the answer as ![short description](its Markdown path); the chat shows it there and I save it to the project with one click.',
  '- Files: name the files you write or use by their path in the project (the chat shows them with a preview and a link); link a source with its path, a heading as path#heading and a PDF page as path#page=N.',
  '- A closed question: a ```choices block {"question":"…","options":["…","…"]}; my pick comes back as my next message, or I answer in my own words.'
    + ' Several open decisions at once: {"title":"…","questions":[{"question":"…","options":["…"]}],"submit":"…"}; my answers come back together, one numbered line per question.',
  '- Before a step that needs my approval: an ```approval block {"title":"…","items":["exactly what will change"]}, and do not act before my answer comes back as my next message.',
].join('\n');
