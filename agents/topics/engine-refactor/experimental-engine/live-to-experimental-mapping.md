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

- `TilePicker` still calls `this.state.collapseOptions(...)`, but the active experimental picker is constructed with `rules`, `gameState`, and `settings`, not a `state` object.
- `GeneratorState` is now the intended `GameState` extension for generator-specific shared state, but the active generator and picker are not fully wired back to it yet.
- generator-side collaborators are trending toward accessing `GameState`
  through `GeneratorState` rather than depending on both directly
- `FaceInventory` is still mid-migration and currently has broken legacy references such as `engine.makeSequentialArray(...)`.
- the topic docs now treat `Tiles`, `Faces`, and `Suspensions` as the intended
  top-level generator orchestration band
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
| `GameGenerator` | The active experimental board generator. It resolves settings, creates a fresh `GameState`, uses `TilePicker` to author structural pairs backward, assigns faces, and restores the final board for runtime play. |
| `GeneratorState` | A `GameState` extension intended to hold generator-specific shared state such as suspension rules, difficulty state, picker rules, face-assignment rules, face-avoidance rules, and option-collapse behavior shared across generation classes. |
| `Tiles` | Intended top-level orchestration layer for structural tile-choice behavior during generation. It would sit above `TilePicker` and expose tile-selection policy to `GameGenerator`. |
| `Faces` | Intended top-level orchestration layer for face-selection and face-assignment behavior during generation. It would sit above `FaceInventory`, `FaceAvoidance`, and `FaceRanking`. |
| `Suspensions` | Intended top-level orchestration layer for delayed-match creation and release behavior during generation. It would coordinate suspension policy and work with `TileSuspension` records. |
| `TilePicker` | The active experimental tile-scoring and selection class. It scores open candidates using z-order, spatial relationships, open-pressure, stack-balance, and short-horizon pressure, then chooses from a difficulty-shaped window. |
| `StateGraphAnalyzer` | The copied-state analysis helper used by generation and picker code. It answers hypothetical questions such as tiles freed by removals, short-horizon collapse, stack balance, open tiles after removals, and playable pairs after removals. |
| `difficulty-settings.js` | The experimental difficulty configuration module. It defines level presets and resolves a final settings bundle from difficulty plus optional overrides. |
| `TileSuspension` | The suspended-tile domain record used to hold one delayed-release tile plus its reserved face-group and release metadata. |

### Experimental Face-Assignment And Transitional Classes

| Class | Current role |
| --- | --- |
| `FaceInventory` | The experimental home for face-set inventory, suit lookup, and future face-group draw logic. It is intended to absorb live draw-pile and assigned-face history responsibilities, but it is still incomplete. |
| `FaceAvoidance` | A planned helper for generation-time soft face penalties. It is meant to carry live face-avoidance state and logic, but it is not wired into the active generator path yet. |
| `FaceRanking` | A planned helper for face-group ranking, reuse spacing, preferred-group bias, and easy-side reuse duplication. It currently looks like an unfinished experimental branch rather than an active subsystem. |

### Taxonomy Summary

- The live side still centers on one large `Engine` plus a partially extracted `GameGenerator`.
- The experimental side has already separated:
  - occupancy substrate
  - Mahjongg state
  - rules
  - runtime mutation
  - intended top-level generator orchestration concerns
  - tile selection
  - copied-state analysis
  - difficulty configuration
- The least-settled part of the experimental taxonomy is the generator-support band beneath `GameGenerator`: `Tiles`, `Faces`, `Suspensions`, and their helpers all have clearer intended homes now, but they are not yet fully migrated into a stable active design.

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
| `pickWeightedTileFromScores` | Completed | `TilePicker.pickWeightedTileFromScores()` | Clear extracted home. |
| `isPlayablePair` | Completed | `GameRules.isPlayablePair()` | Clear extracted home. |
| `arePlayablePairs` | Completed | `GameRules.hasPlayablePairs()` | Same responsibility in clearer form. |
| `calcPlayablePairs` | Completed | `GameRules.getPlayablePairs()` | Clear extracted home. |
| `canRedo` | Completed | `GameEngine.canRedo()` | Runtime shell covers this. |
| `canUndo` | Completed | `GameEngine.canUndo()` | Runtime shell covers this. |
| `doFacesMatch` | Completed | `GameRules.doFacesMatch()` | Clear extracted home. |
| `getSolution` | Completed | `GameState.solution`, `GameGenerator.solution` | The solution payload exists in experimental generation and state. |

