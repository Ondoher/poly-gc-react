# Live To Experimental Mapping

This document maps the current live Mahjongg engine code in:

- `src/gc/features/mj/src/engine/Engine.js`
- `src/gc/features/mj/src/engine/GameGenerator.js`

against the experimental split in:

- `engines/mah-jong-experimental/GameGenerator.js`
- `engines/mah-jong-experimental/GameEngine.js`
- `engines/mah-jong-experimental/GameState.js`
- `engines/mah-jong-experimental/GeneratorState.js`
- `engines/mah-jong-experimental/GameRules.js`
- `engines/mah-jong-experimental/TilePicker.js`
- `engines/mah-jong-experimental/StateGraphAnalyzer.js`
- `engines/mah-jong-experimental/FaceInventory.js`
- `engines/mah-jong-experimental/TileSuspension.js`
- `engines/mah-jong-experimental/Grid.js`

## Status Legend

- `Completed`
  - the live responsibility has a clear experimental home and a working implementation
- `Incomplete`
  - the experimental code has a partial implementation, split implementation, or an obviously unfinished seam
- `Missing`
  - there is no real experimental equivalent yet

## Important Current Caveats

- `TilePicker` reads ranking settings from explicit `GeneratorState`
  accessors, with `GeneratorState` passed through the active `Tiles`
  orchestrator.
- `GeneratorState` is now the intended `GameState` extension for
  generator-specific shared state and is used by `GameGenerator`, `Tiles`, and
  `TilePicker`.
- generator-side collaborators are trending toward accessing `GameState`
  through `GeneratorState` rather than depending on both directly
- active face assignment now goes through the `Faces` orchestrator, which owns
  `FaceInventory`, shared `FaceAvoidance`, and `FaceRanking`
- `ranked-window.js` is now the shared difficulty-window helper used by tile
  and face selection.
- the topic docs now treat `Tiles` and `Faces` as primary generator domains,
  with `Suspensions` as a cross-domain policy seam above them
- The live engine combines runtime, generation, face assignment, telemetry, and controller/event concerns. The experimental code intentionally splits those across several classes, so some live methods map to more than one experimental location.

## Class Taxonomy

### Live Classes

| Class | Current role |
| --- | --- |
| `Engine` | The combined live Mahjongg engine. It owns runtime board state, occupancy tracking, open/playable calculations, generation helpers, face assignment helpers, undo/redo, stats, and controller-facing behavior. |
| `GameGenerator` | The extracted live generation-policy layer. It coordinates backward board construction, suspension creation/release, pending normal pairs, and deferred face assignment while still leaning on `Engine` for low-level helpers and state. |

### Experimental Core Runtime And State Classes

| Class | Current role |
| --- | --- |
| `Grid` | A generic sparse 3D occupancy substrate. It knows only about occupied cells and box intersection, not Mahjongg rules or tiles. |
| `GameState` | The Mahjongg-specific state layer on top of `Grid`. It owns `board`, `layout`, `solution`, `placedTiles`, tile positions, faces, adjacency queries, and cloning. |
| `GameRules` | The stateless Mahjongg rules layer. It answers whether tiles are open, whether faces match, whether a pair is playable, and whether a game is won or lost. |
| `GameEngine` | The experimental runtime shell. It manages runtime state snapshots, derived state, undo/redo stacks, selection, and tile-play mutation over `GameState` through `GameRules`. |

### Experimental Generation And Difficulty Classes

| Class | Current role |
| --- | --- |
| `GameGenerator` | The active experimental board generator. It resolves settings, creates a fresh `GeneratorState`, prepares generated tile pairs backward, assigns face pairs, and restores the final board for runtime play. |
| `GeneratorState` | A `GameState` extension intended to hold generator-specific shared state such as suspension rules, difficulty state, picker rules, face-assignment rules, face-avoidance rules, prepared pairs, active suspended records, and explicit ranking-setting accessors shared across generation classes. |
| `Tiles` | Active top-level orchestration layer for structural tile-choice behavior during generation. It sits above `TilePicker` and exposes selected tile-pair behavior to `GameGenerator`. |
| `Faces` | Active top-level orchestration layer for face-selection and face-assignment behavior during generation. It owns `FaceInventory`, shared `FaceAvoidance`, and `FaceRanking`. |
| `Suspensions` | Active infrastructure seam for delayed-match creation and release behavior. It coordinates public `Tiles` and `Faces` APIs and works with `TileSuspension` records, but the actual eligibility/create/release policy is still incomplete. |
| `TilePicker` | The active experimental tile-ranking and selection class. It ranks open candidates using z-order, spatial relationships, open-pressure, stack-balance, and short-horizon pressure, then selects one from a difficulty-shaped window. |
| `StateGraphAnalyzer` | The copied-state analysis helper used by generation and picker code. It answers hypothetical questions such as tiles freed by removals, short-horizon collapse, stack balance, open tiles after removals, and playable pairs after removals. |
| `difficulty-settings.js` | The experimental difficulty configuration module. It defines level presets and resolves a final settings bundle from difficulty plus optional overrides. |
| `TileSuspension` | The suspended-tile domain record used to hold one delayed-release tile plus its reserved face-group and release metadata. |

