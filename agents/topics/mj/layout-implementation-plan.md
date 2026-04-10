# Mahjongg Layout Implementation Plan

## Goal

Bring the current Mahjongg implementation into alignment with the PSD-driven visual design while keeping the game logic intact and favoring CSS for layout and visual structure.

## Design Direction

The design appears to define two related UI modes within the same framed visual system:

- an in-game play screen
- a settings dialog layered over the play screen

The play screen should stay visually lean and focused on the board. The dialog should hold the broader game configuration controls.

## Guiding Principles

- Favor CSS for layout, sizing, positioning, and ornamental presentation.
- Prefer CSS Grid as the primary layout mechanism for organizing major screen regions where possible.
- Keep React/JSX focused on semantic regions and behavior.
- Preserve existing game logic and delegator behavior where possible.
- Move configuration controls out of the always-visible layout unless they belong in the play HUD.
- Prefer incremental structural changes over large rewrites.

## Current Lessons From Early Pass

The first removal pass exposed several structural issues that should guide the next implementation step:

- removing fields alone is not enough if the old page layout structure still remains
- the current header-plus-main composition still produces a page-like layout instead of the flatter in-game PSD composition
- the board is still visually contained in a separate felt panel, which does not match the target play-screen image
- the text-button controls still fall into a bottom cluster rather than a narrow right-side rail
- the breadcrumb displacement indicates the page/shell sizing model still needs to be simplified rather than patched around

The next pass should therefore focus on reworking the page into a grid-defined play-screen composition rather than making isolated removals inside the old structure.

## Target Play Screen

The base in-game screen should contain:

- frame chrome
- red patterned background
- small `Game #` control group in the upper-left
- timer in the upper-right
- central Mahjongg board
- narrow right-side control rail
- transient status/message treatment as a lightweight overlay or compact HUD element
- a lightweight way to dismiss the win celebration without obscuring the fireworks

The `Game #` control group should consist of:

- an editable positive-integer `Game #` field
- a small adjacent randomize-layout action/button to the right of the field
- the randomize button should sit in its own region to the right of the edit field
- the control should now be treated as one composite rectangle with an internal separator rather than as two independent framed boxes
- the randomize button should use the same background color treatment as the edit field

The base play screen should not contain:

- a persistent left settings/options column
- a large page title band
- a boxed green panel around the board if the PSD continues to show the board directly on the red field

## Target Settings Dialog

The settings dialog should be a centered overlay inside the frame and should hold the broader configuration UI.

Expected contents:

- layout selection
- tileset selection
- tilesize selection
- other configuration controls as needed
- optional board preview area
- close/dismiss affordance

Current implementation note:

- the live code now includes a centered settings dialog opened from the right HUD settings button
- the dialog already includes tab buttons, a selector list, a custom scrollbar, a confirm action, and draft selection state for layout, tile size, and tile style
- the remaining work is primarily PSD refinement and preview generation rather than initial dialog scaffolding

## Proposed Component Structure

### Keep

- `Board.jsx` as the overall Mahjongg screen container
- `Controls.jsx` as the behavior source for play actions
- `Options.jsx` as the source of existing configuration behavior, at least initially
- `Canvas.jsx` as the board renderer

### Extract or Introduce

- `GameNumberControl`
  - small always-visible positive-integer input
  - placeholder text `Game #`
  - styled to match the PSD
  - visually grouped with a randomize-layout action on its right

- `SettingsDialog`
  - overlay container for settings mode
  - now owns the dialog shell and selection draft state while still delegating final apply behavior back out to MJ board logic

- `Toast`
  - transient short-message presentation for lightweight notifications

- optional compact large-message or win-state presentation layer
  - if larger `message` states move away from legacy page/header placement

## Proposed Refactor Sequence

### Step 1: Establish the Base Frame and Background

- strip the MJ screen back to the frame and patterned background
- remove timer, board, and controls temporarily
- remove breadcrumbs temporarily while isolating layout issues
- validate frame asset treatment against the PSD before reintroducing controls

### Step 2: Reintroduce the `Game #` Control First

- add back the board-number control before any other HUD element
- use a feature-local MJ rectangle component instead of coupling box styling directly to inputs
- support a rectangle treatment that can be tuned against the PSD
- allow the board-number field and shuffle action to read as a joined control group

### Current Status

Completed:

