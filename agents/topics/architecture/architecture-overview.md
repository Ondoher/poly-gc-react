# Architecture Overview

Use this as the small, always-safe architecture context card. It gives the
repo's architectural shape without replacing the deeper topic documents.

## Core Model

The client architecture is best read as registry-centered REMVC:

- `Registry` locates services.
- `Executor` starts the app and chooses initial control flow.
- `Model` owns data access, transport, persistence, or domain interaction.
- `Service` presents app-facing capabilities over models and other internals.
- `Controller` manages feature flow and user-facing orchestration.
- `View` organizes controller intent for presentation.
- React is the presentation layer, not the entire view layer.

The repo does not always follow this separation perfectly. Treat the model
above as the direction for new work and cleanup, not as a claim that all current
code already conforms.

Expand when needed:

- [REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md)

## Dependency Direction

Prefer dependency lookup through the registry over broad constructor injection.

Philosophy:

- Dependency knowledge should live inside the conceptual owner.
- Registry lookup keeps app-facing service dependencies close to the code that
  knows why they are needed.
- DI is acceptable inside one internal structural unit when the owning unit is
  wiring its own testable helper pieces.
- Method parameters are runtime API, not test seams.
- Do not add extra method parameters only to make tests easier; except for
  constructor-level mocks, prefer stubbing or mocking the owning
  state/collaborator.

Clarification:

- If one complex internal interface is split into helper classes for structural
  reasons, treat that helper cluster as one conceptual unit.
- Options-object dependency injection is acceptable inside that tight cluster
  when it improves testability.
- Tests should influence helper behavior through construction-time mocks or the
  same state/collaborator production code reads.
- Do not mistake that pattern for app-level service/plugin architecture; use the
  registry for app-facing services and independently located dependencies.

Service lifecycle rule:

- `start()` should do local initialization only.
- `start()` should not call other services or assume dependencies are ready.
- `ready()` is where cross-service subscriptions, listener wiring, and
  dependency-driven setup belong.

Views and React components should prefer consuming services instead of reaching
directly into models or unrelated feature internals.

Expand when needed:

- [Registry](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#registry)
- [Model And Service Boundary](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#model-and-service-boundary)

## Feature Boundaries

Features are intended to be self-contained and removable.

Default assumptions:

- Feature-internal code, styles, and assets are private to that feature.
- Features should not quietly reach into another feature's internals.
- Shared components belong in `src/gc/components`.
- Shared app-facing behavior should be exposed through services or common
  layers, not by cross-feature imports.

Expand when needed:

- [Feature Ownership And Structure](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#feature-ownership-and-structure)
- [Naming And Placement Conventions](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#naming-and-placement-conventions)

## Naming And Placement Snapshot

Use this as a quick rule of thumb, then open the full conventions when a task
involves creating, moving, or renaming files.

- Class files generally use `PascalCase`.
- Service implementation files generally use `kebab-case`.
- CSS and image asset files use `kebab-case`.
- Complex JSDoc types should live in a nearby `types.d.ts`.
- Type properties should be documented.
- Lower-level helpers usually appear before composed public methods.

Expand when needed:

- [Naming And Placement Conventions](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#naming-and-placement-conventions)

## Build And Assets

The build and asset flow has separate rules from runtime feature ownership.
Do not infer asset behavior from component placement alone.

Open the build topic when a task involves:

- copied assets
- generated assets
- `dist`
- runtime asset paths
- feature build files

Expand when needed:

- [Build And Asset Flow](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md)

## Randomness

Seeded/reproducible randomness has repo-specific expectations, especially for
games and generation. Do not replace existing random helpers casually.

Expand when needed:

- [Handling Randomness](/c:/dev/poly-gc-react/agents/topics/architecture/handling-randomness.md)
