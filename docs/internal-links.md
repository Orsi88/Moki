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
