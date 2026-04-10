# Settings Preview Area

## Purpose

Capture design and implementation notes for the Mahjongg settings dialog preview area separately from the main layout plan.

This note is for deciding:

- what the preview is supposed to communicate
- how large it needs to be to stay useful
- how it should scale across discrete dialog-size modes
- whether it should be schematic or rendered from the live board pipeline

## Current Direction

The settings dialog should not let the preview area become an accidental leftover region. It should be treated as a deliberate composition box whose size is protected by the dialog-sizing system.

Current working assumptions:

- the preview area is important enough to drive dialog sizing
- the dialog should grow in discrete size modes rather than fluidly autosizing
- extra size should mostly benefit the preview region rather than the selector list
- the preview should stay visually balanced with the selector column and confirm button

## Core Size Terms

Use the following terms consistently:

- `canvas size`
  - the full stable rendering surface for the preview
  - represents the complete coordinate space of all possible tile positions, not just the occupied footprint of one chosen layout
  - should be treated as stable for a given UI-size mode

- `layout size`
  - the occupied footprint of a specific selected layout within that canvas
  - this may vary significantly from one layout to another

- `preview size`
  - the actual pixel box available in the settings dialog preview area
  - determined by dialog-size mode, not by the selected layout

Important rule:

- the preview area should not change size based on layout choice
- different layouts should be rendered inside a stable canvas and preview box so the dialog does not jitter while the user browses options

## Canvas Size Rule

When determining `canvas size`, do not base it on the selected layout's occupied footprint alone.

Instead:

- determine the current UI-size mode
- determine the maximum allowed tile size for that UI-size mode
- derive the stable preview `canvas size` from that maximum tile size and the board coordinate space
- use that maximum allowed tile size even when the currently selected preview tile size is smaller
- smaller selected tile sizes should then render inside the same stable canvas and appear visibly smaller in the preview

This keeps the preview and dialog sizing stable while still allowing the actual rendered layout choice to vary inside the fixed canvas.

## First Implementation Strategy

For the first implementation pass, prefer keeping the preview system visible on-screen inside the dialog rather than immediately hiding it off-screen.

Why:

- it makes `canvas size`, `preview size`, and scale behavior easier to inspect in DevTools
- it allows visual verification that smaller tile sizes render smaller inside the same fixed canvas
- it gives a clearer way to debug UI-size mode decisions and maximum-allowed-tile-size behavior

Suggested first-pass workflow:

1. render the preview visibly inside the dialog preview area
2. measure the rendered preview container and board/canvas directly in the DOM
3. verify the chosen UI-size mode, max allowed tile size, canvas size, preview size, and resulting scale
4. only move measurement-specific work off-screen later if the pipeline still needs a hidden render phase

## Shared Render Tree Principle

The preview-source render tree should be the same structure in both debug and final modes.

Planned progression:

- first, render the preview-source tree visibly for debugging
- later, move that same tree off-screen for measurement/capture
- do not create a separate "debug render" tree and a different "real off-screen render" tree

Why:

- measurement and layout bugs found during debug remain relevant to the final pipeline
- the visible debug render is a truthful representation of the eventual off-screen source
- switching from visible to off-screen becomes a positioning change, not an architectural rewrite

Temporary debug layout may place:

- the preview-source render in a visible corner of the page
- the settings dialog in another corner so both the source canvas and scaled preview can be inspected at the same time

## Why Discrete Sizing

Discrete size classes are preferred over fluid autosizing because:

- the preview needs controlled dimensions to remain legible
- the dialog is a composed PSD-driven layout, not a generic responsive form
- tile style and tile size previews may need predictable pixel area
- the same runtime sizing logic that limits available tile sizes can also choose dialog-size modes

Likely pattern:

- `mj-settings-dialog-size-normal`
- `mj-settings-dialog-size-large`

Those classes can selectively override:

- dialog width and height
- selector width and height
- preview width and height
- spacing around tabs, preview, and confirm button

## Preview Roles

There are two main viable directions.

