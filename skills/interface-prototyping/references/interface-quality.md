# Interface quality

Use this as a relevant checklist, not a requirement to generate every screen or artifact.

## Composition and design system

Start with the task and reading order. Group related content, distinguish primary/secondary actions and use consistent alignment, typography and spacing. Preserve existing tokens, component variants and brand. For a new direction choose a coherent palette, type scale, density and layout appropriate to the product. Avoid adding cards, gradients, animation or labels with no information purpose.

Build a small state inventory for the actual flow: initial, editing, validation, loading, success, empty, error, permission denied and recovery when applicable. State which actions are in scope, simulated or incomplete. A static collection of attractive screens is insufficient for a requested working workflow.

## Implementation checks

- Prefer meaningful landmarks/headings, buttons for actions, anchors for navigation, labels for controls and tables for tabular information.
- Use responsive layouts and content-driven breakpoints. Test long labels, dense data, narrow screens, zoom and scroll containment where relevant.
- Keep tokens centralized and components reusable; preserve the established framework. Use React/Next-specific advice only in those projects.
- Make form validation actionable; preserve entered data after errors and clarify destructive/irreversible actions when the product requires it.
- Provide accessible names, visible focus, useful contrast and status feedback. Respect reduced-motion preferences.
- For a modal check initial focus, contained tab sequence, closing behavior and focus restoration. Do not implement a custom widget without its expected keyboard semantics.

## Browser review

Inspect the actual rendered page, then exercise the agreed flows. Record tested browser/viewport and relevant data conditions. Check responsive reflow, clipping, overlap, reading order, input errors, focus and console/runtime errors. Check accessibility with applicable automated tools plus keyboard/manual inspection; record untested assistive-technology behavior.

Use roles/accessibility names and web-first assertions where supported. Wait for the relevant visible condition, not arbitrary delays or `networkidle`. A working mock proves the demonstrated client behavior; it does not verify the real provider.

## References and candidates

- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design): intentional composition and typography; adapt aesthetic preferences to the brief.
- [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines): review aid; project requirements and standards govern conflicts.
- [Vercel React best practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices): optional React/Next performance guidance.
- [Anthropic webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing): browser verification reference; use existing project tooling rather than adding Python solely for this guide.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- [Playwright best practices](https://playwright.dev/docs/best-practices) and [load-state API](https://playwright.dev/docs/api/class-page#page-wait-for-load-state): readiness and assertions.

These are not automatic installations. Check licenses, scripts, stack assumptions, permissions and data-sharing defaults before incorporating external files. Prefer first-party standards when a generic style guideline conflicts with correct interaction.
