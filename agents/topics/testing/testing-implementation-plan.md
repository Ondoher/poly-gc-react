# Testing Implementation Plan

## Purpose

Track the rollout of the browser/UI testing framework for this repo.

This note is the planning companion to
[testing.md](/c:/dev/poly-gc-react/agents/topics/testing/testing.md).
Use it to track:

- current status
- implementation phases
- concrete deliverables
- open questions
- follow-up work

## Current Status

Current state:

- the intended Polylith + Karma + Jasmine browser test shape is documented
- the repo does not yet have the browser test lane wired in
- no shared browser test harness exists yet in this workspace
- no app build currently defines the UI test entry/output path yet

Overall status:

- planning

## Target Shape

The intended end state is:

- each browser app can define a browser test entrypoint through its app build
- `polylith test <app>` builds a browser-ready test bundle
- built browser test output lands under an app-scoped `tests` destination
- Karma runs against built output, not raw source files
- Jasmine provides spec/runtime execution
- feature-local specs live near the code they cover
- `spec.js` files aggregate feature and shared specs into the app test bundle
- shared UI test support lives in a dedicated testing area

## Phase 1: Choose The First App

Status:

- pending

Goals:

- choose the first browser app that will receive the UI test lane
- confirm where that app's build definition lives
- confirm the app-specific `tests` output shape

Deliverables:

- selected initial app target
- agreed test output path, preferably app-scoped
- first implementation checklist for that app

Notes:

- because this repo has multiple apps, the first implementation should be
  explicitly app-targeted rather than global
- prefer outputs such as `tests/<app>` over one ambiguous shared bundle

## Phase 2: Add Build-Level Test Entry Support

Status:

- pending

Goals:

- add explicit browser test entry support to the selected app build
- define:
  - `spec`
  - `testDest`

Deliverables:

- app build definition updated with browser test fields
- documented destination for built browser test artifacts

Analog to build here:

- another Polylith app build defining:
  - `spec: 'src/spec.js'`
  - `testDest: 'tests'`

Repo-specific adaptation:

- this repo should likely use app-scoped test destinations

## Phase 3: Add Root Spec Entry

Status:

- pending

Goals:

- create the root browser test entrypoint for the selected app
- keep it structural rather than manually listing every spec forever

Deliverables:

- app root `src/spec.js` or equivalent app-specific spec entry

Expected structure:

- import feature-owned spec aggregators
- import shared spec aggregators
- remain intentionally small

Analog to build here:

- a root `spec.js` that imports:
  - `@polylith/features`
  - shared area spec aggregators

## Phase 4: Establish Spec Inclusion Conventions

Status:

- pending

Goals:

- define how specs become part of the browser test build
- keep spec ownership close to the code under test

Deliverables:

- nearby `_tests` placement convention for browser specs
- nearby `spec.js` aggregator convention
- root app `spec.js` aggregation convention

Rules to preserve:

- individual `*Spec.js` files are included because a `spec.js` imports them
- Karma should not be treated as the source discovery layer
- feature-local specs should stay with the feature where practical

## Phase 5: Introduce Shared Browser Test Support

Status:

- pending

Goals:

- create a dedicated shared testing support area
- add the first reusable browser test helpers

Deliverables:

- shared testing support folder
- initial harness or setup utilities

Likely shape:

- `src/gc/testing`
- or another shared repo-level testing support area that matches the existing
  source layout

Initial support should likely include:

- registry setup helpers
- app bootstrap helpers
- service override/mocking helpers
- DOM mount/unmount helpers

Analog to build here:

- a local equivalent of `src/testing/TestHarness.js`

## Phase 6: Build An App-Aware Test Harness

Status:

- pending

Goals:

- build the first shared harness for browser/UI testing in this repo
- make it aware of this repo's registry-driven and multi-app structure

Deliverables:

- first test harness implementation
- first documented mounting workflow

The harness should support things like:

- selecting the app under test
- mounting with the correct registry/context
- injecting mocks or overrides
- rendering views/components with minimal boilerplate

Important note:

- this repo should build an analog to the existing Polylith harness pattern,
  not a copy from another codebase
- the API should reflect this repo's REMVC and registry patterns

## Phase 7: Add Karma Runner Support

Status:

- pending

Goals:

- add a Karma runner that executes built browser test output

Deliverables:

- `karma.conf.cjs`
- app-aware file loading from built test output
- `ChromeHeadless` runner setup

Expected shape:

- `frameworks: ['jasmine']`
- load built `tests/**/*.js` as modules
- serve built `tests/**/*.css`
- `singleRun: true`
- `autoWatch: false`

Important rule:

- Karma is the runner, not the bundler

## Phase 8: Add App-Specific Scripts

Status:

- pending

Goals:

- expose the new test lane through clear npm scripts

Deliverables:

- app-specific one-shot UI test script
- app-specific watch build script
- app-specific Karma runner script

Preferred script pattern:

- `test:ui:<app>`
- `dev:tests:<app>`
- `karma:<app>`

Reason:

- the app dimension should stay visible in a multi-app repo

## Phase 9: Prove The Flow With One Thin Vertical Slice

Status:

- pending

Goals:

- validate the full browser test lane end-to-end with minimal scope

Deliverables:

- one passing feature-local browser spec
- one passing shared/browser component spec if useful

The first slice should prove:

- source spec placement
- `spec.js` aggregation
- Polylith browser test build
- built test output
- Karma execution in headless Chrome

## Phase 10: Verify Assets And CSS In Tests

Status:

- pending

Goals:

- verify that the browser test lane handles shipped styling and assets

Deliverables:

- at least one test case or test fixture that depends on built CSS
- optional asset-dependent test coverage if relevant

Reason:

- this repo is asset-flow sensitive, so the browser test lane must match real
  runtime asset behavior closely enough to be trustworthy

## Phase 11: Add Targeted Runtime Filtering

Status:

- future

Goals:

- improve iteration speed without changing the full-bundle build model

Deliverables:

- optional Karma `client.args` filter path
- Jasmine runtime filtering by suite/full spec name

Important constraint:

- keep the full Polylith test build intact
- only narrow execution scope at runtime inside Jasmine

Analog to build here later:

- the same kind of runtime filtering enhancement discussed for other Polylith
  browser test setups, where the full bundle still builds and loads, but
  Jasmine decides which specs to execute

## Open Questions

- which app should receive the first browser test lane
- where should shared browser testing support live in this repo exactly
- should `tests` output be app-scoped from day one
- how much app bootstrap should the first harness own versus delegating to
  smaller helpers
- whether the first slice should target a shared component or a feature view

## Immediate Next Steps

1. Choose the first app target.
2. Locate the relevant app build definition.
3. Decide the test output layout for that app.
4. Add the build-level `spec` and `testDest` support.
5. Add the first root `spec.js` entrypoint.

