# Routines and notifications

A routine checks a project's sources, compares them with the last successful reading and reports what entered, changed or left. It can notify you or ask an AI to prepare an analysis for review. Applying proposed file changes always requires your approval.

## Before you start

Open the correct workspace and project. For an external query, first [connect and test a read-only MCP server](mcp-servers.md#connect-a-server-step-by-step) that applies to this project. Have the real tool name, its parameters and the query or filter ready. For AI analysis, install and sign in to the AI tool in **Settings › My AIs**.

The clock runs while Moki is running. **Keep Moki in the background** and **Start Moki when you sign in** are separate preferences; both start off.

## Create a routine

1. Open **Settings › Routines and notifications › New routine**.
2. Set **Name** and **Project**. In **What this routine should do**, describe the analysis you want, such as summarizing changed requirements and identifying possible impacts. Use your own objective and confirmed project rules.
3. In **What should it watch?**, choose a source from the table below. **Add another source** lets one routine follow more than one source.
4. In **When should it run?**, choose **Manual**, **Daily**, **Weekly**, **Monthly** or **Interval**. For an hourly check, select **Interval** and enter `60` minutes. Confirm the time zone. Weekly schedules also need weekdays; monthly schedules need the day of the month.
5. Choose the response mode. **Monitor and notify** compares sources without starting an AI. **Prepare an analysis for review** uses the selected **AI tool**. Keep **Only analyze when something changes** checked if the first reading should establish a baseline and later changes should trigger the AI.
6. Choose in-app and system notifications independently, then click **Save routine**.
7. Click **Run now** and open **History** to verify the result before relying on the schedule.

Each source has its own configuration:

| Source | What to enter |
|---|---|
| Query in a connection | A read-only connection, the tool that reads the query, and one `name: value` parameter per line |
| Project files | One existing project-relative file path per line, such as `context/business-rules.md` |
| Project folder | A project-relative folder, such as `context`, and whether to include subfolders |

Project file and folder sources stay inside this project. Hidden paths and execution folders are excluded from monitoring.

## Example: follow a saved Azure DevOps query

These are placeholders, not real project or query identifiers. Replace them with your provider's actual values.

1. Create or test the local Azure DevOps MCP connection following [MCP servers](mcp-servers.md#example-local-azure-devops-mcp). It must be on, set to read data and available to the project.
2. Create a routine and choose **Query in a connection**. Select that connection.
3. If the tested server offers `wit_query`, enter that name in **Tool on that server**. Other server versions may offer different tools: use the contract your server actually exposes.
4. In **What to search (optional)**, enter:

   ```text
   action: get_results
   id: YOUR_SAVED_QUERY_ID
   project: YOUR_AZURE_PROJECT
   top: 1000
   ```

   The routine's Moki project and the Azure DevOps project can have different names. `project` here is the actual Azure DevOps project. `{{project.name}}` substitutes the Moki project's name, so use it only when those names match.

5. For a hierarchical query using this contract, leave **Field with the list**, **Field with each item id** and the pagination fields empty. Placeholder text such as `value` and `id` is a hint, not a saved value. Moki validates the server's untrusted-content envelope, deduplicates source and target item IDs, then reads fields and revisions through `wit_work_item` with action `get_batch` on the same read-only connection. These items need to be readable by your account.
6. Save and click **Run now**. The first successful check should complete with **Baseline recorded. Nothing to approve yet.** Subsequent checks compare each item's revision and content and detect items entering or leaving the query.

The server's query default is `top: 50`. Set an explicit limit appropriate for your query. If the unique item count reaches the limit, Moki stops because this query contract has no continuation cursor and completeness cannot be proved. Increase `top` or narrow the filter until the complete result is below the limit. A routine accepts up to 10,000 records and approximately 50 MB of serialized data. Invalid or incomplete item batches fail the check; they never replace a successful baseline.

## Advanced fields for other result formats

Most lists and IDs are found automatically. Use **Advanced** only after checking the tool's actual response:

| Field | Meaning |
|---|---|
| Field with the list | A dotted path to the array, for example `data.items` |
| Field with each item id | A stable, unique identifier inside each record, for example `key` |
| Next page parameter | The tool's top-level argument that receives the cursor |
| Field with the next page | A dotted path to the next cursor in the response |

Configure both pagination fields together. Cursor-based sources stop at 100 pages and reject repeated cursors. Explicit list or identifier fields keep the custom interpretation you chose; they disable the automatic hierarchical Azure query reader. For flat Azure results containing only IDs and URLs, the generic reader compares those references, not the item's internal fields or revisions.

## Read the first result and later analyses

Open **History** and expand the execution to see its result or error. The first successful reading is the reference for later comparisons; with analysis only on changes, it does not start the AI or ask for approval. An unchanged source produces **No change since the last successful check.**

In analysis mode, a changed source starts the linked operation. The execution stays waiting while the AI prepares its output. **Approvals** becomes actionable only after the analysis and operation handoff are delivered. Review the findings and exact proposed file contents before approving. Opening a notification or marking it read never approves a proposal.

The bell supports **Mark all as read**, closing one notification with its ×, and **Clear all**. Closing notifications does not archive the routine or approve its proposals. Its next relevant execution can create a new notification.

## Keep checks running and manage the routine

In **Preferences**, enable scheduling and, if needed, background execution and startup at sign-in. Set **Concurrent AI analyses** to limit background analyses; `0` pauses AI analysis while monitoring continues. History retention is configured per routine count.

In the routine's **More actions** menu, **Pause** stops its schedule, **Resume** enables it again, **Duplicate** creates another routine and **Archive** removes it from the active list while preserving history. A missed check can run once when Moki comes back if that option is enabled.

## Troubleshooting

Use the execution's message to choose the next check:

| Symptom | What to check |
|---|---|
| Connection is absent from the routine form | It must be on, read-only and available to the selected project in the current workspace |
| MCP test succeeds but the query fails | The actual tool name, action, query ID, provider project and the account's query/item permissions |
| Query did not return a list | Verify the response shape and any explicit advanced path; use Moki 0.5.7 or newer for the supported Azure DevOps envelope and hierarchical query reader |
| Query reached its result limit | Increase `top` or narrow the query; the default is 50 |
| Item batch was incomplete or invalid | Check permissions and item availability, then retry after resolving the error; the last successful baseline remains intact |
| No AI analysis on the first run | Expected when **Only analyze when something changes** is enabled; the first run establishes the baseline |
| Analysis stays waiting | Check the selected AI tool, its login, the operation's output/handoff and the concurrent-analysis limit |
| Schedule stops when the window closes | Enable background execution and keep the Moki process running |

## See also

- [MCP servers](mcp-servers.md)
- [Settings](settings.md)
- [Agents and operations](agents.md)
- [Runs and deliverables](runs.md)
