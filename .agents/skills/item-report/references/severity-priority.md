# Severity and priority

Two different decisions:

- **Severity** — how much the problem hurts: impact on the function, the data, the users, the business, security or compliance. It does not change with the calendar.
- **Priority** — how soon it should be handled: severity combined with frequency, users affected, workaround, release dates, contractual or legal exposure. It is the team's call.

## Use the project's criteria first

The tracker map gives the fields and their allowed values (for example Azure DevOps Severity "1 - Critical … 4 - Low", Priority 1–4; Jira Priority Highest … Lowest). The project's context may define criteria for choosing them. Suggest a value for each, with a one-line reason tied to the facts of the item.

## Generic scale (a proposal, not a rule)

When the project has no criteria, propose this scale and say it is a proposal. It becomes the project's rule only if the user confirms it (it then goes to `proposed-updates.md` and, after confirmation, to the project's context).

| Severity | When |
|---|---|
| Critical | Data loss or corruption, a security breach, a legal or compliance failure, or the main flow blocked for everyone with no workaround |
| High | A main function fails or gives wrong results; a workaround exists but is costly |
| Medium | A secondary function fails, or a main one fails in a limited case; a simple workaround exists |
| Low | Cosmetic, wording, layout or minor usability; no impact on results |

| Priority | When |
|---|---|
| Urgent | Must be handled before anything else (production impact, release blocker) |
| High | Next in line for the current iteration |
| Medium | Planned in the normal flow |
| Low | When there is capacity |

Map the proposed values to the tracker's real field values; never write a value the field does not accept.
