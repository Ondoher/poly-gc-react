# Pipeline App

Use this topic for the Polylith `pipeline` approval app: shell ownership, page
registration, routing, feature boundaries, view services, current review pages,
shared presentation surfaces, and Asset Review page architecture.

Detailed 3D asset pipeline stage contracts and artifact schemas remain owned by
[3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md).

## Main Documents

- [Pipeline UI Refactor](/c:/dev/poly-gc-react/agents/topics/pipeline-app/pipeline-ui-refactor.md)
  captures the current pipeline UI refactor: the app shell, page registry,
  view services, feature controllers, shared transport, current review pages,
  and remaining cleanup notes.
- [Pipeline App Summary](/c:/dev/poly-gc-react/agents/topics/pipeline-app/app-summary.md)
  is the small cross-topic summary for agents that need app context without
  loading the full topic.
- [Review Data Boundary](/c:/dev/poly-gc-react/agents/topics/pipeline-app/review-data-boundary.md)
  centralizes the rule that review pages consume server-synthesized view
  models and send domain actions back, rather than mirroring canonical
  `pipeline.json` structures as editable UI state.
- [New Page Runbook](/c:/dev/poly-gc-react/agents/topics/pipeline-app/new-page-runbook.md)
  records the settled feature shape for adding a new pipeline app page.
- [Asset Review App Summary](/c:/dev/poly-gc-react/agents/topics/pipeline-app/asset-review-summary.md)
  is the small cross-topic summary for the app-side Asset Review page.
- [Canonical Prompt](/c:/dev/poly-gc-react/agents/topics/pipeline-app/canonical-prompt.md)
  describes the app requirements well enough for an agent to build an
  equivalent app architecture and behavior.

## Current State

`src/pipeline/main` bootstraps the React root, `features/app` owns the visible
shell, and stage features own their own page workflow.

Current app flow:

```text
Reference Approval -> Optional Parts -> Assignment -> Render Review
```

Current live pages:

- `reference-approval`: Stage 0 reference binding, palette review, draft save,
  accept, and part-box preview mode.
- `optional-part-assignment`: optional label/glyph decisions, source hint
  controls, guarded tileset reset, accept, and advancement to Assignment.
- `source-assignment`: source semantic binding review, part-box mode, bind
  components, unbind components, change assignment configuration, rerun
  assignment, and Source Approval acceptance.
- `final-rendering-options`: user-facing `Render Review`, final rendering
  option edits, rerender, and final-rendering review acceptance.

Current shell behavior:

- The app shell owns tabs, page mounting, the main header, clean URL routing,
  browser history behavior, and the manifest-backed tileset selector.
- The active tileset manifest records only routing facts: known tileset ids and
  active tileset id. Canonical tileset state remains owned by each
  `pipeline.json`.
- Source-side page controllers reset their page state when the shell changes
  the active tileset, so stale page data is not reused across tilesets.
- Page activation is Polylith/build-file driven through `@polylith/features`;
  do not directly import individual stage features from `src/pipeline/index.js`.

Current shared presentation primitives:

- `Button`
- `Pill`
- `ColorSwatch`
- `BoundsBox`
- `PartsComponentSelector`

All current review pages use contained page layouts: the app shell owns the
outer viewport and tabs, each page owns its own header and internal scroll
region, and pages should not assume shell chrome dimensions.

Current app work:

- Asset Review is implemented in `src/pipeline/features/asset-review`.
  It owns feature boundary, route/tab registration, card layout, and 3D preview
  presentation. Generated asset contracts, hashes, queue semantics, and build
  stages belong in
  [3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md).
- The large `pipeline-ui-refactor.md` file should be treated as the live
  source until it is split into focused app documents such as architecture,
  current state, and feature pages.

## Purpose

The app is the stage-approval UI for SVG preprocessing and related
asset-pipeline work. This topic owns application structure, routing, feature
decomposition, and page mounting. It does not own detailed asset pipeline
artifact schemas.

Review page data is intentionally decoupled from canonical backend storage.
The app consumes server-synthesized review views and sends user intent as
domain actions through its views/controllers and `server-model`; the server
owns canonical mutation. See [Review Data Boundary](review-data-boundary.md).

## Top-Level Shape

