# Live Face Assignment Flow

This note records the live engine face-assignment flow that the experimental
engine should build against.

The live generator does not assign faces immediately for normal generated
tile pairs. Normal tile pairs are selected structurally first, then stored as
pending face-assignment records. Face pairs are assigned after the structural
prepared tile pairs have been generated.

Suspensions are the exception: they assign or reserve faces immediately because
they need one full face set split across a placed tile pair and a delayed
future tile pair.

## Normal Pair Flow

1. `placeWeightedNormalPair()` selects a structural tile pair.
2. `createGeneratedPairRecord()` creates a pending face-assignment record with:
   - `tiles`
   - `preferredFaceGroup`
   - `faceGroup: false`
   - `avoidanceTargets`
   - `avoidanceWeight`
3. `removeGeneratedPair()` removes the selected structural tile pair from the
   working board and appends it to the solution path.
4. The pending record is pushed into `engine.pendingPairs`.

At this point the tile pair is structurally committed, but faces are not
assigned.

## Preferred Face Group

`createGeneratedPairRecord()` calls:

```js
this.getPreferredFaceGroup(2, [tile1, tile2])
```

This only does work when face avoidance is enabled.

The preferred group is a soft preference, not a reservation. It asks
`getWeightedFaceGroup(...)` for a low-penalty group without drawing concrete
faces yet.

## Deferred Assignment

After structural generation finishes, `fillInRemainingFaces()` loops over
`engine.pendingPairs`.

For each pending record:

1. `drawPendingFaces(pending)` selects a concrete face pair.
2. The selected face pair is written to `engine.board.pieces`.
3. `recordAssignedFacePair(...)` records assignment history.
4. `markFaceAvoidanceForTargets(...)` adds future avoidance pressure.

## Pending Face Selection

`drawPendingFaces(pending)` is the live normal tile-pair face-selection path.

If the pending record already has concrete face metadata, it returns that
metadata.

Otherwise it performs the ranked selection flow:

1. `pickRankedFaceGroup(2, pending || tiles)` chooses a face group.
2. `drawFacePairFromGroup(faceGroup, tiles)` draws one concrete face pair from
   that selected group.
3. The selected group and concrete face pair are stored back onto the pending
   record.

## Ranking Flow

`pickRankedFaceGroup()` uses:

```txt
rankFaceGroups()
  -> getRankedFaceGroupWindow()
  -> random selection from the difficulty-shaped window
```

`rankFaceGroups()` builds the ordered group list using:

- enough remaining faces
- pair-count factor
- assignment-history distance
- preferred face-group multiplier
- easy duplicate expansion
- avoidance penalty override for unused groups

`getRankedFaceGroupWindow()` applies the same difficulty-window idea used by
tile picking. Easy leans toward the front of the ranked list, hard leans toward
the back, and medium keeps a broader middle.

`pickRankedFaceGroup()` randomly selects one group from that window.

## Concrete Pair Selection

`drawFacePairFromGroup(faceGroup, tiles)` mutates the draw pile:

1. Verifies the selected group can provide two faces.
2. Records face-avoidance draw stats when enabled.
3. Draws one concrete face pair from the selected group.
4. Removes those faces from the draw pile.

The experimental equivalent should use `select` language:

- `FaceInventory.canSelectFromGroup(...)`
- `FaceInventory.selectPairFromGroup(...)`

## Suspension Flow

Suspensions do not wait for deferred normal tile-pair face assignment.

When a weighted suspension is created:

1. `drawWeightedFaceSetForTiles(...)` selects and removes a full face set.
2. One face pair is assigned to the placed tile pair immediately.
3. The remaining face pair is stored on the suspended record for later release.
4. `recordAssignedFacePair(...)` records the immediate assignment.
5. `markFaceAvoidanceForTargets(...)` adds suspension-weighted avoidance.

When a suspension is released:

1. The reserved faces from the suspension record are assigned to the released
   tile pair.
2. The assignment is recorded.
3. Avoidance is marked around the released tile pair.

## Experimental Mapping

