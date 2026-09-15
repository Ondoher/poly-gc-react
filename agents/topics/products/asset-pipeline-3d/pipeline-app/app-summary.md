# Pipeline App Summary

Use this short summary when another topic needs to understand the pipeline app
without loading the full app topic.

## Owns

The `pipeline-app` topic owns the Polylith `pipeline` approval app:

- shell, tabs, page mounting, and browser routing
- page registration through `app-pages`
- view registration through `views`
- feature-owned page controllers, view services, React components, helper
  models, CSS, and page workflow
- shared pipeline presentation primitives
- app-side behavior for future review pages such as Asset Review

It does not own detailed SVG/asset stage contracts, generated artifact schemas,
hash definitions, or GLB build rules. Those belong to
[Asset Pipeline 3D](../summary.md).

## Current App Shape

```text
src/pipeline/main
  bootstrap + React root mount only

src/pipeline/features/app
  visible shell, header, tabs, page mounting, routing, tileset selector

src/pipeline/features/<stage>
  stage-owned controller, view service, React page, model/helpers, CSS
```

React pages and components talk to their owning page view. Views relay user
intent to controllers. Controllers own server/model calls, workflow transitions,
and cross-page navigation.

Review page data is intentionally decoupled from canonical backend storage.
Pages consume server-synthesized review views and send user intent as domain
actions or review-specific draft payloads; the server owns canonical state
mutation.

## Current Flow

```text
Reference Approval -> Optional Parts -> Assignment -> Render Review
```

- Reference Approval reviews Stage 0 reference bindings and palette state.
- Optional Parts reviews source-side optional label/glyph decisions and can
  reset the current tileset before rerunning normalization and optional
  assignment.
- Assignment reviews source semantic bindings after alignment.
- Render Review edits and accepts final rendering options.

The app shell owns the manifest-backed tileset selector. The manifest owns only
routing facts: active tileset id and known tileset ids. Canonical pipeline
state remains in each tileset's `pipeline.json`.

## Current Rules

Engineering authority is selected by the [manifest](../../../standards/manifest.md), with local refinements in the [overlay](../../../standards/overlay.md). Use the [new-page runbook](new-page-runbook.md) for Pipeline registration/API examples and the [topic status](README.md#standards-adoption-status) for adoption work.

## Deep Links

- [Pipeline App README](README.md)
- [Review Data Boundary](review-data-boundary.md)
- [App Shell](app-shell.md)
- [Asset Review Page](asset-review-page.md)