### Experimental Face-Assignment And Transitional Classes

| Class | Current role |
| --- | --- |
| `FaceInventory` | Face-domain-owned inventory for face sets, suit lookup, selected-group face-pair selection, and assigned-face history. |
| `FaceAvoidance` | Shared generation-run soft-penalty store owned by `Faces`. It can be marked and queried, though live target discovery and telemetry are not complete. |
| `FaceRanking` | Active helper for face-group ranking, reuse spacing, preferred-group bias, easy-side reuse duplication, and ranked-window group selection. |
| `ranked-window.js` | Shared pure helper for difficulty-shaped ranked-window slicing and random selection. It is used by `TilePicker` and `FaceRanking`. |

### Taxonomy Summary

- The live side still centers on one large `Engine` plus a partially extracted `GameGenerator`.
- The experimental side has already separated:
  - occupancy substrate
  - Mahjongg state
  - rules
  - runtime mutation
  - intended generator domains and cross-domain generation policy
  - tile selection
  - copied-state analysis
  - difficulty configuration
- The least-settled part of the experimental taxonomy is the generator-support band beneath `GameGenerator`: `Tiles` and `Faces` have clearer primary-domain homes, while `Suspensions` composes those domains as cross-domain policy rather than sitting beside them as an equal lower-level domain.

## Methods

### Live `Engine` Method Mapping