### 1. Schematic Layout Preview

Purpose:

- communicate the shape of the selected layout clearly

Strengths:

- works at smaller sizes
- cheaper to render
- easier to keep sharp and readable
- less sensitive to tile artwork fidelity

Weaknesses:

- does not reflect tile style very well
- less useful if the dialog is meant to preview the full final appearance

### 2. Rendered Board Preview

Purpose:

- communicate layout, tile style, and tile size together

Strengths:

- closer to the actual in-game result
- can respond to multiple settings at once
- makes the preview area much more useful, not just decorative

Weaknesses:

- needs more pixels to remain legible
- more expensive to generate
- likely requires discrete larger dialog sizes to be worthwhile

## Current Lean

Current lean is toward a rendered preview if the pipeline is practical, because:

- the dialog exposes `Layout`, `Tile Size`, and `Tile Style`
- a rendered preview can reflect all three together
- the app already has logic for generating a board from selected layout and settings

But the preview should still be designed so that:

- there is a minimum viable preview size
- the dialog can fall back to a smaller but still intentional size mode
- the selector column does not consume preview space unnecessarily
- layout choice changes the rendered content inside the preview, not the preview box dimensions themselves

## Size Guidance

The preview should be treated as the main beneficiary of larger dialog sizes.

Guideline:

- keep the selector area relatively stable
- let additional dialog space mostly enlarge the preview box

Questions to validate during implementation:

- what is the smallest preview size where layout differences remain obvious?
- what size is needed before tile style differences are actually visible?
- should the preview keep a fixed aspect ratio, or adapt to the selected layout?

## Implementation Notes

If the preview is rendered from live settings:

- cache or memoize by `(layout, tilesize, tileset)`
- refresh only when those inputs change
- avoid tying preview generation to every render pass

### Builder Pattern

Current intended architecture:

- the visible preview remains a normal React component
- that component creates and owns a non-component helper responsible for building the preview source render
- the helper may be something like `PreviewCanvasBuilder`
- that builder should initially live under `src/gc/features/mj/src/utils` because it is MJ-specific preview infrastructure rather than a shared app utility

Responsibilities of the builder:

- create and manage its own DOM host node
- mount a React render tree into that host
- manage rendering and updating of the preview-source node tree
- measure the rendered canvas/source area
- eventually capture or produce the image that the visible preview component can display

Important principle:

- the builder itself is not a React component
- but it may mount React components internally through its managed host/root
- the visible preview component should still own the builder lifecycle

Builder input contract:

- the builder should be initialized with the maximum allowed tile size for the current UI-size mode
- that maximum tile size is what should drive the stable preview `canvas size`
- after initialization, the builder should accept updates for:
  - selected tile size
  - selected tile style / tileset
  - selected layout

This allows:

- a stable canvas derived from the maximum allowed tile size
- live preview updates when the user changes tile size, tile style, or layout
- smaller selected tile sizes to render smaller inside the same fixed canvas

### Proposed Builder Interface

Current preferred interface is intentionally simple and callback-oriented.

Constructor:

- `constructor(root, { onRenderComplete })`

Primary setter methods:

- `setMaxTileSize(maxTileSize)`
- `setTileSize(tileSize)`
- `setTileStyle(tileStyle)`
- `setLayout(layout)`

Primary execution method:

- `generateRender()`

Completion:

- the builder should call `onRenderComplete(result)` when a render is ready

Why callback-first:

- the preview component can hook into it easily
- the builder can stay imperative
- the React component can update state directly when a render completes

Optional secondary consideration:

- `generateRender()` may also return a promise in addition to using the callback
- this is not required for the primary design, but may still be useful later for testing, sequencing, or non-React callers

### Render Scheduling

Do not render/capture immediately on every individual setter call.

Preferred first-pass approach:

- setters update builder state
- setters mark the builder dirty
- setters call a debounced `scheduleRender()`
- the debounce collapses rapid changes into one render/capture pass

Why debounce is preferred:

