# REMVC Architecture

## Purpose

Implementation context for the client. The selected [canonical REMVC standard](C:/Users/gande/.codex/documentation/standards/remvc.md) owns architectural rules.

## Historical Note

This codebase was converted from the non-React application at `c:\dev\gc`. Some current seams reflect that conversion.

## Core Framing

The client uses registry-centered REMVC with multiple feature-scoped MVC groupings. See [preferred flow](C:/Users/gande/.codex/documentation/standards/remvc.md#preferred-flow).

## Roles

[Canonical responsibility matrix](C:/Users/gande/.codex/documentation/standards/remvc.md#strict-responsibility-matrix).

## Registry

[Canonical registry boundaries](C:/Users/gande/.codex/documentation/standards/remvc.md#registry) and [service lifecycle](C:/Users/gande/.codex/documentation/standards/remvc.md#service-lifecycle) govern dependency location and readiness. [Testing](C:/Users/gande/.codex/documentation/standards/testing.md) owns production seams and lifecycle verification.

## Model And Service Boundary

[Canonical model/service boundaries](C:/Users/gande/.codex/documentation/standards/remvc.md#models-and-services) govern capability ownership without redundant facades. Exported service interfaces and shared EventBus contracts follow [JSDoc](C:/Users/gande/.codex/documentation/standards/jsdoc.md) and [types](C:/Users/gande/.codex/documentation/standards/types.md).

## View And Presentation

[Canonical view/presentation boundaries](C:/Users/gande/.codex/documentation/standards/remvc.md#views-and-react-presentation) and [React](C:/Users/gande/.codex/documentation/standards/react.md).

## Current Addendum

Some existing controllers render React components directly instead of delegating through a distinct view. This is current implementation behavior and remains a cleanup target against the canonical boundary; reconciliation does not certify code compliance.
