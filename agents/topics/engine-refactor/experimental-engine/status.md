## Experimental Engine Status

Last updated: 2026-04-21

This note tracks the current status of the UI-less Mahjongg engine experiment in
[engines/mah-jong-experimental](/c:/dev/poly-gc-react/engines/mah-jong-experimental).

This note is a progress snapshot, not the final architecture spec. For the
current structure, prefer the experimental-engine README and the generator
build plan.

Related roadmap:

- [Generator Build Plan](/c:/dev/poly-gc-react/agents/topics/engine-refactor/experimental-engine/generator-build-plan.md)
- Historical only: [Archived Generator Build Plan A](/c:/dev/poly-gc-react/agents/topics/engine-refactor/experimental-engine/generator-build-plan-a-archived.md)

## Current State

The experiment now has a working, test-backed baseline for the core layers:

- `Grid`
  - sparse 3D occupancy with point/box operations
- `GameState`
  - the only layer that owns direct access to `grid` and `board`
- `GeneratorState`
  - generator-side extension of `GameState` for shared settings and generator
    collaborators, including prepared pairs and active suspended records
- `GameRules`
  - stateless Mahjongg rule interpretation over `GameState`, including guarded
    null-state behavior
- `StateGraphAnalyzer`
  - hypothetical copied-state analysis with chainable removals and guarded
    short-horizon solved-state behavior
- `Tiles`
  - structural tile orchestration over lower-level candidate ranking
- `TilePicker`
  - weighted candidate ranking and selection helper for `Tiles`
- `Faces`
  - face initialization and ranked face-pair assignment orchestration over
    domain-owned inventory, ranking, and avoidance helpers
- `FaceInventory`
  - face-set inventory, selected-group face-pair selection, and assignment-history
    helper for `Faces`
- `FaceRanking`
  - face-group ranking and difficulty-windowed group selection for `Faces`
- `FaceAvoidance`
  - shared generation-run soft-penalty store owned by `Faces`
- `ranked-window.js`
  - shared difficulty-window helper used by tile and face selection
- `GeneratedPair`
  - normal generated tile-pair record for deferred face assignment metadata
- `GameGenerator`
  - simplified solved-by-construction generator with deterministic baseline flow
- `GameEngine`
  - initial runtime state-machine shell

The non-UI Jasmine lane is also in place:

- `npm run test:engines`

As of this update, the experimental lane passes:

- `218 specs, 0 failures`

## Completed So Far

- moved the experimental engine work out of the feature UI tree and into the
  repo-root `engines` workspace
- set up a lightweight Jasmine test lane for UI-less engine work
- established glossary terms for:
  - `layout`
  - `board`
  - `play state`
  - `tileKey`
  - `face`
  - `difficulty settings`
- shaped and implemented first-pass class interfaces for:
  - `Grid`
  - `GameState`
  - `GameRules`
  - `GameEngine`
  - `GameGenerator`
- extracted generation support classes:
  - `FaceInventory`
  - `TilePicker`
  - `StateGraphAnalyzer`
- introduced `Tiles` as the structural tile-selection orchestrator above
  `TilePicker`
- introduced `Faces` as the face initialization and assignment orchestrator
  above `FaceInventory`
- made `Faces` own the shared `FaceAvoidance` instance and pass it into
  `FaceRanking`
- made `Faces` own `FaceInventory` and register it on `GeneratorState`
- hid raw `grid` access behind `GameState`
- introduced `GeneratorState` as the shared generator-side state hub
- made `GeneratorState` the source of truth for resolved generation behavior
- removed one-call difficulty/behavior overrides from core face and tile
  generation APIs
- moved prepared tile-pair records into `GeneratorState` because they are
  generation-only metadata
- moved active suspended records into `GeneratorState` because they are
  generation-only metadata
- moved tile-picker ranking settings into explicit `GeneratorState` accessors
- made generator-state setup methods fluent and side-effect free
- tightened `GameRules` edge-case behavior for missing state and unknown tiles
- tightened `StateGraphAnalyzer` short-horizon probing so cleared boards are
  not treated as collapsed states
- named the main analyzer API shapes in `types.d.ts`, including stack-balance
  summaries and short-horizon probe results
- consolidated experimental ambient declarations into `types.d.ts`
- cleaned up overlapping type names after consolidation, including runtime
  state, face-pair, face-set, tile-pair, and pending-removed-tile terminology
- clarified that `StateGraphAnalyzer` depends only on the `GameState` surface,
  not generator-specific state
- introduced `GeneratedPair` as the normal tile-pair generation record alongside
  `TileSuspension`