#### Incomplete

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `constructor` | Incomplete | `GameGenerator`, `GameEngine`, `GameState`, `GameRules`, `FaceInventory`, `TilePicker`, `Grid` | The big combined constructor has been split, but not all live state has a finished experimental replacement yet. |
| `makeSuits` | Incomplete | `FaceInventory.makeSuits()` | Suit bookkeeping exists, but the face inventory layer is still unfinished. |
| `getSuit` | Incomplete | `FaceInventory.getSuit()` | Present, but still tied to unfinished `FaceInventory`. |
| `getSuitFromFaceGroup` | Incomplete | `FaceInventory.getSuitFromFaceGroup()` | Present, but part of the unfinished face-inventory path. |
| `setupSuspensionRules` | Incomplete | `GeneratorState.setupSuspensionRules()` | The generator-side state extension now has this method, but the active generator is not yet wired around `GeneratorState`. |
| `setupDifficulty` | Incomplete | `GeneratorState.setupDifficulty()`, `difficulty-settings.js`, `GameGenerator.resolveSettings()` | `GeneratorState` now exposes the live-style mutator, but the active generator still leans on resolved settings instead of this shared state path. |
| `setupTilePickerRules` | Incomplete | `GeneratorState.setupTilePickerRules()`, `difficulty-settings.js`, `GameGenerator.resolveSettings()` | Same split as `setupDifficulty`. |
| `setupFaceAvoidanceRules` | Incomplete | `GeneratorState.setupFaceAvoidanceRules()`, `Faces` | The generator-side state extension now has the rule mutator, but active face avoidance is not wired into generation. |
| `setupFaceAssignmentRules` | Incomplete | `GeneratorState.setupFaceAssignmentRules()`, `Faces` | The generator-side state extension now has the rule mutator, but live parity is not there yet. |
| `calcOpenTiles` | Incomplete | `GameRules.getOpenTiles()`, `GameEngine.getDerivedState()` | Open tiles are derived, not cached on state. Suspended-tile skipping from live generation is not mirrored yet. |
| `recordAssignedFacePair` | Incomplete | Best fit: `FaceInventory.assignedFacePairs` and/or `GameGenerator` | The history structure exists, but active generator code does not yet maintain live-equivalent face assignment history. |
| `getAssignedFaceGroupIndexes` | Incomplete | `FaceInventory.getAssignedFaceGroupIndexes()` | Present in the unfinished inventory path. |
| `countVerticalIntersections` | Incomplete | `GameState.countDepthIntersections()` | Concept is present, but the experimental name and exact semantics are not yet parity with live `vertical`. |
| `buildUsedSpacesForPlacedTiles` | Incomplete | `GameState.clone()`, `Grid`, `StateGraphAnalyzer.withRemovedTiles()` | Responsibility exists in split form, but not as a direct helper. |
| `isTileOpenInSpaces` | Incomplete | `GameRules.isTileOpen()` plus copied-state analysis | Experimental code can answer the question through cloned state, but not via this direct helper. |
| `getOpenTilesInState` | Incomplete | `StateGraphAnalyzer.getOpenTileKeysAfterRemoving()` | Present as a copied-state operation, but not as a generic placed/used-spaces helper. |
| `wouldCreateDominantStack` | Incomplete | `StateGraphAnalyzer.getStackBalanceAfterRemoving()` | The analyzer can detect dominant stacks, but hard safety enforcement is not wired into the picker/generator yet. |
| `scoreOpenTiles` | Incomplete | `TilePicker.scoreOpenTiles()` | Main idea is implemented, but live parity is not complete and the active picker still has unfinished settings plumbing. |
| `getBalancePressure` | Incomplete | `TilePicker.getBalanceFactor()` | Pressure is represented, but not as a separate helper with live naming. |
| `getOpenPressure` | Incomplete | `TilePicker.getOpenPressureFactor()` | Present as part of the picker, but with different shape/naming. |
| `getRankedWindow` | Incomplete | `TilePicker.getDifficultyWindowDetails()`, `GameGenerator.getRankedWindow()` | Windowing exists, but is duplicated and not yet fully consolidated. |
| `pickWeightedTile` | Incomplete | `TilePicker.pickWeightedTile()` | Active experimental equivalent exists, but stack-safety and settings wiring are not fully finished. |
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
| `drawOneOf` | Missing | Best fit: `FaceInventory` | No experimental equivalent yet. |
| `getFaceSetId` | Missing | Best fit: `FaceInventory` | Not implemented as a standalone experimental helper. |
| `getAvoidancePenalty` | Missing | Best fit: `Faces` / `FaceAvoidance` | Experimental `FaceAvoidance` is not active or wired. |
| `addFaceAvoidance` | Missing | Best fit: `FaceAvoidance.addFaceAvoidance()` | There is a candidate class, but the active generator does not use it. |
| `getFaceAvoidanceTargetsAfterRemoval` | Missing | Best fit: `Faces` plus `StateGraphAnalyzer` | The hypothetical-state plumbing exists, but this live helper has not been recreated. |
| `getFaceGroupPenalty` | Missing | Best fit: `Faces` / `FaceRanking` / `FaceAvoidance` | No active experimental equivalent. |
| `getWeightedFaceGroup` | Missing | Best fit: `Faces` plus `FaceInventory` / `FaceRanking` | Not implemented on the active path. |
| `canDrawFromFaceGroup` | Missing | Best fit: `FaceInventory` | The experimental inventory does not yet expose this live helper. |
| `recordFaceAvoidanceDraw` | Missing | Best fit: `Faces` or future face telemetry helper | No equivalent yet. |
| `getFaceGroupDuplicateCount` | Missing | Best fit: `Faces` / `FaceRanking` | The live concept exists only in the unfinished face-ranking branch. |
| `getAdjustedDistanceFactor` | Missing | Best fit: `Faces` / `FaceRanking` | Same as above. |
| `rankFaceGroups` | Missing | Best fit: `Faces` / `FaceRanking` | There is an unfinished experimental version, but it is not active or reliable yet. |
| `getRankedFaceGroupWindow` | Missing | Best fit: `Faces` / `FaceRanking` | No active experimental equivalent. |
| `pickRankedFaceGroup` | Missing | Best fit: `Faces` plus `FaceInventory` / `FaceRanking` | Not implemented on the active path. |
| `drawWeightedFacePairForTiles` | Missing | Best fit: `Faces` plus `FaceInventory` | Active experimental generator does not do weighted face-pair selection. |
| `drawFacePairFromGroup` | Missing | Best fit: `Faces` plus `FaceInventory` | No active equivalent. |
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
| `removeGeneratedPair` | Completed | `GameGenerator.removeGeneratedPair()` | Clear extracted equivalent. |

