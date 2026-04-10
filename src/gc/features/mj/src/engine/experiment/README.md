## Engine Experiment

Use this folder to explore breaking the current Mahjongg engine into smaller parts without disturbing the active runtime implementation.

Current idea:

- extract board generation into a dedicated generator module
- narrow the engine toward a pure game-state machine
- keep event firing and UI orchestration outside those pieces

Suggested experiment shape:

- `BoardGeneratorExperiment.js`
  - generate a solvable board from a layout and game number
  - return board data and solution data without firing UI events
- `StateMachineExperiment.js`
  - accept state plus actions
  - return updated state and derived game data

This folder is for exploration only and should not be treated as production runtime code.

Use the MJ topic index as the documentation entry point for feature notes:

- [agents/topics/mj/README.md](/c:/dev/poly-gc-react/agents/topics/mj/README.md)