#### Completed

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `addPos` | Completed | `GameState.placeTile()` | Occupancy mutation is now a `GameState` responsibility over `Grid`. |
| `subtractPos` | Completed | `GameState.removeTile()` | Same split as `addPos`. |
| `isTileOpen` | Completed | `GameRules.isTileOpen()` | Live rule logic now belongs in the rules layer. |
| `configureBoard` | Completed | `GameState.configureBoard()` | Board setup/reset is clearly moved into `GameState`. |
| `countHorizontalIntersections` | Completed | `GameState.countHorizontalIntersections()` | This responsibility is clearly in `GameState`. |
| `isUsedInSpaces` | Completed | `Grid.has()` via `GameState.isOccupied()` | The responsibility exists lower in the stack now. |
| `countTilesFreedByRemoval` | Completed | `StateGraphAnalyzer.countTilesFreedByRemoving()` | This is one of the clearest successful extractions. |
| `countPlacedTiles` | Completed | `GameState.getPlacedTileCount()` | Clear home in `GameState`. |
| `removeTileFromProbeState` | Completed | `StateGraphAnalyzer.createStateCopyWithRemovedTiles()` | Same responsibility, cleaner home. |
| `pickShortHorizonProbePair` | Completed | `StateGraphAnalyzer.pickShortHorizonProbePair()` | Directly extracted. |
| `runShortHorizonProbe` | Completed | `StateGraphAnalyzer.runShortHorizonProbe()` | Directly extracted. |
| `getStackKey` | Completed | `GameState.getStackKey()` | Clear home in `GameState`. |
| `getStackBalanceAfterRemoval` | Completed | `StateGraphAnalyzer.getStackBalanceAfterRemoving()` | Directly extracted. |
| `getShortHorizonPressure` | Completed | `StateGraphAnalyzer.getShortHorizonPressure()` | Extracted into the analyzer. |
| `pickWeightedTileFromScores` | Completed | `TilePicker.selectRankedTile()`; alias: `TilePicker.pickWeightedTileFromScores()` | Clear extracted home under rank/select terminology. |
| `getRankedWindow` | Completed | `ranked-window.js`, wrapper: `TilePicker.getDifficultyWindowDetails()` | Windowing is now shared by tile and face selection. |
| `recordAssignedFacePair` | Completed | `Faces.recordAssignedFacePair()`, `FaceInventory.recordAssignedPair()` | Active face assignment records history after assigning a face pair to a tile pair. |
| `getAssignedFaceGroupIndexes` | Completed | `FaceInventory.getAssignedFaceGroupIndexes()` | Present and backed by active assignment history. |
| `getAvoidancePenalty` | Completed | `FaceAvoidance.getPenalty()` | Single tile/group penalty lookup is active through the shared `FaceAvoidance` instance. |
| `addFaceAvoidance` | Completed | `FaceAvoidance.addFaceAvoidance()`, orchestrated by `Faces.applyFaceAvoidance()` | The penalty store exists, and `Faces` consumes matching `GeneratorState.softLinks` records after face assignment. |
| `getFaceGroupPenalty` | Completed | `FaceRanking.getAvoidancePenalty()` | Sums avoidance penalties across the target tiles for one face group. |
| `canDrawFromFaceGroup` | Completed | `FaceInventory.canSelectFromGroup()` | Same selected-group availability check under `select` terminology. |
| `getFaceGroupDuplicateCount` | Completed | `FaceRanking.getFaceGroupDuplicateCount()` | Test-backed and uses `GeneratorState.difficulty()`. |
| `getAdjustedDistanceFactor` | Completed | `FaceRanking.getAdjustedDistanceFactor()` | Test-backed preferred multiplier behavior. |
| `rankFaceGroups` | Completed | `FaceRanking.rankFaceGroups()` | Active and used by `Faces.selectFacesForPair()`. |
| `getRankedFaceGroupWindow` | Completed | `FaceRanking.getRankedFaceGroupWindow()` | Uses shared `ranked-window.js`. |
| `pickRankedFaceGroup` | Completed | `FaceRanking.selectRankedFaceGroup()` | Same responsibility under `select` terminology. |
| `drawFacePairFromGroup` | Completed | `FaceInventory.selectPairFromGroup()`, orchestrated by `Faces.selectFacesForPair()` | Same selected-group concrete face-pair selection under `select` terminology. |
| `getFaceAvoidanceNeighborhood` | Completed | `Tiles.getOpenSoftLinkTiles()` | The structural open-tile discovery moved to soft-link terminology and the `Tiles` domain. |
| `getFaceAvoidanceTargetsAfterRemoval` | Completed | `Tiles.getOpenSoftLinkTiles({ removeTiles, ignoreTiles })`, stored through `SoftLinks` | Stage 1 records `open-tiles` / `after-removal` links after hypothetical removal. Face avoidance now consumes those links. |
| `isPlayablePair` | Completed | `GameRules.isPlayablePair()` | Clear extracted home. |
| `arePlayablePairs` | Completed | `GameRules.hasPlayablePairs()` | Same responsibility in clearer form. |
| `calcPlayablePairs` | Completed | `GameRules.getPlayablePairs()` | Clear extracted home. |
| `canRedo` | Completed | `GameEngine.canRedo()` | Runtime shell covers this. |
| `canUndo` | Completed | `GameEngine.canUndo()` | Runtime shell covers this. |
| `doFacesMatch` | Completed | `GameRules.doFacesMatch()` | Clear extracted home. |
| `getSolution` | Completed | `GameState.solution`, `GameGenerator.solution` | The solution payload exists in experimental generation and state. |
| `makeSuits` | Completed | `FaceInventory.makeSuits()` | Suit lookup setup is owned by the face inventory layer. |
| `getSuit` | Completed | `FaceInventory.getSuit()` | Clear face-inventory lookup. |
| `getSuitFromFaceGroup` | Completed | `FaceInventory.getSuitFromFaceGroup()` | Clear face-inventory lookup. |
| `setupSuspensionRules` | Completed | `GeneratorState.setupSuspensionRules()` | The generator-side state extension owns this rule bundle. Active suspension behavior is still separate future work. |
| `setupDifficulty` | Completed | `GeneratorState.setupDifficulty()`, `GeneratorState.setupSettings()`, `difficulty-settings.js`, `GameGenerator.resolveSettings()` | Settings are resolved by `GameGenerator`, then copied into shared generator state. |
| `setupTilePickerRules` | Completed | `GeneratorState.setupTilePickerRules()`, `GeneratorState.setupSettings()` | Tile picker rules are copied into `GeneratorState` and consumed through explicit accessors. |
| `setupFaceAvoidanceRules` | Completed | `GeneratorState.setupFaceAvoidanceRules()`, `Faces.faceAvoidance` | Rule storage, the penalty store, and pressure application from recorded soft links are active. Telemetry remains optional future work. |
| `setupFaceAssignmentRules` | Completed | `GeneratorState.setupFaceAssignmentRules()`, `FaceRanking`, `Faces` | Preferred multiplier, duplicate tuning, and preferred-group generation are active. Suspension-related parity remains separate future work. |

