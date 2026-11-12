# Links inside a project

Use standard Markdown links to connect documents:

```markdown
[Rules](../inbox/story.md#rules)
```

Paths are relative to the document containing the link. Moki also accepts paths rooted at the active project, such as `/inbox/story.md`, and existing note mentions written relative to the project.

Targets can be a file, a Markdown heading, a stored Markdown or PDF comment (`#comment-<id>`), or a PDF page (`#page=3`). Heading slugs are lowercase with spaces replaced by hyphens and punctuation removed. Repeated headings receive numbered suffixes. Spaces and reserved characters in paths and comment ids must be URL encoded.

Click a link in **Reading view**, or Ctrl+click (Cmd+click on macOS) an explicit link in the formatted editor. Opening an anchor brings the target into view and outlines it, including when the document is already open. A comment link opens the comments column. PDF comments use PdfCraft when available or Moki's local PDF support; page links use the built-in pages viewer.

In Reading view, existing file paths written as plain text or inline code also become clickable. Code blocks, existing links, URLs, emails and missing file paths are left as written. This changes the view only; the source file is not rewritten.

Note mentions inserted with `@` in the source editor use document-relative paths. Older project-relative mentions still work. Navigation remains inside the active project. A missing file or anchor produces a message instead of silently opening a different document.
## Copy and follow references

In a file's tree menu, **Copy link** copies a Markdown link rooted at the active project. A copied link works from any document in the same Moki project. When authoring a portable Markdown deliverable for another viewer, make the destination relative to that document.

In Reading view, the **#** beside a heading copies a link to that section. A Markdown link pasted or typed in the formatted editor becomes a link, so a copied link is pasted as a reference.

In a terminal, Ctrl+click (Cmd+click on macOS) an existing project path to open it. Plain clicks keep the terminal active. Wrapped lines and wide characters are handled; URL-encoded paths can represent spaces. A computer path is accepted only when it identifies the active project folder. Missing files and references to other projects are not made into terminal links.
