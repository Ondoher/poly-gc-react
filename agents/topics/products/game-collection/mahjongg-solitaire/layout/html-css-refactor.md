# MJ HTML And CSS Refactor

## Purpose

Capture the current plan for a broader MJ layout refactor so we stop solving
portrait, compact sizing, expanded mode, and future touch zoom as isolated CSS
patches.

This note is about structure first:

- which layers own layout
- which layers own decorative chrome
- which layers own board fitting and scaling
- where overlays such as dialogs and toasts should attach

The main goal is to make future layout work predictable instead of repeatedly
debugging interactions between margins, transforms, generated tile CSS, and
ornamental framing.

## Why This Refactor Exists

The current MJ layout has several competing concerns living too close together:

- desktop layout and portrait layout
- ornamental frame chrome and functional playfield sizing
- board fitting and tile-size choice
- expanded mode and future gesture scaling
- transient overlays such as toasts and dialogs

That makes small CSS changes expensive, because one adjustment can accidentally
change:

- board fit
- frame spacing
- HUD placement
- overlay anchoring
- expanded mode behavior

The refactor should separate those responsibilities into clearer layers.

## Refactor Goals

The working target is:

- support a dedicated portrait layout
- remove ornamental chrome under tighter width/height constraints
- allow controlled board scaling at smaller sizes
- preserve a clean animated transition into expanded mode
- leave room for future programmatic pan/zoom or pinch gestures through a
  library rather than whole-app scaling hacks
- keep dialogs and toasts reliable across all layout modes

## Layout Layers

The recommended structure is:

1. Page shell
2. Chrome shell
3. Playfield viewport
4. Transform surface
5. Board canvas
6. Overlay layer

These layers should have distinct ownership.

### Page Shell

The page shell owns:

- overall feature layout
- landscape vs portrait arrangement
- compact mode vs regular mode
- shared overlay anchoring

This layer should not care about tile coordinates or board-generation details.

### Chrome Shell

The chrome shell owns decorative presentation such as:

- ornamental frame
- border art
- patterned background
- other non-essential page dressing

This layer should be removable at smaller breakpoints without changing board fit
math.

That means:

- the board must still size correctly when the chrome disappears
- compact landscape and portrait can turn the chrome off independently

### Playfield Viewport

The playfield viewport owns the available functional space for the board.

This is the element that should answer:

- how much width is available
- how much height is available
- whether the board is in expanded mode
- whether chrome is present around it

The viewport should not directly own tile transforms.

### Transform Surface

The transform surface is the board-interaction layer.

This is the preferred future home for:

- expanded-mode motion
- board fit scaling
- future pinch zoom
- future pan support

Using a dedicated transform surface avoids stacking multiple unrelated transform
systems on the board canvas itself.

### Board Canvas

The board canvas should remain the intrinsic board content.

It already has generated tile-size-specific dimensions. That makes it the right
place to define:

- intrinsic width
- intrinsic height
- size-specific board metrics

But it should not own page layout.

### Overlay Layer

The overlay layer should host:

- toast messages
- win/fail actions
- fireworks
- dialogs and modal surfaces

This layer should attach to the page shell or a stable board-page overlay host,
not to a decorative frame and not to the transformed board canvas.

That keeps overlays stable across:

- portrait mode
- compact mode
- expanded mode
- future zoom/pan transforms

## Recommended DOM Responsibilities

The current MJ structure already contains pieces of this, but the ownership
should become more explicit.

Preferred conceptual mapping:

- `mj-frame-shell`
  - page shell plus optional chrome shell
- `mj-layout-shell`
  - main layout grid for board and HUDs
- `mj-playfield-viewport`
  - available space for the board
- `mj-playfield-transform-surface`
  - scale and transition target
- `board-canvas`
  - intrinsic board content
- `mj-overlay-layer`
  - toasts, dialogs, celebration/failure overlays

The exact class names can differ, but the roles should stay distinct.

## Layout Modes

