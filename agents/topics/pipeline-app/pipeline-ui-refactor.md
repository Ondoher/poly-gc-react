# Pipeline UI Refactor Status Log

Use this as the pipeline app refactor status/checkpoint log. It intentionally
keeps historical checkpoints because it records how the current app shape was
restored and checked. For current-state context without history, use
[Pipeline App Summary](/c:/dev/poly-gc-react/agents/topics/pipeline-app/app-summary.md)
or the [Pipeline App README](/c:/dev/poly-gc-react/agents/topics/pipeline-app/README.md).

This document replaces the earlier `incremental-page-extraction.md` topic name.
Incremental page extraction was the preparation phase; the current subject is
the full pipeline UI refactor.

## Current Intent

The pipeline UI is being rebuilt as a registry-centered REMVC application:

- `src/pipeline/main` owns bootstrap and React root mounting only.
- `features/app` owns the visible shell, page tabs, page activation, and route
  handling.
- stage features own their controller, view service, React page component,
  helper models, feature CSS, and page workflow.
- `app-pages` owns page availability and tab metadata.
- `url` owns clean browser URL parsing, URL construction, and History API
  `popstate` events for app routing.
- `views` owns view-service lookup so controllers mount named views instead of
  importing React components directly.
- `server-model` is the pipeline API boundary, and all backend calls flow
  through the shared `io` service.

`src/pipeline_original` remains the behavior reference for page restoration.
Do not bring old `App.jsx` orchestration back into the live app.

## Extracted Stash Context

The earlier stashed topic `pipeline-app-refactor` is historical, but several
decisions still define the live refactor:

- `main` and `app` are deliberately different concepts. `main` owns startup and
  React root mounting; `features/app` owns the visible shell and page mounting
  boundary.
- The app shell is a feature. It can be swapped or iterated independently from
  stage pages.
- Feature activation is build-file driven through the pipeline build
  configuration and feature side-effect imports. Do not add one-off direct
  imports for individual stage features into `src/pipeline/index.js`.
- Each feature should own its `build.json`, local CSS assets, controller,
  view-service registration, React component, and sibling `.d.ts` service
  contracts when service files are introduced.
- `app-pages` stores page id, label, route, order, and controller service name.
  Page records can be re-added to update a page and are returned in stable
  sorted order.
- `views` maps stable view ids to view service names. It keeps stage
  controllers from importing React page components directly.
- Registered views are REMVC view services. React components are presentation
  returned by those services.
- Feature models should own page-specific derived review/editing state.
  `server-model` should remain the shared pipeline API boundary rather than
  becoming the owner of every page's derived UI model.

Stashed implementation details not carried forward wholesale:

- the dummy page feature was only a page-registry proof of concept
- the old `metadata-review` feature is not part of the current restored
  main flow
- the nested `components/structure-review` shared surface was a useful
  exploration, but the current app promotes only proven shared primitives into
  the flat `src/pipeline/components` folder
- old page-level Reference Approval Bind/Unbind actions were superseded by the
  current card-local/shared selector behavior

## Current Pattern

For each restored page feature:

- register a page with `app-pages` from the feature controller
- register the feature view service with `views`
- let the feature controller own model/server calls and workflow transitions
- let the feature view remain a thin coordinator between controller and React
- let the React page talk only to its page view
- keep page-specific helpers inside the feature
- move reusable presentation primitives into the flat `src/pipeline/components`
  folder only once more than one page needs them

React components never talk directly to controllers. Views do not own domain
work; they relay component events to controllers and expose current page state
to React.

## Current Feature State

Live restored pages:

- `reference-approval`: Stage 0 reference binding/palette review.
- `optional-part-assignment`: optional label/glyph assignment review.
- `source-assignment`: source assignment review and acceptance.
- `final-rendering-options`: user-facing `Render Review`, preserving the
  final-rendering option and artifact naming.

Main flow:

1. Reference Approval accepts the reference structure.
2. Optional Part Assignment accepts optional source decisions, then the server
   runs the next pipeline stages and the controller advances to Source
   Assignment.
3. Source Assignment accepts source maps, then the server runs first final
   rendering composition and the controller advances to Render Review.
4. Render Review edits final rendering options and can rerender the current
   final output. It does not persist final approval state until a downstream
   Visual Approval / Prepared SVG export contract exists.

Shared UI primitives currently include:

- `Button`
- `Pill`
- `ColorSwatch`
- `BoundsBox`
- `PartsComponentSelector`

All restored review pages use contained page layouts: the app shell owns the
outer viewport and tabs, each page owns its own header and internal scroll
region, and the page does not make assumptions about shell chrome dimensions.

## Current Pipeline App Behavior

Tileset selection:

- The app shell owns the tileset selector in the main header, aligned with the
  app tabs rather than any individual page.
