# Repository Standards Overlay

## ADD: Topic continuity

Extends: documentation.md#Project Topics
Scope: repository
Rule: Keep current-state, routing, design, and tracker documents free of running history. Put chronology in the topic's designated log; plans may retain checked-off progress. After a design decision, refresh relevant status/design docs. After an implementation step, record what changed, what was verified, and what remains next in relevant status docs. After an explicit documentation request, update relevant topic docs and remove stale/redundant wording. At checkpoint, refresh status and focused subtopic notes when relevant. Before completing any of these tasks, make sure the owning status document reflects the current state.
Reason: This repository uses focused topic companions and designated logs for continuing work.

## ADD: Existing development processes

Extends: documentation.md#Loading Procedure
Scope: repository
Rule: During normal development, assume the Polylith watcher and local server are already running. Do not start duplicate watchers or dev servers unless the user explicitly requests them. The normal build command remains available as a syntax/build smoke check.
Reason: Normal sessions share the developer's running processes.

## ADD: Temporary live asset refresh

Extends: polylith.md#Copied Assets And Runtime Paths
Scope: repository
Rule: If the running watcher misses newly added or changed assets, either notify the user that the watcher may need restarting or copy only those assets to the exact generated destinations derived from their owning build metadata. This is a temporary live-development refresh; the normal builder subsequently reconciles output. Do not use this shortcut for source code or build configuration.
Reason: The existing watcher may not detect newly added asset files.

## ADD: GC randomness domain

Extends: testing.md#Durable Test Principles
Scope: repository
Rule: For GC-domain randomness in `src/gc/`, `engines/mah-jong-experimental/`, and `scripts/difficulty/`, prefer the shared `src/gc/utils/random.js` Random utility over direct `Math.random()`. Seed reproducible flows at their entry and reseed mid-flow only when sequence reset is intentional. Keep random selection near orchestration and lower-level rule helpers deterministic from their inputs. Prefer the utility's selection/distribution methods, choosing pick methods for removal and choose methods for non-mutating selection. Exact-outcome tests explicitly seed the utility; invariant tests assert the required structural guarantees. This rule does not introduce GC dependencies into other apps or script domains.
Reason: GC generation and replay share a seeded random domain; one scoped rule owns the utility selection across its participating folders.

## ADD: Normalized script inputs

Extends: code-conventions.md#Validation And Failure Policy
Scope: folder:scripts/
Rule: Keep `process.argv` and raw argv at the CLI boundary. After parsing, use `scripts/shared/options.js` for option extraction and pass normalized options and positional params into script logic. Keep resource/logger seams consistent with the production owner rather than introducing test-only runtime switches.
Reason: Repository scripts share a concrete option-normalization helper and input vocabulary.

## ADD: Pipeline shared model registration

Extends: remvc.md#Models And Services
Scope: folder:src/pipeline/
Rule: Client model logic shared by two Pipeline pages lives in `src/pipeline/models` as a registry-backed model service consumed by page controllers. Feature-local models remain owned by their page. This registration requirement does not require a redundant facade when the model itself exposes the capability.
Reason: Pipeline pages share model capabilities through the app registry.

## ADD: Pipeline page service identities

Extends: code-conventions.md#JavaScript And Module Shape
Scope: folder:src/pipeline/
Rule: A page controller service uses `<page-id>-controller` and its page view service uses `<page-id>-view`. The page identity supplies the namespace; implementation filenames continue to follow the canonical naming rules.
Reason: Pipeline page registration and view lookup use paired service identities.

## REPLACE: Pipeline top tabs

Replaces: app-shells.md#Top Tabs
Scope: folder:src/pipeline/
Rule: MUI Tabs are required only if the app selects MUI. The current non-MUI Pipeline shell may use its own semantic, keyboard-operable tab controls. Keep the application header sticky and tab navigation usable when it overflows; on narrow screens place the tabs on a full-width second header row without changing semantic ownership. Render one active page in main; pages own their headings and internal scrolling.
Reason: Pipeline has its own shared control system and has not selected MUI.

## REPLACE: Pipeline shell accessibility mechanisms

Replaces: app-shells.md#Responsive And Accessibility Rules
Scope: folder:src/pipeline/
Rule: Preserve navigation/page semantics across breakpoints and change arrangement in CSS. Keep menu controls, tabs, and drawer items keyboard-operable through the selected control system; use MUI mechanisms only when MUI is selected. Give navigation a useful distinguishing label when needed. Restore focus sensibly when a temporary drawer closes. Keep active selection visible and programmatically exposed. If desktop collapse exists, keep its control available in both states and expose expanded state/action when accessibility support is active; collapsed controls leave keyboard and assistive-technology traversal without changing the selected page. Desktop collapse and mobile overlay state remain independent across breakpoints. Pages do not calculate around shell chrome dimensions.
Reason: Preserve every applicable shell obligation while making toolkit-specific mechanisms conditional.
