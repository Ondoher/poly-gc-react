# REMVC Architecture

## Purpose

Capture the primary architectural organization used by this repo independently of build-system and asset-pipeline concerns.

This note is about application structure, dependency location, runtime orchestration, and conceptual boundaries within the client architecture.

## Historical Note

This codebase is a conversion from an earlier non-React application.

That earlier codebase can be found locally at `c:\dev\gc`.

That history is useful context when reading current architectural seams, because some present implementation choices reflect adaptation into React rather than a clean-sheet React-first design.

## Core Framing

The primary architectural framing used in this repo is `REMVC`:

- `Registry`
- `Executor`
- `Model`
- `View`
- `Controller`

This should not be read as one global model, one global view, and one global controller for the entire application.

A more accurate reading is that the application may contain multiple scoped MVC groupings. Those scopes often correspond to a feature or bounded functional area, and each such scope may have its own model, view, and controller.

## Roles

Within that framing:

- the registry is a centralized locator for service dependencies
- the executor is responsible for initializing the application and determining which controller should receive initial control
- models own state, data access, transport-facing behavior, or domain interaction
- views organize information and direction for presentation
- controllers manage feature flow and user-facing orchestration

The initial controller selected by the executor may be influenced by startup context such as configuration, route, URL, or similar runtime inputs.

## Registry

The registry is especially important in this architecture because the repo prefers service location through the registry over dependency injection.

The registry is not just a generic coordination mechanism. Its primary purpose is to provide a centralized way for code to locate the services it depends on.

That preference appears deliberate rather than accidental. The local reasoning is that dependency knowledge should stay close to the code that actually knows what it needs, rather than being pushed outward into a separate injection layer.

In practice, this often means classes declare their dependencies by calling `this.registry.subscribe(...)` where the dependency is used, instead of receiving every dependency from an external injector.

So in practical terms, the repo behaves more like a registry-centered architecture containing multiple scoped MVC groupings than a single monolithic MVC stack.

There is also an important lifecycle rule for registry-backed services:

- service `start()` should be used for local initialization that makes the service usable
- service `start()` should not assume other services are ready yet
- code should not call or depend on other services until `ready()` has been called
- cross-service subscriptions, listener wiring, and precache work that depends on another service should happen in `ready()`

This matters because Polylith startup can initialize services in parallel. A service may exist in the registry during startup without yet being safe to call as a dependency.

## Model And Service Boundary

Another useful architectural boundary is the distinction between models and services on the client side.

Current preferred pattern:

- models should own raw data access, transport-facing behavior, or backend/domain interaction
- services should provide the UI-facing or app-facing interface over those models
- views should prefer subscribing to services rather than reaching directly into models

This matters because it keeps view dependencies aligned with runtime/UI concerns rather than transport or storage concerns.

A useful way to think about the boundary is:

- model
  - fetches, persists, or bridges domain data
- service
  - caches, adapts, and presents that data for the rest of the client
- view
  - consumes the service

This should be treated as:

- preferred direction
- useful review heuristic
- an incremental cleanup target where existing code still bypasses the service layer

## View And Presentation

Another important distinction is between the view and the presentation layer.

In this architecture, the purpose of a view is to organize information and direction coming from the controller and translate that into presentation decisions.

The presentation itself is rendered through React.

A useful way to think about that boundary is:

- controller
  - determines user-facing flow, behavior, and direction
- view
  - organizes that information and translates it into presentation structure
- presentation
  - is the concrete React rendering layer

This distinction matters because it helps separate:

- application flow and intent
- UI organization
- actual rendering technology

So when reading or evolving the repo, React should be understood as the presentation mechanism, not as the full meaning of the view layer.

## Current Addendum

The repo is not following that separation perfectly today.

In the current implementation, some code paths have the controller render the React component directly rather than delegating through a distinct view layer.

That should be treated as a current implementation detail rather than the ideal architectural target.

So the present reality is:

- `REMVC` remains the intended architectural framing
- React remains the presentation technology
- some controllers are currently taking on direct rendering responsibility that would more cleanly belong behind a view boundary

This is a point to revisit later rather than an intentional rejection of the broader `REMVC` organization.