- The tileset selector is manifest-backed and uses the server's
  `/api/pipeline/tilesets` and `/api/pipeline/tilesets/active` routes through
  `server-model`.
- The manifest path is
  `scripts/output/asset-pipeline/tilesets.json`.
- The manifest records `activeTilesetId` and known tileset ids only.
- The manifest does not duplicate source paths, pipeline state paths, face
  counts, or stage timestamps owned by each tileset's canonical
  `pipeline.json`.
- The server may synthesize UI view models from multiple canonical sources, but
  those view models are not canonical state.
- Review pages should speak the language of the review domain instead of
  mirroring canonical storage. UI edits should be sent as domain actions or
  review-specific draft payloads for the server to reconcile into canonical
  state. See [Review Data Boundary](review-data-boundary.md).
- When the active tileset changes, the app controller remounts the active page
  and passes the active tileset id to page controllers that consume source-side
  tileset data. Those controllers reset their loaded page state so stale data
  from the previous tileset is not displayed.

Clean URL routing:

- The pipeline template defines `<base href="/pipeline/">`.
- The pipeline server registers a final catch-all route that serves the
  pipeline index so refreshes on clean page URLs load the app.
- The `url` service returns path segments after `/pipeline`; the app controller
  treats the first segment as the page slug and ignores later segments for now.
- Pages register `urlSlug` with `app-pages`. Current slugs are `reference`,
  `optional-parts`, `assignment`, and `render-review`.
- Initial page selection prefers the URL slug when it matches a registered
  page. Browser back/forward remounts the matched page without pushing another
  history entry.
- App-controller page changes push the registered page slug into browser
  history. Initial fallback selection replaces the current history entry.

Optional Part Assignment UI:

- The Optional Parts page has a Reset action guarded by a warning dialog.
  Reset is tileset-scoped: the server rebuilds the current tileset's canonical
  `pipeline.json` from the recorded source manifest and pipeline bootstrap,
  then runs source normalization and optional part assignment before the page
  reloads.
- Placement hint changes preserve `searchSource`.
- Choosing a new label/glyph placement hint also sets `searchSource` on.
- The placement hint menu includes `Default`. Default means no user region
  override is written, so rebuild scoring continues to use bootstrap/default
  candidate weighting unless the reviewer explicitly selects a concrete region.
- Optional parts are never gated on having bindings. Accepting the stage marks
  every optional part accepted, whether bound or not, and promotes all existing
  tentative/strong optional bindings to accepted.
- Missing optional candidates are informational diagnostics for review context,
  not blocking warnings.
- Component selection has one review-time binding source of truth:
  `componentAssignments`.
- Suggested component ids and server-provided assigned components seed
  `componentAssignments` once when a face card loads.
- When canonical face assignment data changes, the face card resets to that
  canonical seed instead of preserving stale local review assignments.
- The server preview model treats only `tentative`, `strong`, and `accepted`
  optional strengths as bindings. Weak `none` candidates stay visible only as
  review candidates.
- Optional preview part rows and summary counts are rendered from canonical
  binding-backed reservations only. Artifact candidate data does not make a
  part appear bound or chosen.
- Part-row selection selects every component currently assigned to that part.
- Source-image component clicks and component-list clicks use the same
  component-selection handler and select only the clicked component.
- Unbind acts on the selected part and selected bound components when present;
  otherwise it clears the selected part binding.

Source Assignment Verification UI:

- Shows every canonical source-side semantic part in each face, including
  source-bound, source-unbound, source-absent, and unknown-source parts.
- Treats accepted or reviewed unbound parts as satisfied source
  absences. They are still displayed and can be rebound later, but they do not
  count as unbound issues.
- Uses the normalized identified-components SVG as the card image preview when
  available, so Source Assignment reviews the same path-backed source geometry
  used by the pipeline instead of browser-rendering raw intake text.
- Builds source-part rows from the canonical source-side
  `faces[*].state.parts` list. Reference structure data may enrich those rows,
  but it does not own Source Assignment part membership.
- Source Assignment does not know output policy. It must not treat no-source
  parts as generated output; final rendering decides generation or omission.
- Source-unbound parts may have `reviewStatus: accepted`. That means the
  source-side absence was accepted at the current review checkpoint, not that
  output generation has been chosen. Accepted source-unbound parts satisfy the
  Source Assignment gate, are not reported as unbound, and can still be rebound
  later.
- The `Part boxes` view mode removes each card's source tile-body image
  preview, renders the normalized face artwork paths directly with the same
  tile-body exclusion shape as the identified-components preview, keeps inner
  white cutout paths, and draws one union bounds box per bound source part.
- Part boxes use the same part selection state as the parts list; selecting a
  part box or part row dims the other part boxes and other face component paths
  in that face.
- Individual component boxes are not drawn in `Part boxes` mode.
- The mode stays active through part selection and turns off when a component is
  selected or when a non-card button is clicked.

