# Testing

## Purpose

Capture the intended browser/UI test setup for this workspace.

Because this repo uses Polylith, the browser test lane should follow the same
Polylith-driven build pattern as other Polylith apps rather than inventing a
separate ad hoc browser test pipeline.

## Current Test Support

The repo currently has two unit-test lanes:

- UI/browser unit tests use Jasmine specs bundled by Polylith and run by Karma
  in `ChromeHeadless`.
- Non-UI engine unit tests use Jasmine directly through the engine-specific
  Jasmine config.

Current commands:

- `npm run test:ui:gc` builds and runs the browser/UI test lane.
- `npm run test:ui:pipeline` builds and runs the Pipeline browser/UI test lane.
- `npm test` currently delegates to `npm run test:ui:gc`.
- `npm run karma` runs Karma against the already-built browser test output.
- `npm run dev:tests:gc` runs the Polylith browser test build in watch mode.
- `npm run test:engines` runs non-UI engine specs with Jasmine.
- `npm run test:pipeline` runs non-browser pipeline specs with Jasmine.
- `npm run test:scripts` runs all non-browser specs discovered under
  `scripts`.

There are now focused direct-Jasmine lanes for engines and SVG preprocessor
pipeline tests, plus a broader scripts lane for tests that live near script
code under `scripts`.

The scripts lane now includes local specs for shared script helpers. Shared
script code lives under `scripts/shared`, with specs placed nearby in
`scripts/shared/_tests`.

## Domain-Level Testing

Unit tests should cover specific code behavior, but the suite should also
include domain-level tests that read like product or pipeline promises. These
tests are especially useful for script pipelines where a helper's real value is
that it preserves facts required by later stages.

The intended testing posture is test-following-development rather than strict
TDD, even if day-to-day work sometimes varies. Design and implementation
usually come first. Tests should then be written against the existing code and
intended behavior so they consistently verify the quality and correctness
promises that development has established and should preserve as work
continues.

For example, SVG preprocessor tests should not only assert individual helper
return values. They should also cover scenarios such as:

- tile chrome is identified as discardable while face artwork is preserved
- white source paths remain available as cutout candidates without becoming
  independent alignment artwork
- source identity and ancestry survive decomposition and nested transforms
- small top-corner labels or glyphs are discoverable before alignment
- large body artwork is not mistaken for optional glyphs
- cutouts attach to nearby, containing, or shared-group paint rather than
  unrelated artwork
- unsupported or degenerate SVG noise is ignored without crashing extraction
- coordinate facts such as bounds, centers, and transforms remain stable in
  source coordinate space
- repeated artwork members remain separable where possible for later identity
  resolution

The practical guideline is to mix both styles:

- code-level tests pin down small exported functions and edge cases
- domain-level tests describe the pipeline contract in the language of the
  stage, even when they exercise several helpers together

## Core UI Test Stack

The intended browser/UI test lane should use:

- Jasmine for test definitions and assertions
- Karma as the browser test runner
- `ChromeHeadless` as the default browser target
- a Polylith test build step that emits each browser test bundle into an
  app-scoped folder under `tests/<app>/`

This is not a direct source-file execution setup. The tests are first bundled,
then served to Karma from the built output.

## Script Flow

The intended script shape is:

- `npm run test:ui`
  - run the Polylith test build for the relevant app
  - then start Karma against the built output
- `npm run karma`
  - run Karma only
- `npm run dev:tests`
  - run the Polylith test build in watch mode

The intended flow is:

1. `polylith test <app>` builds the browser test bundle
2. the build output lands under `tests/<app>/`
3. Karma serves and runs that built output in headless Chrome

For sustained UI test development, the preferred live loop is:

1. run `npm run dev:tests`
2. run `npm run karma`

The watch-mode build keeps rebuilding the test bundle into the app-scoped
`tests/<app>/` output, while Karma reruns against that rebuilt output.

## Karma Configuration Shape

The expected `karma.conf.cjs` shape is:

- `frameworks: ['jasmine']`
- test files from the active app's `tests/<app>/**/*.js` loaded as ES modules
- CSS assets from the active app's `tests/<app>/**/*.css`
- browser:
  - `ChromeHeadless`
- `singleRun: true`
- `autoWatch: false`

This makes Karma the execution runner, not the bundler.

## Built Output

The key architectural point is:

