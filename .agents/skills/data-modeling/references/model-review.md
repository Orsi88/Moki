# Model review

Load during discovery and consistency review. Apply only the parts relevant to the chosen model level.

## Understand the domain

- Identify the actors, operations, business objects and terms with multiple meanings.
- Trace the origin of each relationship; clarify minimum/maximum cardinality and whether it changes over time.
- Distinguish current state from history, ownership from authorship, a person from a login and a business event from a technical log.
- In an existing system, report both enforced constraints and documented intent. An absent FK does not prove that there is no relationship; matching column names do not prove there is one.

## Review the structure

| Concern | Questions |
|---|---|
| Identity | What uniquely identifies the business object? Is uniqueness global, per tenant or time-bound? |
| Relationships | Is the link optional? Does many-to-many need an associative entity with its own attributes? |
| Integrity | Which restrictions can be expressed through PK, FK, UNIQUE, NOT NULL or CHECK? Which require another mechanism? |
| Attributes | What do absence, zero and empty string mean? Are money precision and time-zone semantics explicit? |
| Lifecycle | Can the object be removed, archived or anonymized? What happens to dependents and historical facts? |
| Workload | Which reads/writes matter? Is denormalization justified by an observed need and a consistency strategy? |
| Tenancy | Can a child reference a parent in another tenant? How will the selected engine enforce the intended boundary? |

Do not decide all of these for the user. Resolve only what affects the requested design and keep unsupported choices visible.

## Reconcile representations

Walk every entity/table and every relationship in both directions. Match names, key membership, uniqueness, nullability, types and delete/update actions where those representations contain them. Explain any level-of-abstraction difference instead of inventing a physical detail to fill the diagram.

Try representative creation, change, duplicate, removal and historical lookup situations. A review scenario can reveal a missing decision; it does not authorize creating real data.

## Diagram craft

Choose a clear reading direction, group related entities and label relationships with meaningful verbs. Show the essential attributes at the current level; use linked detail views when a single canvas becomes unreadable. Check crossings, clipped labels and legend consistency at normal reading size. A successful parse proves syntax only.

## Sources and optional specializations

Consult documentation for the actual engine/version when physical behavior matters. These are references, not installed dependencies or instructions overriding Moki:

- [Mermaid ER diagrams](https://mermaid.js.org/syntax/entityRelationshipDiagram.html): relationship notation, keys and attributes.
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): engine-specific null, unique and referential behavior; FK declaration does not automatically index the referencing columns.
- [Supabase Postgres Best Practices](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices): optional Postgres guidance.
- [Microsoft Azure SQL schema design](https://github.com/microsoft/microsoft-sql/tree/main/plugins/microsoft-sql/skills/design-azure-sql-schema): Azure SQL Database specifics; do not assume applicability to another engine or product.

Read only applicable guidance; keep the source version/date used in the run. Review licensing and executable resources before any external skill incorporation. Do not install, provision infrastructure or upload data as a side effect of modeling.