- frame/background-only pass was created
- frame chrome was rebuilt using outline-derived corner and stretched edge assets
- breadcrumbs were temporarily removed from app rendering
- `GameNumberControl.jsx` was introduced
- `OrnamentalRect.jsx` was introduced as a class-based child-rendering wrapper
- `CssRect.jsx` was introduced as a CSS-based rectangle component for PSD tuning
- `Toast.jsx` was introduced for transient short-message display
- `SettingsDialog.jsx` was introduced and now holds the tabbed settings overlay structure
- a two-size ornamental rectangle system exists:
  - `small` from `edit-rect.png`
  - `large` from `standard-rect.png`
- the live `Game #` field is now using `CssRect` rather than the image-cut rectangle treatment
- the live `Game #` field and shuffle action now render as one composite control with an internal separator
- the right-side control rail is now wired back into play actions
- the settings rail action now opens the tabbed settings dialog
- short messages are now displayed through a toast-style overlay
- the win fireworks state now has a bottom-center `Continue` action
- the win fireworks state can be dismissed with either that action or `Escape`
- the timer now swaps to the word `Paused` while the board is paused
- the current live MJ UI is now using `CssRect` in place of `OrnamentalRect` for the board playfield, right HUD rail, settings buttons, text edit control, and shuffle control
- the settings dialog now includes a live selector component with a custom draggable scrollbar and wired layout, tile size, and tile style draft selection

Still in progress:

- final `Game #` font size
- final `Game #` text padding/alignment
- final interior background color/transparency
- final `CssRect` surface/border tuning against the PSD
- final exact `Game #` placement
- final right-HUD rail positioning/content
- final board-area and control spacing polish
- final settings dialog structure and PSD fidelity
- preview sizing rules, centering behavior, and PSD fidelity
- final presentation for larger blocking `message` states
- dedicated touch polish for settings-dialog scrolling and dragging interactions

Responsive-mode note:

- a runtime sizing system that limits available tile sizes based on window size is still planned, but it does not currently appear to exist in the live codebase
- when implemented, that same sizing system is the likely place to attach MJ UI scale classes for alternate icon/control sizing
- on resize, the future size-selection logic may also need to support a portrait-oriented layout mode with different minimum-size rules than the landscape thresholds
- that same responsive decision should adjust the settings dialog size as well, so the dialog and its preview area stay intentional rather than keeping one fixed desktop-sized treatment
- when larger icon assets are introduced, prefer a parent mode class such as `mj-ui-large` on the page or frame shell rather than duplicating base rules
- use that mode class to override only the dimensions that need to change, for example:
  - larger `Game #` control dimensions
  - larger shuffle button and icon sizing
  - larger right-HUD rail sizing and icon dimensions
- this keeps icon scale, tile-size availability, and layout-density decisions in the same responsive system

Naming cleanup note:

- the feature-local component/class cleanup has now moved the main `Mj*` React and engine names to feature-local names such as `Board`, `Canvas`, `SettingsDialog`, and `CssRect`
- service-style names such as `mjController` and `mj:controller` intentionally stay prefixed because they participate in the feature namespace and registry contract
- future feature-local additions should prefer the shorter names unless they need the `mj` prefix for cross-feature/service identity

Reintroduced in structural/prototype form:

- board canvas and tile area
- right-side ornamental rail rectangle
- randomize button paired with `Game #`
- centered settings dialog with tabbed selector structure
- transient short-message toast overlay
- bottom-center win-dismiss pill/button
- a first-pass preview pipeline that mounts a live board source render and captures a preview bitmap from it

Current implementation note:

- the original image-cut ornamental rectangle system is still present in the codebase, but the live MJ feature currently renders its rectangles through `CssRect`
- the CSS-based rectangle path is being tuned because it is proving easier to iterate against the PSD for borders, transparency, and join behavior
- the settings dialog preview now uses a first-pass `PreviewGenerator` implementation that:
  - mounts a live preview render through `PreviewWrapper` and `Canvas`
  - creates board data through a local `Engine` instance
  - captures a bitmap with `html-to-image`
  - currently anchors the preview to a temporary fixed maximum tile size of `normal` until the real responsive size-selection rules are implemented

### Current Layout Constraint

- the current `tiny` tile-size play layout has been tested down to approximately `730x410`
- `730x410` should be treated as the current minimum supported viewport for the in-game screen when using `tiny` tiles
- the current practical minimum app sizes for the larger tile sizes are:
  - `small`: `870x540`
  - `medium`: `950x590`
  - `normal`: `1080x690`
- larger tile sizes will require larger minimum supported viewports unless further adaptation is introduced
- below that size, the `tiny` board fit becomes unreliable without further adaptation
- future mobile work may lower this minimum, but it is the current practical floor for `tiny`

