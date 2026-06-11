# Active Topic

Current active topic: `3d-asset-pipeline`

Current focus: generated 3D models from the asset-pipeline contract,
especially final-rendering SVG handoff into cutter, stamped-body, colored
inlay, and preview artifacts.

Current subtopic: generated asset contract and SVG-to-model consumption for
Mark III base tile selection and generated outputs.

Continuity notes:

- The SVG pipeline belongs to the `3d-asset-pipeline` topic in the topics
  index.
- Generated 3D model production from accepted SVG contracts is the immediate
  focus.
- The latest Mark III artist delivery is integrated as a selectable
  generated-asset base tile while preserving embedded/secondary-UV texture
  materials and carving the configured ivory/front mesh correctly.
- General repo architecture rules still apply, but asset-pipeline contracts are
  the source of truth for stage boundaries and generated model handoffs.

Additional reload sources:

- [3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/README.md)
- [SVG Stage Contracts](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/svg-stage-contracts.md)
- [Current Contracts](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/current-contracts.md)
- [Generated Asset Contract](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/generated-asset-contract.md)

When switching topics, update this file with the new topic id from
[Topics Index](/c:/dev/poly-gc-react/agents/topics/README.md). On bootstrap,
load the active topic README after the lightweight shared context.

The user may ask to add extra reload sources here when a specific file is
important for continuity. Keep those sources focused and relevant. On
bootstrap, load listed additional sources after the active topic README.