Debug Alignment Preview:

- Reads alignment stage artifact/debug data.
- Does not treat alignment candidates or placement evidence as durable binding
  state.

Render Review UI:

- Defaults are server-synthesized from canonical `renderingOptions` plus
  mutable `outputOptions` overrides.
- The UI sees suit options keyed by the same family ids it displays, such as
  `dragon`, even when bootstrap config uses plural family ids such as
  `dragons`.
- Saving final rendering options writes mutable overrides only; config defaults
  remain owned by `renderingOptions`.
- Eligible freeform-artwork faces expose a per-face `Mirror Artwork` checkbox.
  The checkbox writes `outputOptions.faces[faceKey].artwork.mirrorX` and does
  not affect suit-level label/glyph render mode settings.

Future Asset Review UI:

- A later 3D asset review page should render generated tile assets inside the
  same review-card language used by the restored pipeline pages.
- Card-level 3D previews should be minimal and mostly passive. A slow rotation
  or static preview is enough for scan/review context.
- Clicking a card preview should open a larger interactive view where the user
  can rotate around the tile and zoom in and out.
- If a user wants to change source/review decisions, they can navigate back to
  the earlier stage tab that owns that decision. Final acceptance through
  earlier pages should only rebuild affected tiles.
- Unavailable tiles should enter a build queue instead of blocking the review
  page. Their card can render a semi-transparent tile face in the 3D preview
  spot with a spinner/progress state until the generated asset is available.
- The build queue should live server-side so queued tile work continues even
  when the browser app is closed. The app observes queue status rather than
  owning queue execution.
- A future implementation can follow ModMod's Socket.IO shape. Polylith
  already supports Socket.IO through `polylith.json` `socketIo`; the built app
  can receive the Socket.IO server through `setSocketIo`. Use the relevant
  transport ideas from ModMod, but do not carry over its multi-user/session
  complexity.
- The pipeline app is a single-developer tool, not a multi-user production
  app. Socket.IO handling does not need account/session verification, app-user
  linking, per-client authorization, or cross-user isolation. A lightweight
  local connection, queue snapshot, and progress-event flow is enough.
- Socket.IO namespaces are still useful as clear server feature boundaries.
  Server features are less formal than client REMVC features, but namespaces
  can keep asset-pipeline progress, stage progress, and other future live
  channels conceptually separated without adding multi-user infrastructure.
- Stage-specific progress can be owned by a focused server feature/namespace
  when the workflow needs it. For example, Final Render progress could have
  its own small live-progress feature rather than being forced through one
  generic global progress channel.
- Socket.IO is additive, not a replacement for normal service routes. ModMod
  supports both regular HTTP/service calls and Socket.IO flows; the pipeline
  can keep stable request/response routes for canonical actions while using
  Socket.IO for live progress, queue observation, and interactive command/ack
  workflows where it helps.
- The same Socket.IO routing should support other long-running pipeline work
  that currently only gives spinner-level feedback. Long-running routes can
  emit finer-grained progress events, letting pages show progress bars,
  current face/stage labels, and partial completion counts.
- For the asset queue, that suggests an `/asset-pipeline` or
  `/pipeline-assets` namespace that reports queued/running/progress/complete
  and failed tile build events and lets the app request a queue snapshot when
  it connects. Other stage-specific long-running jobs can use the same
  transport shape with their own event names or namespaces.
- The page should stay stage-feature owned when implemented: controller,
  view service, React component, model/helper code, feature CSS, and
  `app-pages` registration all live in the feature boundary.

## Checkpoint - 2026-05-05

The bridge refactor now includes stage-gate flow behavior, not only extracted
page presentation:

- The page dropdown is trimmed to active review surfaces plus the debug
  alignment view. `Debug: Alignment Preview` remains accessible but is no
  longer treated as a main-flow gate.
- Optional Part Assignment Accept stays in `App.jsx` orchestration, calls the
  pipeline server to promote optional label/glyph decisions, runs alignment and
  semantic assignment, reloads source assignment data, and navigates directly
  to Source Assignment Verification.
- Source Assignment Accept stamps the semantic maps, runs final rendering
  composition, reloads final rendering options, and navigates to Final
  Rendering Options.
- Final Rendering Options Accept rerendered with the current
  `outputOptions.suits` and `outputOptions.faces` choices in this historical
  checkpoint. The current Render Review flow no longer stamps final-rendering
  review state because no downstream stage consumes it yet.
- `server/pipeline/index.js` now uses `fs/promises` and
  `util.promisify(execFile)` for the touched pipeline routes instead of direct
  synchronous filesystem/process calls.
- Verification after this checkpoint: `node --check server/pipeline/index.js`,
  `npm run test:pipeline` with 176 specs and 0 failures, and `npm run build`
  all pass.