The intended experimental split is:

- `Faces.assignFacesToPreparedPairs()`
  - orchestrates deferred normal tile-pair face assignment
- `Faces.selectFacesForPair()`
  - asks ranking for a selected face group, then asks inventory for a concrete
    face pair
- `FaceRanking.rankFaceGroups()`
  - builds the ordered face-group list
- future `FaceRanking` or `Faces` ranked-window method
  - applies difficulty-window selection before concrete face selection
- `FaceInventory.selectPairFromGroup()`
  - removes and returns a concrete face pair from the selected group
- `FaceAvoidance`
  - stores and queries shared avoidance pressure for the generation run
- `Tiles.recordSoftLinks()`
  - records structural soft-link metadata before the selected tile pair is
    committed and removed

The experimental engine should not skip the ranked-window step permanently.
Selecting the first ranked group is acceptable only as a temporary integration
step if explicitly documented.

## Current Experimental Task Mapping

This maps the live face-assignment flow to the experimental work list so we can
build against the live behavior without losing the intended class boundaries.

### Already Done

- `GeneratedPair` carries the normal tile-pair metadata needed for deferred face
  assignment:
  - `tile1`
  - `tile2`
  - `preferredFaceGroup`
  - `faceGroup`
  - `faces`
- `SoftLinks` carries non-structural generation links in `GeneratorState`,
  including `open-tiles` / `after-removal` records keyed by source tiles.
- `Faces` exists as the face-domain orchestrator.
- `Faces` owns:
  - `FaceInventory`
  - shared `FaceAvoidance`
  - `FaceRanking`
- `FaceInventory` can initialize face sets and select concrete face pairs.
- `FaceInventory.canSelectFromGroup(...)` can test selected-group
  availability.
- `FaceInventory.selectPairFromGroup(...)` can remove concrete faces from a
  selected group as one face pair.
- `FaceRanking.rankFaceGroups(...)` is test-backed for the live-shaped ordering
  formula.
- `FaceRanking.getRankedFaceGroupWindow(...)` and
  `FaceRanking.selectRankedFaceGroup(...)` use shared `ranked-window.js`.
- `Faces.selectFacesForPair(...)` uses ranked face-group selection with no
  fallback to unranked inventory draw.
- `Faces.preparePairForFaceAssignment(...)` generates the preferred face group
  before assignment when face avoidance is enabled.
- `Tiles.selectGeneratedPair(...)` records an `open-tiles` / `after-removal`
  soft link before the selected pair is removed from the working board.
- `Faces.assignFacesToPair(...)` records assigned-face history.
- `Faces.assignFacesToPreparedPairs(...)` exists as the experimental equivalent of
  `fillInRemainingFaces()`.

### Next Face Tasks In Live-Flow Order

1. Mark avoidance after assignment.
   - Live equivalent: `markFaceAvoidanceForTargets(...)`.
   - Experimental target: after `Faces.assignFacesToPair(pair)`, query
     `GeneratorState.softLinks` for matching `open-tiles` / `after-removal`
     records and use `GeneratorState.faceAvoidanceRules.weight` to update
     `FaceAvoidance`.
   - Implemented as `Faces.applyFaceAvoidance(pair)`.
2. Add full-face-set selection for suspensions.
   - Live equivalent: `drawWeightedFaceSetForTiles(...)`.
   - Experimental target: `Faces.selectFullFaceSet(...)`.
   - This is implemented as a neutral face-domain capability. Future
     `Suspensions` should decide how to split or reserve the selected faces.
3. Add suspension release face assignment.
   - Live equivalent: reserved faces are stored on the suspension and assigned
     when released.
   - Experimental target: `Suspensions` coordinates with `Faces`; `GameGenerator`
     should not reach directly into face inventory.

### Immediate Recommended Step

Introduce the `Suspensions` policy seam above `TileSuspension`. The normal
prepared-pair path now has preferred-group generation, soft-link recording,
ranked face-group selection, concrete face-pair selection, full-face-set
selection, assignment-history recording, and face-avoidance pressure
consumption in place.