- extracted shared ranked-window selection helpers into `ranked-window.js`
- shifted runtime code toward `tileKey` terminology for board-local tile
  handles
- implemented a first-pass deterministic generator with:
  - simple tile-pair removal
  - ranked face assignment
  - final-state restoration for play
- implemented Stage 1 soft linking:
  - `SoftLinks` owns generation soft-link records through `GeneratorState`
  - `Tiles` records `open-tiles` / `after-removal` links automatically when a
    tile pair is selected
  - `GeneratedPair` no longer carries structural soft-link payloads
  - `Faces` no longer discovers structural face-avoidance targets
- implemented Stage 2 face-avoidance consumption:
  - `Faces.applyFaceAvoidance()` queries `GeneratorState.softLinks`
  - assigned face groups add soft pressure to linked open tiles through
    `FaceAvoidance`
- added neutral full-face-set selection:
  - `FaceInventory.canSelectFullFaceSet()`
  - `FaceInventory.selectFullFaceSet()`
  - `Faces.selectFullFaceSet()`
- added reason-agnostic unavailable-tile selection state:
  - `GeneratorState.unavailableTiles`
  - `Tiles.markTileUnavailable(tileKey)`
  - `Tiles.markTilesUnavailable(tileKeys)`
  - `Tiles.markTileAvailable(tileKey)`
  - `Tiles.clearUnavailableTiles()`
  - `Tiles.isTileUnavailable(tileKey)`
  - `Tiles.getUnavailableTiles()`
  - `TilePicker.rankOpenTiles()` and selection now exclude unavailable tiles

## Tile Picker Progress

`TilePicker.rankOpenTiles()` now has the main ranking buckets from the live
picker, although not full live parity yet.

Implemented buckets:

- z-index / elevation factor
- spatial relationship factor
  - horizontal intersections
  - depth intersections
- open-pressure factor
- stack-balance factor
- short-horizon factor

Implemented support for these buckets:

- ranking settings come from `GeneratorState`, combining generator defaults and
  difficulty-derived settings without per-call behavior overrides
- shared difficulty-window behavior through `ranked-window.js`
- hypothetical-state analysis through `StateGraphAnalyzer`
- deterministic short-horizon probe behavior

Still not at live parity:

- stack-safety rejection / hard filtering
- full ranking metadata parity such as `freedRank`
- full live naming parity for all pressure fields
- full live spatial mask behavior
- picker telemetry/stats recording

## Generator Progress

The current generator is intentionally simplified.

Implemented:

- `generate(layout, boardNbr, { difficulty, settingsOverrides? })`
- resolved difficulty settings
- `GeneratorState` construction and setup
- structural tile orchestration through `Tiles`
- structural tile-selection initialization through `initializeTiles()`
- face orchestration through `Faces`
- face initialization stage through `initializeFaces()`
- full-board occupancy setup
- prepared tile-pairs generation stage through `preparePairs()`
- tile-pair selection through `pickGeneratedPair()` using `Tiles`
- one-step pair preparation through `preparePair()`, which gives
  `Suspensions.step()` the first chance to provide a pair before normal tile
  selection
- selected generated tile-pair commit through `commitGeneratedPair()`
- normal tile-pair recording through `GeneratedPair`
- structural soft-link recording through `Tiles` before the selected pair is
  removed from the working board
- face-pair assignment through `assignFacesToPair()` using `Faces`
- ranked prepared tile-pairs face assignment through `assignFacesToPreparedPairs()` using
  `Faces`
- deterministic output for the same seed/layout/difficulty

Not yet implemented:

- suspension flows
- weighted normal/suspension/release branching
- compatibility wrapper back into the live engine event model

## Domain And Policy Status

The primary generator domains are `Tiles` and `Faces`. They should not reach
laterally into each other.

`Suspensions` is different: it is a cross-domain generation-policy seam above
those primary domains. It may coordinate public `Tiles` and `Faces` APIs because
delayed matching needs both structural tile selection and face reservation.

For this tight generator cluster, helper classes split one complex interface
into separately testable parts. Options-object dependency injection is
acceptable here because the division is structural rather than conceptual; it
should not be generalized into app-wide service/plugin semantics.

Testing guidance for this cluster: method parameters should represent real
runtime inputs, not testing controls. Except for passing mocks through
construction seams, prefer stubbing `GeneratorState` or the relevant
collaborator over adding extra method parameters solely to assist tests. If a
test needs to steer an internal decision, create that condition through the same
state or collaborator the production code reads.

### Tiles

Current state:

