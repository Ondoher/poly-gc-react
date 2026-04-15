# Spec

This folder contains shared Jasmine test infrastructure for non-UI test lanes.

Current intended targets:

- `engines` via `npm run test:engines`

Supporting folders:

- `support`
  Jasmine config files
- `helpers`
  shared Jasmine helpers loaded before specs

Notes:

- This lane is meant for UI-less code that does not need Karma or browser bundling.
- Specs are discovered directly by Jasmine from the repo-root target directory.
- Use the `*.spec.*` naming pattern for discovered specs in this lane.