The app separates three layers:

```text
main/
  bootstrap + React root mount only

features/app/
  visible app shell: header, page region, routing/page mounting behavior

features/<stage>/
  individual approval/review pages
```

Ownership:

- `main` owns application startup and React root bootstrap only.
- `features/app` owns the shell: header, page region, route/page request
  handling, and page mounting boundary.
- stage features own their own controllers, views, React components, styles,
  and workflow.
- shared services own app-facing registries such as pages, views, and API
  access.

## Root Flow

The bootstrap flow is:

```text
index.js
  -> registry.start()

main-controller.ready()
  -> asks app-controller for the shell component
  -> tells main-view to render it

main-view
  -> creates React root at #main-content
  -> renders main/App.jsx

main/App.jsx
  -> minimal root wrapper
  -> renders the shell supplied by features/app
```

The architectural point: `main` has no stage/page policy.

## Shell And Page Flow

The app shell owns navigation and page mounting:

```text
features/app/controller.js
  -> owns shell behavior
  -> watches browser history/URL events and UI page-request events
  -> resolves those events to registered page controllers

features/app/view service
  -> registered view boundary for the shell
  -> returns React shell presentation

AppShell.jsx
  -> renders main header and page region
  -> forwards page requests to app-controller

stage page controller
  -> mount(...)
  -> mounts its registered view into the shell/page region
```

The shell itself should be treated as a feature, not loose bootstrap plumbing.
That keeps it swappable later for alternate shells, review layouts, or parallel
experiments without forcing stage features to know which shell is active.

## Shared Services

App-facing services:

- `app-pages`: registry of available pages/menu items. Stores page id, label,
  route, order, and controller service name.
- `views`: registry mapping view ids to REMVC view services, so controllers can
  mount named views without importing React components directly.
- `server-model`: centralizes `/api/pipeline/*` calls and uses the shared `io`
  service for request handling.
- shared page model helpers live in `src/pipeline/models`; page-specific
  models may remain inside their owning feature.
- `url`: owns clean browser URL parsing, URL construction, and History API
  event handling for app routing.

## Registered Views Vs React Components

A registered pipeline view is a REMVC view service, not just a React component.

- Controllers talk to view services.
- View services translate controller intent into presentation state, callbacks,
  events, and component choice.
- React components are the concrete presentation returned by view services.
- Stage controllers should mount registered view ids rather than importing
  stage React components directly.
- React should focus on rendering and local interaction forwarding.
- React pages/components should emit user intent to their owning page view, not
  directly to controllers or models.

## Stage Features

Each stage page should behave like a removable feature:

- registers one or more pages with the page service
- exposes a controller with a `mount()` method
- keeps stage-specific data loading/actions out of the top-level shell
- keeps stage-specific components/styles inside the stage feature
- uses shared services/models only for cross-stage capabilities

Current stage features:

```text
reference-approval
optional-part-assignment
source-assignment
final-rendering-options
asset-base-tile-selection
asset-review
```

Use [New Page Runbook](new-page-runbook.md) when adding another page feature.

## Shared Structure Review Surface

Reference Approval, Optional Parts, and Assignment render similar
part/component review surfaces, but each feature owns a different artifact and
workflow.

Shared presentation should cover:

- face preview with component overlays
- semantic part list
- detected/normalized component list
- binding state
- selection, bind, unbind, incomplete, and unbound states
- summary/header counts

The shared layer remains presentation-oriented. Reference Approval, Optional
Parts, and Assignment keep separate controllers/models because they own
different artifacts.

Artifact ownership:

- Reference approval owns reference structure normalization, reference binding
  updates, palette validation, and acceptance stamping.
- Source normalization owns non-semantic source component extraction and
  normalized component status.
- Optional part assignment owns pre-alignment optional label/glyph
  expectations, source-provided bindings, absent/generated decisions, and
  component reservations.
- Assignment owns the full source part map after alignment.

Both can feed a common semantic face review shape into shared components.

## Route Model

The app-shell controller owns history and route handling.

Current routes:

```text
/pipeline/reference
/pipeline/optional-parts
/pipeline/assignment
/pipeline/render-review
```

Each route resolves to a registered stage page. The header renders registered
pages as links, and route changes mount the selected feature.
