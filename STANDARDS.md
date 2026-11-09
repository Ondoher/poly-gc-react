# Repository Engineering Standards

> **Generated developer reference.** Do not modify this file directly or use it as standards authority.
>
> To update it now, tell Codex: `Use $write-standards-guide to update this repository's generated STANDARDS.md now.`

## Authority and provenance

- Folder manifest: [`agents/topics/standards/manifest.md`](./agents/topics/standards/manifest.md)
- Repository overlay: [`agents/topics/standards/overlay.md`](./agents/topics/standards/overlay.md)
- Standards governance: [`documentation.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/documentation.md)
- First normalized: `2026-09-15T16:45:50.809Z`
- Repository standards configuration fingerprint: `sha256:82f705f532405dab423eb78a377f728ad3ba7e9bd855632093827aa8c44702af`
- Local standards overlay fingerprint: `sha256:8db899ec8576804c84bf3bb83cf8db6a9fbf147dd8624a6aeb7cf341acd7fac3`
- Selected canonical standards fingerprint: `sha256:4226cb43fc2960ad7692c8a9b331159999cd85316175e0718881a5d2c16d8d13`
- Guide source fingerprint: `sha256:c7842b38e47255f0d2bfb2f391741c8a71f1f30d6a67f879464143e49df8f046`

For each file, the longest matching folder assignment selects one named standards set. The set includes its inherited canonical standards, then matching folder-scoped overlay rules modify specific sections. This file is a readable projection only.

Canonical links open the configured GitHub branch and show its latest published standards. Skills and reviewers still read local canonical files; the fingerprints above describe those local inputs, which may contain unpublished changes. Publish the governance checkout with `update-standards` to update the linked documents. Private repositories require GitHub access.

## Standards sets

### `governance`

Extends: `none`

Adds:

- [`documentation.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/documentation.md) — Standards and documentation governance.

### `code`

Extends: `governance`

Adds:

- [`architecture.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/architecture.md) — Authored capability ownership and boundaries.
- [`code-conventions.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/code-conventions.md) — JavaScript/module and source conventions.
- [`jsdoc.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/jsdoc.md) — Documentation of authored callable contracts.
- [`types.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/types.md) — Declaration ownership and public contracts.
- [`testing.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/testing.md) — Behavioral verification and test ownership.

### `host`

Extends: `code`

Adds:

- [`project-foundation.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/project-foundation.md) — Host package, runtime and repository facts.
- [`polylith.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/polylith.md) — Build, activation and deployment composition.
- [`server.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/server.md) — HTTP/server boundaries and host composition.
- [`local-https.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/local-https.md) — Host development HTTPS configuration.

### `browser`

Extends: `code`

Adds:

- [`polylith.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/polylith.md) — Build, activation and deployment composition.
- [`remvc.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/remvc.md) — Resident client service/controller/view organization.
- [`react.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/react.md) — Resident React presentation.
- [`accessibility.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/accessibility.md) — Browser interactions and semantic presentation.

### `pipeline-browser`

Extends: `browser`

Adds:

- [`app-shells.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/app-shells.md) — Pipeline page shell and routing.
- [`server.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/server.md) — HTTP/server boundaries and host composition.
- [`socket-io.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/socket-io.md) — Pipeline live-progress transport.

### `server`

Extends: `code`

Adds:

- [`polylith.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/polylith.md) — Build, activation and deployment composition.
- [`server.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/server.md) — HTTP/server boundaries and host composition.

### `gc-server`

Extends: `server`

Adds:

- [`data-persistence.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/data-persistence.md) — GC database records and cross-boundary contracts.

### `pipeline-server`

Extends: `server`

Adds:

- [`socket-io.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/socket-io.md) — Pipeline live-progress transport.

### `gc-browser`

Extends: `browser`

Adds:

