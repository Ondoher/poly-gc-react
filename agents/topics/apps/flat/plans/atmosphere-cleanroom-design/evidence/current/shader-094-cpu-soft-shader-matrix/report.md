# CPU Unified Source-Driven Soft-Shader Matrix

Status: accepted

## Goal

Prove distant directional Sun and flat/local point Sun packets can run through one CPU soft-shader postprocess contract before browser shader implementation resumes.

## Summary

- Criteria: 56 passed, 0 failed.
- Cases: distant-high, distant-low, local-000deg, local-045deg, local-090deg, local-135deg, local-180deg.

## Aggregate Criteria

- unified-case-set-covered: passed.
- all-cases-accepted: passed.
- distant-and-local-source-families-covered: passed.
- single-postprocess-kernel-used: passed.
- distant-cases-continue-milestone-17-checks: passed.
- local-cases-continue-milestone-18-checks: passed.
- local-scene-light-adapter-deferred-explicitly: passed.

## Case Summary

- distant-high: accepted, distant-directional-sun, browser-lit-scene-input-capture.
- distant-low: accepted, distant-directional-sun, browser-lit-scene-input-capture.
- local-000deg: accepted, flat-local-point-sun, cpu-synthesized-unlit-scene-packet.
- local-045deg: accepted, flat-local-point-sun, cpu-synthesized-unlit-scene-packet.
- local-090deg: accepted, flat-local-point-sun, cpu-synthesized-unlit-scene-packet.
- local-135deg: accepted, flat-local-point-sun, cpu-synthesized-unlit-scene-packet.
- local-180deg: accepted, flat-local-point-sun, cpu-synthesized-unlit-scene-packet.

## Limits

- Distant cases use accepted browser lit/shadow scene packets and source-driven DirectionalLight.
- Local cases use accepted CPU-synthesized unlit scene packets; browser local point-light/proxy behavior remains deferred.
- Scene color remains the RGBA8/display-domain POC transport for browser distant cases.
