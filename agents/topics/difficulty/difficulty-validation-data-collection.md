# Mahjongg Difficulty Validation Data Collection

Use this document to track the first real-world data collection pass for
Mahjongg difficulty validation.

Implementation note:

- use [MVP Implementation Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-implementation-checklist.md) to track first-release coding work for consent, feedback, telemetry transport, and related launch integration

## Goal

Capture enough production play data to:

- reconstruct the exact generated board locally
- compare real player behavior against current analyzer assumptions
- see whether the named difficulty levels feel and behave as intended
- identify where the difficulty model is missing human-facing signals

This rollout is not trying to answer every future analytics question. The first
goal is narrower:

- identify the board the player saw
- capture a small set of meaningful play metrics
- keep the implementation simple enough to ship with the first deployment
- ask the player for telemetry permission before collecting play data
- let the player choose an initial difficulty level at startup

## Scope Split

This document intentionally covers two related concerns:

- the research goal for validating the difficulty model with live play data
- the product and implementation requirements needed to collect that data

The research goal explains why the rollout exists. The startup dialog, consent,
cookie-backed preferences, and settings requirements explain how the rollout can
ship responsibly in the app.

## Current Hypothesis

The current engine and analyzer assume that difficulty is shaped by:

- consequential same-face pair choices
- solve-order sensitivity
- dead-end timing
- overall board brutality versus forgiveness

The deployment exists to test whether real play behavior supports those
assumptions.

Examples of the questions this rollout should help answer:

- do harder levels lead to longer sessions and more abandoned games
- do harder levels cause more undo or redo usage
- do harder levels produce more peek usage
- do some layouts feel harsher or softer than the analyzer suggests
- do specific board numbers generate outlier behavior worth replaying locally

## Minimum Data Needed To Reconstruct A Board

These fields are the minimum board identity we want to capture:

- difficulty
- layout
- board number

Those three values should be enough to recreate the same board locally for
analysis and replay.

## Startup Experience Requirements

The first deployment should include a startup dialog that does two things:

- asks the player for permission to track play data
- asks the player to choose an initial difficulty level

The intention is:

- no telemetry collection before consent is granted
- a clear first-run moment where the player understands what is being asked
- a simple path into the game without requiring a later settings detour

The startup dialog should only appear when the required preference values are
not already stored.

## Rollout Requirements

The sections below describe the product requirements for the first live
difficulty-validation rollout:

- startup consent
- initial difficulty selection
- cookie-backed preference persistence
- settings-based telemetry control

## Persistence Requirements

The startup responses should be saved in one or more cookies.

At minimum, we need to persist:

- telemetry consent on or off
- initial selected difficulty
- user settings that should be restored across visits

If it simplifies the implementation, this can be stored as either:

- separate cookies for consent and preferred difficulty
- one combined preference cookie

For the first pass, the important thing is not the exact cookie shape. The
important thing is that:

- the app remembers the user choice across visits
- telemetry remains disabled unless consent is explicitly granted
- the startup dialog does not keep reappearing after the choice is saved
- supported settings can be restored without server-side state

## Settings Requirements

The settings UI should include a checkbox that allows the user to turn telemetry
tracking on and off later.

The broader settings state can also be stored in cookie-backed preferences so
the first deployment remembers user choices across visits.

The settings flow should:

- reflect the currently saved consent state
- update the stored cookie value when changed
- stop future telemetry capture if the user turns tracking off
- restore saved settings during startup when those settings are cookie-backed

For the first pass, difficulty can still be selected in the startup dialog even
if a richer settings treatment comes later.

If settings are stored this way, the cookie payload should stay limited to
small preference data rather than gameplay telemetry.

## First-Pass Session Data

These are the first real-world play metrics we want to capture:

- tiles played
- undo count
- redo count
- peek count
- duration of play

These should be paired with board identity so each play session can be read in
context.

## Recommended Extra Fields

These are not strictly required for the first pass, but they are high-value if
they are easy to add:

- session id
- started at timestamp
- ended at timestamp
- completion status such as won, lost, restarted, or abandoned
- remaining tiles at session end
- restart count
- hint count if hint remains part of normal gameplay
- consent source such as startup dialog or later settings change

## Suggested Event Model

The simplest useful model is a session-summary model.

Recommended first-pass events:

- `game_started`
- `game_finished`

Suggested `game_started` fields:

- sessionId
- difficulty
- layout
- boardNumber
- startedAt

Suggested `game_finished` fields:

- sessionId
- difficulty
- layout
- boardNumber
- durationMs
- tilesPlayed
- undoCount
- redoCount
- peekCount
- result
- remainingTiles

