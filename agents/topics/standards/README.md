# Standards

This area owns repo-wide conventions that are not specific to one product or
app.

## Topics

- [Architecture](architecture/README.md)
- [Testing](testing/README.md)
- [Deployment](deployment/README.md)
- [React Code](react-code/README.md)
- [Components](components/README.md)
- [Scripts](scripts/README.md)

Domain-specific facts should live with the product or app that owns them. For
example, script conventions belong here, but the meaning of an asset-pipeline
generation script belongs under `products/asset-pipeline-3d`.

## Documentation State

Agent-facing docs should describe the current state by default. Do not carry
historical narrative forward unless the document explicitly exists for one of
these purposes:

- experimental lanes used as evidence or data-mining sources;
- status documents that intentionally track a task list, decision sequence, or
  accepted/rejected artifact list;
- archive documents clearly marked as historical.

When history becomes production policy, promote the durable current contract
into the owning production document and leave the old trail behind.
