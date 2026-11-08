# Source tiers and evaluation

Sources are ranked by how much a statement can rest on them. What fits each tier depends on the topic; the examples show the idea.

| Tier | What it is | Examples by topic | Use |
|---|---|---|---|
| **1 — Primary** | The origin of the fact or rule | Standards and specifications (RFC, ISO, W3C, OASIS, OpenID), laws and regulations, official data and statistics, peer-reviewed papers, the vendor's own specification or security advisory, CVE/NVD records, court decisions | Can support a key claim alone |
| **2 — Recognized reference** | Expert synthesis by a body or author with a reputation to lose | OWASP (ASVS, WSTG, Cheat Sheets), NIST special publications, CWE/CAPEC, ISTQB syllabi, textbooks and books from established publishers, systematic reviews, professional bodies, government agencies' guides | Supports a key claim with one more independent source, or alone when it is the authority of the field |
| **3 — Practice** | Real use, reported by people who did it | Vendor documentation and guides, engineering blogs of known companies, conference talks, case studies, public bug bounty reports, post-mortems, educational courses from universities | Shows how things happen in practice; corroborates tiers 1–2 |
| **4 — Signals** | Community discussion and opinion | Forums (Stack Overflow, Reddit, GitHub issues, mailing lists), personal blogs, Q&A sites, social media | Shows real problems, pitfalls and questions people face; never proof on its own — label as *weak* unless corroborated |

Not sources: AI-generated pages without authorship, content farms, pages that copy others without attribution. Prefer the origin they copied.

## Evaluating a source (lateral reading)

Before using a source, answer in a few words (record the answer in the source log only when it lowers trust):

- **Who** — author or organization; expertise; does another reputable source vouch for them?
- **When** — publication and update date; is it current for this topic?
- **Evidence** — does it show data, method, references, or only assert?
- **Interest** — does it sell what it recommends? Is it sponsored?
- **Corroboration** — do independent sources say the same? Are they really independent, or do they copy one origin?

Scientific papers: note the venue (journal or conference, peer-reviewed or preprint), the sample or method, and whether later work cited it to confirm or to refute.

## Independent sources

Two sources are independent when neither derives from the other and they do not share the same origin. A vendor blog quoting the vendor's documentation is one source. Two papers by the same group on the same data count as one.