#### Incomplete

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `constructor` | Incomplete | `GameGenerator.constructor()` | Experimental constructor is much slimmer and intentionally no longer takes the full live engine. |
| `shuffleTiles` | Incomplete | `GameGenerator.shuffleTiles()`, `FaceInventory.shuffleTiles()` | Equivalent responsibility exists, but the inventory implementation is still unfinished. |
| `getTilePickerOptions` | Incomplete | `GameGenerator.settings`, `TilePicker`, `difficulty-settings.js` | Settings exist, but there is no direct equivalent helper. |
| `recordAssignedFacePair` | Incomplete | Best fit: `FaceInventory.assignedFacePairs` and `GameGenerator` | History concept exists, but it is not actively maintained at live parity. |
| `pickWeightedPair` | Incomplete | `TilePicker.pickTile()` and `TilePicker.pickWeightedTile()` | The experimental generator can pick pairs, but not with the live retry/window/stats behavior. |
| `generate` | Incomplete | `GameGenerator.generate()` | The main solved-by-construction loop exists, but live difficulty features are not all ported. |
| `placeGeneratedPair` | Incomplete | `GameGenerator.placeGeneratedPair()` | Experimental version only does the normal pair path. |
| `placeWeightedNormalPair` | Incomplete | `GameGenerator.placeGeneratedPair()` | Normal pair placement exists in simplified form only. |
| `fillInRemainingFaces` | Incomplete | `GameGenerator.fillInRemainingFaces()` | Experimental version exists, but it is simple face-pair assignment rather than live face-group-aware deferred assignment. |

