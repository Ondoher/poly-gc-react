# MJ Play Animations

Use this note to track animation ideas for live Mahjongg play interactions.

The current tile system has a few important constraints:

- tiles are absolutely positioned with generated `left`, `top`, and `z-index`
- tile sides and shadows are baked into the tile images
- the current hint highlight already uses a `highlight:after` overlay on the face element
- movement across the board is riskier than face-local emphasis because overlapping tiles can expose visual conflicts

Because of those constraints, the first animation passes should favor:

- face-local overlays
- brightness and glow treatment
- opacity changes
- small scale changes
- board-level transitions

The first evaluation pass should go from conservative to more exciting.

## Shared Timing Source

When one animation timing needs to be used by both CSS and JavaScript, the
preferred MJ pattern is:

1. define the timing token as a CSS custom property in `mj.css`
2. expose that value through the `mj:css-vars` service
3. let an MJ service such as `mj:controller` precache and parse the timing
   values it needs
4. pass the resulting timing object down to React components as props

This keeps the timing source of truth in CSS while still allowing JavaScript
timers such as `setTimeout(...)` to stay aligned with live animation durations.

The current service contract is intentionally simple:

- `mj:css-vars.precache(names)` caches a known set of CSS custom properties
- `mj:css-vars.get(name)` returns one cached value, or reads it synchronously on
  demand when it was not cached yet

The CSS side must provide a documented readiness sentinel such as
`--mj-css-ready: 1`, because the service startup path depends on that contract
to know when the stylesheet has become available.

Practical rule:

- if the timing affects both CSS animation declarations and JavaScript behavior,
  do not duplicate the number in both places
- define one CSS variable, then read it through `mj:css-vars`

## Interaction Targets

The current gameplay/UI events worth animating are:

- hints
- peek
- undo
- redo
- selection
- normal pair play / tile removal
- solve dialog playback / solution stepping

These do not all need the same animation language.

A useful framing is:

- guidance events
  - hints
  - peek
- state feedback events
  - selection
  - undo
  - redo
- outcome events
  - normal pair play / tile removal
  - solve dialog playback / solution stepping

That split matters because guidance effects should usually be clearer and calmer,
while removal and playback effects can be a little more stylized.

## Conservative To Exciting

### 1. Hint Pulse

- reuse the current highlight mechanism
- animate brightness, glow, or opacity on the face overlay
- apply to the hinted pair only

Why it is safe:

- no movement
- already aligned to the current hint system
- stays close to the existing visual language

### 2. Selection Emphasis

- add a very small brighten, face wash, or tiny lift on the selected tile
- use the face overlay where possible

Why it is safe:

- small effect
- low risk of overlap artifacts
- improves click/tap feedback immediately

### 3. Undo/Redo Pulse

- briefly pulse or brighten tiles affected by undo or redo
- prefer face-local emphasis over tile-box shadows

Why it is safe:

- short-lived
- informative rather than decorative
- easy to understand during play

### 4. Match Glow Then Fade

- matched pair gets a bright face glow
- then fades out

Why it is a good early removal animation:

- no board travel required
- low collision risk
- communicates removal clearly

### 5. Match Glow Plus Fade And Slight Shrink

- glow first
- fade opacity
- add a small scale-down toward the center

Why it is a good next step:

- more satisfying than pure fade
- shrinking reduces overlap risk instead of increasing it

### 6. Shrink To Center With Endpoint Flash

- tile contracts inward
- a small flash or face burst happens at the end
- then the tile disappears

Why it is interesting:

- more stylized but still compatible with the baked tile imagery
- keeps the motion inside the existing tile footprint

Main caution:

- easy to overdo
- flash should stay brief and face-local

### 7. Available-Move Emphasis

- softly pulse all currently open matching candidates
- likely for tutorial, hint, or assist modes only

Why it is useful:

- supports discoverability
- could help newer players

Main caution:

- can become noisy if used constantly

### 8. Win-State Tile Shimmer

- staggered glow or brightness passes across visible tiles after a win
- keep the motion subtle and short

Why it is feasible:

- board-level celebration is less sensitive to exact per-move readability

### 9. Board-Level Zoom / Focus Motion

- expand/contract board transitions
- stage scaling
- subtle opacity and spacing easing

Why it belongs on the list:

- not a tile-removal effect, but it is part of live play motion
- already partially implemented and should continue to be tuned

### 10. Sideways Pair Drift On Removal

- matched pair drifts slightly outward before disappearing

Why it is lower on the list:

- legal moves are more open than arbitrary tiles
- but overlap and baked-shadow conflicts still make this risky

Status:

- possible in a constrained way
- should be tested only after safer non-travel effects

## Current Recommendation

Try these first, in order:

1. `Hint pulse`
2. `Match glow then fade`
3. `Match glow plus fade and slight shrink`
4. `Shrink to center with endpoint flash`

This order starts with the safest face-local emphasis and moves gradually toward more stylized removal effects.

## Priority By Visibility In Normal Play

If animation work is prioritized by what players are most likely to see
regularly during normal play, start in this order:

1. `Play animation`
2. `Generate board`
3. `Selection`
4. `Hint`
5. `Undo / redo`
6. `Peek`
7. `Solve playback`
8. `Win-state polish`

Why this order:

- `Play animation` sits at the center of the main game loop
- `Generate board` is the first impression for every new board
- `Selection` is frequent interaction feedback
- `Hint`, `undo`, and `redo` are recurring but not constant
- `Peek` and `solve playback` are more occasional tools
- win-state polish matters, but it is encountered less often than the core play loop

## Candidate Mapping By Interaction

### Hints

- hint pulse
- face-local glow
- gentle repeating emphasis while active

### Peek

- board-level dim or reveal treatment
- optional soft pulse on newly exposed understanding cues

### Selection

- small brighten
- tiny lift or settle
- face wash overlay

### Undo

- pulse the restored pair
- brief brighten on the returned tiles

### Redo

- pulse or brighten the removed pair before exit
- use the same removal language as normal play if possible

### Normal Pair Play

- glow then fade
- glow plus fade and slight shrink
- shrink to center with endpoint flash

### Solve Playback

- use a calmer version of the normal pair-play effect
- avoid anything so dramatic that it becomes noisy over many repeated moves
- hint-style pacing may work better than flashy removal pacing

## Follow-Up: Audio Cues

Small matching sound cues may be worth pairing with the visual animation pass later.

Initial candidates:

- light tile-select chirp
- soft blocked / invalid click tick
- subtle matched-pair confirmation chirp
- optional hint cue, if it does not become annoying

Free places to look first:

- Kenney
  - https://kenney.nl/assets?q=audio
- Pixabay sound effects
  - https://pixabay.com/sound-effects/
- Freesound
  - https://freesound.org/
- OpenGameArt
  - https://opengameart.org/

Useful search terms:

- `ui chirp`
- `soft blip`
- `menu tick`
- `light click`
- `confirm beep`

Main caution:

- keep the sounds very short and soft
- avoid anything arcade-loud or repetitive enough to become tiring during normal play