- source-side UI specs are bundled into a browser-ready test artifact
- Karma runs against that artifact rather than the raw source tree

The intended destinations for built browser test output are:

- `tests/gc/`
- `tests/pipeline/`

## How Specs Enter The Test Build

The important detail in this Polylith model is that UI specs are not
discovered directly by Karma.

Instead, the app build should define an explicit browser test entry, typically
with fields like:

- `spec: 'src/<app>/test.js'`
- `testDest: 'tests/<app>'`
- `testGroups`

That means `polylith test <app>` starts at the app test entry and builds the
browser test bundle into that app's generated test output.

The app test entry should import the synthetic Polylith test module:

```js
import '@polylith/tests';
```

Polylith fills that synthetic module from the selected app and feature
`testGroups`. This creates a glob-based inclusion model:

- the app build points the test lane at `src/<app>/test.js`
- `src/<app>/test.js` imports `@polylith/tests`
- app-level `testGroups.default` globs include shared/non-feature specs
- feature-local `test.json` files contribute feature-owned specs
- `polylith test <app> -f <feature>` can build one feature's browser specs

So the practical rule is:

- individual `*Spec.js` and `*.spec.js` files become part of the test build
  because they match an app-level or feature-level `testGroups` glob
- Karma does not perform source-side spec discovery on its own
- if a spec is not appearing in the test run, first check whether it is
  matched by the app or feature `testGroups`

## Source Test Placement

The intended browser-spec placement model is:

- source specs live near the code they exercise
- browser specs can live in nearby `_tests` folders
- feature-owned browser specs are enabled by the feature's local `test.json`
- app-owned shared specs are enabled by the app build's `testGroups`
- the root app `test.js` remains structural and imports only
  `@polylith/tests`

So the practical model is:

- source specs live near the code
- source specs are grouped by app and feature `testGroups` globs
- Polylith assembles the browser test bundle
- Karma runs the built browser test bundle

## Shared UI Test Support

Shared client-side test support should live in a dedicated testing area such as:

- `src/testing`

That shared area can hold things like:

- a builder-style `TestHarness`
- shared registry setup
- common service mocks
- reusable component mounting helpers

This keeps shared browser test support out of feature folders while still
helping feature-local UI tests.

## Service Testing Guidance

Service implementations in this repo export their classes, which means browser
specs can instantiate them directly for narrow unit tests.

Useful pattern:

- create a test-specific `Registry`
- instantiate the service class directly with that registry
- register mock services into that registry as needed
- call the public service methods directly

This is useful for focused unit tests where the goal is to validate one
service's public API without depending on full app startup.

For example:

- import `Registry` from `@polylith/core`
- construct `new Registry()`
- instantiate the service with `new MyService(registry)`
- register test doubles with `registry.makeService(...)` when the service
  depends on other services

There is also a lifecycle-aware option.

`Registry` provides an asynchronous `start(prefix)` method that runs the real
Polylith service lifecycle:

1. call each matching service's `start()`
2. wait for async `start()` work to settle
3. call each matching service's `ready()`

That means service tests can choose between:

- direct method calls for tight unit tests
- `await registry.start('<prefix>')` for tests that need to validate real
  lifecycle behavior such as cross-service subscription in `ready()`

Practical rule:

- use direct class instantiation plus direct method calls when testing behavior
  in isolation
- use `registry.start(...)` when the test specifically cares about lifecycle
  sequencing or dependency wiring

Future note:

- if service mocks start recurring across multiple specs, promote them into a
  shared testing area rather than copying them between feature tests
- a future shared location such as `src/gc/testing/services` or
  `src/gc/testing/mocks` would be a good home for reusable service-mock
  builders
- if a consistent cross-spec mock environment emerges, create a shared
  "universe" helper or class that populates a `Registry` with the standard set
  of mocks for that testing scenario
- that kind of helper should update the registry in one place so individual
  specs only override the parts that are specific to the test

## Recommended Takeaway For This Workspace

The intended UI/browser lane for this repo should look like this:

- use Jasmine for browser specs
- use Karma to run the built browser bundle in `ChromeHeadless`
- use a Polylith test build step to emit browser test artifacts into
  `tests/<app>/`
- prefer a two-process dev loop:
  - one process to rebuild browser test output
  - one process to rerun Karma

This keeps the browser test architecture aligned with the existing Polylith
build model instead of introducing a completely separate UI test pipeline.