## Checkpoint - 2026-05-05 React Page Cleanup

This checkpoint is deliberately not the REMVC refactor. It keeps `App.jsx` as
the bridge orchestration owner and only improves current React presentation
code shape:

- `OptionalPartAssignmentPage.jsx` was converted from a hook-heavy function
  page into a substantial class component with named render regions for the
  summary, bulk presets, and face grid.
- The per-face Optional Part Assignment card was converted to a class
  component with explicit preview and selector render methods while preserving
  page-local selection and manual assignment state.
- The optional checkbox indeterminate behavior now uses a class component and
  ref lifecycle methods instead of hook effects.
- `OptionalPartsComponentsSelector.jsx` moved from `pages/` to
  `components/` so shared pipeline presentation lives in the shared component
  area.
- `FinalRenderingOptionsPage.jsx` was converted to a class component with
  explicit state reset on final-rendering data changes and named summary,
  suit-options, and face-grid render regions.
- `AlignmentPreviewPage.jsx`, `ReferenceStructureVerificationPage.jsx`, and
  `SourceAssignmentVerificationPage.jsx` now use class component page/card
  shells with explicit render methods for their major preview, summary, grid,
  and selector regions. This pass intentionally did not move behavior into
  REMVC controllers or services.
- Page/card-local presentation helpers were pulled into component instance
  methods where they are tied to JSX structure. Stateless pipeline helper
  groups now live in named shared classes even when the methods do not share
  instance data, keeping the domain names explicit and out of loose
  module-level functions.
- The strongest non-React helper domains now live under `src/pipeline/shared/`
  as pipeline shared model classes: `OptionalComponentAssignments`,
  `OptionalFaceOptionsModel`, `RenderingOptionsModel`,
  `PipelinePresentationModel`, `RenderingGeometryModel`, and
  `SemanticReviewModel`. They own pipeline-domain behavior for optional
  component assignment state, optional face/bulk option derivation,
  render-option normalization, shared pipeline URL/color/label presentation,
  source/alignment geometry, and semantic review shaping. Current React pages
  consume those shared models, but the models are not page-specific.
- Optional Part Assignment now has a page-level View/Edit mode. View mode dims
  the source image, restores clipped source-image slices for optional or
  suggested parts so the part artwork stays bright, removes view-mode overlay
  outlines, and editing controls switch the page back out of view mode before
  applying changes.
- Verification: `node --check` passes for the shared `.js` model classes,
  `git diff --check` passes, and `npm run build` passes. Direct `node --check`
  on `.jsx` files is not useful in this repo because current Node reports the
  `.jsx` extension as unknown.

Historical caution for the bridge checkpoint:

- `App.jsx` is still the bridge orchestration owner. Do not start a broad shell
  or registry rewrite just because the flow behavior is clearer; the next
  extraction should still be opportunistic and tied to active page work.

## Guardrails

- Preserve the existing user workflow while restoring or refining pages.
- Keep stage behavior inside the owning feature controller/model/view boundary.
- Keep React components presentation-focused and route events through views.
- Prefer page-local helpers before introducing shared abstractions.
- Move repeated presentation primitives into `src/pipeline/components` only
  when multiple live pages actually need the same behavior.
- Keep old bridge checkpoints as historical context; the live direction is now
  the restored REMVC shell and page-feature architecture.

## Next Refactor Step

Continue from the restored REMVC shell and page-feature architecture:

1. Browser-test the restored main flow end to end.
2. Stabilize repeated page/header/card layout only after the browser pass
   confirms the common shape.
3. Restore additional pipeline pages only when their behavior is actively being
   worked, using `src/pipeline_original` as reference and keeping each page in
   its own feature boundary.

## Checkpoint - 2026-05-09 App Shell Rebuild Baseline

Current focus: rebuild the pipeline app architecture after preserving the
previous working app under `src/pipeline_original`.

What changed:

- Restored only the broad app architecture skeleton from the previous stash:
  `main` bootstrap/controller/view, the `features/app` shell feature,
  `app-pages` and `views` services, and the shared `server-model`.
- Kept page-specific stashed code out of the live app. Reference approval,
  metadata review, source assignment, dummy pages, shared structure-review
  components, and SVG preprocessor changes were not restored.
- Reintroduced the pipeline HTML template needed by the build.
- Updated `builds/pipeline.json` to load only `features/app` for now, while
  keeping the feature-local build metadata pattern.

Checked:

- `node --check` passed for the restored pipeline service/controller/view
  `.js` files.
- `npm run build` passed. Existing broad build noise remains Babel
  deoptimization notices and the known Mahjong engine circular dependency.

Next:

- Add the first current page feature back intentionally, using
  `src/pipeline_original` as the behavior reference instead of restoring the
  older stashed page implementations wholesale.

