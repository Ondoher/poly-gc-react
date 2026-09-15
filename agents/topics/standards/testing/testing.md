# Testing

## Purpose

Local lane inventory and domain scenarios. [Canonical testing](C:/Users/gande/.codex/documentation/standards/testing.md) and [Polylith](C:/Users/gande/.codex/documentation/standards/polylith.md) own behavior coverage, sequence preference, discovery, placement, and runner rules.

## Current Test Support

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

`package.json` owns the command definitions. Root `npm test` currently covers GC UI only; orchestration across all repository-owned lanes remains an implementation follow-up against the canonical root-test contract.

## Domain-Level Testing

SVG preprocessor behavior scenarios retained for local development:

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

## Core UI Test Stack

Current browser lanes bundle Jasmine specs with Polylith and run them with Karma/ChromeHeadless. Engine and script lanes use direct Jasmine configs.

## Script Flow

See the current command inventory above and [canonical runner guidance](C:/Users/gande/.codex/documentation/standards/testing.md).

## Karma Configuration Shape

`karma.conf.cjs` owns browser execution configuration; it consumes the generated app test output.

## Built Output

Browser test outputs are `tests/gc/` and `tests/pipeline/`.

## How Specs Enter The Test Build

Current app entries are `src/gc/test.js` and `src/pipeline/test.js`. They import `@polylith/tests`; app `testGroups` and feature `test.json` supply discovery. [Canonical Polylith](C:/Users/gande/.codex/documentation/standards/polylith.md) owns the contract. The obsolete manual-aggregator implementation plan has been removed.

## Source Test Placement

[Canonical test placement and discovery](C:/Users/gande/.codex/documentation/standards/testing.md). Script helper specs currently live in `scripts/shared/_tests`.

## Shared UI Test Support

[Canonical test-support ownership](C:/Users/gande/.codex/documentation/standards/testing.md).

## Service Testing Guidance

[Canonical service/lifecycle verification](C:/Users/gande/.codex/documentation/standards/testing.md). Local service classes are directly constructible with a test registry.
