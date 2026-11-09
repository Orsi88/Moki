# Operations per tracker

The tools each server offers, as documented by the vendors in November 2026 (Atlassian *Rovo MCP Server — Supported tools*; Microsoft *Remote Azure DevOps MCP Server*). Tool sets change: the `capabilities` step lists what the session really has; when a tool here is missing, use the equivalent the session offers or the fallback.

| Operation | Jira (Atlassian Rovo MCP) | Azure DevOps (remote MCP) |
|---|---|---|
| Read an item | `getJiraIssue` | `wit_work_item` (get, get_batch) |
| Comments | `listJiraIssueComments` | `wit_work_item` (list_comments) |
| History / revisions | `listJiraIssueChangelogs` | `wit_work_item` (list_revisions) |
| Attachments (read) | `downloadJiraIssueAttachment` | `wit_work_item_attachment` (download) |
| Links | `getJiraIssue` fields, `listJiraIssueRemoteIssueLinks`, `listJiraIssueLinkTypes` | `wit_work_item` (get, with relations) |
| Search | `searchJiraIssuesUsingJql` | `search_workitem`; `wit_query_by_wiql` only with the `X-MCP-Insiders: true` header |
| Item types and fields | `listJiraProjectIssueTypesMetadata`, `getJiraIssueTypeMetaWithFields` | `wit_work_item` (get_type) |
| States / transitions | `listJiraIssueTransitions`, `listJiraStatuses` | the type's states (get_type) |
| Create | `createJiraIssue` | `wit_work_item_write` (create) |
| Edit fields | `editJiraIssue` | `wit_work_item_write` (update) |
| Comment | `addOrEditJiraIssueComment` | `wit_work_item_comment_write` (add) |
| Attach a file | `uploadAttachmentToJiraIssue` | `wit_work_item_attachment_upload` then `wit_work_item_attachment_link` |
| Link items | `createJiraIssueLink` | `wit_work_item_link_write` (link) |
| Change state | `transitionJiraIssue` | `wit_work_item_write` (update of the state field, when the type allows it) |
| Delete | **never used** (`delete_jira` tools are off by default) | **never used** |

The local Azure DevOps server (`@azure-devops/mcp`) offers its own tool names; map them by description in the `capabilities` step.

## Revision used for comparisons

- Azure DevOps: the work item's revision number (`rev`) and the comment and attachment lists.
- Jira: the issue's `updated` timestamp and changelog entries, plus the comment list (an edited comment has a different updated date).