## Checkpoint - 2026-05-09 IO Service Baseline

Current focus: centralize backend request behavior before rebuilding page
models.

What changed:

- Added `src/pipeline/services/io.js` and `io.d.ts`, modeled after the ModMod
  `io` service but implemented with native `fetch`.
- Wired `io` into `src/pipeline/services/index.js`.
- Moved the previous app's `sourceStateUpdatedOn` request/response token
  handling into `io`, so source-assignment writes get the latest token and
  source-state responses refresh it centrally.
- Updated the current pipeline server model to subscribe to `io` and route
  backend requests through it instead of calling `fetch` directly.

Checked:

- `node --check` passed for `src/pipeline/services/io.js`,
  `src/pipeline/models/server-model.js`, and `src/pipeline/services/index.js`.
- `npm run build` passed with the same existing broad build noise.

Next:

- Consider renaming `server-model` to a pipeline-domain model when the first
  page feature is restored, keeping `io` as the generic transport service and
  the model as the pipeline API boundary.

## Checkpoint - 2026-05-09 Reference Approval Feature Restore

Current focus: restore Stage 0 Reference Approval on top of the rebuilt app
shell without bringing back the rest of the old page-specific app.

What changed:

- Added `features/reference-approval` with its own model, controller, view,
  component, feature build metadata, CSS, and service contract docs.
- Registered the page with `app-pages` as the first app-shell page and wired it
  through the shared `views` service.
- The React page talks to the page view, and the page view talks only to the
  controller. The controller owns coordination with the page model and the
  pipeline server model; the view remains a thin presentation coordinator.
- The Reference Approval page starts its initial reference-structure load from
  `ReferenceApprovalPage.componentDidMount()` through the page view, so the
  controller does not fetch page data while merely producing the mountable
  component.
- App-shell page activation now commits only after the page controller returns
  a mounted component. This keeps early page-registration events from marking a
  page active before its page view has registered, allowing the registry-ready
  mount path to retry and display the page.
- `app-pages` now emits explicit `page-added` and `page-updated` events in
  addition to the full-list `updated` event.
- `views` now emits `view-added` when a page view registers. The app
  controller listens to page availability, view availability, and registry
  ready. It also asks `app-pages` for the current page list during its own
  `ready()` after attaching those listeners. Each reconciliation starts from
  the current page registry and tries to mount the first available page. The
  React shell remains a passive listener of controller events instead of
  polling for pages.
- The app controller now exposes a current shell-state snapshot so the React
  shell can subscribe and then immediately sync after mount through the app
  view. `AppShell` listens to the app view, not the controller directly, while
  the view relays controller page events and forwards page requests back to
  the controller. This closes the race where page/view registration events
  could fire before the shell component had installed its listeners.
- The app shell is a two-row viewport grid. The shell header is outside the
  page scroll region, and `.app-shell-body` is the scrolling page container.
  Page views mount into that container and own their own in-container headers
  and scrolling behavior without knowing shell chrome dimensions.
- Reference Approval uses a contained page layout: its unified page header is
  outside the card scroll region, and only the card/content area scrolls. The
  page no longer relies on a sticky overlay for its header.
- Reference Approval now carries the previous Source Assignment review
  part-box view mode as a local presentation toggle. The page can switch the
  preview overlay from individual component boxes to one union bounds box per
  semantic part while leaving review state in the controller/model unchanged.
- The shared `PartsComponentSelector` owns part/component selection rules and
  reports the resulting selection through callbacks. Reference Approval passes
  those selection changes through the page view to the controller. Choosing a
  part selects that part's current component list; choosing a component from
  another part moves the active part to that component's associated part and
  clears the previous component selection.
- Added a shared `src/pipeline/components/Button.jsx` presentation component
  using the previous pipeline app's basic button, primary, accept, and active
  styles as the starting point. Reference Approval page actions and the shared
  `PartsComponentSelector` now use this component for action buttons.
- Added a shared `src/pipeline/components/Pill.jsx` presentation component for
  compact status/report labels. It defaults to `info`, supports `warning` and
  `error` report levels through level-specific classes, adds a clickable
  style class when it receives a click handler, and accepts an `extraContent`
  slot for small appended content such as swatches. Reference Approval summary
  counters now render through `Pill`.
- Palette swatches remain specialized visual controls, but they now render
  through the shared `src/pipeline/components/ColorSwatch.jsx` component. The
  Reference Approval header summary uses the same unknown/addable swatch states
  as the card rows.
- Removed the duplicate Reference Approval header-level Bind and Unbind
  actions. Binding remains card-local through `PartsComponentSelector`.
- Reference approval view registration uses the service's `serviceName`, and
  the shared `views` service now fails loudly when a registered view service
  name cannot be resolved.