The refactor should treat layout modes as first-class states, not as scattered
one-off media-query patches.

### Default Landscape

Default landscape should keep:

- left HUD on the left
- board in the middle
- right HUD on the right
- full decorative chrome when space allows

### Compact Landscape

Compact landscape should prioritize usable board area over decoration.

Expected changes:

- reduce or remove ornamental frame
- tighten gaps and margins
- keep HUDs usable with denser spacing
- preserve board legibility first

This is the likely path for reducing the practical minimum height from `410px`
toward `390px`.

### Portrait

Portrait should be treated as a deliberate layout, not a fallback.

Current intended rough structure:

- board first
- right HUD horizontal beneath the board
- left HUD horizontal beneath that
- feedback anchored in the bottom-right region

Portrait should also be allowed to disable ornamental chrome early.

### Expanded

Expanded mode should be a playfield mode, not a separate layout system.

Expected behavior:

- animate from standard viewport to expanded viewport
- keep overlays functional
- avoid coupling the animation to decorative-frame layout assumptions

The transform target for expanded mode should ideally be the same surface that a
future zoom library would control.

## Board Fitting Strategy

Board fitting should have one source of truth.

The recommended rule is:

- generated tile CSS provides intrinsic board dimensions and other useful board
  metrics
- the viewport provides available space
- one fitting layer computes the scale
- scale should never exceed `1` unless deliberately requested

That is preferable to mixing:

- ad hoc negative offsets
- centering hacks
- stage scaling in one place and canvas scaling in another
- layout compensation based on guesswork

If needed, the tile CSS generator can emit additional size-specific variables
such as:

- usable board width
- usable board height
- left inset
- top inset
- scale-safe width and height

That is often cleaner than reverse-engineering those values later in hand-written
CSS.

## Chrome Removal Rules

Decorative chrome should be considered optional under constraints.

Recommended policy:

- full chrome when there is comfortable width and height
- reduced chrome under moderate pressure
- no chrome under portrait or short-height pressure

This is especially attractive for short-height landscape support, because
removing ornamental framing buys real board space without forcing the board to
be scaled more aggressively than necessary.

## Dialog And Toast Support

Dialogs and toasts must remain stable through the refactor.

### Dialogs

Dialogs should:

- anchor to the page shell or overlay layer
- ignore board fit transforms
- ignore decorative frame presence
- remain centered and readable in portrait and compact layouts

Dialogs should not be positioned relative to the scaled board canvas.

### Toasts

Toasts should:

- anchor to a stable overlay host
- remain readable in portrait and compact modes
- not take part in board fit calculations

Transient board-state messaging should behave the same whether the board is:

- in standard layout
- in portrait layout
- in compact landscape
- in expanded mode

## Gesture Zoom Preparation

Future touch gesture support is easier if the DOM is prepared now.

The expected future model is:

- viewport clips the available playfield region
- transform surface handles pan and zoom
- board canvas remains intrinsic content

That allows a library to attach to the transform surface for:

- pinch zoom
- panning
- controlled programmatic scale changes

This is preferable to scaling the entire page or attaching gestures directly to
the decorative frame shell.

## Implementation Order

Recommended order of attack:

1. Clarify the DOM roles in `Board.jsx`.
2. Separate decorative chrome from functional playfield layout.
3. Define layout modes clearly: default landscape, compact landscape, portrait,
   expanded.
4. Centralize board fit logic around intrinsic board dimensions plus viewport
   space.
5. Move overlays onto a stable overlay layer.
6. Revisit expanded-mode animation against the new transform surface.
7. Add future gesture support against that same surface.

## Review Heuristics

When evaluating a layout change, prefer asking:

- does this belong to layout, chrome, fit, or overlay?
- does this rule still work if the ornamental frame disappears?
- does this rule still work in portrait?
- does this rule still work in expanded mode?
- would a future gesture-zoom implementation fight this rule?

If a change only works because two unrelated layers happen to compensate for one
another, it is probably the wrong long-term solution.