- [`server.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/server.md) — HTTP/server boundaries and host composition.
- [`data-persistence.md`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/data-persistence.md) — GC database records and cross-boundary contracts.

## Folder assignments

- `.` → `host` — Repository root and fallback host files.
- `agents/` → `governance` — Owning agents/ subtree.
- `references/` → `governance` — Owning references/ subtree.
- `src/gc/` → `gc-browser` — Owning src/gc/ subtree.
- `src/pipeline/` → `pipeline-browser` — Owning src/pipeline/ subtree.
- `src/3d-poc/` → `browser` — Owning src/3d-poc/ subtree.
- `src/sat/` → `browser` — Owning src/sat/ subtree.
- `src/pipeline_original/` → `governance` — Preserved behavior reference, not the active Pipeline app.
- `server/` → `server` — Owning server/ subtree.
- `server/gc/` → `gc-server` — Owning server/gc/ subtree.
- `server/pipeline/` → `pipeline-server` — Owning server/pipeline/ subtree.
- `engines/` → `code` — Owning engines/ subtree.
- `shared/` → `code` — Owning shared/ subtree.
- `types/` → `code` — Owning types/ subtree.
- `spec/` → `code` — Owning spec/ subtree.
- `scripts/` → `code` — Owning scripts/ subtree.
- `scripts/deploy/` → `host` — Owning scripts/deploy/ subtree.
- `builds/` → `host` — Owning builds/ subtree.
- `scripts/data/` → `governance` — Authored domain configuration.

## Repository-wide additions and replacements

### ADD: Topic continuity

- Extends: [`documentation.md#Project Topics`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/documentation.md#project-topics)
- Scope: `repository`
- Rule: Keep current-state, routing, design, and tracker documents free of running history. Put chronology in the topic's designated log; plans may retain checked-off progress. After a design decision, refresh relevant status/design docs. After an implementation step, record what changed, what was verified, and what remains next in relevant status docs. After an explicit documentation request, update relevant topic docs and remove stale/redundant wording. At checkpoint, refresh status and focused subtopic notes when relevant. Before completing any of these tasks, make sure the owning status document reflects the current state.
- Reason: This repository uses focused topic companions and designated logs for continuing work.

### ADD: Existing development processes

- Extends: [`documentation.md#Loading Procedure`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/documentation.md#loading-procedure)
- Scope: `repository`
- Rule: During normal development, assume the Polylith watcher and local server are already running. Do not start duplicate watchers or dev servers unless the user explicitly requests them. The normal build command remains available as a syntax/build smoke check.
- Reason: Normal sessions share the developer's running processes.

### ADD: Temporary live asset refresh

- Extends: [`polylith.md#Copied Assets And Runtime Paths`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/polylith.md#copied-assets-and-runtime-paths)
- Scope: `repository`
- Rule: If the running watcher misses newly added or changed assets, either notify the user that the watcher may need restarting or copy only those assets to the exact generated destinations derived from their owning build metadata. This is a temporary live-development refresh; the normal builder subsequently reconciles output. Do not use this shortcut for source code or build configuration.
- Reason: The existing watcher may not detect newly added asset files.

### ADD: GC randomness domain

- Extends: [`testing.md#Durable Test Principles`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/testing.md#durable-test-principles)
- Scope: `repository`
- Rule: For GC-domain randomness in `src/gc/`, `engines/mah-jong-experimental/`, and `scripts/difficulty/`, prefer the shared `src/gc/utils/random.js` Random utility over direct `Math.random()`. Seed reproducible flows at their entry and reseed mid-flow only when sequence reset is intentional. Keep random selection near orchestration and lower-level rule helpers deterministic from their inputs. Prefer the utility's selection/distribution methods, choosing pick methods for removal and choose methods for non-mutating selection. Exact-outcome tests explicitly seed the utility; invariant tests assert the required structural guarantees. This rule does not introduce GC dependencies into other apps or script domains.
- Reason: GC generation and replay share a seeded random domain; one scoped rule owns the utility selection across its participating folders.

## Folder-specific additions and replacements

### ADD: Normalized script inputs

- Extends: [`code-conventions.md#Validation And Failure Policy`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/code-conventions.md#validation-and-failure-policy)
- Scope: `folder:scripts/`
- Rule: Keep `process.argv` and raw argv at the CLI boundary. After parsing, use `scripts/shared/options.js` for option extraction and pass normalized options and positional params into script logic. Keep resource/logger seams consistent with the production owner rather than introducing test-only runtime switches.
- Reason: Repository scripts share a concrete option-normalization helper and input vocabulary.

### ADD: Pipeline shared model registration

- Extends: [`remvc.md#Models And Services`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/remvc.md#models-and-services)
- Scope: `folder:src/pipeline/`
- Rule: Client model logic shared by two Pipeline pages lives in `src/pipeline/models` as a registry-backed model service consumed by page controllers. Feature-local models remain owned by their page. This registration requirement does not require a redundant facade when the model itself exposes the capability.
- Reason: Pipeline pages share model capabilities through the app registry.

### ADD: Pipeline page service identities

- Extends: [`code-conventions.md#JavaScript And Module Shape`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/code-conventions.md#javascript-and-module-shape)
- Scope: `folder:src/pipeline/`
- Rule: A page controller service uses `<page-id>-controller` and its page view service uses `<page-id>-view`. The page identity supplies the namespace; implementation filenames continue to follow the canonical naming rules.
- Reason: Pipeline page registration and view lookup use paired service identities.

### REPLACE: Pipeline top tabs

- Replaces: [`app-shells.md#Top Tabs`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/app-shells.md#top-tabs)
- Scope: `folder:src/pipeline/`
- Rule: MUI Tabs are required only if the app selects MUI. The current non-MUI Pipeline shell may use its own semantic, keyboard-operable tab controls. Keep the application header sticky and tab navigation usable when it overflows; on narrow screens place the tabs on a full-width second header row without changing semantic ownership. Render one active page in main; pages own their headings and internal scrolling.
- Reason: Pipeline has its own shared control system and has not selected MUI.

### REPLACE: Pipeline shell accessibility mechanisms

- Replaces: [`app-shells.md#Responsive And Accessibility Rules`](https://github.com/Ondoher/polylith-skills/blob/main/documentation/standards/app-shells.md#responsive-and-accessibility-rules)
- Scope: `folder:src/pipeline/`
- Rule: Preserve navigation/page semantics across breakpoints and change arrangement in CSS. Keep menu controls, tabs, and drawer items keyboard-operable through the selected control system; use MUI mechanisms only when MUI is selected. Give navigation a useful distinguishing label when needed. Restore focus sensibly when a temporary drawer closes. Keep active selection visible and programmatically exposed. If desktop collapse exists, keep its control available in both states and expose expanded state/action when accessibility support is active; collapsed controls leave keyboard and assistive-technology traversal without changing the selected page. Desktop collapse and mobile overlay state remain independent across breakpoints. Pages do not calculate around shell chrome dimensions.
- Reason: Preserve every applicable shell obligation while making toolkit-specific mechanisms conditional.