- Moved the reusable review presentation pieces into the flat pipeline
  component folder: `src/pipeline/components/BoundsBox.jsx` and
  `src/pipeline/components/PartsComponentSelector.jsx`.
- Refactored `PartsComponentSelector` toward the React code topic guidance by
  splitting its JSX into explicit title, action, details, and list render
  regions while preserving its local open/closed interaction state.
- Ported the previous Reference Structure Verification behavior into the new
  feature boundary: load, select parts/components, bind, unbind, add palette
  colors, save draft, accept, and jump to the first incomplete/unbound item.
- Kept backend access on the existing `server/pipeline` routes through
  `server-model` and the new shared `io` service.
- Kept the card layout mostly faithful to the previous app. The structure is
  feature-owned now, but broader card/grid visual cleanup is intentionally
  deferred.
- Updated `builds/pipeline.json` to include `features/reference-approval`.

Checked:

- `node --check` passed for the reference approval `.js` files.
- Direct `node --check` on `.jsx` is still not useful in this repo because
  Node reports the `.jsx` extension as unknown.
- `npm run build` passed and copied the feature CSS into
  `dist/pipeline/reference-approval/css/reference-approval.css`. After the
  shared button extraction, `npm run build` also copied
  `src/pipeline/styles/pipeline.css` into `dist/pipeline/styles/pipeline.css`.
- `git diff --check` passed.

Next:

- Open the live page and do a browser interaction pass against real reference
  structure data.
- Extract the repeated face-card/review-card surface further once the next
  pipeline page needs it, rather than over-generalizing from Stage 0 alone.

## Checkpoint - 2026-05-09 Optional Part Assignment Feature Restore

Current focus: restore the Optional Part Assignment page as the next
stage-owned feature after Reference Approval.

What changed:

- Added `features/optional-part-assignment` with feature build metadata,
  controller, view service, page model, page component, feature-local CSS, and
  optional assignment helper models.
- Registered the page with `app-pages` as `optional-part-assignment` at
  `/pipeline/optional-parts`, mounted through the shared `views` service.
- Added optional-part API methods to the shared `server-model` for load,
  rebuild, and accept, all still flowing through the centralized `io`
  service.
- Ported the previous optional assignment page behavior into the new feature
  boundary: bulk optional settings, per-face source hint controls, per-face
  manual component assignment, source preview overlays, header view selection,
  Reset/Reload/Save/Accept actions, and Save-as-rebuild behavior.
- Optional Accept now keeps the backend-owned flow behavior from the previous
  app: the server promotes optional assignments, runs source alignment, runs
  source semantic assignment, and returns `nextPage: "source-assignment"` on
  success.
- After a successful Optional Accept, the optional page controller force-loads
  the Source Assignment controller so stale cached source data cannot survive
  the stage rerun, then asks the app shell controller to switch to the
  `source-assignment` page.
- Brought over `OptionalPartsComponentsSelector` as a feature-local component
  that consumes the shared flat `PartsComponentSelector`.
- Brought over `OptionalComponentAssignments` and `OptionalFaceOptionsModel` as
  feature-local helper models, keeping optional-stage behavior out of the
  reference feature.
- Extended the shared `PartsComponentSelector` with an optional row clear
  action so optional part rows can expose the previous clear affordance while
  keeping selection rules in the shared selector component.
- Kept React components talking only to the optional page view. The view relays
  to the controller, and the controller owns server/model calls.
- Updated `builds/pipeline.json` to include `features/optional-part-assignment`;
  `npm run build` copied
  `dist/pipeline/optional-part-assignment/css/optional-part-assignment.css`.

Checked:

- `node --check` passed for `src/pipeline/models/server-model.js`,
  `src/pipeline/features/optional-part-assignment/controller.js`,
  `src/pipeline/features/optional-part-assignment/model.js`, and
  `src/pipeline/features/optional-part-assignment/views/optional-part-assignment.js`.
- `git diff --check` passed.
- `npm run build` passed with the existing broad build noise: Babel
  deoptimization notices and the known Mahjong engine circular dependency.

Next:

- Open the live Optional Parts page and do an interaction pass against the
  current accepted reference state.
- Consider whether the duplicated review-card CSS should become a shared
  pipeline review stylesheet once a third review surface needs it.

## Checkpoint - 2026-05-09 Source Assignment Feature Restore

Current focus: restore the Source Assignment Verification page as the next
stage-owned feature after Optional Part Assignment.

What changed:

- Added `features/source-assignment` with feature build metadata, controller,
  view service, page model, page component, feature-local CSS, helper models,
  and service contract docs.
- Registered the page with `app-pages` as `source-assignment` at
  `/pipeline/source-assignment`, mounted through the shared `views` service.
- Added source-assignment API methods to the shared `server-model` for Save
  and Accept, all still flowing through the centralized `io` service and its
  shared `sourceStateUpdatedOn` handling. Save reruns alignment and semantic
  assignment after applying the binding action map.