- most functionally complete generator domain
- active domain orchestrator is `Tiles`
- lower-level candidate ranking and weighted selection live in `TilePicker`
- `GameGenerator.initializeTiles()` creates `Tiles`
- `GameGenerator.preparePairs()` uses `preparePair()` to run one generation
  step, then `commitGeneratedPair()` to commit the selected pair
- `GameGenerator` no longer reaches directly into `TilePicker`
- `TilePicker` ranks tile candidates and selects from a difficulty-shaped
  window
- copied-state questions are handled by `StateGraphAnalyzer`

Implemented:

- z-index / elevation scoring
- spatial relationship scoring
- open-pressure scoring
- stack-balance scoring metadata
- short-horizon pressure scoring
- candidate / selected / committed terminology
- prepared `GeneratorState.preparedPairs` collection
- `Tiles.selectGeneratedPair()` as the selected tile-pair boundary
- `Tiles.selectTile()`, `rankCandidates()`, and `selectWeightedTile()` as
  domain-facing wrappers over picker behavior
- `Tiles.getOpenSoftLinkTiles()` for graph-derived open-tile link snapshots
- `Tiles.recordSoftLinks()` for recording open tiles after hypothetical pair
  removal
- reason-agnostic unavailable-tile API for suspensions and other future policy
  layers to remove tiles from selection without explaining why

Still left:

- add stack-safety hard filtering or rejection
- decide final ranked-record shape and live parity level
- add picker telemetry if we preserve live stats
- compare old and new tile-selection behavior under fixed inputs

### Faces

Current state:

- active domain orchestrator is `Faces`
- `Faces` owns `FaceInventory`, shared `FaceAvoidance`, and `FaceRanking`
- lower-level face-set storage, selected-group face-pair selection, and assignment
  history live in `FaceInventory`
- ranked face-group ordering and difficulty-window selection live in
  `FaceRanking` plus `ranked-window.js`
- `GameGenerator.initializeFaces()` creates `Faces`
- `GameGenerator.assignFacesToPair()` delegates tile-pair-level assignment to
  `Faces`
- `GameGenerator.assignFacesToPreparedPairs()` assigns faces across
  `GeneratorState.preparedPairs`

Implemented:

- `FaceInventory` can initialize face sets containing matching face pairs
- `FaceInventory.drawPair()` can provide a matching face pair
- `FaceInventory.canSelectFromGroup()` can check whether ranked selection can
  select from a specific face group
- `FaceInventory.selectPairFromGroup()` can select and remove a concrete face pair
  from a selected face group
- `FaceInventory.canSelectFullFaceSet()` can check whether a selected group has
  all four faces available
- `FaceInventory.selectFullFaceSet()` can select and remove all four faces from
  a selected group
- `Faces.selectFacesForPair()` selects one face pair from inventory
- `Faces.selectFacesForPair()` uses ranked face-group selection with no
  fallback to unranked inventory draw
- `Faces.selectFullFaceSet()` uses ranked face-group selection with no
  suspension-specific vocabulary
- `FaceRanking.getRankedFaceGroupWindow()` exposes difficulty-window details
- `FaceRanking.selectRankedFaceGroup()` selects one ranked face group through
  the shared `ranked-window.js` helper
- `Faces.assignFacesToPair()` assigns one prepared tile pair and updates
  `GameState`
- `Faces.assignFacesToPair()` records assigned face history and applies
  face-avoidance pressure from recorded soft links
- `Faces.assignFacesToPreparedPairs()` assigns all prepared tile pairs
- `Faces.preparePairForFaceAssignment()` prepares face-domain metadata before
  assignment
- preferred face groups are generated for prepared pairs when face avoidance is
  enabled, using the lowest current avoidance penalty as a soft ranking bias
- structural soft links are generated for prepared pairs by `Tiles`, using
  copied-state analysis to record "open after removal, excluding source tiles"
- after face assignment, those prepared records are treated as assigned pairs:
  their concrete faces have been selected, but later generation stages may still
  be inserted before the final generated state
- committed `GeneratedPair` records can receive assigned face metadata
- `GameState` receives the concrete assigned faces

- add face-avoidance draw/selection telemetry if we preserve live stats
- support release-time face assignment from future suspension flows
- decide how much live weighted face-set behavior to preserve
- decide whether assignment history should stay in `FaceInventory` or move to a
  dedicated helper during the future folder restructure

#### FaceRanking Stabilization Checklist

`FaceRanking` is now stabilized and wired into `Faces.selectFacesForPair()`.
Preferred-group generation is wired into `Faces.preparePairForFaceAssignment()`.
Structural soft-link recording is owned by `Tiles`, and `Faces` now consumes
those links through `applyFaceAvoidance(pair)`. Full-face-set selection is
available through `Faces.selectFullFaceSet()`. The remaining work is suspension
policy, release-time assignment, and telemetry.

