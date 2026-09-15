# Folder Standards Manifest

[Standards governance](C:/Users/gande/.codex/documentation/standards/documentation.md) defines applicability and precedence.
[Repository overlay](overlay.md) owns local refinements and replacements.

## Standards Sets

### `governance`

Extends: none
Standards:

- [documentation.md](C:/Users/gande/.codex/documentation/standards/documentation.md) - Standards and documentation governance.

### `code`

Extends: governance
Standards:

- [architecture.md](C:/Users/gande/.codex/documentation/standards/architecture.md) - Authored capability ownership and boundaries.
- [code-conventions.md](C:/Users/gande/.codex/documentation/standards/code-conventions.md) - JavaScript/module and source conventions.
- [jsdoc.md](C:/Users/gande/.codex/documentation/standards/jsdoc.md) - Documentation of authored callable contracts.
- [types.md](C:/Users/gande/.codex/documentation/standards/types.md) - Declaration ownership and public contracts.
- [testing.md](C:/Users/gande/.codex/documentation/standards/testing.md) - Behavioral verification and test ownership.

### `host`

Extends: code
Standards:

- [project-foundation.md](C:/Users/gande/.codex/documentation/standards/project-foundation.md) - Host package, runtime and repository facts.
- [polylith.md](C:/Users/gande/.codex/documentation/standards/polylith.md) - Build, activation and deployment composition.
- [server.md](C:/Users/gande/.codex/documentation/standards/server.md) - HTTP/server boundaries and host composition.
- [local-https.md](C:/Users/gande/.codex/documentation/standards/local-https.md) - Host development HTTPS configuration.

### `browser`

Extends: code
Standards:

- [polylith.md](C:/Users/gande/.codex/documentation/standards/polylith.md) - Build, activation and deployment composition.
- [remvc.md](C:/Users/gande/.codex/documentation/standards/remvc.md) - Resident client service/controller/view organization.
- [react.md](C:/Users/gande/.codex/documentation/standards/react.md) - Resident React presentation.
- [accessibility.md](C:/Users/gande/.codex/documentation/standards/accessibility.md) - Browser interactions and semantic presentation.

### `pipeline-browser`

Extends: browser
Standards:

- [app-shells.md](C:/Users/gande/.codex/documentation/standards/app-shells.md) - Pipeline page shell and routing.
- [server.md](C:/Users/gande/.codex/documentation/standards/server.md) - HTTP/server boundaries and host composition.
- [socket-io.md](C:/Users/gande/.codex/documentation/standards/socket-io.md) - Pipeline live-progress transport.

### `server`

Extends: code
Standards:

- [polylith.md](C:/Users/gande/.codex/documentation/standards/polylith.md) - Build, activation and deployment composition.
- [server.md](C:/Users/gande/.codex/documentation/standards/server.md) - HTTP/server boundaries and host composition.

### `gc-server`

Extends: server
Standards:

- [data-persistence.md](C:/Users/gande/.codex/documentation/standards/data-persistence.md) - GC database records and cross-boundary contracts.

### `pipeline-server`

Extends: server
Standards:

- [socket-io.md](C:/Users/gande/.codex/documentation/standards/socket-io.md) - Pipeline live-progress transport.

### `gc-browser`

Extends: browser
Standards:

- [server.md](C:/Users/gande/.codex/documentation/standards/server.md) - HTTP/server boundaries and host composition.
- [data-persistence.md](C:/Users/gande/.codex/documentation/standards/data-persistence.md) - GC database records and cross-boundary contracts.

## Folder Assignments

- `.` - `host` - Repository root and fallback host files.
- `agents/` - `governance` - Owning agents/ subtree.
- `references/` - `governance` - Owning references/ subtree.
- `src/gc/` - `gc-browser` - Owning src/gc/ subtree.
- `src/pipeline/` - `pipeline-browser` - Owning src/pipeline/ subtree.
- `src/3d-poc/` - `browser` - Owning src/3d-poc/ subtree.
- `src/sat/` - `browser` - Owning src/sat/ subtree.
- `src/pipeline_original/` - `governance` - Preserved behavior reference, not the active Pipeline app.
- `server/` - `server` - Owning server/ subtree.
- `server/gc/` - `gc-server` - Owning server/gc/ subtree.
- `server/pipeline/` - `pipeline-server` - Owning server/pipeline/ subtree.
- `engines/` - `code` - Owning engines/ subtree.
- `shared/` - `code` - Owning shared/ subtree.
- `types/` - `code` - Owning types/ subtree.
- `spec/` - `code` - Owning spec/ subtree.
- `scripts/` - `code` - Owning scripts/ subtree.
- `scripts/deploy/` - `host` - Owning scripts/deploy/ subtree.
- `builds/` - `host` - Owning builds/ subtree.
- `scripts/data/` - `governance` - Authored domain configuration.

## Repository Boundaries

Independently rooted discovered applications own their own standards. This manifest does not govern `deployed-apps/naginator` internals. Generated output and dependencies are not authored review units.