- Ported the previous Source Assignment Verification behavior into the new
  feature boundary: load reference/source data, select source semantic parts
  and normalized components, bind components, unbind components, change
  assignment configuration, rerun assignment, accept Source Approval, and jump
  to the first unbound part or component.
- Kept React components talking only to the source page view. The view relays
  to the controller, and the controller owns server/model calls.
- Reused the shared flat `BoundsBox`, `Button`, `Pill`, and
  `PartsComponentSelector` components. The selector continues to own shared
  part/component selection rules and reports selection changes through the
  page view.
- Brought over the previous source assignment presentation/helper models as
  feature-local helpers for source review shaping, pipeline URL/color/label
  presentation, and source geometry.
- Updated `builds/pipeline.json` to include `features/source-assignment`;
  `npm run build` copied
  `dist/pipeline/source-assignment/css/source-assignment.css`.

Checked:

- `node --check` passed for `src/pipeline/models/server-model.js`,
  `src/pipeline/features/source-assignment/controller.js`,
  `src/pipeline/features/source-assignment/model.js`, and
  `src/pipeline/features/source-assignment/views/source-assignment.js`.
- `git diff --check` passed.
- `npm run build` passed with the existing broad build noise: Babel
  deoptimization notices and the known Mahjong engine circular dependency.

Next:

- Open the live Source Assignment page and do an interaction pass against the
  current optional/source artifacts.
- Fold duplicated review-card layout into shared review CSS only if the Source
  Assignment page proves the third surface needs the same stabilized shell.

## Checkpoint - 2026-05-09 Render Review Feature Restore

Current focus: restore the final Render Review page as the next stage-owned
feature after Source Assignment.

What changed:

- Added `features/final-rendering-options` with feature build metadata,
  controller, view service, page model, page component, feature-local CSS,
  helper model, and service contract docs.
- Registered the page with `app-pages` as `final-rendering-options` at
  `/pipeline/render-review`, mounted through the shared `views` service and
  labeled `Render Review` in the app shell. The internal feature id remains
  `final-rendering-options` for now because it still maps to the existing
  final-rendering API/artifact names.
- Added final-rendering API methods to the shared `server-model` for load,
  rerender, and accept, all still flowing through the centralized `io`
  service.
- Ported the previous Final Rendering Options page behavior into the new
  feature boundary: load render options, edit suit-level defaults, edit
  per-face overrides, mirror/preserve artwork settings, Rerender, and Accept.
- Render Review now follows the same contained page layout as the other
  restored review pages: one styled page header row and one internal scrolling
  content row for suit options and face cards.
- Render Review page-level actions live in that header: Reload, Rerender, and
  Accept stay available while the options and face-card list scrolls.
- Kept React components talking only to the render review page view. The view
  relays to the controller, and the controller owns server/model calls.
- Brought over `RenderingOptionsModel` as a feature-local helper model for
  render option normalization, family grouping, and option mutation.
- Source Assignment Accept now keeps the previous app-flow behavior: the
  server runs final rendering composition, returns
  `nextPage: "final-rendering-options"`, the source assignment controller
  force-loads the Render Review controller, and then asks the app shell
  controller to switch to that page. The UI advances only after the first
  render has been produced successfully.
- Updated `builds/pipeline.json` to include
  `features/final-rendering-options`; `npm run build` copied
  `dist/pipeline/final-rendering-options/css/final-rendering-options.css`.

Checked:

- `node --check` passed for
  `src/pipeline/features/final-rendering-options/models/RenderingOptionsModel.js`,
  `src/pipeline/features/final-rendering-options/controller.js`,
  `src/pipeline/features/final-rendering-options/model.js`,
  `src/pipeline/features/final-rendering-options/views/final-rendering-options.js`,
  `src/pipeline/features/source-assignment/controller.js`,
  `src/pipeline/models/server-model.js`, and `server/pipeline/index.js`.
- `git diff --check` passed.
- `npm run build` passed with the existing broad build noise: Babel
  deoptimization notices and the known Mahjong engine circular dependency.

Next:

- Open the live Render Review page after accepting Source Assignment and do an
  interaction pass against current final-rendering artifacts.
- Decide whether the final-rendering review surface should share a generalized
  page/header/card layout with the other restored pipeline pages after the
  first browser pass.

## Checkpoint - 2026-05-09 Pipeline UI Refactor Progress

Current focus: document the live state after restoring the main review path on
the new app shell/page registry/controller/view-service architecture.

What is live:

- The pipeline app no longer uses the old monolithic `App.jsx` as the workflow
  owner. `main/App.jsx` is now a minimal root wrapper around the shell supplied
  by `features/app`.
- `features/app` owns the shell header, tabs, page mounting region, page
  activation, and page registry reconciliation.
