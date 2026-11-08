# Investigation types

The **type** says what kind of subject is investigated; the **purpose** says what the dossier is for. One investigation can combine types (a law's history is *legal* and *historical*; choosing an SSO provider is *tools* and *technology*). In the `briefing`, identify the types; in the `plan`, name them and take each type's questions, sources and pitfalls from here.

## Time and context frame (every type)

Before searching, fix the frame and write it in the plan:

- **When**: the reference date or period ("today", "in 1994", "2015–2020"). A question about the past is answered with what was true **then**: sources from or about that time, and the text or version in force at that date. Say what changed afterwards, separately.
- **Where**: country, jurisdiction, market, language, sector — whatever limits the answer.
- **Context to reconstruct**: who the actors were, what problem or event motivated it, what the alternatives were, what influenced it (economic, political, social, technological), and what came of it.

Never answer a "how was it" question with today's sources without checking that they describe that time. Every source in the log has its date; a source written later about the past is labeled as later interpretation.

## Legal and regulatory

Laws, decrees, regulations, norms of regulators, standards with legal force, court decisions.

- **Always cover**: jurisdiction; the exact act (number, date, official name); the text **in force at the reference date** (original publication, amendments, revocations and the version valid then); the legislative history (bill, author, statement of reasons, debates, changes during the process, votes, vetoes); the context that motivated it; how it was interpreted and applied (case law, regulators, doctrine); what changed since.
- **Primary sources**: official gazettes and legislation portals (e.g. Planalto, LexML, Câmara and Senado portals, Diário Oficial; EUR-Lex; congress.gov; legislation.gov.uk), parliamentary records, court websites and decisions, regulators' acts.
- **Reference and context**: legal doctrine and textbooks, academic articles, press archives of the time (e.g. Hemeroteca Digital Brasileira, newspaper archives), reports of the period.
- **Pitfalls**: quoting the current consolidated text for a past date; mixing jurisdictions; relying on summaries instead of the act; confusing a bill with the enacted law; missing a later revocation or court ruling.
- **Dossier**: timeline of the act (Mermaid `timeline`), the relevant text at the reference date (quoted, with the clause), legislative history, context, interpretation and application, changes since. What the sources say — not legal advice.

## Historical and contextual

The origin and course of an event, decision, organization, practice or idea.

- **Always cover**: chronology; actors and their positions; causes and circumstances; what contemporaries said (primary sources of the time) versus what was said later (interpretations, historiography); consequences; disputed points.
- **Sources**: documents and records of the time, newspapers and magazines of the period, archives and libraries, memoirs and interviews (marked as personal accounts), historians' work and academic articles.
- **Pitfalls**: anachronism (judging with today's concepts), hindsight, one-sided accounts, later myths repeated as facts.
- **Dossier**: timeline, actors, context, the account supported by the evidence, divergences between accounts.

## Market research

A market, segment or industry: size, players, behavior, trends.

- **Always cover**: the market definition used (what is in and out — sources define it differently); size and growth with year, unit, currency and method; segments; main players and their share or position; business models and prices; customers and buying behavior; drivers, barriers and regulation; trends with evidence; where the data comes from.
- **Sources**: official statistics (e.g. IBGE, Eurostat, national statistics offices), regulators' and central banks' data, company filings and annual reports, industry associations, academic studies, analyst reports (often paywalled: cite the public summary and say so), business press.
- **Pitfalls**: one paid report's number repeated by dozens of press releases (count it once and find the origin); sponsored studies; incompatible market definitions compared as if equal; old figures presented as current; forecasts presented as facts.
- **Dossier**: market map (Mermaid), figures table (value, year, definition, method, source), players table, trends with evidence and confidence, gaps in data.

## Tools and products

Choosing or understanding software, services, devices or providers.

- **Always cover**: the need and the **criteria** (agree them in the plan: features, cost, integration, security and compliance, support, license, maturity, lock-in); the long list and why candidates were dropped; for each short-listed option: what it does, pricing (with the access date), license, integrations, security and compliance statements, release activity and changelog, community or vendor health, known limitations and complaints; total cost and exit cost when relevant.
- **Sources**: official documentation, pricing and terms pages, changelogs and release notes, security and compliance pages, repositories (activity, open issues), independent reviews and benchmarks with their method, user communities and forums (signals), analyst comparisons (state who paid, when known).
- **Pitfalls**: affiliate "top 10" lists; vendor benchmarks taken as neutral; outdated prices and features; comparing a free tier with a paid one; features announced but not released.
- **Dossier**: criteria × option comparison table (each cell with its source), trade-offs, recommendation for stated conditions (purpose *decide*), what would change it.

## Technology and security

How a technology, protocol, architecture or system works, its risks and good practice.

- **Always cover**: the versions in scope; how it works; standards and specifications; known vulnerabilities and incidents (CVE, advisories) with dates; recommended controls; how it is tested; what changed between versions.
- **Sources**: specifications and RFCs, vendor documentation and advisories, CVE/NVD, OWASP, NIST, CWE/CAPEC, academic security research, conference talks, public bug bounty reports.
- **Pitfalls**: advice for an old version applied to the current one; vendor marketing as security evidence; proof-of-concept hype without context.

## Science, health and education

Questions answered by research evidence.

- **Always cover**: the type and quality of each study (systematic reviews and meta-analyses, randomized trials, observational studies, case reports, expert opinion), sample and method, consistency across studies, guidelines and consensus statements, retractions and corrections, how recent the evidence is.
- **Sources**: PubMed, Cochrane, Google Scholar, SciELO, ERIC (education), guidelines of recognized bodies, Retraction Watch.
- **Pitfalls**: a single study as proof; press coverage instead of the paper; correlation as causation; predatory journals; retracted papers.
- **Dossier**: evidence table (study, type, sample, finding, quality). What the evidence shows — not medical or professional advice.

## Business domain and processes

How a field of business works: its rules, processes, actors and vocabulary.

- **Always cover**: actors and their roles, the main processes (flow diagram), regulators and rules, standards of the field, glossary, common problems and practices.
- **Sources**: regulators, industry associations and standards bodies, textbooks and courses, practitioners' material, case studies.
- **Dossier**: concept map, process flow, glossary table, rules with their source.

## Organizations

Companies, institutions, public bodies.

- **Always cover**: identity and registration, history, ownership and structure, activities and figures, regulatory and legal record, reputation and controversies with sources.
- **Sources**: official registers and filings, the organization's own reports (marked as self-description), regulators, court records, press.
- **Limits**: people only in their public role and as publicly documented; no personal data of private individuals, no profiling of private persons.
