# Canvas Rescaling Policy

## Purpose

Define the events that should trigger automatic board/canvas rescaling and the
events that should not.

This note is meant to keep runtime fit behavior predictable while preserving
manual user control over zooming and canvas navigation.

## Auto-Rescale Triggers

Automatic canvas fit should only be recalculated on these transitions:

1. app start
2. after a game is generated
3. when switching into expanded mode
4. when switching back out of expanded mode
5. when switching into portrait mode
6. on screen resize

These are the moments when either:

- the board geometry changes
- the available render space changes
- the layout mode changes enough that the existing fit should be considered
  stale

## Non-Triggers

Automatic canvas fit should not be recalculated for manual navigation actions
inside the current board view.

Do not auto-rescale on:

- manual zooming or scaling
- manual canvas scrolling
- manual panning

Those interactions should change only the user's current view of the canvas,
not the underlying auto-fit decision.

## Working Rule

The runtime should treat auto-fit and manual navigation as separate concerns:

- auto-fit responds to layout-state and viewport-state transitions
- manual interaction adjusts the current view of the already fitted canvas

This prevents the system from fighting the user after they have intentionally
zoomed or moved the board.

## Practical Consequence

If a user manually zooms or scrolls the board, that view should remain stable
until one of the explicit auto-rescale triggers happens.

The next allowed automatic fit event may then replace the current fitted view,
because the board or available space has materially changed.
