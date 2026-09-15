# Architecture Overview

## Core Model

The client uses registry-centered REMVC and React presentation. [REMVC](remvc.md) records conversion context and known implementation compromises. Engineering applicability is selected by the [manifest](../manifest.md), independently of the active topic.

## Dependency Direction

[Registry boundaries](C:/Users/gande/.codex/documentation/standards/remvc.md#registry), [lifecycle](C:/Users/gande/.codex/documentation/standards/remvc.md#service-lifecycle), and [test seams](C:/Users/gande/.codex/documentation/standards/testing.md) are canonical.

## Feature Boundaries

[Feature ownership](C:/Users/gande/.codex/documentation/standards/architecture.md#feature-ownership) is canonical. [Feature Mechanics](feature-mechanics.md) maps local shared component locations and activation.

## Naming And Placement Snapshot

See [Naming And Placement Conventions](feature-mechanics.md#naming-and-placement-conventions) for canonical code, JSDoc, and type references.

## Build And Assets

`package.json` owns the command definitions. `npm run build` builds configured apps through Polylith; `npm start` serves them. `dev`, `dev:watch`, and `dev:serve` expose the local development processes. Process coordination and temporary asset refresh are owned by the [overlay](../overlay.md). [Build And Asset Flow](build-and-assets.md) records emitted asset examples.

## Randomness

[Randomness](randomness.md) documents the GC utility API and links its local rule.