### Phase 1: Stabilize the Screen Regions

- keep the current frame shell
- flatten the main screen layout
- remove the persistent left options column and all editable fields from the main in-game layout
- position the board, timer, `Game #`, and control rail using CSS regions

### Phase 2: Split Main HUD From Settings

- extract the `Game #` control from `Options.jsx`
- keep it visible on the play screen
- move layout, tileset, and tilesize controls into a settings dialog component
- connect the settings rail action to open and close the dialog
- keep dialog selection state draft-based so preview updates can happen before confirm

### Phase 3: Rework the Control Rail

- keep existing action behavior
- restyle actions as a narrow vertical rail
- move from text-button presentation toward icon-oriented presentation
- keep text labels only as a temporary or accessibility aid if needed
- preserve stateful behaviors such as pause, undo, redo, peek, and settings-open interactions

### Phase 4: Reposition or Reduce Message Areas

- remove the large page-style title/header treatment if it remains
- keep `shortMessage` as a transient toast-style overlay
- treat larger `message` states as a separate blocking or modal-style presentation path
- keep win/loss overlays separate
- keep win celebration dismissal lightweight and non-obscuring

### Phase 5: Visual Polish

- refine the `Game #` control styling
- refine timer typography and placement
- refine control rail ornament/states
- refine board centering and scale
- add touch-specific follow-up for custom settings selector interactions
  - verify thumb dragging on phones/tablets
  - add `touch-action` tuning where needed
  - consider larger touch targets or tap-to-scroll behavior for the custom scrollbar
- revisit decorative details only after the main layout is correct

## Expected File Impact

Primary files likely to change:

- `src/gc/features/mj/src/components/Board.jsx`
- `src/gc/features/mj/src/components/CssRect.jsx`
- `src/gc/features/mj/src/components/Options.jsx`
- `src/gc/features/mj/src/components/Controls.jsx`
- `src/gc/features/mj/src/components/SettingsDialog.jsx`
- `src/gc/features/mj/src/components/Toast.jsx`
- `src/gc/features/mj/assets/css/mj.css`
- `src/gc/features/mj/assets/css/mj-css-rect.css`
- `src/gc/features/mj/assets/css/mj-settings.css`
- `src/gc/features/mj/assets/css/mj-toast.css`
- `src/gc/features/mj/assets/css/ornamental-rect.css`

Likely new files:

- `src/gc/features/mj/src/components/GameNumberControl.jsx`
- `src/gc/features/mj/src/components/OrnamentalRect.jsx`
- `src/gc/features/mj/src/components/CssRect.jsx`
- `src/gc/features/mj/src/components/SettingsDialog.jsx`
- `src/gc/features/mj/src/components/Toast.jsx`

Possible future additions:

- icon assets for control rail actions
- dialog-specific decorative assets if CSS is not enough
- small and large ornamental rectangle asset sets under `src/gc/features/mj/assets/images/rect`
- additional rectangle cut sets for smaller target sizes and aspect ratios
  - the current rectangle assets begin to blur once the corner pieces separate before reaching the stretched middle segments
  - future cuts should cover square, portrait, and landscape use cases rather than assuming one generic rectangle family
- alternate PNG icon exports for larger UI modes derived directly from PSD shape layers when the Photoshop effects need to be preserved

## Open Questions

- Should the board sit directly on the red field, or should a very subtle play-area treatment remain?
- Should `New` stay in the rail, or should starting/restarting be driven primarily through `Game #` and settings?
- Should settings open as a modal overlay, or as a panel that still leaves the board visible and interactive behind it?
- How should the larger `message` channel be presented now that `shortMessage` has moved to a toast?
- Should the settings preview be a lightweight layout renderer or an off-screen rendered bitmap derived from the live board pipeline?
- At what point should responsive/mobile layout be tuned relative to the desktop-aligned PSD pass?

## Deliberate Deferrals

Do not block the structural refactor on:

- pixel-perfect bevel matching for small ornamental controls
- breadcrumb overlay redesign
- perfect icon fidelity
- advanced mobile polish beyond keeping the layout functional
- replacing every text button with final icon assets immediately

## Immediate Next Step

Next work session should:

- continue integrating the preview with a real maximum-tile-size selection rule
- continue tuning preview sizing and centering against the stable max-size canvas
- continue PSD-tuning the settings dialog and selector treatment
- continue tuning the live `Game #` field text and interior fill/transparency