This is enough to start validating difficulty without committing to full
per-action telemetry yet.

## Consent And Preference Flow

Recommended first-pass flow:

1. On app startup, check whether telemetry consent and preferred difficulty are
   already stored.
2. If either value is missing, show the startup dialog.
3. Let the player choose whether telemetry tracking is allowed.
4. Let the player choose an initial difficulty level.
5. Save the responses to cookie-backed preferences.
6. Restore any previously saved settings that are also cookie-backed.
7. Start normal gameplay using the saved difficulty.
8. Only send telemetry for sessions where consent is enabled.

Recommended later control:

- a settings checkbox for telemetry on/off

If the settings checkbox is turned off after prior consent, future telemetry
should stop from that point forward.

## Future Event Expansion

If the first pass works and we want deeper reconstruction of player behavior, we
can later add per-action events such as:

- `tile_played`
- `undo`
- `redo`
- `peek`
- `hint`
- `restart`

That would let us study lines of play in more detail, but it is intentionally
not required for the first rollout.

## Progress Checklist

### Telemetry Scope

- [ ] Confirm the first-pass data fields
- [ ] Confirm whether result state should include abandoned sessions
- [ ] Confirm whether hint usage should be included in the first pass
- [ ] Confirm whether restart count should be included in the first pass
- [ ] Confirm the exact consent wording shown in the startup dialog

### Session Identity

- [ ] Define how `sessionId` will be created
- [ ] Define when a session starts
- [ ] Define when a session finishes
- [ ] Define how restarts affect session boundaries

### Board Reconstruction

- [ ] Confirm that `difficulty + layout + board number` is sufficient to recreate a board locally
- [ ] Document the exact local replay process
- [ ] Confirm the replay process uses the same runtime rules as production

### Metrics Capture

- [ ] Count tiles played
- [ ] Count undo usage
- [ ] Count redo usage
- [ ] Count peek usage
- [ ] Measure duration of play
- [ ] Capture session result
- [ ] Capture remaining tiles at session end

### Consent And Preferences

- [ ] Add a startup dialog for telemetry permission and initial difficulty selection
- [ ] Define when the startup dialog should appear
- [ ] Save telemetry consent in cookie-backed preferences
- [ ] Save preferred difficulty in cookie-backed preferences
- [ ] Decide which user settings should also be saved in cookie-backed preferences
- [ ] Save supported settings in cookie-backed preferences
- [ ] Prevent telemetry from starting before consent is granted
- [ ] Add a settings checkbox to turn telemetry on and off
- [ ] Update stored consent when the settings checkbox changes
- [ ] Restore saved settings during startup
- [ ] Confirm whether turning telemetry off should affect the current session or only future sessions

### Storage And Transport

- [ ] Decide where telemetry will be sent
- [ ] Decide whether events are sent immediately or batched
- [ ] Decide how failed sends are handled
- [ ] Decide whether anonymous local buffering is needed

### Privacy And Safety

- [ ] Keep the first-pass payload free of personal content
- [ ] Avoid collecting anything not needed for board reconstruction or difficulty validation
- [ ] Document what data is being collected for testers

### Validation

- [ ] Verify the startup dialog appears only when needed
- [ ] Verify consent choice persists across reloads
- [ ] Verify preferred difficulty persists across reloads
- [ ] Verify saved settings persist across reloads
- [ ] Verify sessions do not emit telemetry without consent
- [ ] Verify the settings checkbox correctly enables and disables telemetry
- [ ] Verify that a captured session can be tied back to the intended board
- [ ] Verify that a completed session writes the expected summary values
- [ ] Verify that restart, win, loss, and abandon paths behave correctly
- [ ] Verify that duration excludes obvious idle/test noise if needed

### Analysis Readiness

- [ ] Define the first analysis questions we want to answer from the data
- [ ] Define how sessions will be grouped by difficulty
- [ ] Define how sessions will be grouped by layout
- [ ] Define how outlier board numbers will be reviewed locally

## First Analysis Targets

Once data is flowing, the first comparisons should be simple:

- average duration by difficulty
- win/abandon rate by difficulty
- average undos by difficulty
- average redos by difficulty
- average peeks by difficulty
- outlier board numbers by unusually high duration or usage counts

Those comparisons should help tell us whether the real-world play pattern lines
up with the analyzer's current difficulty expectations.

## Current Status

Current status for this goal:

- telemetry goal is defined at a high level
- board reconstruction fields are identified
- first-pass summary metrics are identified
- startup consent and initial difficulty selection are now part of the first-pass scope
- settings-based telemetry opt-in/out is now part of the first-pass scope
- cookie-backed settings persistence is now part of the first-pass scope
- implementation has not started yet