- layout, tile size, and tile style changes may arrive in bursts
- the dialog may initialize several preview inputs in quick succession
- collapsing rapid updates avoids redundant measurement and bitmap generation

Important distinction:

- debounce manages input timing
- a small post-render readiness step may still be needed after the debounced render fires so DOM/layout state is stable before capture

## First-Pass Class Sketches

These are implementation sketches, not final code contracts.

### 1. Visible Preview Component

```js
class SettingsPreview extends React.Component {
  constructor(props) {
    super(props);
    this.hostRef = React.createRef();
    this.state = {
      imageUrl: null,
      canvasSize: null,
    };
  }

  componentDidMount() {
    this.builder = new PreviewCanvasBuilder(this.hostRef.current, {
      onRenderComplete: this.onRenderComplete.bind(this),
    });

    this.pushPreviewInputs();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.maxTileSize !== this.props.maxTileSize ||
      prevProps.tileSize !== this.props.tileSize ||
      prevProps.tileStyle !== this.props.tileStyle ||
      prevProps.layout !== this.props.layout
    ) {
      this.pushPreviewInputs();
    }
  }

  componentWillUnmount() {
    if (this.builder) this.builder.destroy();
  }

  pushPreviewInputs() {
    this.builder.setMaxTileSize(this.props.maxTileSize);
    this.builder.setTileSize(this.props.tileSize);
    this.builder.setTileStyle(this.props.tileStyle);
    this.builder.setLayout(this.props.layout);
    this.builder.scheduleRender();
  }

  onRenderComplete(result) {
    this.setState({
      imageUrl: result.imageUrl,
      canvasSize: result.canvasSize,
    });
  }
}
```

### 2. Builder Sketch

```js
class PreviewCanvasBuilder {
  constructor(root, { onRenderComplete } = {}) {
    this.root = root;
    this.onRenderComplete = onRenderComplete;
    this.host = document.createElement('div');
    this.mountNode = document.createElement('div');
    this.host.appendChild(this.mountNode);
    this.root.appendChild(this.host);

    this.maxTileSize = null;
    this.tileSize = null;
    this.tileStyle = null;
    this.layout = null;
    this.renderHandle = null;
  }

  setMaxTileSize(maxTileSize) {
    this.maxTileSize = maxTileSize;
  }

  setTileSize(tileSize) {
    this.tileSize = tileSize;
  }

  setTileStyle(tileStyle) {
    this.tileStyle = tileStyle;
  }

  setLayout(layout) {
    this.layout = layout;
  }

  scheduleRender() {
    clearTimeout(this.renderHandle);
    this.renderHandle = setTimeout(this.generateRender.bind(this), 40);
  }

  generateRender() {
    // mount/update preview-source tree
    // measure canvas size
    // capture bitmap
    // call onRenderComplete(result)
  }

  destroy() {
    clearTimeout(this.renderHandle);
    // unmount render tree and clean up host
  }
}
```

### 3. Preview Source Tree Sketch

```js
<PreviewSource
  maxTileSize={maxTileSize}
  tileSize={tileSize}
  tileStyle={tileStyle}
  layout={layout}
/>
```

The important architectural point is:

- the same preview-source tree should be used in visible debug mode first
- later, that same tree should simply move off-screen rather than being reimplemented

Suggested lifecycle:

1. preview component creates the builder
2. builder creates a host and mounts the preview-source render tree
3. builder measures and/or captures the rendered result
4. preview component receives and displays the produced preview image
5. preview component disposes the builder on unmount

This keeps the source render pipeline reusable for both:

- visible debug mode
- later off-screen measurement/capture mode

If the preview is schematic:

- derive it directly from layout position data
- scale to fit a controlled preview box
- keep the rendering intentionally simple and legible

## Open Questions

- Should the preview prioritize layout legibility or tile-style fidelity?
- Should the preview box have one fixed aspect ratio across all layouts?
- Should larger dialog modes increase the preview only, or also the selector rows and tabs?
- At what point should preview generation be deferred until after the basic PSD layout is finalized?
