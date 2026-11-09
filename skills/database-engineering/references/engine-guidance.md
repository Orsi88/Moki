# Engine guidance

## Select by actual environment

Use the established engine, product, version, compatibility level, ORM and migration tool. SQL Server, Azure SQL Database and Azure SQL Managed Instance are not interchangeable targets; neither are PostgreSQL and a provider's extra services. Do not provision a service to make a reference skill applicable.

## Implementation and query review

- Check types, sizes, precision, collation, null behavior, default expressions and date/time semantics against the approved model.
- Check FK/unique membership, tenant boundaries and dependent delete/update behavior.
- Parameterize values in application queries; validate/quote dynamic identifiers using the driver's supported mechanism.
- Consider transaction boundaries, isolation, lost updates, deadlocks and upsert conflicts for the actual operation.
- Derive indexes from workload, selectivity and write cost. Distinguish scans that are appropriate from scans caused by a bad estimate or conversion.

## Migration review

| Concern | Evidence to request or verify |
|---|---|
| Preconditions | Current schema revision, data violating new constraints, object dependencies |
| Compatibility | Behavior while old and new application versions overlap; read/write migration order |
| Transformation | Bounded backfill, progress checkpoint, duplicate prevention, validation counts/invariants |
| Concurrency | One migration owner, lock duration, other writers, concurrent deploys |
| Failure/retry | Which operations committed; whether repeated execution changes data again |
| Recovery | Restore capability, irreversible data loss, forward fix or tested downgrade limits |
| Postconditions | Schema matches intent, rows preserved/transformed correctly, relevant application behavior |

A successful empty-database migration does not prove an upgrade preserves populated data. An existence guard can race and does not protect an unguarded backfill. Do not assume a transaction reverses every DDL operation on every engine.

## Performance investigations

Record the query, parameters (masked), source of the plan, estimated/actual distinction, observation window, volume and relevant configuration. Start from the bottleneck the evidence supports. Compare the same operation under comparable conditions and retain correctness checks. Missing statistics or permissions limit the conclusion; do not install extensions or elevate privileges silently.

## Maintainer references and candidate skills

Read only the applicable section and verify time-sensitive claims against the target version. These links are research references, not automatic installations:

- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html).
- [Supabase Postgres Best Practices](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices).
- [Microsoft SQL skill catalog](https://github.com/microsoft/microsoft-sql): select the product-specific skill rather than loading the whole catalog.
- [Azure SQL schema migrations](https://github.com/microsoft/microsoft-sql/tree/main/plugins/microsoft-sql/skills/schema-migrations-safely).
- [Azure SQL execution plans](https://github.com/microsoft/microsoft-sql/tree/main/plugins/microsoft-sql/skills/read-execution-plan).

Keep the guidance version/date consulted in the run. Review license, executable resources and permissions before incorporating external skill files. No automatic cloud provisioning, extension installation or telemetry/data publication.
