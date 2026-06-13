# Pipeline App

This area owns the Polylith `pipeline` approval app: shell ownership, page
registration, routing, feature boundaries, view services, current review pages,
shared presentation surfaces, and the app-side Asset Review page.

Detailed generated asset contracts, hashes, queue semantics, and build stages
belong to [Asset Pipeline 3D](../README.md) and its contract/runtime docs.

## Main Documents

- [App Shell](app-shell.md): app shell, page registry, view services, feature
  controllers, shared transport, current review pages, and cleanup notes.
- [App Summary](app-summary.md): compact cross-topic app context.
- [Review Data Boundary](review-data-boundary.md): rule that review pages
  consume server-synthesized view models and send domain actions back.
- [Asset Review Page](asset-review-page.md): app-side Asset Review page
  summary.
- [New Page Runbook](new-page-runbook.md): settled feature shape for adding a
  pipeline app page.
- [Canonical Prompt](canonical-prompt.md): app requirements and architecture
  prompt.

## Current State

`src/pipeline/main` bootstraps the React root, `features/app` owns the visible
shell, and stage features own their own page workflow.

Current source-side flow:

```text
Reference Approval -> Optional Parts -> Assignment -> Render Review
```

Generated-asset pages include Base Tile Selection and Asset Review.

Current shell behavior:

- The app shell owns tabs, page mounting, the main header, clean URL routing,
  browser history behavior, and the manifest-backed tileset selector.
- The active tileset manifest records routing facts only. Canonical tileset
  state remains owned by each `pipeline.json`.
- Page activation is Polylith/build-file driven through `@polylith/features`.
  Do not directly import individual stage features from `src/pipeline/index.js`.

Review page data is intentionally decoupled from canonical backend storage.
The app consumes server-synthesized review views and sends user intent as
domain actions through views/controllers and `server-model`; the server owns
canonical mutation.