#### Incomplete

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `constructor` | Incomplete | `GameGenerator`, `GameEngine`, `GameState`, `GameRules`, `FaceInventory`, `TilePicker`, `Grid` | The big combined constructor has been split, but not all live state has a finished experimental replacement yet. |
| `calcOpenTiles` | Incomplete | `GameRules.getOpenTiles()`, `GameEngine.getDerivedState()` | Open tiles are derived, not cached on state. Suspended-tile skipping from live generation is not mirrored yet. |
| `countVerticalIntersections` | Incomplete | `GameState.countDepthIntersections()` | Concept is present, but the experimental name and exact semantics are not yet parity with live `vertical`. |
| `buildUsedSpacesForPlacedTiles` | Incomplete | `GameState.clone()`, `Grid`, `StateGraphAnalyzer.withRemovedTiles()` | Responsibility exists in split form, but not as a direct helper. |
| `isTileOpenInSpaces` | Incomplete | `GameRules.isTileOpen()` plus copied-state analysis | Experimental code can answer the question through cloned state, but not via this direct helper. |
| `getOpenTilesInState` | Incomplete | `StateGraphAnalyzer.getOpenTileKeysAfterRemoving()` | Present as a copied-state operation, but not as a generic placed/used-spaces helper. |
| `wouldCreateDominantStack` | Incomplete | `StateGraphAnalyzer.getStackBalanceAfterRemoving()` | The analyzer can detect dominant stacks, but hard safety enforcement is not wired into the picker/generator yet. |
| `scoreOpenTiles` | Incomplete | `TilePicker.rankOpenTiles()`; alias: `TilePicker.scoreOpenTiles()` | Main idea is implemented under rank terminology, but live parity is not complete. |
| `getBalancePressure` | Incomplete | `TilePicker.getBalanceFactor()` | Pressure is represented, but not as a separate helper with live naming. |
| `getOpenPressure` | Incomplete | `TilePicker.getOpenPressureFactor()` | Present as part of the picker, but with different shape/naming. |
| `pickWeightedTile` | Incomplete | `TilePicker.selectWeightedTile()`; alias: `TilePicker.pickWeightedTile()` | Active experimental equivalent exists, but stack-safety and settings wiring are not fully finished. |
| `playPair` | Incomplete | `GameEngine.playTiles()` | The runtime ability exists, but live side effects and event integration do not. |
| `canPlay` | Incomplete | `GameRules.isPlayablePair()` and `GameEngine` | Experimental code can answer it, but there is no single matching public runtime helper. |
| `playTiles` | Incomplete | `GameEngine.playTiles()` | Present, but much thinner than the live engine version. |
| `undo` | Incomplete | `GameEngine.undo()` | Present, but missing live event/action integration. |
| `redo` | Incomplete | `GameEngine.redo()` | Present, but missing live event/action integration. |

