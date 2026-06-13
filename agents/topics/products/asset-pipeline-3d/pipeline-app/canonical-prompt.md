# Pipeline App Canonical Prompt

Use this prompt when asking an agent to recreate an app that fulfills the same
requirements as the current Polylith `pipeline` approval app. The goal is an
equivalent app architecture and behavior, not a byte-for-byte source clone.

## Prompt

Build a Polylith React approval app named `pipeline` for reviewing and
advancing a multi-stage Mahjong 3D asset pipeline. The app is a local
single-developer tool. It should favor clear feature boundaries and simple
request/response workflows over production multi-user infrastructure.

The app must follow a registry-centered REMVC shape:

- `src/pipeline/main` owns application bootstrap and React root mounting only.
- `src/pipeline/features/app` owns the visible shell: header, tabs, page
  mounting region, clean URL routing, browser history handling, and the active
  tileset selector.
- Each stage page is a separate feature under `src/pipeline/features/<feature>`.
  A stage feature owns its controller, view service, React page component,
  feature-local models/helpers, CSS, service contracts, and page workflow.
- Shared app services own page registration, view registration, URL handling,
  and backend access.
- Shared presentation primitives that are only shared inside the pipeline app
  live flat under `src/pipeline/components`.

The main entry point must not directly import individual stage features.
Feature activation is Polylith/build-file driven through `@polylith/features`.
Each feature should have build metadata and an `index.js` entry that registers
its controller/view/page side effects.

Use these app services:

- `app-pages`: registry of available shell pages/tabs. Each page record should
  include a stable page id, label, order, controller service name, and clean
  URL slug. The service should return pages in stable order and notify when
  pages are added or updated.
- `views`: registry mapping stable view ids to REMVC view service names.
  Controllers mount named views instead of importing React components directly.
  The registry should fail loudly when a registered view service cannot be
  resolved.
- `url`: clean URL service. It should parse path segments after `/pipeline`,
  treat the first extra segment as the page slug, ignore later segments for
  now, build page URLs, and emit events from `window.popstate`.
- `io`: centralized HTTP request helper for backend calls and shared request
  handling.
- `server-model`: the pipeline API boundary used by feature controllers/models.
  All page backend calls go through `server-model`, and `server-model` uses
  `io`.

The server must support clean browser URLs:

- the pipeline index template includes `<base href="/pipeline/">`
- the pipeline server has a final catch-all route that serves the pipeline
  index for `/pipeline/*` paths
- page changes push the page slug into browser history
- browser back/forward remounts the matching registered page without pushing a
  new history entry
- initial load prefers a valid URL slug and otherwise selects the first
  available registered page

React communication rules:

- React pages and shared components talk only to their owning page view.
- Components never talk directly to controllers.
- Views are thin coordinators. They expose page state to React and relay user
  intent back to controllers.
- Controllers own server/model calls, workflow transitions, and cross-page
  navigation.

The app shell must provide:

- a main header with registered page tabs
- a manifest-backed tileset selector on the right side of the header
- a page mounting region below the header
- clean URL navigation for each registered page

The tileset selector is shell-owned, not page-owned. It loads known tilesets
and the active tileset through `server-model`. The tileset manifest owns only
routing facts: known tileset ids and active tileset id. Canonical per-tileset
pipeline state remains in each tileset's `pipeline.json`. When the active
tileset changes, remount the active page and pass the new active tileset id to
source-side page controllers. Source-side controllers must reset loaded page
state on tileset change so stale data from a previous tileset is not reused.
Reference Approval does not depend on the source tileset selector.

The current app flow is:

```text
Reference Approval -> Optional Parts -> Assignment -> Render Review
```

Implement these current pages:

1. Reference Approval

   - Stage 0 reference binding and palette review page.
   - Reviews active `reference-structure.json`.
   - Supports semantic part/component selection, bind, unbind, draft save,
     accept, palette review, unknown/addable color swatches, complete/incomplete
     status, and part-box preview mode.
   - Loads reference data after the page component mounts so the component/view
     lifecycle is ready before data is requested.

2. Optional Parts

   - Reviews source-side optional label/glyph expectations after normalization
     and before alignment.
   - Supports per-face optional decisions, source hint controls, candidate
     component selection, bind/unbind/clear behavior, accept, and a
     guarded Reset action.
   - Reset is tileset-scoped: warn the user, then rebuild the current tileset's
     `pipeline.json` from its recorded source manifest and canonical bootstrap,
     rerun Source Normalization and Optional Part Assignment, and reload the
     page.
   - Accept promotes optional decisions, runs Alignment and Source Semantic
     Assignment on the server, then advances the app to Assignment.

