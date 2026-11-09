# Excalidraw spec

The script turns this spec into an Excalidraw scene; never write Excalidraw elements by hand.

```json
{
  "direction": "LR",
  "nodes": [
    { "id": "user", "label": "User", "shape": "ellipse" },
    { "id": "sp", "label": "Service provider", "color": "blue" },
    { "id": "check", "label": "Valid assertion?", "shape": "diamond", "color": "yellow" },
    { "id": "ok", "label": "Session created", "color": "green" },
    { "id": "deny", "label": "Access denied", "color": "red" }
  ],
  "edges": [
    { "from": "user", "to": "sp", "label": "opens" },
    { "from": "sp", "to": "check" },
    { "from": "check", "to": "ok", "label": "yes" },
    { "from": "check", "to": "deny", "label": "no", "dashed": true }
  ]
}
```

| Field | Values | Default |
|---|---|---|
| `direction` | `LR` (left to right), `TB` (top to bottom) | `LR` |
| `nodes[].id` | unique short id | required |
| `nodes[].label` | a few words | required |
| `nodes[].shape` | `rectangle`, `ellipse`, `diamond` | `rectangle` |
| `nodes[].color` | `none`, `blue`, `green`, `red`, `yellow`, `gray`, `violet` | `none` |
| `edges[].from`, `edges[].to` | node ids | required |
| `edges[].label` | a word or two | none |
| `edges[].dashed` | `true` for optional or asynchronous paths | `false` |

Layout is automatic: nodes are placed in columns (`LR`) or rows (`TB`) by their distance from the first nodes, in the order they are listed. The user can rearrange the drawing in Moki afterwards.

Commands (from the framework root):

```text
npm run excalidraw -- --spec <spec.json> --fence                   # prints an ```excalidraw block for the Markdown
npm run excalidraw -- --spec <spec.json> --out <file.excalidraw>   # writes a standalone drawing
```
