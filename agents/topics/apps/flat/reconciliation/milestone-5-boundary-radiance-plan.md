# Milestone 5 Boundary Radiance Plan

This plan is not a historical log. It records how the active reconciliation
lane intends to proceed from the current starting point.

## Goal

Prove the external-boundary-radiance contract before promoting anything into
production:

```text
pathRadiance + viewTransmittance * celestialRadiance
```

## Phase 1: Name The Boundary

- Define the provider or descriptor shape for `ExternalBoundaryRadiance`.
- Name the returned radiance field and selected-pixel diagnostics.
- Define how the provider reports no visible boundary body for a ray.
- Keep this shape separate from incident-radiance/L2 cache sampling.

Exit condition: the POC has a named role that can be implemented by stars,
Moon/planet analogs, and a source-owned Sun disk provider.

## Phase 2: Source-Owned Sun Disk

- Add a light-source companion visible-body provider for the Sun disk.
- Use source-owned direction or position, angular size/radius, spectrum or
  radiance facts, and source identity.
- Avoid a second owner for source data.
- Include selected-pixel diagnostics showing the Sun disk provider was used.

Exit condition: the POC can identify and compose a visible Sun disk through the
same boundary-radiance path planned for other celestial bodies.

## Phase 3: Controlled Celestial Samples

- Add dim synthetic star samples.
- Add at least one bright Moon/planet-like sample.
- Give each sample explicit radiance and footprint policy.
- Keep decorative backgrounds out of the provider list.

Exit condition: stars, bright analogs, and the Sun disk use one composition
point with different provider policies.

## Phase 4: CPU Or Soft-Shader Proof

- Run the first proof in the cheapest reliable lane: CPU/reference or CPU
  postprocess.
- Capture selected pixels for solar noon, sunset, and post-sunset conditions.
- Report `pathRadiance`, `viewTransmittance`, `celestialRadiance`, provider id,
  and final composed color for each selected pixel.
- Verify dim stars are buried by daytime atmosphere while bright bodies can
  survive when calibrated radiance and footprint justify it.

Exit condition: a fresh numbered record accepts or rejects the proposed
contract with enough diagnostics to explain the outcome.

## Phase 5: GPU / Browser Parity

- Port the accepted provider shape and composition point into the GPU/browser
  path.
- Compare selected pixels against the CPU or soft-shader proof.
- Keep renderer-captured scene RGB available for ordinary scene endpoints, but
  do not use it as the celestial visibility model.

Exit condition: GPU/browser evidence matches the accepted CPU/soft-shader
behavior within named tolerance.

## Phase 6: Promotion Decision

- Update the active design docs with the final provider names and data flow.
- Record unresolved facts in the active fact ledger.
- Promote only the accepted contract into `shared/algorithm32/production/`.
- Keep archived Mark I docs and artifacts as provenance only.

Exit condition: production receives a small accepted boundary-radiance contract,
not the whole reconciliation experiment.
