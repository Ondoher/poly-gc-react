# Architecture Topics

This folder contains the main architecture notes for the repo.

Use this file as the entry point for the topic.

## Main Documents

- [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/architecture/architecture-overview.md)
- [REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md)
- [Feature Mechanics](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md)
- [Build And Asset Flow](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md)
- [Handling Randomness](/c:/dev/poly-gc-react/agents/topics/architecture/handling-randomness.md)

## Fast Links

REMVC architecture:

- [Core Framing](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#core-framing)
- [Roles](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#roles)
- [Registry](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#registry)
- [Model And Service Boundary](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#model-and-service-boundary)
- [View And Presentation](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#view-and-presentation)
- service lifecycle usage: [Registry](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#registry)

Feature organization:

- [Architectural Context](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#architectural-context)
- [Feature Ownership And Structure](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#feature-ownership-and-structure)
- [Naming And Placement Conventions](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#naming-and-placement-conventions)
- [Runtime Feature Activation](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#runtime-feature-activation)
- service startup and ready rules: [Naming And Placement Conventions](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#naming-and-placement-conventions)

Build and assets:

- [Core Build Model](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md#core-build-model)
- [Asset Paths](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md#asset-paths)
- [Runtime Asset Path Derivation](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md#runtime-asset-path-derivation)
- [Practical Placement Rules](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md#practical-placement-rules)
- [Feature Build Files](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md#feature-build-files)

Randomness:

- [Handling Randomness](/c:/dev/poly-gc-react/agents/topics/architecture/handling-randomness.md)

## Suggested Reading Order

1. Start with [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/architecture/architecture-overview.md) for a small context card.
2. Open [REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md) when the application model matters.
3. Open [Feature Mechanics](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md) for feature ownership, runtime activation, naming, and placement.
4. Use [Build And Asset Flow](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md) when a task involves build inclusion, copied assets, `dist`, or runtime asset paths.
5. Use [Handling Randomness](/c:/dev/poly-gc-react/agents/topics/architecture/handling-randomness.md) when code needs seeded, reproducible, or array-based random behavior.

## Which Doc?

- If the question is about overall application architecture, start with [REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md).
- If the question is about feature boundaries, naming, placement, or runtime feature activation, use [Feature Mechanics](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md).
- If the question is about build inclusion, copied assets, `dist`, or asset paths, use [Build And Asset Flow](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md).
- If the question is about seeded randomness, reproducibility, or list-selection helpers, use [Handling Randomness](/c:/dev/poly-gc-react/agents/topics/architecture/handling-randomness.md).
