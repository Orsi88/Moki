# Composition

A diagram is good when the reader gets its point in a few seconds. Plan it before writing a line.

## 1. Plan

- **The question**: write in one sentence what the diagram answers ("How does a renewal get approved?"). It becomes the caption.
- **The elements**: list the actors, steps, states, components or concepts the text actually mentions — nothing else.
- **The relations**: who calls whom, what follows what, what moves a state, what contains what; with their conditions.
- **The type**: from the question ([diagram types](diagram-types.md)).

## 2. Lay out

- **One reading direction**: left to right for flows and pipelines, top to bottom for hierarchies and decisions; never mix in one diagram.
- **Fit the page**: on an A4 or a panel-width page, a left-to-right chain of more than about four boxes is drawn tiny; use top to bottom, or two rows (subgraphs), for longer flows.
- **Main path straight**: the normal path runs along the reading direction; exceptions branch to the side and come back or end.
- **Group** related elements (a subgraph, a lane, a frame) and name the group.
- **Few crossings**: order elements so arrows do not cross; when they must, it is a sign to reorder or split.
- **Even spacing** and aligned elements of the same level; boxes sized to their text.
- **At most ~15 elements**; denser content → split into complementary views (overview + one detail per part), each with its own caption, keeping the relations that matter across views.

## 3. Label

- Short labels (a few words) that keep the essential condition ("Renewal < 3?" not just "Check").
- Arrows labelled when the relation is not obvious; decision branches always labelled (yes/no, approved/rejected).
- Labels near the element or arrow they explain.

## 4. Style

- Shapes with one meaning each (diamond = decision, rounded = start/end, rectangle = step, cylinder = data).
- Colour with one meaning each and a legend when more than two colours are used; never colour as the only carrier of meaning (pair with a shape or a word).
- Moderate: one or two highlight colours; the rest neutral.

## 5. Check

- Every element and arrow corresponds to something the text states; nothing invented to complete the picture.
- The caption answers the question of step 1; the surrounding text explains what the diagram does not.
- Rendered (in Moki, or with `npm run doc-render` when the tool can see images): labels readable at page width, no overlapping, arrows with clear origin and target, crossings minimal. If not readable, reorder, shorten labels or split, and check again.
