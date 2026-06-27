# Algorithm32 POC Implementations

This folder preserves the accepted Algorithm32 POC implementations in one
central location so future experiments do not have to rediscover code buried
inside individual runners. The copied runners have been reduced to pure,
importable implementation modules: no CLI entrypoints, no numbered artifact
writers, no image-output side effects.

This is not production code yet. These modules are the clean, tested POC basis
for the production Algorithm32 implementation. Production work should promote,
refine, and harden these modules into `shared/algorithm32/` outside this `POC`
folder instead of re-mining the old experiment runners.

## Promotion Role

- Treat this folder as the implementation starting point for production
  Algorithm32 work.
- Keep POC modules importable, deterministic, and free of runner/artifact side
  effects.
- Add experiment proof here or in adjacent POC lanes before promoting behavior
  into production.
- Move validated production contracts into `shared/algorithm32/` once they are
  ready to become the stable module boundary.

## Contents

- `source-contract/` - source and geometry config factories for distant
  directional Sun and flat/local point Sun.
- `bruneton-start-fresh/` - pared-down module for the original non-shader
  Algorithm32 base algorithm from `scripts/flat/experimental/`.
- `cpu/` - pure CPU Algorithm32 transport and CPU soft-shader postprocessor.
  The old runner filenames are compatibility re-export shims.
- `three/` - importable Three-native `Algorithm32AtmospherePass` POC class and
  accepted shader body, plus `local-second-order-renderer.js`, the reusable
  live Three scene-color/depth to Algorithm32 display-pass wrapper that
  prepares local incident cache textures and configures the final shader path.
- `local-second-order/` - reusable local Sun second-order POC cache helpers,
  including the direct local incident-field oracle, `z/rho/local-direction`
  cache builder, RGBA `Data3DTexture` packing metadata, and the accepted
  annual-tropic local finite-Sun source resolver used by the display pass.
- `atmosflat32/` - pure configurable flat/local Sun source and
  single-scattering helpers. The old `run.js` filename is a compatibility
  re-export shim.
- `validate-poc-imports.js` - smoke check for centralized POC imports plus
  small original-base, CPU distant, flat/local, and soft-shader execution
  checks.

## Validation

Run:

```text
node shared/algorithm32/POC/validate-poc-imports.js
```

This proves importability and small execution paths. Browser harnesses,
numbered artifacts, gallery layout, and validation criteria stay in the local
experiment lane; this POC folder owns the reusable code that feeds and runs
the display pixel path.
