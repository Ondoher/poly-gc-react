# Pipeline App New Page Runbook

Use this runbook when adding a new page to the Polylith `pipeline` app.

The settled shape is the one used by current feature pages such as
`asset-review`, `asset-base-tile-selection`, and `final-rendering-options`.

## Page Boundary

Apply [canonical feature activation and privacy](C:/Users/gande/.codex/documentation/standards/remvc.md#feature-activation-and-privacy), [REMVC responsibilities](C:/Users/gande/.codex/documentation/standards/remvc.md#preferred-flow), and [shell ownership](C:/Users/gande/.codex/documentation/standards/app-shells.md#shell-ownership). The [Pipeline shared model overlay](../../../standards/overlay.md#add-pipeline-shared-model-registration) owns the local registration refinement.

Pipeline's concrete server boundary is `server-model`; the server synthesizes review data and processes domain actions. Shared model examples include stream payload interpretation, derived summaries, and page-independent status transitions. Existing page examples are `asset-review`, `asset-base-tile-selection`, and `final-rendering-options`.

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

Naming follows [canonical code conventions](C:/Users/gande/.codex/documentation/standards/code-conventions.md#javascript-and-module-shape). Paired page service names come from the [Pipeline identity overlay](../../../standards/overlay.md#add-pipeline-page-service-identities). The tree above is a concrete Pipeline layout example.

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

The [canonical controller boundary](C:/Users/gande/.codex/documentation/standards/remvc.md#controllers) owns loading and workflow. Pipeline controllers integrate with `app-pages` and `views`, expose `mount(options)`, `getState()`, and `setTilesetId(tilesetId)`, reset cached data on tileset change, and publish `updated` state through the existing `setState(...)` path.

The page registry entry should look like:

```js
this.pages.add({
	id: '<page-id>',
	label: '<Page Label>',
	urlSlug: '<page-id>',
	order: 60,
	controller: '<page-id>-controller',
});
```

Use the existing page order to place the new tab in workflow order.

## View Service Shape

Use the [canonical view/presentation boundary](C:/Users/gande/.codex/documentation/standards/remvc.md#views-and-react-presentation). Pipeline view services register with `views.add('<page-id>', this.serviceName)`, return their component from `getComponent()`, and relay controller `updated` state and presentation callbacks.

## React Page Shape

Use [canonical lifecycle and cleanup](C:/Users/gande/.codex/documentation/standards/react.md#effects-and-lifecycle) and [presentation events](C:/Users/gande/.codex/documentation/standards/react.md#props-state-and-events). Existing Pipeline pages read `props.pageView.getState()` and subscribe to page-view `updated` events. Controller activation owns loading; where presentation readiness is required, relay that readiness through the view under the canonical controller/view contract.

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
view models and canonical actions. The [review data boundary](review-data-boundary.md) owns the Pipeline action/view-model contract.

For canonical pipeline JSON, use `PipelineModel` on the server side. Do not
read or write `pipeline.json` directly from the app.

## Navigation Between Pages

When a page action advances the workflow:

- use `this.app = options.appController || this.app || null` in `mount()`
- call `this.app?.requestPage('<next-page-id>')`
- force-load or invalidate the next page so stale cached data does not survive
  a server-side stage transition

[Canonical privacy and activation](C:/Users/gande/.codex/documentation/standards/remvc.md#feature-activation-and-privacy) govern cross-page dependencies.

## CSS Shape

Feature CSS should live under `assets/css/<page-id>.css`.

Use [canonical layout ownership](C:/Users/gande/.codex/documentation/standards/react.md#css-and-layout-ownership) and the [Pipeline shell overlay](../../../standards/overlay.md#replace-pipeline-top-tabs). Pipeline's review-card product requirements are:

- keep repeated items as cards; avoid cards inside cards
- define stable preview/canvas dimensions with `aspect-ratio` or fixed grid constraints

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

Follow the [topic continuity overlay](../../../standards/overlay.md#add-topic-continuity). Page catalog and current app state belong in this topic; stage-domain changes belong in the owning product topic.