#### Missing

| Live method | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `getPreferredFaceGroup` | Missing | Best fit: `Faces` / `FaceRanking` | Not implemented on the active path. |
| `markFaceAvoidanceAroundTiles` | Missing | Best fit: future `FaceAvoidance` plus `GameGenerator` | No active equivalent. |
| `markFaceAvoidanceForTargets` | Missing | Best fit: future `FaceAvoidance` plus `GameGenerator` | No active equivalent. |
| `getFaceAvoidanceNeighborhood` | Missing | Best fit: `GameRules.getOpenTiles()` plus generator helper | No active equivalent. |
| `getFaceAvoidanceTargetsAfterRemoval` | Missing | Best fit: `Faces` plus `StateGraphAnalyzer` | No active equivalent. |
| `hasFullFaceSet` | Missing | Best fit: `FaceInventory` | Not exposed yet. |
| `drawWeightedFaceSetForTiles` | Missing | Best fit: `Faces` plus `FaceInventory` / `FaceRanking` | Not implemented. |
| `drawPendingFaces` | Missing | Best fit: `Faces` | Experimental generator does simple final face assignment instead. |
| `pickWeightedSuspensionTriple` | Missing | Best fit: `GameGenerator` plus `TilePicker` | No experimental suspension flow yet. |
| `pickWeightedReleasedPartner` | Missing | Best fit: `GameGenerator` plus `TilePicker` | No experimental suspension release flow yet. |
| `testRelease` | Missing | Best fit: `GameGenerator` | No suspension release path yet. |
| `mustRelease` | Missing | Best fit: `GameGenerator` | No suspension release safety logic yet. |
| `countOpenSuspensions` | Missing | Best fit: `GameGenerator` | No active suspension support. |
| `recordSuspensionSafetyStats` | Missing | Best fit: `GameGenerator` or telemetry helper | No equivalent. |
| `canSuspend` | Missing | Best fit: `Suspensions` | No active suspension support. |
| `findReleasableTile` | Missing | Best fit: `Suspensions` | No active suspension support. |
| `createGeneratedPairRecord` | Missing | Best fit: `GameGenerator` | Experimental generator stores only plain `TilePair` records right now. |
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
| `suspensionRules` | Incomplete | `GeneratorState.suspensionRules`, `settings.suspensionRules` | The generator-state extension now has a direct home for this field, but the active generator path is not centered on it yet. |
| `difficulty` | Incomplete | `GeneratorState._difficulty`, `settings.generationDifficulty` | Experimental code now has both a generator-state field and resolved settings path, and those have not been unified yet. |
| `tilePickerRules` | Incomplete | `GeneratorState.tilePickerRules`, `settings.tilePickerRules` | Experimental code now has both a generator-state field and resolved settings path, and those have not been unified yet. |
| `faceAvoidanceRules` | Incomplete | `GeneratorState.faceAvoidanceRules`, `settings.faceAvoidanceRules` | Experimental code now has both a generator-state field and resolved settings path, and active face avoidance is still missing. |
| `faceAssignmentRules` | Incomplete | `GeneratorState.faceAssignmentRules`, `settings.faceAssignmentRules` | Experimental code now has both a generator-state field and resolved settings path, and live parity is still missing. |
| `suspended` | Incomplete | `GameGenerator.suspended`, `TileSuspension` | The collection exists and now points at a real suspension domain class, but active suspension behavior still does not. |
| `suspendedCount` | Missing | Best fit: `GameGenerator` | No experimental equivalent yet. |
| `pendingPairs` | Missing | Best fit: `GameGenerator` | Experimental generator only tracks plain `pairs`. |
| `suspensionStats` | Missing | Best fit: telemetry helper or `GameGenerator` | No experimental equivalent. |
| `tilePickerStats` | Missing | Best fit: telemetry helper or `TilePicker` | No experimental equivalent. |
| `faceAvoidanceStats` | Missing | Best fit: telemetry helper or `Faces` | No experimental equivalent. |
| `faceAvoidance` | Missing | Best fit: `FaceAvoidance` | Experimental class exists but is not active in the generator path. |
| `assignedFacePairs` | Incomplete | `FaceInventory.assignedFacePairs` | The property exists, but active use is unfinished. |
| `undoStack` | Completed | `GameEngine.initialState.undoStack` | Runtime state owns this now. |
| `redoStack` | Completed | `GameEngine.initialState.redoStack` | Runtime state owns this now. |
| `selectableTiles` | Missing | Best fit: derived runtime state or compatibility wrapper | Experimental runtime derives `open`, but does not keep a live-style selectable cache. |
| `usedSpaces` | Completed | `Grid.occupied` | Occupancy is now owned by `Grid`. |
| `placedTiles` | Completed | `GameState.placedTiles` | Clear home in `GameState`. |
| `openTiles` | Incomplete | `GameRules.getOpenTiles()`, `GameEngine.getDerivedState().open` | Experimental code derives open tiles rather than caching them on the main engine. |
| `solution` | Completed | `GameState.solution`, `GameGenerator.solution` | Present in both generation and state payloads. |
| `suits` | Incomplete | `FaceInventory.suits` | Present, but still part of unfinished inventory code. |
| `drawPile.faceSets` | Incomplete | `FaceInventory.faceSets` | Equivalent home exists, but the inventory implementation is unfinished. |
| `actionCollector` | Missing | Best fit: compatibility/runtime wrapper | No experimental equivalent yet. |

