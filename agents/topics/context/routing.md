# Routing

Use this file as the routing table for the reorganized topic tree.

## Main Areas

- Use [Standards](../standards/README.md) for repo-wide architecture, testing,
  deployment, React, component, and script conventions.
- Use [Game Collection](../products/game-collection/README.md) for the game
  product, Mahjongg Solitaire, restored games, and shared game UI.
- Use [Asset Pipeline 3D](../products/asset-pipeline-3d/README.md) for SVG
  preprocessing, generated 3D assets, base tiles, pipeline queues, contractor
  handoff, and Asset Review domain contracts.
- Use [Apps](../apps/README.md) for deployable app surfaces in this monorepo,
  including `gc`, `pipeline`, `sat`, and `flat`.
- Use [References](../references/README.md) for large assets, PDFs, images,
  palettes, contractor packages, and research material.
- Use [Documentation Restructure](../documentation-restructure/README.md) for
  the ongoing migration from `agents/topics.bak`.

## Former Topic Mapping

- `architecture` -> `standards/architecture`
- `testing` -> `standards/testing`
- `deployment` -> `standards/deployment`
- `react-code` -> `standards/react-code`
- `components` -> `standards/components`
- `scripts` -> `standards/scripts`, with domain-specific script meaning moved
  to the owning product or app.
- `mj`, `difficulty`, `scaling`, `css-animations`, `engine-refactor`,
  `telemetry-analysis`, `mvp`, and `progressive-web-app` ->
  `products/game-collection`
- `3d-asset-pipeline`, `pipeline-app`, and useful parts of
  `real-3d-rendering` -> `products/asset-pipeline-3d`
- `sat-app` -> `apps/sat`
- `flat` -> `apps/flat`
