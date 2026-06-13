# Scripts

This standard owns conventions for repository automation:

- script naming
- CLI argument shape
- generated output rules
- logging and progress output
- scratch versus maintained scripts

It does not own the domain meaning of script outputs. Move those facts to the
owning product or app.

## Current Boundary

The old scripts topic mixed general script conventions with Mahjongg tile CSS
and difficulty-analysis script details. During this restructure:

- general script conventions stay here
- Mahjongg tile CSS and difficulty script facts move under
  `products/game-collection/mahjongg-solitaire`
- Asset Pipeline 3D generation script facts move under
  `products/asset-pipeline-3d`
- SAT and Flat data-generation script facts move under their app docs

## General Guidance

The top-level `scripts` folder is mostly a working area for generation,
conversion, and maintenance helpers. Treat scripts as maintained repository
tooling when they support current work, but do not assume every script is
stable runtime infrastructure.

When script code grows beyond a thin command and stateless helpers, keep the
CLI file small and extract a runner, processor, or model with a clear owning
domain. Plain functions are still appropriate for utility modules that
transform one input into one output without carrying state.

Reusable operational helpers, such as production deployment scripts, should be
documented by the owning standards or app/deployment docs.