#### Missing

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `setActionCollector` | Missing | Best fit: future compatibility wrapper around `GameEngine` | Experimental runtime has no controller/action collector bridge yet. |
| `recordAction` | Missing | Best fit: future compatibility wrapper around `GameEngine` | `GameEngine.apply()` is not a replacement for live action recording. |
| `createSuspensionStats` | Missing | Best fit: `GameGenerator` or future telemetry helper | No experimental suspension telemetry yet. |
| `createTilePickerStats` | Missing | Best fit: `TilePicker` or future telemetry helper | No experimental picker telemetry yet. |
| `createFaceAvoidanceStats` | Missing | Best fit: `Faces` or future face telemetry helper | No experimental face-avoidance telemetry yet. |
| `makeSequentialArray` | Missing | Best fit: small utility or `FaceInventory` helper | Experimental code should use a utility instead of re-embedding this on the main engine. |
| `drawOneOf` | Missing | Best fit: `FaceInventory` | No one-face draw helper exists; selected face-pair selection is implemented instead. |
| `getFaceSetId` | Missing | Not needed | Experimental `FaceInventory` has a contract that face sets carry `id`, so the legacy fallback helper was intentionally not recreated. |
| `getWeightedFaceGroup` | Missing | Best fit: `Faces` plus `FaceInventory` / `FaceRanking` | Not implemented on the active path. |
| `recordFaceAvoidanceDraw` | Missing | Best fit: `Faces` or future face telemetry helper | No equivalent yet. |
| `drawWeightedFacePairForTiles` | Missing | Best fit: `Faces` plus `FaceInventory` | Active experimental normal-pair selection now uses ranked face-group selection through `Faces.selectFacesForPair()`, but this exact live helper and its telemetry are not recreated. |
| `getFullFaceGroup` | Missing | Best fit: `Faces` / `FaceInventory` | Not implemented yet. |
| `generateLayout` | Missing | Best fit: `GameGenerator.createGameState()` | Experimental code configures a board from an input layout, but does not expose a live-style `generateLayout()` method. |
| `getTilePickerGrid` | Missing | Best fit: `GameState` / `Grid` | The experimental split removed the need for this helper as a main-engine method. |
| `tilePickerHorizontalKey` | Missing | Best fit: `TilePicker` if mask-based scoring returns | Current experimental picker uses `GameState` overlap/intersection helpers instead of live mask-key helpers. |
| `tilePickerVerticalKey` | Missing | Best fit: `TilePicker` if mask-based scoring returns | Same as above. |
| `numberSetsIntersect` | Missing | Best fit: `TilePicker` or `GameState` helper | No direct equivalent needed in the current experimental approach. |
| `buildHorizontalReferenceMasks` | Missing | Best fit: `TilePicker` | Experimental picker currently uses simpler intersection counting instead of full mask-building. |
| `buildVerticalReferenceMasks` | Missing | Best fit: `TilePicker` | Same as above. |
| `buildHorizontalTileMask` | Missing | Best fit: `TilePicker` | Same as above. |
| `buildVerticalTileMask` | Missing | Best fit: `TilePicker` | Same as above. |
| `buildUsedSpacesForTilePicker` | Missing | Best fit: `StateGraphAnalyzer` / `GameState` / `Grid` | Experimental copied-state analysis replaces this style of helper. |
| `recordTilePickerStats` | Missing | Best fit: `TilePicker` or future telemetry helper | No experimental equivalent yet. |
| `shuffleTileScores` | Missing | Best fit: `TilePicker` | Not implemented in the experimental picker. |
| `removePair` | Missing | Best fit: `GameEngine.playTiles()` or generator helper | No direct equivalent with this exact semantics/name. |
| `sendState` | Missing | Best fit: compatibility wrapper around `GameEngine.getDerivedState()` | No event-based runtime state emission yet. |
| `getUndoHistory` | Missing | Best fit: `GameEngine` | Experimental runtime has undo stacks but no public history API. |
| `getSuspensionStats` | Missing | Best fit: `GameGenerator` or telemetry helper | No experimental suspension stats yet. |
| `getTilePickerStats` | Missing | Best fit: `TilePicker` or telemetry helper | No experimental picker stats yet. |
| `getFaceAvoidanceStats` | Missing | Best fit: `Faces` or future face telemetry helper | No experimental face-avoidance stats yet. |
| `getHints` | Missing | Best fit: compatibility/runtime helper on top of `GameRules.getPlayablePairs()` | No experimental hint API yet. |
| `checkState` | Missing | Best fit: runtime compatibility wrapper | No direct equivalent. |

### Live `GameGenerator` Method Mapping

