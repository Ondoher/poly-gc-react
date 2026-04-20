# Testing

## Purpose

Capture the intended browser/UI test setup for this workspace.

Because this repo uses Polylith, the browser test lane should follow the same
Polylith-driven build pattern as other Polylith apps rather than inventing a
separate ad hoc browser test pipeline.

## Core UI Test Stack

The intended browser/UI test lane should use:

- Jasmine for test definitions and assertions
- Karma as the browser test runner
- `ChromeHeadless` as the default browser target
- a Polylith test build step that emits the browser test bundle into `tests/`

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
2. the build output lands under `tests/`
3. Karma serves and runs that built output in headless Chrome

For sustained UI test development, the preferred live loop is:

1. run `npm run dev:tests`
2. run `npm run karma`

The watch-mode build keeps rebuilding the test bundle into `tests/`, while
Karma reruns against that rebuilt output.

## Karma Configuration Shape

The expected `karma.conf.cjs` shape is:

- `frameworks: ['jasmine']`
- test files from `tests/**/*.js` loaded as ES modules
- CSS assets from `tests/**/*.css`
- browser:
  - `ChromeHeadless`
- `singleRun: true`
- `autoWatch: false`

This makes Karma the execution runner, not the bundler.

## Built Output

The key architectural point is:

- source-side UI specs are bundled into a browser-ready test artifact
- Karma runs against that artifact rather than the raw source tree

The intended destination for that built output is:

- `tests/`

## How Specs Enter The Test Build

The important detail in this Polylith model is that UI specs are not
discovered directly by Karma.

Instead, the app build should define an explicit browser test entry, typically
with fields like:

- `spec: 'src/spec.js'`
- `testDest: 'tests'`

That means `polylith test <app>` starts at `src/spec.js` and builds the
browser test bundle into `tests/`.

The root `src/spec.js` should then pull in test code through explicit imports,
for example:

- `import '@polylith/features';`
- `import './common/spec.js';`
- `import './components/spec.js';`

This creates a layered inclusion model:

- the app build points the test lane at `src/spec.js`
- `src/spec.js` aggregates shared spec entrypoints
- `@polylith/features` pulls feature-owned `spec.js` entrypoints into the
  bundle
- each area-level `spec.js` imports the actual `*Spec.js` files

So the practical rule is:

- individual `*Spec.js` files become part of the test build because some
  `spec.js` entrypoint imports them
- Karma does not perform source-side spec discovery on its own
- if a spec is not appearing in the test run, first check whether it is
  reachable through the `spec.js` aggregation chain

## Source Test Placement

The intended browser-spec placement model is:

- source specs live near the code they exercise
- browser specs can live in nearby `_tests` folders
- nearby `spec.js` files act as local aggregators
- the root `src/spec.js` remains structural rather than manually listing every
  spec in the app

So the practical model is:

- source specs live near the code
- source specs are grouped by nearby `spec.js` aggregators
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
- use a Polylith test build step to emit browser test artifacts into `tests/`
- prefer a two-process dev loop:
  - one process to rebuild browser test output
  - one process to rerun Karma

This keeps the browser test architecture aligned with the existing Polylith
build model instead of introducing a completely separate UI test pipeline.
