# CPU Algorithm32 POC

Pure importable CPU implementation extracted from the accepted shader-lab
runner code.

- `algorithm32-transport.js` owns the Algorithm32 constants, source-model
  builders, path-radiance transport, display conversion, and the external
  `incidentField` hook used by future local second-order work.
- `soft-shader.js` owns the CPU postprocess/soft-shader pixel loop over scene
  packets.
- `node-three-reference.js` and `cpu-scene-input-postprocessor.js` remain as
  compatibility re-export shims for older POC imports.
