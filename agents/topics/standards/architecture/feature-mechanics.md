# Feature Mechanics

## Purpose

Client feature implementation map. Engineering rules are selected by the [manifest](../manifest.md); this document records project paths and routes to canonical guidance.

## Architectural Context

The client uses registry-centered REMVC. See [REMVC](remvc.md) for implementation context and [canonical responsibilities](C:/Users/gande/.codex/documentation/standards/remvc.md).

## Feature Ownership And Structure

[Canonical feature ownership](C:/Users/gande/.codex/documentation/standards/architecture.md#feature-ownership) and [component ownership](C:/Users/gande/.codex/documentation/standards/react.md#shared-and-feature-local-ownership) govern extraction, privacy, and removal. GC shared UI lives in `src/gc/components`; Pipeline shared UI lives in `src/pipeline/components`.

## Naming And Placement Conventions

Use [code conventions](C:/Users/gande/.codex/documentation/standards/code-conventions.md), [JSDoc](C:/Users/gande/.codex/documentation/standards/jsdoc.md), and [types](C:/Users/gande/.codex/documentation/standards/types.md). These own class/service filenames, helper extraction, typed JS/JSX documentation, declaration exports, and event contracts.

`mjController.jsx` is an existing GC controller filename associated with `mj:controller`; it is an implementation fact, not a naming exception. See [Scripts](../scripts/README.md) for the local CLI helper.

## Runtime Feature Activation

Client services are instantiated by side-effect import chains. [Canonical activation rules](C:/Users/gande/.codex/documentation/standards/remvc.md#feature-activation-and-privacy) and [Polylith](C:/Users/gande/.codex/documentation/standards/polylith.md) own runtime/build requirements. [Build And Assets](build-and-assets.md) records concrete emitted paths.
