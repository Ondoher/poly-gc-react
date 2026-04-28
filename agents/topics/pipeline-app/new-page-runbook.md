# Pipeline App New Page Runbook

Use this runbook when adding a new page to the Polylith `pipeline` app.

The settled shape is the one used by current feature pages such as
`asset-review`, `asset-base-tile-selection`, and `final-rendering-options`.

## Page Boundary

Before implementing, decide the page's ownership boundary:

- The page owns its controller, view service, React presentation, feature-local
  CSS, page state, and workflow.
- The server owns canonical state mutation and synthesizes page view models.
- The page sends domain actions through `server-model`; it does not mirror
  canonical JSON as editable UI state.
- The app shell owns tabs, routing, tileset selection, and page mounting.

Do not make a page depend on another feature's private components, styles, or
helpers. Promote genuinely shared pieces into `src/pipeline/components` first.

If two pipeline pages share client-side model logic, move that logic into the
top-level `src/pipeline/models` folder as a registry-backed model service and
subscribe to it from page controllers. Feature-local `models/` folders are for
models owned by exactly one page feature. Shared examples include stream
payload interpretation, derived summaries, and page-independent status
transitions.

Polylith feature/service/model activation should flow through `index.js`
side-effect imports. Do not import another feature, service, or shared model
implementation directly from a page controller. Instead:

- register shared services/models from their owning `index.js`
- subscribe to them through the registry in `ready()`
- keep direct imports mostly for React components and feature-private helper
  classes used by those components

## File Shape

Create a feature folder under:

```text
src/pipeline/features/<page-id>/
```

Use this structure:

```text
build.json
index.js
controller.js
controller.d.ts
views/
  index.js
  <page-id>.js
  <page-id>.d.ts
components/
  <PageClassName>.jsx
assets/
  css/
    <page-id>.css
```

Naming conventions:

- `page-id` is kebab-case and matches the route slug when practical.
- React page component files use PascalCase.
- Controller and view service filenames use kebab-case.
- CSS files use kebab-case.
- The controller service name should be `<page-id>-controller`.
- The view service name should be `<page-id>-view`.

## Build Registration

The feature `build.json` should include feature-local CSS and the feature
entrypoint:

```json
{
  "css": [
    {
      "dest": "<page-id>/css",
      "cwd": "assets/css",
      "glob": "**/*.css",
      "keepNest": true
    }
  ],
  "index": "index.js"
}
```

Add the feature to `builds/pipeline.json`:

```json
"features": [
  "features/app",
  "...",
  "features/<page-id>"
]
```

The feature `index.js` should only side-effect import the view index and
controller:

```js
import './views/index.js';
import './controller.js';
```

## Controller Shape

The controller owns page lifecycle and workflow. It should:

- extend `Service`
- call `this.implement(...)` for public methods
- subscribe to `app-pages`, `views`, and any required services in `ready()`
- register the page with `app-pages`
- expose `mount(options)`, `getState()`, and `setTilesetId(tilesetId)`
- reset cached page data when the active tileset changes
- keep state updates centralized through `setState(...)`
- call `this.fire('updated', this.getState())` after state changes

The page registry entry should look like:

```js
this.pages.add({
  id: '<page-id>',
  label: '<Page Label>',
  urlSlug: '<page-id>',
  route: '/pipeline/<page-id>',
  order: 60,
  controller: '<page-id>-controller',
});
```

Use the existing page order to place the new tab in workflow order.

## View Service Shape

The view service is the boundary between controller and React. It should:

- extend `Service`
- subscribe to `views` and the page controller in `ready()`
- forward controller `updated` events with `this.fire('updated', state)`
- register itself with `views.add('<page-id>', this.serviceName)`
- return the page React component from `getComponent()`
- expose only the callbacks the React page needs

React components should call page-view methods, not controller or model
services directly.

## React Page Shape

The React page component should:

- initialize local state from `props.pageView.getState()`
- listen for page-view `updated` events in `componentDidMount()`
- unlisten in `componentWillUnmount()`
- call `props.pageView.load({ quiet: true })` on mount when it owns loadable
  server data
- render a contained page layout with a page header and page-owned content
- use shared controls from `src/pipeline/components` when available
- put feature-specific components inside the page feature until they are proven
  shared

Typical header contents:

- page name
- summary pills under the page name when counts matter
- page actions on the right, such as `Reload`, `Save`, `Accept`, or `Start`

Keep page text task-focused. Avoid visible instructions that explain the UI
unless the page genuinely needs an empty/error state.

## Server Model And Routes

Add server calls to `src/pipeline/models/server-model.js` and mirror them in
`server-model.d.ts`.

Use `/api/pipeline/<page-id>` routes in `server/pipeline/index.js` for page
view models and canonical actions. The server response may synthesize a
UI-facing view model from multiple canonical sources, but that response must
not become another source of truth.

For canonical pipeline JSON, use `PipelineModel` on the server side. Do not
read or write `pipeline.json` directly from the app.

## Navigation Between Pages

When a page action advances the workflow:

- use `this.app = options.appController || this.app || null` in `mount()`
- call `this.app?.requestPage('<next-page-id>')`
- force-load or invalidate the next page so stale cached data does not survive
  a server-side stage transition

Do not import another page feature directly. If cross-page communication is
needed, subscribe to the next page's controller through the registry.

## CSS Shape

Feature CSS should live under `assets/css/<page-id>.css`.

Use contained page layout:

- the app shell owns the viewport and tabs
- the page owns its header and internal content region
- avoid assuming shell chrome dimensions
- use CSS Grid for major page regions when it fits naturally
- keep repeated items as cards; avoid cards inside cards
- define stable preview/canvas dimensions with `aspect-ratio` or fixed grid
  constraints

## Verification

Run focused syntax checks for non-JSX files:

```text
node --check server/pipeline/index.js
node --check src/pipeline/models/server-model.js
node --check src/pipeline/features/<page-id>/controller.js
node --check src/pipeline/features/<page-id>/views/<page-id>.js
```

Run the app build for JSX/CSS/build registration:

```text
npm run build
```

## Documentation

After adding a page:

- update this topic README if the page is part of current app state
- update focused page docs or summaries when the page has a cross-topic
  contract
- update owning domain-topic status docs when the page represents a new stage
  or changes a workflow boundary
- remove stale "future/planned" wording from docs that now describe current
  behavior
