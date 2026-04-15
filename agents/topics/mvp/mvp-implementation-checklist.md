# MVP Implementation Checklist

Use this document to track the coding work required for the first meaningful
release.

This checklist is intentionally implementation-focused. Keep deeper domain
reasoning in the source topics:

- difficulty validation rationale stays in the difficulty topic
- PWA platform notes stay in the progressive web app topic
- deployment and hosting notes stay in the deployment topic

Track the actual MVP build-out here.

## Current MVP Direction

Current first-release scope assumes:

- a friends-and-family Mahjong release
- a simple deployment path
- installable-first PWA behavior
- feedback and telemetry focused on validating difficulty assumptions

## Frontend Feedback Flow

- [x] Wire the feedback dialog submit path to the frontend feedback model
- [x] Include board number, difficulty label, and layout title in the submitted feedback payload
- [x] Handle successful feedback submit with a clear user-facing confirmation
- [x] Handle failed feedback submit with a clear user-facing message while keeping the dialog open
- [x] Confirm the two-step feedback dialog fits at minimum supported viewport sizes
- [x] Confirm the feedback icon placement works at the smallest supported height

## Startup Consent And Preferences

- [x] Finalize the startup consent wording
- [ ] Confirm the startup dialog appears only when required values are missing
- [x] Persist telemetry consent in cookie-backed preferences
- [x] Persist preferred difficulty in cookie-backed preferences
- [x] Persist the approved first-pass settings in cookie-backed preferences
- [x] Restore saved preferences during startup
- [ ] Prevent telemetry from starting before consent is granted
- [x] Confirm the settings telemetry checkbox reflects and updates saved consent
- [x] Turning telemetry off affects the current game immediately

## Telemetry And Difficulty Validation

- [x] Confirm the first-pass gameplay metrics to collect
- [x] Do not create a `sessionId`; each completed game is stored as its own standalone record
- [x] Standalone completed-game records begin when a new game starts
- [x] Standalone completed-game records end on win, loss, or starting a new game after recorded moves
- [x] Restarts end the previous recorded game as abandoned and begin a new one
- [x] Capture board identity as `difficulty + layout + board number`
- [x] Count tiles played through the tile sequence
- [x] Count undo usage through the tile sequence
- [x] Count redo usage through the tile sequence
- [x] Keep peek usage out of MVP telemetry
- [x] Measure duration of play as total elapsed time
- [x] Capture game result as won, lost, or abandoned
- [x] Remaining tiles at game end stay out of the payload and can be inferred from the tile sequence
- [x] Hint usage and restart count stay out of MVP telemetry

## Feedback And Telemetry Backend

- [x] Confirm the shared feedback payload shape between UI and server
- [x] Confirm the Mongo collection shape for stored feedback
- [x] Verify the Polylith feedback route is registered and reachable
- [x] Verify `/gc/api/feedback` accepts and stores valid feedback
- [x] Send telemetry to `/gc/api/telemetry`
- [x] Send telemetry immediately when a session completes
- [x] Failed telemetry sends are dropped after the immediate send attempt
- [x] No local telemetry buffering is needed for MVP

## PWA Implementation

- [x] Choose the production app name and short name
- [x] Save the chosen `theme_color` value as `#6b2424`
- [x] Add manifest metadata
- [x] Add `start_url`
- [x] Add `scope`
- [x] Add `display`
- [x] Add `orientation: landscape`
- [x] Add `theme_color`
- [x] Add `background_color`
- [x] Add standard icons
- [x] Add a maskable icon
- [x] Link the manifest from the HTML template
- [x] Add `theme-color` metadata to the HTML template
- [x] Decide how the manifest and icons are copied into build output
- [ ] Confirm portrait fallback behavior for the first release
- [x] Keep offline support out of scope unless installability testing shows it is required
- [x] Do not add a service worker in the first pass unless it becomes necessary

## Validation And Release Readiness

- [x] Verify feedback submits successfully against the local server
- [x] Verify consent choice persists across reloads
- [x] Verify preferred difficulty persists across reloads
- [x] Verify saved settings persist across reloads
- [x] Verify standalone completed-game telemetry does not emit without consent
- [x] Verify structured feedback and telemetry payloads avoid personal content, acknowledging that free-form comments are user-supplied
- [ ] Verify the app is installable in its first-release PWA configuration
- [ ] Verify a second deploy still updates cleanly after the first PWA release

## Out Of Scope For MVP

- [x] Keep full portrait layout redesign out of MVP scope
- [x] Keep aggressive service worker caching out of MVP scope
- [x] Keep full per-action telemetry out of MVP scope unless validation needs force it
- [x] Keep deeper analytics/dashboard work out of MVP scope