#### Completed

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `getFaceSetForFace` | Completed | `FaceInventory.getFaceGroup()` | Same responsibility under a clearer name. |
| `getPreferredFaceGroup` | Completed | `Faces.getPreferredFaceGroup()` | Active preferred-group selection is generated before face assignment when face avoidance is enabled. |
| `recordAssignedFacePair` | Completed | `Faces.recordAssignedFacePair()`, `FaceInventory.recordAssignedPair()` | Face assignment records history after assigning each face pair to a tile pair. |
| `getFaceAvoidanceNeighborhood` | Completed | `Tiles.getOpenSoftLinkTiles()` | The structural part exists as graph-derived open-tile link discovery. |
| `getFaceAvoidanceTargetsAfterRemoval` | Completed | `Tiles.getOpenSoftLinkTiles({ removeTiles, ignoreTiles })`, stored through `SoftLinks` | Active for Stage 1 soft-link recording before committing/removing a selected prepared pair. |
| `markFaceAvoidanceForTargets` | Completed | `Faces.applyFaceAvoidance(pair)` | Reads matching `GeneratorState.softLinks` records and writes pressure into `FaceAvoidance` after a face group is assigned. |
| `drawPendingFaces` | Completed | `Faces.selectFacesForPair()` plus `Faces.assignFacesToPair()` | Active experimental path ranks/selects a face group, selects a concrete face pair, writes prepared tile-pair metadata, and assigns board faces. |
| `fillInRemainingFaces` | Completed | `GameGenerator.assignFacesToPreparedPairs()`, `Faces.assignFacesToPreparedPairs()`; aliases: `GameGenerator.assignFacesToPairSet()`, `GameGenerator.assignDeferredFaces()`, `GameGenerator.fillInRemainingFaces()` | Experimental version exists under the clearer prepared tile-pairs stage name and now uses ranked face-group assignment. |
| `removeGeneratedPair` | Completed | `GameGenerator.commitGeneratedPair()`; alias: `GameGenerator.removeGeneratedPair()` | Same backward-generation mutation under clearer selected/commit wording. |

#### Incomplete

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `constructor` | Incomplete | `GameGenerator.constructor()` | Experimental constructor is much slimmer and intentionally no longer takes the full live engine. |
| `shuffleTiles` | Incomplete | `GameGenerator.initializeFaces()`; alias: `GameGenerator.shuffleTiles()`; lower-level: `Faces.initialize()` / `FaceInventory.initialize()` | Equivalent responsibility exists behind a clearer face-subsystem initialization seam, but the inventory implementation is still transitional. |
| `getTilePickerOptions` | Incomplete | `GameGenerator.settings`, `TilePicker`, `difficulty-settings.js` | Settings exist, but there is no direct equivalent helper. |
| `initializeTiles` | Incomplete | `GameGenerator.initializeTiles()`, `Tiles` | Current seam initializes the structural tile orchestrator, but the full live behavior is not complete. |
| `pickWeightedPair` | Incomplete | `Tiles.selectGeneratedPair()`, `TilePicker.selectTileKey()`, `TilePicker.selectWeightedTile()` | The experimental generator can select tile pairs through `Tiles`, but not with the live retry/window/stats behavior. |
| `generate` | Incomplete | `GameGenerator.generate()` | The main solved-by-construction loop exists, but live difficulty features are not all ported. |
| `placeGeneratedPair` | Incomplete | `GameGenerator.preparePair()`; alias: `GameGenerator.placeGeneratedPair()` | Experimental version now gives `Suspensions.step()` the first chance to provide a pair, then falls back to the normal pair path. Active suspension policy is still missing. |
| `placeWeightedNormalPair` | Incomplete | `GameGenerator.preparePair()`, `Tiles.selectGeneratedPair()` | Normal tile-pair placement exists in simplified form as the fallback after `Suspensions.step()` returns `false`. |
| `createGeneratedPairRecord` | Incomplete | `GeneratedPair`, `GameGenerator.pickGeneratedPair()`, `GameGenerator.commitGeneratedPair()` | Experimental generator now records normal generated tile pairs with a dedicated `GeneratedPair` class, but does not yet carry full live metadata/telemetry parity. |

