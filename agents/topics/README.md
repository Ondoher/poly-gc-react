# Topics Index

Use this file as a routing table for repo topic guidance.

Bootstrap rule:

- Read this index first when topic guidance may be useful.
- Read [Active Topic](/c:/dev/poly-gc-react/agents/topics/active-topic.md)
  during bootstrap. If it names an active topic, load that topic's README after
  the lightweight shared context. If it lists additional reload sources, load
  those after the active topic README.
- When switching topics, update the active topic file to the new topic id from
  this index.
- When the user asks for extra reload sources, add focused relevant paths to
  the active topic file.
- Always also read the small [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/architecture/architecture-overview.md)
  on bootstrap. Treat it as the always-on repo context for architecture,
  placement, feature boundaries, service lifecycle, and build/run expectations.
- Do not open linked topic documents until the user's task clearly matches that
  topic, the user explicitly asks to switch to that topic, or local code context
  is not enough to proceed safely.
- Prefer the most specific matching topic. Avoid loading neighboring topics
  just because they are related.
- Archived documents are historical context only. Open them only when the user
  explicitly asks for history or comparison.

## Topic Areas

- [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/architecture/architecture-overview.md)
- [Architecture Topic](/c:/dev/poly-gc-react/agents/topics/architecture/README.md)
- [Components](/c:/dev/poly-gc-react/agents/topics/components/porting-guidance.md)
- [CSS Animations](/c:/dev/poly-gc-react/agents/topics/css-animations/README.md)
- [Deployment](/c:/dev/poly-gc-react/agents/topics/deployment/README.md)
- [Difficulty](/c:/dev/poly-gc-react/agents/topics/difficulty/README.md)
- [Engine Refactor](/c:/dev/poly-gc-react/agents/topics/engine-refactor/README.md)
- [MJ](/c:/dev/poly-gc-react/agents/topics/mj/README.md)
- [MVP](/c:/dev/poly-gc-react/agents/topics/mvp/README.md)
- [Pipeline App](/c:/dev/poly-gc-react/agents/topics/pipeline-app/README.md)
- [Progressive Web App](/c:/dev/poly-gc-react/agents/topics/progressive-web-app/README.md)
- [React Code](/c:/dev/poly-gc-react/agents/topics/react-code/README.md)
- [Real 3D Rendering](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/README.md)
- [Scaling](/c:/dev/poly-gc-react/agents/topics/scaling/README.md)
- [SAT App](/c:/dev/poly-gc-react/agents/topics/sat-app/README.md)
- [Scripts](/c:/dev/poly-gc-react/agents/topics/scripts/README.md)
- [3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/README.md)
  ([summary](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md))
- [Telemetry Analysis](/c:/dev/poly-gc-react/agents/topics/telemetry-analysis/README.md)
- [Testing](/c:/dev/poly-gc-react/agents/topics/testing/README.md)

## Quick Routing

- Use `architecture` for REMVC, feature boundaries, build/assets, path
  conventions, naming, and placement rules.
- Use `components` for shared component inventory, porting, context support, and
  common UI component dependencies.
- Use `css-animations` for animation notes and MJ play/win animation behavior.
- Use `deployment` for build, deploy, hosting, and release-check guidance.
- Use `difficulty` for MJ difficulty tuning, generation presets, and related
  board-generation behavior.
- Use `engine-refactor` for the UI-less Mahjongg engine experiment and live to
  experimental engine mapping.
- Use `mj` for general Mahjongg feature notes that are not specifically engine
  refactor, scaling, difficulty, or animation work.
- Use `mvp` for MVP scope and product-tracking notes.
- Use `pipeline-app` for the pipeline approval app's shell, routing, page
  registration, feature decomposition, REMVC view services, restored review
  pages, shared review presentation boundaries, and future app-side Asset
  Review page architecture.
- Use `progressive-web-app` for PWA install/offline/app-shell behavior.
- Use `react-code` for writing or refactoring React presentation code,
  component structure, JSX organization, local component state, callbacks, and
  React/CSS boundaries.
- Use `real-3d-rendering` for the `3d-poc` viewer, renderer diagnostics,
  scene/camera/lighting/material experiments, and visual 3D research notes.
- Use `scaling` for tile-size generation, layout scaling, canvas sizing, and
  related tests.
- Use `sat-app` for the new `src/sat` application, including its app shape,
  product direction, UI decisions, and SAT-specific domain model.
- Use `scripts` for repo utility scripts and generated asset/script workflows.
- Use `3d-asset-pipeline` for reference bitmap structure, source SVG
  normalization, alignment transforms, semantic assignment, metadata review,
  prepared SVG export, asset build invalidation/queueing, and cutter/stamped/
  inlay GLB generation.
- Use `telemetry-analysis` for telemetry capture, interpretation, and analysis.
- Use `testing` for test strategy, test commands, and test implementation plans.
