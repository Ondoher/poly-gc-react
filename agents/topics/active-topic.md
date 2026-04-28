# Active Topic

Current active topic: `sat-app`

Current focus: grow the `src/sat` app into a quick ASTRA satellite
pointing calculator with calculation steps and in-app math reference notes.

Current subtopic: first app mode solves forward pointing from one observer
city selected through a typeahead, then recommends the ASTRA orbital
neighborhood with the highest elevation angle; the prototype script's
multi-station inverse solver can become a later second mode.

Continuity notes:

- `src/sat` now contains a split calculator/reference app. `main/App.jsx`
  groups 11 ASTRA spacecraft into orbital neighborhoods, lets the user pick
  one city through a `cities.json` typeahead, recommends the highest-elevation
  ASTRA neighborhood, and computes city ECEF, satellite ECEF, local ENU,
  azimuth, elevation, and slant range.
- ASTRA recommendations require positive elevation. If every modeled slot is
  below the observer horizon, the app shows no visible pointing solution.
- Valid calculations are stored in an in-memory previous-results list, and
  selecting one restores that city for recalculation.
- Polylith 1.x serving uses the root `polylith.json` `apps` list as the app
  selection table: `polylith serve sat` serves only SAT, `polylith serve
  --all` serves all apps, and plain `polylith serve` serves the `default: true`
  app. The repo's `npm start` uses `polylith serve --all`, so SAT is included
  during normal repo-wide serving.
- The server-local untracked `polylith.prod.json` shallow-overrides the app
  list for `NODE_ENV=prod`; production should include only `gc` and `sat`, with
  `sat` as the default app. That file may also hold production certificate
  config, and Polylith's environment overlay is top-level shallow replacement.
- The app starts with no selected/seeded city and waits for a typeahead
  selection or manual latitude/longitude before calculating.
- The active topic folder exists at `agents/topics/sat-app`.
- `agents/topics/sat-app/notes.md` is copied to `dist/sat/docs/notes.md` and
  rendered by the app with `react-markdown`, `remark-math`, and
  `rehype-katex` so inline and block formulas render through KaTeX.
- Step-by-step calculation instructions also render formulas through the same
  KaTeX Markdown path.
- `builds/sat.json` copies KaTeX CSS into
  `dist/sat/assets/css/katex/katex.min.css`.
- City lookup now uses the npm `cities.json` package, with a filtered
  typeahead over package records.
- `npx polylith build sat` passed on 2026-05-18 after fixing the SAT build
  entry path and Polylith app name.
- General repo architecture rules still apply: React is presentation, app
  startup stays small, and Polylith build conventions should drive app wiring.

Additional reload sources:

- [SAT App](/c:/dev/poly-gc-react/agents/topics/sat-app/README.md)
- [SAT App Script Notes](/c:/dev/poly-gc-react/agents/topics/sat-app/script.js)
- [SAT App Notes](/c:/dev/poly-gc-react/agents/topics/sat-app/notes.md)
- [SAT App Entry](/c:/dev/poly-gc-react/src/sat/index.js)
- [SAT Main App](/c:/dev/poly-gc-react/src/sat/main/App.jsx)
- [SAT Main Bootstrap](/c:/dev/poly-gc-react/src/sat/main/main.jsx)
- [SAT CSS](/c:/dev/poly-gc-react/src/sat/assets/css/sat.css)

When switching topics, update this file with the new topic id from
[Topics Index](/c:/dev/poly-gc-react/agents/topics/README.md). On bootstrap,
load the active topic README after the lightweight shared context.

The user may ask to add extra reload sources here when a specific file is
important for continuity. Keep those sources focused and relevant. On
bootstrap, load listed additional sources after the active topic README.