#### Missing

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `markFaceAvoidanceAroundTiles` | Missing | Best fit: future `FaceAvoidance` plus `GameGenerator` | No active equivalent. |
| `hasFullFaceSet` | Completed | `FaceInventory.canSelectFullFaceSet()` | Exposed as a neutral full-face-set availability check. |
| `drawWeightedFaceSetForTiles` | Incomplete | `Faces.selectFullFaceSet()`, `FaceInventory.selectFullFaceSet()`, `FaceRanking.selectRankedFaceGroup(4, ...)` | The neutral full-face-set selection exists. Suspension-specific splitting/reservation policy is still future work. |
| `pickWeightedSuspensionTriple` | Missing | Best fit: `GameGenerator` plus `TilePicker` | No experimental suspension flow yet. |
| `pickWeightedReleasedPartner` | Missing | Best fit: `GameGenerator` plus `TilePicker` | No experimental suspension release flow yet. |
| `testRelease` | Missing | Best fit: `GameGenerator` | No suspension release path yet. |
| `mustRelease` | Missing | Best fit: `GameGenerator` | No suspension release safety logic yet. |
| `countOpenSuspensions` | Missing | Best fit: `GameGenerator` | No active suspension support. |
| `recordSuspensionSafetyStats` | Missing | Best fit: `GameGenerator` or telemetry helper | No equivalent. |
| `canSuspend` | Missing | Best fit: `Suspensions` | No active suspension support. |
| `findReleasableTile` | Missing | Best fit: `Suspensions` | No active suspension support. |
| `placeWeightedSuspensionPair` | Missing | Best fit: `Suspensions` plus `GameGenerator` | No experimental suspension creation yet. |
| `placeWeightedReleasedSuspensionPair` | Missing | Best fit: `Suspensions` plus `GameGenerator` | No experimental suspension release yet. |

## Properties

### Live `Engine` Property Mapping

| Live property | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `seasonFaceSetArray` | Completed | `GameGenerator.seasonFaceSetArray` | Directly carried over. |
| `flowerFaceSetArray` | Completed | `GameGenerator.flowerFaceSetArray` | Directly carried over. |
| `board` | Completed | `GameState.board` | Board definition is now clearly in `GameState`. |
| `layout` | Completed | `GameState.layout` | Same split as `board`. |
| `suspensionRules` | Completed | `GeneratorState.suspensionRules`, `settings.suspensionRules` | The field has a generator-state home; active suspension behavior is still future work. |
| `difficulty` | Completed | `GeneratorState._difficulty`, `settings.generationDifficulty` | `GameGenerator` resolves settings, and `GeneratorState.setupSettings()` copies the generation difficulty into shared state. |
| `tilePickerRules` | Completed | `GeneratorState.tilePickerRules`, `settings.tilePickerRules` | `GameGenerator` resolves settings, and `GeneratorState.setupSettings()` copies picker rules into shared state for explicit ranking-setting accessors. |
| `faceAvoidanceRules` | Incomplete | `GeneratorState.faceAvoidanceRules`, `settings.faceAvoidanceRules`, `Faces.faceAvoidance` | Rule storage, the penalty store, and soft-link pressure application are active; telemetry is still incomplete. |
| `faceAssignmentRules` | Incomplete | `GeneratorState.faceAssignmentRules`, `settings.faceAssignmentRules`, `FaceRanking`, `Faces` | Preferred multiplier, duplicate tuning, and preferred-group generation are active; suspension-related parity is still incomplete. |
| `suspended` | Incomplete | `GeneratorState.suspended`, `TileSuspension` | The collection now lives in generator state and points at the intended suspension domain class, but active suspension behavior still does not exist. |
| `suspendedCount` | Missing | Best fit: `GameGenerator` | No experimental equivalent yet. |
| `pendingPairs` | Completed | `GeneratorState.preparedPairs`; compatibility accessors: `GameGenerator.preparedPairs`, `GameGenerator.pairSet`, `GameGenerator.pairs` | The live term is `pendingPairs`; the experimental vocabulary is prepared pairs because these tile pairs are structurally committed and ready for face assignment. |
| `suspensionStats` | Missing | Best fit: telemetry helper or `GameGenerator` | No experimental equivalent. |
| `tilePickerStats` | Missing | Best fit: telemetry helper or `TilePicker` | No experimental equivalent. |
| `faceAvoidanceStats` | Missing | Best fit: telemetry helper or `Faces` | No experimental equivalent. |
| `faceAvoidance` | Completed | `Faces.faceAvoidance` / `FaceAvoidance` | `Faces` owns the shared generation-run penalty store and passes it to `FaceRanking`. |
| `assignedFacePairs` | Completed | `FaceInventory.assignedFacePairs` | Active face assignment records history through `Faces.recordAssignedFacePair()`. |
| `undoStack` | Completed | `GameEngine.initialState.undoStack` | Runtime state owns this now. |
| `redoStack` | Completed | `GameEngine.initialState.redoStack` | Runtime state owns this now. |
| `selectableTiles` | Missing | Best fit: derived runtime state or compatibility wrapper | Experimental runtime derives `open`, but does not keep a live-style selectable cache. |
| `usedSpaces` | Completed | `Grid.occupied` | Occupancy is now owned by `Grid`. |
| `placedTiles` | Completed | `GameState.placedTiles` | Clear home in `GameState`. |
| `openTiles` | Incomplete | `GameRules.getOpenTiles()`, `GameEngine.getDerivedState().open` | Experimental code derives open tiles rather than caching them on the main engine. |
| `solution` | Completed | `GameState.solution`, `GameGenerator.solution` | Present in both generation and state payloads. |
| `suits` | Completed | `FaceInventory.suits` | Suit lookup lives in face inventory. |
| `drawPile.faceSets` | Incomplete | `FaceInventory.faceSets` | Equivalent home exists and active normal-pair plus full-face-set selection use it; suspension release behavior is still missing. |
| `actionCollector` | Missing | Best fit: compatibility/runtime wrapper | No experimental equivalent yet. |

