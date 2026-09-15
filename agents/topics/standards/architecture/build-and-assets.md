# Build And Asset Flow

## Purpose

Project build/asset path examples. [Canonical Polylith](C:/Users/gande/.codex/documentation/standards/polylith.md) owns build inclusion, activation, copied assets, and test bundling.

## Current State

The repo uses Polylith build definitions, including `builds/gc.json` and `builds/pipeline.json`. They own templates, app-wide resources/CSS, and feature lists.

## Core Build Model

[Build and runtime gates](C:/Users/gande/.codex/documentation/standards/architecture.md#build-and-runtime-are-separate-gates) and [Polylith build configuration](C:/Users/gande/.codex/documentation/standards/polylith.md) define the engineering contract.

## Asset Paths

[Copied assets and runtime paths](C:/Users/gande/.codex/documentation/standards/polylith.md#copied-assets-and-runtime-paths) owns asset placement and shipped styling.

## Runtime Asset Path Derivation

Examples from current build metadata:

- Pipeline app images: `src/pipeline/assets/images/**` emits to `dist/pipeline/assets/images/**`; app styles emit from `assets/styles` to `dist/pipeline/assets/styles`. An app icon is referenced as `assets/images/circle-check.svg`.
- GC Mahjong feature: `assets/images/**` emits to `mj/images/**`; `assets/css/**` emits to `mj/css/**`. The frame corner is `mj/images/frame/tl-corner.png` in JSX and `../images/frame/tl-corner.png` relative to emitted CSS.

The owning build metadata remains the source of truth for these examples.

## Imported CSS

See [canonical shipped-styling rules](C:/Users/gande/.codex/documentation/standards/polylith.md#copied-assets-and-runtime-paths). Platform support for module-imported CSS is historical implementation behavior, not permission to use it for shipped styling.

## Practical Placement Rules

[Canonical asset placement](C:/Users/gande/.codex/documentation/standards/polylith.md#copied-assets-and-runtime-paths) and [React layout ownership](C:/Users/gande/.codex/documentation/standards/react.md#css-and-layout-ownership). Temporary live refresh is owned by the [overlay](../overlay.md#add-temporary-live-asset-refresh).

## Feature Build Files

Existing feature `build.json` files contribute `css`, `resources`, and an `index` entry. Inspect the owning file when diagnosing missing feature output.

## Agent Checklist

Use the canonical build/runtime gates and the owning build metadata when diagnosing missing source activation or copied output.

## Risks

Manual feature inclusion and separate runtime side-effect activation are distinct places to inspect when source exists but behavior is absent.