1. Completed: make `FaceRanking` construct cleanly.
   - Verify it stores `GeneratorState`.
   - Verify it reads inventory from `state.faceInventory`.
2. Completed: fix and test `getAdjustedDistanceFactor()`.
   - Unpreferred groups should keep their base value.
   - Preferred groups should apply `faceAssignmentRules.preferredMultiplier`.
   - Custom multipliers should be honored.
3. Completed: fix and test `getAvoidancePenalty()`.
   - Use `faceSet.id` or `faceGroup` directly instead of a missing helper.
   - Sum penalties across all relevant tiles.
   - Decide and test missing-face-group behavior.
4. Completed: fix and test `getFaceGroupDuplicateCount()`.
   - Use `GeneratorState.difficulty()` as the real difficulty source.
   - Return `1` when duplicate scaling is off.
   - Return `1` when difficulty does not create easy-side pressure.
   - Return extra duplicates on easy settings when reuse history exists.
5. Completed: make `rankFaceGroups()` minimally correct.
   - Use `this.state`.
   - Handle missing prepared-pair input.
   - Skip groups without enough remaining faces.
   - Return deterministic `FaceGroup[]` output.
6. Completed: reintroduce weighting behavior one concern at a time.
   - Preferred group bias.
   - Assigned-history distance factor.
   - Easy duplicate expansion.
   - Avoidance penalty.
   - Note: the live-shaped avoidance branch currently uses `1 / penalty` for
     unused face groups. This means the current difficulty settings were tuned
     against inverse penalty ranking. Revisit deliberately later before changing
     the formula.
7. Completed: update status after stabilization.
   - Mark `FaceRanking` as test-backed.
   - Wire it into active `Faces` selection through `ranked-window.js` and
     `FaceInventory.selectPairFromGroup()`.

### Suspensions

Current state:

- cross-domain generation-policy seam now exists as `Suspensions`
- `Suspensions` is wired by `GameGenerator` with an options-object dependency
  shape: `{ state, tiles, faces }`
- `TileSuspension` exists as the suspension record
- active generation currently commits only normal tile pairs into
  `GeneratorState.preparedPairs`

Implemented:

- `TileSuspension` record shape
- `Suspensions` orchestrator shell
- `GeneratorState` has a typed `suspended` collection ready for future flow
- docs define suspensions as delayed tile-pair commitment rather than a separate
  final structure
- `Faces` exposes `selectFullFaceSet()` for future suspension policy to compose
- `GameGenerator.initializeSuspensions()` creates `Suspensions` after `Tiles`
  and `Faces`
- shell methods exist for `canCreateSuspension()`, `createSuspension()`, and
  `releaseSuspension()`
- `GameGenerator.preparePair()` now gives `Suspensions.step()` the first chance
  to provide a pair, then falls back to normal `Tiles` selection
- `Suspensions.step()` exists as a no-op policy seam that returns `false` until
  release or creation eligibility is implemented

Planned generator integration contract:

- `GameGenerator` should not know whether a pair came from normal tile
  selection, suspension creation, or suspension release
- `GameGenerator.preparePair()` should give `Suspensions` one chance to act for
  the current generation step
- `Suspensions.step()` should return either:
  - `false` when suspension policy has nothing to do
  - the suspended pair created by suspension policy
  - the resolved pair released from an active suspension
- `GameGenerator.commitGeneratedPair(pair)` should remain generic and should
  not branch on suspension-specific details
- if suspension creation needs a third tile to be held, `Suspensions` tells
  `Tiles` to mark that tile unavailable; the generator does not know or care
  why the tile is unavailable
- future generation policies could use the same step-participant concept, but
  the current implementation should stay simple because suspensions are the
  only participant

Proposed generator shape:

```js
preparePair() {
	let pair = this.suspensions.step();

	if (!pair) {
		pair = this.tiles.selectGeneratedPair();
	}

	if (!pair) {
		throw new Error('Generation step did not return a pair');
	}

	this.commitGeneratedPair(pair);
}
```

Supporting `Suspensions` contract:

```js
step() {
	if (this.canReleaseSuspension()) {
		return this.releaseSuspension();
	}

	if (this.canCreateSuspension()) {
		return this.createSuspension();
	}

	return false;
}
```

Future direction:

- if generation grows multiple step participants, introduce a small
  `GenerationStep` object for one loop iteration
- participants could record analytics, mutate generator state, claim the one
  pair to commit, or do nothing
