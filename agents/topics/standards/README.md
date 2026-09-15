# Standards

Engineering applicability is owned by the [manifest](manifest.md). Repository additions and replacements are owned by the [overlay](overlay.md). Canonical [governance](C:/Users/gande/.codex/documentation/standards/documentation.md) defines precedence. Topic documents below retain project facts and links to engineering authority.

## Topics

- [Rules Comparison](rules-comparison.md): differences, specificity, and
  additional local rules, grouped by rule type.
- [Reconciliation Report](reconciliation.md): normalization findings and
  developer decisions.

- [Architecture](architecture/README.md)
- [Testing](testing/README.md)
- [Deployment](deployment/README.md)
- [React Code](react-code/README.md)
- [Components](components/README.md)
- [Scripts](scripts/README.md)

## Documentation State

See the [topic continuity overlay](overlay.md#add-topic-continuity) for local documentation updates and history placement. Product and app topics own domain facts.

## Normalization Status

The approved standards reconciliation is applied. The [report](reconciliation.md) owns validation and completion evidence; [STANDARDS.md](../../../STANDARDS.md) is the generated developer reference.

## Formatting Status

Repository-local Prettier is configured by `.prettierrc.json` and
`.prettierignore`; `package.json` owns the pinned version and formatting commands.
The root lockfile is retained. Setup preflight passes. Repository-wide
formatting has been applied with `npm run format`, and
`npm run format:check` passes. Generated artifacts and independent app repositories
remain excluded by the formatter configuration.
