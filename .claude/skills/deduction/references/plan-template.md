# Investigation plan template

Short: the user reads it in one minute and approves or adjusts. Labels in the deliverable language.

```markdown
# Investigation plan — <topic>

**Purpose:** <understand | map risks and tests | decide | support a position | other: …> — <what the user will do with it, one line>
**Types:** <legal | historical | market | tools | technology and security | science | business domain | organization> (see investigation-types)
**Frame:** when <today | date | period> · where <country, jurisdiction, market> · context to reconstruct <actors, motives, circumstances>
**Known context:** <versions, protocols, vendors, sector — only what was given; or "none given">. Internal identifiers (hosts, ids, credentials) are not copied here; say only that they exist and stay out of searches.
**Assumptions to confirm:** <what was assumed instead of asking; or "none">

## Key questions
1. <question the dossier must answer>
2. …
(3 to 8 questions, ordered by importance)

## Scope
- In: <…>
- Out: <…>
- Period and languages: <e.g. 2018–today; English and Portuguese>

## Candidate sources by tier (verified during research)
- Primary: <e.g. RFC 6749, OASIS SAML 2.0 core and profiles, OpenID Connect Core>
- Reference: <e.g. OWASP ASVS V2/V3, OWASP SAML and OAuth cheat sheets, NIST SP 800-63C>
- Academic: <e.g. papers on SAML signature wrapping, OAuth mix-up attacks>
- Practice: <e.g. vendor security advisories, public bug bounty reports>
- Signals: <e.g. forum threads on common misconfigurations>

## Search strings
- `<generic query 1>`
- `<generic query 2>`
(no project data: no customer names, internal hosts, ids or logs)

## Dossier sections
Mandatory sections + <the purpose's sections, see the dossier template>. Spreadsheet: <no | yes: risk catalog>.

## Stop criterion
Each key question answered or declared a gap, then saturation or at most <N> search rounds per question (default 3).
```