- Page availability flows through `app-pages`, including current-page lookup
  and page-added/page-updated notifications. The app controller can ask for the
  current page list when it is ready and also listens for later availability
  events.
- View availability flows through `views`, including explicit view-added
  notifications. The app shell React component listens to the app view, while
  the app view relays controller state and page requests.
- Backend requests flow through `server-model`, which uses the shared `io`
  service for request handling and shared `sourceStateUpdatedOn` state.
- The restored tabs are Reference Approval, Optional Parts, Assignment, and
  Render Review.

Restored feature behavior:

- Reference Approval loads after the component mounts, supports reference
  part/component binding, palette review, unknown/addable swatches, draft save,
  accept, and part-box preview mode.
- Optional Part Assignment supports optional source hints, manual optional
  component assignment, rebuild/accept, and advances to Assignment after
  backend pipeline stages complete.
- Source Assignment supports source semantic binding review, part-box mode,
  bind components, unbind components, change assignment configuration, rerun
  assignment, and advances to Render Review after Source Approval acceptance
  produces the first final render.
- Render Review loads final rendering options, edits suit defaults and
  per-face overrides, supports mirror/preserve artwork choices, rerenders, and
  can save current rendering options. It does not persist accepted render
  review state yet.
- The live app uses `accept` vocabulary for Optional Parts and Render Review.
  The old Optional Parts check action and final-rendering accepted-card/count
  state have been removed from live app/server integration.

Presentation state:

- Shared pipeline components are flat under `src/pipeline/components`.
- `PartsComponentSelector` owns shared selection rules and reports selection
  changes through callbacks.
- `Button`, `Pill`, `ColorSwatch`, `BoundsBox`, and `PartsComponentSelector`
  are the current shared primitives.
- The restored review pages use contained page layout: a page-owned header row
  and an internal scrolling content row mounted inside the app shell body.
- Render Review has one styled page header. Reload, Rerender, and Accept live
  in that header so the option and face-card list can scroll independently.
- Render Review's header view selector includes `Preview`, `Source`,
  `Reference`, `Overlay`, and `Invert`. `Source` renders the face's original
  source SVG as a centered, contained image so the source artwork keeps its own
  aspect ratio inside the tile preview frame.

Architecture rules confirmed during this pass:

- React pages/components talk to their page view, not directly to controllers.
- Views remain thin coordinators and relay to controllers.
- Controllers own workflow, server/model calls, and cross-page navigation.
- Components never talk to controllers.
- Pages should not assume details about the shell container beyond being given
  a mounted region.
- Relevant durable context from the stashed `pipeline-app-refactor` topic has
  been extracted into this topic; obsolete proof-of-concept details are called
  out as historical rather than restored as current guidance.

Checked during the latest pass:

- `git diff --check` passed for the touched Render Review source, CSS, and
  topic files.
- `npm run build` passed and copied updated pipeline feature CSS into `dist`.
- Existing broad build noise remains Babel deoptimization notices and the
  known Mahjong engine circular dependency.

## Checkpoint - 2026-05-09 Manifest Tileset Selector

Current focus: add a shell-level tileset switcher without pushing manifest
ownership into individual stage pages.

What changed:

- Added a manifest-backed Tileset dropdown to the right side of the app shell
  header.
- Added `server-model` methods for loading available tilesets and setting the
  active tileset through the existing pipeline server routes.
- Tileset loading first uses the dedicated tilesets route and falls back to
  the existing `state?kind=tileset` response, since that older state response
  also carries the manifest source list. This keeps the selector populated
  even when a running server has not yet picked up the newer tilesets route.
- The app controller loads tileset state during shell startup, exposes it
  through the app view, and handles selector changes from the shell component.
- Active tileset changes remount the current page after the server accepts the
  new active tileset.
- Source intake/sprite-sheet registration preserves the manifest's active
  tileset instead of switching the app selector as a side effect. App selection
  changes are owned by the explicit active-tileset server route.
- The app shell keys the mounted page by active page id and active tileset id
  so React does not reuse a page instance after the controller has reset that
  page's tileset-scoped state.
- Source-side page controllers now accept a shell-provided tileset id and reset
  their loaded page state when it changes: Optional Parts, Assignment, and
  Render Review. Reference Approval remains independent of the source tileset
  selector.

Checked:

- `node --check` passed for the touched `.js` controller/view/model files.
- `git diff --check` passed for the touched source, CSS, and contract files.
- `npm run build` passed and copied updated app CSS into `dist`.

Next:

- Do a browser interaction pass on the full restored flow:
  Reference Approval -> Optional Parts -> Assignment -> Render Review.
- Decide whether the repeated contained page/header/card CSS should become a
  shared review stylesheet now that several pages use the same shape.
- Continue keeping feature-specific domain helpers inside feature directories
  unless a true shared presentation or model boundary emerges.