### Live `GameGenerator` Property Mapping

| Live property | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `engine` | Incomplete | Split across `GameGenerator.gameState`, `GameGenerator.rules`, `GameGenerator.settings`, `Tiles`, `Faces`, `TilePicker`, `FaceInventory` | The whole point of the refactor is removing this monolithic dependency. |

## Experimental Properties With No Direct Live Single-Field Equivalent

These are worth calling out because they represent real refactor progress rather
than one-for-one field moves.

| Experimental property | Role |
| --- | --- |
| `GameGenerator.gameState` | Replaces the live pattern of generator methods mutating the full engine directly. |
| `GameGenerator.settings` | Replaces several live configuration fields with one resolved settings bundle. |
| `GameGenerator.faces` | Active face-domain orchestrator used by `GameGenerator`. |
| `Faces.faceInventory` | Face-domain-owned lower-level face inventory registered on `GeneratorState` for shared face access. |
| `GameGenerator.tiles` | Active structural tile-domain orchestrator used by `GameGenerator`. |
| `GeneratorState.preparedPairs` | Prepared generated tile pairs in generated removal order. This is generation-only metadata, not playable game state. |
| `GameGenerator.preparedPairs` | Compatibility accessor for `GeneratorState.preparedPairs` during an active generation run. |
| `GameGenerator.pairSet` | Transitional alias for `GameGenerator.preparedPairs`. |
| `GameGenerator.pairs` | Transitional alias for `GameGenerator.preparedPairs`. |
| `GeneratorState.suspended` | Keeps active suspension records as generation-only metadata and uses `TileSuspension` as the intended record shape. |
| `GameEngine.initialState` | First runtime state snapshot object, instead of storing all runtime fields directly on one engine object. |
| `TilePicker.analyzer` | Explicit home for copied-state graph questions that used to live inside the live engine. |
| `ranked-window.js` | Shared pure helper for difficulty-shaped windowing across tile and face selection. |
| `GameState.grid` | Makes the occupancy substrate explicit instead of implicit through engine helper methods. |
| `GeneratorState.suspensionRules` | Restores a direct generator-state home for live-style generator rule fields shared across generation classes. |
| `GeneratorState.tilePickerRules` | Shared generator-side picker-rule field intended for generation classes that need ranking settings. |
| `GeneratorState.faceAvoidanceRules` | Shared generator-side face-avoidance rule field. |
| `GeneratorState.faceAssignmentRules` | Shared generator-side face-assignment rule field. |
| `GeneratorState.preparedPairs` | Shared generator-side prepared-pair collection consumed by face assignment. |
| `GeneratorState` as shared access path | Reflects the experimental intent that generator-side collaborators should reach `GameState` through `GeneratorState` rather than depend on both in parallel. |

## Summary

The experimental code already has clear replacements for:

- board and occupancy state
- open/playable rule evaluation
- runtime undo/redo shell
- copied-state probe analysis
- basic weighted tile picking
- shared ranked-window selection
- ranked normal tile-pair face assignment
- face assignment history
- shared face-avoidance penalty storage
- basic solved-by-construction generation

The main missing or incomplete areas are:

- suspension creation/release
- suspension-specific reservation/release policy over full-face-set selection
- picker telemetry/stats
- face-assignment and face-avoidance telemetry/stats
- runtime compatibility/event bridge
- cleanup of transitional seams such as `GeneratorState` wiring, the active `Tiles` / `Faces` / `Suspensions` split, tile-ranking settings, and `FaceInventory`