- the step object would make the one-pair-per-generation-step rule explicit
  without storing tick-local control flow in durable `GeneratorState`
- this is intentionally deferred; the current code only needs
  `Suspensions.step()` returning `false` or a `GeneratedPair`

Planned staged work:

1. Completed: add a reason-agnostic unavailable-tile API to `Tiles`.
   - Store unavailable tile keys in `GeneratorState`.
   - Add `markTileUnavailable(tileKey)`.
   - Add `markTilesUnavailable(tileKeys)`.
   - Add `markTileAvailable(tileKey)`.
   - Add `clearUnavailableTiles()`.
   - Add `isTileUnavailable(tileKey)`.
   - Add `getUnavailableTiles()`.
   - Make tile ranking and selection avoid unavailable tiles.
2. Completed: add the generic `GameGenerator.preparePair()` seam.
   - Ask `Suspensions.step()`.
   - Use the returned pair when present.
   - Otherwise use `Tiles.selectGeneratedPair()`.
   - Throw if no pair is returned.
   - Keep `commitGeneratedPair(pair)` generic.
3. Completed: update `Suspensions` to the step contract.
   - Add `step()`.
   - Add `canReleaseSuspension()`.
   - Keep `canCreateSuspension()`.
   - Route `step()` through release first, then create, then `false`.
   - Keep creation/release behavior shell-only until eligibility exists.
4. Implement the first suspension creation path.
   - Select a tile to hold.
   - Tell `Tiles` to mark it unavailable.
   - Add a `TileSuspension` record to `GeneratorState.suspended`.
   - Return a normal `GeneratedPair` for the generator to commit.
5. Implement suspension release.
   - Pick a releasable suspension.
   - Make the held tile available through `Tiles` or use a public `Tiles`
     method that can select a pair including it.
   - Return the resolved `GeneratedPair`.
   - Remove the resolved suspension record.
6. Add face-set reservation only after structural creation/release works.
   - Use `Faces.selectFullFaceSet()` as the public face-domain seam.
   - If reservation needs tile linkage, use `SoftLinks.createLink('grouped',
     { role: 'reservation', ... })`.
7. Add live parity and safety checks.
   - forced-release behavior
   - max suspended count
   - open-count thresholds
   - placement-count thresholds
   - fixed-input comparison against the live generator

Still left:

- compose public `Tiles` and `Faces` APIs without reaching into lower-level
  helpers such as `TilePicker`, `FaceInventory`, or `FaceRanking`
- implement suspension eligibility
- implement suspension creation
- implement release selection
- implement forced-release safety
- integrate suspension face-group reservation through `Faces.selectFullFaceSet()`
- integrate suspension structural selection with `Tiles`
- define how suspended records become prepared tile pairs

## State Analyzer Progress

`StateGraphAnalyzer` currently answers copied-state questions such as:

- open tile keys after hypothetical removals
- playable pairs after hypothetical removals
- lost-state detection after hypothetical removals
- tiles freed by hypothetical removals
- stack-balance summaries after hypothetical removals
- short-horizon collapse probing

This is the current home for graph-style and hypothetical questions that should
not live in `GameRules` or `TilePicker`.

## Open Questions

- how closely the experimental `TilePicker` should track live ranking record
  naming versus using clearer experimental names
- whether `ranked-window.js` should move into a future `tools` or shared helper
  folder with other pure cross-domain helpers
- whether stack-safety rejection should be implemented before deeper picker
  tuning
- during a future folder restructure, whether `StateGraphAnalyzer` belongs in a
  shared `tools` or `analysis` area instead of under generation
- whether future stats and analytics should live as pure engine tools, with
  app-facing common services wrapping them when persistence, export, UI, or
  cross-feature access is needed
- whether the finished experimental generator produces the same boards,
  assigned faces, solution paths, and telemetry as the live generator for the
  same inputs
- if old/new parity is incomplete, whether the old generator must remain
  available for analysis of existing generated-game data
- when the experimental generator is mature enough to start informing the live
  refactor directly

## Near-Term Next Steps

- keep using `candidate`, `selected`, and `committed` consistently while the
  generator flow is split into clearer seams
- continue building bottom-up inside the active `Tiles`, `Faces`, and
  `Suspensions` seams without filling in policy too early
- next likely low-risk work is implementing the first suspension eligibility
  question inside `Suspensions`
- continue tightening `TilePicker` parity where it adds real value without
  re-monolithizing the experiment
- keep `Suspensions` shell-like until `Tiles` and `Faces` expose enough public
  behavior for delayed tile-pair commitment to plug into
- decide how much of the old difficulty telemetry should move into the
  experimental lane later, after the generator-side structure settles
