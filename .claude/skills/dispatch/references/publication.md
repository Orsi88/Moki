# Publication protocol

Every write to a tracker follows these steps, in order. Nothing is written outside them.

## 1. Action list

Number each action `A1`, `A2`… in execution order. For each one:

| Field | Content |
|---|---|
| Tracker and project | e.g. Azure DevOps · contoso/Library, or Jira · acme.atlassian.net/LIB |
| Operation | `create`, `edit`, `comment`, `attach`, `link`, `transition` |
| Target | the item id and link, or for `create` the item type |
| Content | every field with its exact value; the full text of descriptions and comments; file names; link type and target |
| Depends on | the actions it needs first (e.g. `attach` to the item created by A1) |

Before showing it, check that texts and files carry no secrets or personal data ([isolation](core/isolation-policy.md)); remove or ask.

## Signature

Every created item ends its description, and every comment ends its text, with this line (in the deliverable language), shown in the preview as part of the text:

```text
—
Registered via Moki · run <run-id> · action <A-id>
```

pt-BR: `Registrado via Moki · run <run-id> · ação <A-id>`.

The signature is how an uncertain result is checked: search the target (or the project, for `create`) for the exact signature line before repeating an action.

## 2. Preview and approval

Show the whole list exactly as it will be sent, then the gate question. The user may approve all, approve some (by A-id), change content (the list is rebuilt and shown again), or cancel. Record the decision in `state.json` `approvals` with the approved A-ids.

## 3. Journal

`runs/<run-id>/logs/dispatch-journal.json` holds one entry per action, written **before** execution and updated **after**:

```json
{
  "actions": [
    {
      "id": "A1", "tracker": "azure-devops", "project": "contoso/Library", "operation": "create", "target": "Bug",
      "summary": "Login fails after SSO redirect", "signature": "Registered via Moki · run 20261108-1530-defect-report-login · action A1",
      "dependsOn": [], "state": "done", "result": { "id": "4521", "url": "https://dev.azure.com/contoso/Library/_workitems/edit/4521" },
      "error": null, "approvedAt": "2026-11-08T15:41:00Z", "updatedAt": "2026-11-08T15:41:07Z"
    }
  ]
}
```

States: `planned` (in the list, not approved) → `approved` → `running` (written just before the call) → `done` | `failed` (with `error`) | `uncertain` (no reliable answer) | `skipped` (not approved, or a dependency failed).

## 4. Execution

- Run only `approved` actions, in order; an action whose dependency is not `done` becomes `skipped`.
- Set `running` before each call and the final state right after it, with the returned id or link.
- After a `failed` action, continue only with approved actions that do not depend on it, and say so in the report.

## 5. Report

List each action with its final state, id and link. Say plainly what was published, what failed and why, what was skipped, and what is uncertain.

## Resuming and recovery

1. Read the journal. `done` actions are never repeated; their ids are reused by dependent actions.
2. `running` or `uncertain` actions: search the tracker for their signature (for `edit` and `transition`, read the current values). Found → `done` with the id. Not found → present it again in a new preview.
3. `failed` actions: present again only if the user wants to retry, as a new preview.
4. Never retry the whole batch, never delete to undo.

## Without a usable MCP

Mark every action *prepared, not published* and give, per action: where (tracker, project, item), what to do (create/comment/attach…), the exact content to paste (signature included) and the files. Record the actions as `skipped` with `manual: true` so a later run can check for the signatures.
