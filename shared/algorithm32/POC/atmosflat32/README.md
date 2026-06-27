# Atmosflat32 POC

Pure importable flat/local Sun implementation extracted from the accepted
`scripts/flat/atmosflat32/run.js` lane.

- `local-sun.js` owns the configurable distant/local source factories and
  single-scattering helper.
- `run.js` remains as a compatibility re-export shim for older POC imports.

There is no direct runner behavior in this folder.
