# SAT App

This topic tracks the new `src/sat` application.

## Current State

The app is now a quick ASTRA geosynchronous satellite pointing calculator:

- `src/sat/index.js` starts the registry, imports configured features, and
  calls the app main function.
- `src/sat/main/main.jsx` mounts React into `#main-content`.
- `src/sat/main/App.jsx` renders the calculator, a single city typeahead,
  calculated pointing values, step-by-step math, and the Markdown reference
  panel.
- The step-by-step math uses the same `react-markdown`/`remark-math`/
  `rehype-katex` path as the reference panel, so formulas render as formatted
  KaTeX blocks.
- Valid city calculations are stored in an in-memory previous-results list.
  Selecting a previous result restores that city and recalculates its ASTRA
  recommendation.
- `src/sat/assets/css/sat.css` owns the split app layout and calculator
  presentation.
- `src/sat/templates/index.html` provides the app template shell.
- `agents/topics/sat-app/notes.md` is copied into `dist/sat/docs/notes.md`
  and rendered in-app with `react-markdown`, `remark-math`, and
  `rehype-katex`.
- KaTeX CSS is copied from `node_modules/katex/dist/katex.min.css` into
  `dist/sat/assets/css/katex/katex.min.css` by `builds/sat.json`.
- City lookup uses the npm `cities.json` package. The app imports its
  `name`, `country`, `lat`, and `lng` records, then filters matches into a
  typeahead dropdown.
- The app starts without a seeded city. Typeahead matches appear only after
  the user enters a city query, or the user can enter latitude/longitude
  manually.
- The app currently models 11 ASTRA spacecraft grouped by orbital
  neighborhood: ASTRA 4A at 5E, ASTRA 1KR/1L/1M/1N/1P at 19.2E,
  ASTRA 3B/3C at 23.5E, and ASTRA 2E/2F/2G at 28.2E. For pointing purposes,
  co-located spacecraft at the same longitude share the same idealized dish
  angles.
- After a city is selected, the app recommends the ASTRA neighborhood with
  the highest calculated elevation angle and shows the spacecraft at that
  slot.
- Recommendations require positive elevation above the local horizon. If every
  modeled ASTRA slot is below the horizon for the selected city, the app shows
  no visible ASTRA pointing solution instead of recommending a dish angle that
  points through the Earth.

## Working Direction

Use this topic for product direction, app shape, UI decisions, and any
satellite/geospatial domain model that emerges.

The first app mode solves the forward pointing problem for the recommended
ASTRA neighborhood and one observer city:

```text
ASTRA neighborhood longitude + GEO altitude + observer city
-> satellite ECEF
-> city WGS84 ECEF
-> station-to-satellite delta
-> local east/north/up
-> azimuth, elevation, slant range
```

The prototype script in `agents/topics/sat-app/script.js` also contains a
multi-station least-squares inverse solver. That can become a second mode when
the app needs to estimate a satellite position from observed azimuth/elevation
measurements.

General repo architecture still applies:

- keep startup small
- let Polylith build configuration and feature imports own app wiring
- treat React as presentation
- prefer registry-located services when the app grows beyond a simple shell

## Verification

- `npx polylith build sat` passed on 2026-05-18 after fixing the SAT app entry
  in `builds/sat.json` and adding the app name in `polylith.json`.
- The build copies `notes.md` to `dist/sat/docs/notes.md`, `sat.css` to
  `dist/sat/assets/css/sat.css`, and KaTeX CSS to
  `dist/sat/assets/css/katex/katex.min.css`.
- `npx polylith build sat` also passed after adding `cities.json`.
- `npx polylith build sat` passed after switching the Markdown renderer to
  `react-markdown` plus KaTeX formula support.
- `npx polylith build sat` passed after hardcoding ASTRA 19.2E and replacing
  the multi-city rows with a single city typeahead.
- `npx polylith build sat` passed after removing seeded city defaults and
  adding the blank observer-city empty state.
- `npx polylith build sat` passed after adding formatted KaTeX formulas to
  the step-by-step instructions.
- `npx polylith build sat` passed after adding ASTRA neighborhood selection by
  highest elevation.
- `npx polylith build sat` passed after adding the positive-elevation
  visibility gate.
- `npx polylith build sat` passed after adding previous-result switching.

## Polylith Serving Notes

This repo uses Polylith 1.x behavior from `c:/dev/polylith`, not the 2.0
version.

The root `polylith.json` `apps` list is the selection table. Each entry needs
`name`, `filename`, `code`, and optionally `default`.

- `polylith serve sat` loads only the `sat` app spec from `polylith.json`.
- `polylith serve --all` loads every app spec.
- `polylith serve` with no app name loads the app where `default: true`.
- The current npm `start` script runs `polylith serve --all`, so normal
  repo-wide serving includes SAT along with the other apps.
- The current `dev` script also watches all apps and starts `npm run
  dev:serve`, whose nodemon config executes `npm start`.
- The server-local untracked `polylith.prod.json` intentionally replaces the
  root `apps` list when `NODE_ENV=prod`; production should be limited to `gc`
  and `sat`, with `sat` marked as the default app.
- That same server-local production override may also hold certificate
  configuration. Polylith merges top-level config shallowly, so `apps` and
  `https` each replace the root value entirely when present.

Server routing then uses each selected app's `routerRoot` from its build config
or defaults to `/<app-name>`. The SAT app therefore serves under `/sat` when it
is included.

## Related Paths

- [SAT source](/c:/dev/poly-gc-react/src/sat)
- [SAT entry](/c:/dev/poly-gc-react/src/sat/index.js)
- [SAT app component](/c:/dev/poly-gc-react/src/sat/main/App.jsx)
- [SAT CSS](/c:/dev/poly-gc-react/src/sat/assets/css/sat.css)
- [SAT bootstrap](/c:/dev/poly-gc-react/src/sat/main/main.jsx)
- [SAT template](/c:/dev/poly-gc-react/src/sat/templates/index.html)