### Live `GameGenerator` Property Mapping

| Live property | Status | Experimental home | Notes |
| --- | --- | --- | --- |
| `engine` | Incomplete | Split across `GameGenerator.gameState`, `GameGenerator.rules`, `GameGenerator.settings`, `TilePicker`, `FaceInventory` | The whole point of the refactor is removing this monolithic dependency. |

## Experimental Properties With No Direct Live Single-Field Equivalent

These are worth calling out because they represent real refactor progress rather
than one-for-one field moves.

| Experimental property | Role |
| --- | --- |
| `GameGenerator.gameState` | Replaces the live pattern of generator methods mutating the full engine directly. |
| `GameGenerator.settings` | Replaces several live configuration fields with one resolved settings bundle. |
| `GameGenerator.faceInventory` | Transitional direct dependency that should eventually sit behind `Faces`. |
| `GameGenerator.tilePicker` | Transitional direct dependency that should eventually sit behind `Tiles`. |
| `GameGenerator.pairs` | Simplified structural record for authored removal order. |
| `GameGenerator.suspended` | Keeps active suspension records on the generator side and now uses `TileSuspension` as the intended record shape. |
| `GameEngine.initialState` | First runtime state snapshot object, instead of storing all runtime fields directly on one engine object. |
| `TilePicker.analyzer` | Explicit home for copied-state graph questions that used to live inside the live engine. |
| `GameState.grid` | Makes the occupancy substrate explicit instead of implicit through engine helper methods. |
| `GeneratorState.suspensionRules` | Restores a direct generator-state home for live-style generator rule fields shared across generation classes. |
| `GeneratorState.tilePickerRules` | Shared generator-side picker-rule field intended for generation classes that need collapsed picker options. |
| `GeneratorState.faceAvoidanceRules` | Shared generator-side face-avoidance rule field. |
| `GeneratorState.faceAssignmentRules` | Shared generator-side face-assignment rule field. |
| `GeneratorState` as shared access path | Reflects the experimental intent that generator-side collaborators should reach `GameState` through `GeneratorState` rather than depend on both in parallel. |

## Summary

The experimental code already has clear replacements for:

- board and occupancy state
- open/playable rule evaluation
- runtime undo/redo shell
- copied-state probe analysis
- basic weighted tile picking
- basic solved-by-construction generation

The main missing or incomplete areas are:

- suspension creation/release
- deferred normal-pair records
- full face-group ranking and reuse
- face avoidance
- picker telemetry/stats
- runtime compatibility/event bridge
- cleanup of transitional seams such as `GeneratorState` wiring, the future `Tiles` / `Faces` / `Suspensions` split, `TilePicker` option collapse, and `FaceInventory`
