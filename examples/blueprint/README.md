# Example: blueprint

## Case 1 — editable drawing (Excalidraw)

Synthetic input: [spec.json](spec.json). Run from the framework root:

```text
npm run excalidraw -- --spec examples/blueprint/spec.json --fence
```

- [ ] Prints one ```` ```excalidraw ```` block whose JSON has `"type":"excalidraw"` and `"source":"moki"`, 6 shapes and 5 arrows.
- [ ] Pasted into a note in Moki, it is drawn (User → Service provider → Identity provider → decision → two outcomes, the "no" arrow dashed) and opens for editing.

## Case 2 — Mermaid by default

Request: "Add a diagram of the SAML login, service-provider initiated, to `notes/sso.md`."

- [ ] A ```` ```mermaid ```` `sequenceDiagram` block with a one-line caption, at most 15 participants and messages that match the text; no `click`, links or HTML labels.
- [ ] No PNG, SVG or PDF file created.

## Case 3 — a table, not a diagram

Request: "Make a diagram comparing three SSO providers on price, protocols and support."

- [ ] The answer proposes a table (a comparison of attributes) instead of a diagram, or draws a quadrant only if the user insists on two criteria.
