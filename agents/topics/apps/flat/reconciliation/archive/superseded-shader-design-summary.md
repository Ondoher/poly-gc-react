# Reconciliation Shader Design

This archived summary is superseded by the active Milestone 5 boundary-radiance
design and plan. Older shader notes live in this archive.

## Active Composition

The shader proof should add a camera-ray external boundary-radiance sample and
compose it with atmosphere output as:

```glsl
displayRgb = pathRadianceDisplayRgb
  + viewTransmittanceDisplayRgb * celestialRadianceDisplayRgb;
```

Names may change during implementation, but the roles should remain separate:

- `pathRadiance`: atmosphere radiance integrated along the view path.
- `viewTransmittance`: attenuation from the camera to the atmosphere boundary
  or visible body.
- `celestialRadiance`: radiance supplied by a boundary provider for a visible
  outside-atmosphere body.

## Required Proof Cases

- Dim synthetic stars are buried by bright daytime atmosphere.
- The same stars are visible when the sky path radiance/transmittance allows
  them at night.
- A bright disk, starting with a source-owned Sun disk provider and later Moon
  analog, can remain visible through the same path when its calibrated
  radiance and footprint justify it.
- Captured renderer scene RGB is not used as the physical star visibility
  model.

## Integration Boundary

The proof may start CPU/reference or CPU postprocess, but promotion needs a
GPU/browser comparison through the existing composer architecture:

```text
RenderPass(scene, camera)
  -> SceneInputCapture
  -> ShaderRuntimePass
  -> Color-owned display composition
```

Decorative app backgrounds should remain outside the physical
boundary-radiance path unless a provider explicitly turns them into radiance.