3. Assignment

   - Reviews source semantic bindings after alignment.
   - Shows every canonical source-side semantic part in each face, including
     source-bound, source-unbound, source-absent, and unknown-source parts.
   - Treats accepted/reviewed source-unbound parts as satisfied source
     absences. They remain visible and can be rebound later, but they do not
     count as unbound issues.
   - Supports part/component selection, bind components, unbind components,
     change assignment configuration, rerun assignment, Source Approval
     acceptance, and part-box view mode.
   - Part-box mode draws one union bounds box per bound source part, uses the
     same part selection state as the part list, and turns off when the user
     selects an individual component.
   - Accept runs first Final Rendering Composition on the server and advances
     the app to Render Review only after that render succeeds.

4. Render Review

   - User-facing page for Stage 6 Final Rendering Options. The internal feature
     and API names may remain `final-rendering-options` if they map to existing
     backend routes/artifacts.
   - Reviews final color SVGs and effective rendering options.
   - Supports suit-level defaults, per-face overrides, generated/source/omit
     label and glyph choices where relevant, free-form artwork mirror and
     preserve-color controls, rerender, reload, and accept.
   - Page-level actions such as Reload, Rerender, and Accept live in the page
     header so the options/card list can scroll independently.

Shared presentation requirements:

- Use contained page layouts. The app shell owns the outer viewport and tabs;
  each page owns its own page header and internal scroll region. Pages must not
  assume shell chrome dimensions.
- Use a consistent review-card language across review pages.
- Shared primitives include `Button`, `Pill`, `ColorSwatch`, `BoundsBox`, and
  `PartsComponentSelector`.
- `PartsComponentSelector` owns shared part/component selection rules and
  reports changes through callbacks. A page can then pass those events through
  its view to the controller.
- `ColorSwatch` preserves specialized swatch states such as unknown/addable
  colors, including the diagonal disabled mark and add indicator where used.
- `Pill` supports report levels `info`, `warning`, and `error`, defaults to
  `info`, accepts extra rendered content, and adds a clickable class when it
  has a click handler.

Workflow and data ownership:

- The app can use server-synthesized view models for page rendering, but those
  view models are not canonical state.
- Review page payloads should speak the language of the review domain, not the
  backend storage implementation. React pages should not mirror canonical
  `pipeline.json` structures as editable state.
- User edits should flow back to the server as domain actions or
  review-specific draft payloads, such as assigning components to a part,
  clearing an assignment, accepting source absence, changing rendering
  options, rerendering, or accepting a review gate. The server owns translating
  those actions into canonical state mutations.
- Do not overload canonical binding fields to carry UI operation intent. For
  example, manual unbinding should be request/action data reconciled by the
  server, not a durable fake binding whose `strength` exists only to remember
  that the UI unbound something.
- Canonical pipeline facts remain in their owning artifacts, especially each
  source tileset's `pipeline.json` and generated stage artifacts.
- `server-model` remains the shared API boundary. Feature-local models may own
  page-specific derived review/editing state.
- Controllers should force-load or invalidate the next page's data after a
  server-side stage transition so stale cached page state does not survive a
  rerun.

Asset Review page requirements:

- Asset Review is implemented after generated asset planning. The app owns the
  page shape, route/tab registration, card layout, 3D preview, and user
  workflow.
- The generated asset contract belongs to the asset pipeline, not the app:
  hashes, invalidation, build queue semantics, cutter/stamped/inlay GLB
  generation, generated model metadata, and publication/sync rules.
- The page renders one card per tile/face. Available tiles show the latest
  final GLB with rotate and zoom controls. Stale tiles keep showing that latest
  GLB with a stale indicator. Missing tiles replace the canvas with a not
  available message.
- Corrections happen in earlier owning tabs rather than in Asset Review.
- Use HTTP routes for canonical actions and add Socket.IO only as an additive
  live-progress/queue-observation channel if spinner-level feedback is not
  enough. Do not add multi-user account/session/authorization complexity.

Keep implementation conservative and aligned with the existing repo style.
Prefer feature-local helpers until behavior is proven shared. Promote only
reusable presentation primitives into `src/pipeline/components`.
