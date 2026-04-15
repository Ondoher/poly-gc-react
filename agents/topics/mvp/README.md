# MVP Topics

Use this topic for notes about the minimum viable release, first-pass scope, and what must be true for an initial public or friends-and-family launch.

Use this folder when the task involves:

- defining the first shippable scope
- deciding what is in or out for the initial launch
- tracking launch blockers versus nice-to-haves
- documenting the smallest coherent release plan

## Current Telemetry Direction

Current MVP telemetry assumptions are:

- each completed game is stored as one standalone record
- do not create a `sessionId`
- do not link multiple played games together
- telemetry consent changes apply to the active game immediately
- opted-in gameplay telemetry is sent when a game record completes
- a game record completes on win, loss, or starting a new game after any recorded moves

## Main Documents

- [MVP Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-checklist.md)
- [MVP Implementation Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-implementation-checklist.md)

## Suggested Reading Order

1. Start with [MVP Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-checklist.md) for the current first-release scope.
2. Use [MVP Implementation Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-implementation-checklist.md) for the coding and integration work needed to ship that scope.
