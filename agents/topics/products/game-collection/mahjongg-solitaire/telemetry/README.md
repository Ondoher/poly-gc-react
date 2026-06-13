# Mahjongg Telemetry

Telemetry capture and analysis related to Mahjongg Solitaire behavior.

## Documents

- [Telemetry Analysis](telemetry-analysis.md)

## Current MVP-Era Facts

- Each completed game is stored as one standalone record.
- Telemetry consent changes apply to the active game immediately.
- Opted-in gameplay telemetry is sent when a game record completes.
- A game record completes on win, loss, or starting a new game after recorded
  moves.
