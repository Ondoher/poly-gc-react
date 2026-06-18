# Reference Stage Contracts

This document is the canonical input/output contract for the CPU spectral
atmosphere reference pipeline. Code, tests, fixtures, reports, and later shader
parity notes should reference this file for packet shape decisions.

The surrounding design docs explain why the model exists. This file says what
each stage consumes, what it produces, which facts it owns, and which facts
must remain owned elsewhere.

## Scope

This file owns physical stage packet contracts. The
`CpuSpectralReferenceIntegrator` facade contract, including request/default
merging, cloning, constructor validation, probe resolution, `runStage`,
`runUntil`, `traceRay`, custom-stage support boundaries, and the public result
boundary, lives in [Reference Code Design](code_design.md#integrator-facade-contract).

## Contract Rules

- One fact has one owner. Later stages consume the owning stage's packet field
  instead of re-querying models or reading alternate top-level packet aliases.
- Output fields are selected by downstream need, diagnostic value, and
  recomputation cost. Cheap values should be carried only when they prevent
  ambiguity or repeated model calls.
- Source inputs remain immutable. Stages append derived data; they do not
  silently rewrite the model, observer, ray, wavelength grid, numerical
  controls, source properties, surface properties, or previous stage outputs.
- When producer and consumer expectations disagree, update this contract first,
  then update code, fixtures, tests, and docs to the same shape. Do not support
  legacy aliases unless a migration bridge is explicitly requested.
- Each stage validates the packet fields and model-returned values it consumes,
  even if an upstream stage normally produces valid data.
- Stage code validates the input shape it consumes while tolerating unrelated
  extra fields. Code may require field absence when the input contract defines
  mutually exclusive alternatives. Tests may include extra input fields, then
  assert the contracted output fields and values. Tests may assert field
  absence when mutually exclusive alternatives, or explicit removal behavior,
  are part of the stage contract.
- Display, exposure, tone mapping, report formatting, and color conversion are
  post-pipeline consumers. They do not enter the physical transport stages.

## Units

- Position, distance, interval length, and path weights: kilometers.
- Wavelength: nanometers.
- Extinction, scattering, and absorption coefficients: `1 / km`.
- Optical depth: unitless.
- Transmittance: unitless, physically valid range `[0, 1]`.
- Spectral radiance: `W / m2 / sr / nm`.
- Spectral irradiance: `W / m2 / nm`.
- Phase function values: `1 / sr`.

## Common Packet Fields

The initial packet is created from a trace request and may contain convenience
copies of request fields. After `validateRequest`, downstream stages should use
`validatedRequest` as the canonical request source.

```js
{
  request,
  stageHistory: []
}
```

`stageHistory` is public diagnostic history only. It records which stage ids
ran successfully in order and is not a physical input.

## Canonical Stage Order

The canonical order is:

```text
validateRequest
resolveRayPath
sampleViewPath
evaluateMedium
integrateViewOpticalDepth
integrateSolarTransmittance
evaluateScatteringPhase
integrateSingleScattering
integrateDiffuseSkyAirlight
resolveSurfaceRadiance
composeSpectralRadiance
```

The declarative registry in
`scripts/flat/atmosphere/reference/pipeline-stages.js` should mirror the
top-level `requires` and `provides` fields in this document. Detailed nested
shapes belong here and in the ambient `types.d.ts` implementation mirror.

## `validateRequest`

Purpose: validate physical/numerical request input and establish the canonical
request packet field.

Consumes:

```js
{
  request: {
    model,
    observer: { positionKm },
    ray: { direction },
    wavelengthsNm,
    numerical
  }
}
```

Produces:

```js
{
  validatedRequest: {
    model,
    observer: {
      positionKm
    },
    ray: {
      direction
    },
    wavelengthsNm,
    numerical
  }
}
```

Ownership:

- `validateRequest` owns request-shape validation, finite observer position
  validation, ray-direction normalization, wavelength-grid validation, model
  interface presence checks, and numerical-control validation.
- It emits the canonical `validatedRequest` fields listed above. Request-level
  physical coefficient fields, display/report consumer fields, and other
  unrelated extras are tolerated as input and do not change the contracted
  output fields.
- It drops unknown numerical keys from `validatedRequest.numerical`; later
  stages only consume known controls.

Downstream use:

- All physical stages after `validateRequest` read the model, observer, ray,
  wavelength grid, and numerical controls from `validatedRequest`.
- `ray.direction` is a unit vector, so ray parameters and sample distances are
  kilometers.

## `resolveRayPath`

Purpose: choose the camera-ray atmosphere transport segment from model-owned
atmosphere and surface intersections.

Consumes:

```js
{
  validatedRequest: {
    model,
    observer,
    ray
  }
}
```

Model calls:

```js
const transportRay = {
  originKm: validatedRequest.observer.positionKm,
  direction: validatedRequest.ray.direction
};

model.atmosphere.intersect(transportRay);
model.world.intersectSurface(transportRay);
```

Produces:

```js
{
  rayPath: {
    isEmpty,
    viewSegment: {
      startKm,
      endKm,
      lengthKm
    },
    boundaryReason,
    boundaryId,
    surfaceHit,
    metadata
  }
}
```

Ownership:

- The model owns geometry intersection math. This stage owns ordering,
  clipping, empty-path classification, and boundary precedence.
- `surfaceHit` is carried only when it is the visible endpoint or the reason
  for an empty path. A surface behind the observer or after atmosphere exit is
  not a selected surface endpoint.
- Flat horizontal or unbounded atmosphere paths must fail unless the model
  supplies a finite named boundary.

Downstream use:

- `sampleViewPath` consumes `rayPath.viewSegment`.
- `resolveSurfaceRadiance` consumes `rayPath.surfaceHit` when a surface is
  visible.
- Diagnostics consume `boundaryReason`, `boundaryId`, and `metadata`.

## `sampleViewPath`

Purpose: turn the selected view segment into numerical integration samples.

Consumes:

```js
{
  validatedRequest: {
    numerical
  },
  rayPath: {
    isEmpty,
    viewSegment
  }
}
```

Produces:

```js
{
  viewSamples: [
    {
      sampleIndex,
      distanceFromObserverKm,
      weightKm,
      intervalStartKm,
      intervalEndKm,
      integrationMethod
    }
  ],
  viewSampleMetadata: {
    integrationMethod,
    sampleCount,
    pathLengthKm
  }
}
```

Ownership:

- This stage owns sample placement, interval endpoints, sample weights, and
  sample-count metadata.
- The initial method is fixed midpoint integration. If integration methods are
  later generalized, the method registry becomes the source of truth for valid
  method ids and sampling behavior.
- Empty and zero-length paths produce `viewSamples: []`; no epsilon sample is
  invented.

Downstream use:

- `evaluateMedium` consumes sample distances and interval weights.
- `integrateViewOpticalDepth` consumes the propagated `weightKm` and
  `intervalEndKm` after `evaluateMedium`.

## `evaluateMedium`

Purpose: evaluate model-owned medium state at each view sample and emit
downstream-ready transport/scattering coefficients.

Consumes:

```js
{
  validatedRequest: {
    model,
    observer,
    ray,
    wavelengthsNm
  },
  viewSamples
}
```

Model calls:

```js
positionKm = observer.positionKm + ray.direction * distanceFromObserverKm;
altitudeKm = model.world.altitudeAt(positionKm);
mediumState = model.atmosphere.mediumAt(positionKm, { wavelengthsNm, sample });
```

Produces:

```js
{
  mediumSamples: [
    {
      sampleIndex,
      distanceFromObserverKm,
      weightKm,
      intervalStartKm,
      intervalEndKm,
      integrationMethod,
      positionKm,
      altitudeKm,
      profile,
      coefficients: {
        extinctionByWavelength,
        scatteringByWavelength,
        absorptionByWavelength,
        derivation
      },
      species: [
        {
          name,
          extinctionByWavelength,
          scatteringByWavelength,
          absorptionByWavelength,
          phase
        }
      ]
    }
  ]
}
```

Ownership:

- `sampleViewPath` owns sample interval geometry; this stage preserves it.
- `world.altitudeAt` owns geometric altitude. `atmosphere.mediumAt` must not be
  treated as another altitude source.
- `evaluateMedium` owns coefficient total derivation. Totals may come from
  model totals, species summation, or absorption-plus-scattering derivation.
  Duplicate model data must agree or fail loudly.
- Valid vacuum/outside-atmosphere samples emit explicit zero coefficient arrays
  aligned to `validatedRequest.wavelengthsNm`.
- Profile diagnostics and species diagnostics are model-owned data that this
  stage validates and preserves when supplied.

Downstream use:

- `integrateViewOpticalDepth` consumes
  `mediumSample.coefficients.extinctionByWavelength`, `weightKm`, and species
  extinction diagnostics.
- `integrateSolarTransmittance` consumes `positionKm`.
- `evaluateScatteringPhase` consumes species phase metadata when present.
- `integrateSingleScattering` consumes scattering coefficients, sample weights,
  and species/component identities.
- Diagnostics consume altitude/profile/composition/coefficient derivation data.

## `integrateViewOpticalDepth`

Purpose: integrate camera-to-sample and camera-to-path-end optical depth and
view transmittance.

Consumes:

```js
{
  validatedRequest: {
    wavelengthsNm
  },
  mediumSamples
}
```

Produces:

```js
{
  viewOpticalDepth: {
    samples: [
      {
        sampleIndex,
        distanceFromObserverKm,
        cumulativeOpticalDepthByWavelength,
        viewTransmittanceByWavelength,
        speciesOpticalDepth: {
          [speciesName]: {
            cumulativeOpticalDepthByWavelength
          }
        }
      }
    ],
    pathEnd: {
      distanceFromObserverKm,
      cumulativeOpticalDepthByWavelength,
      viewTransmittanceByWavelength,
      speciesOpticalDepth: {
        [speciesName]: {
          cumulativeOpticalDepthByWavelength
        }
      }
    }
  }
}
```

Ownership:

- The wavelength grid comes only from `validatedRequest.wavelengthsNm`.
- Sample weights and interval endpoints remain owned by `mediumSamples`; this
  stage uses them but does not duplicate them in each output sample.
- Species optical-depth diagnostics are cumulative through each sample.
- Source-path visibility and source-path transmittance are out of scope.

Downstream use:

- `integrateSingleScattering` consumes per-sample view transmittance.
- `resolveSurfaceRadiance` consumes `pathEnd.viewTransmittanceByWavelength`.
- Diagnostics consume sample and path-end optical depths.

## `integrateSolarTransmittance`

Purpose: integrate source-to-sample and source-to-surface transmittance for
model-owned solar source samples.

Consumes:

```js
{
  validatedRequest: {
    model,
    wavelengthsNm,
    numerical
  },
  mediumSamples,
  rayPath
}
```

Model calls:

```js
model.solarSource.samplesAt(positionKm, undefined, numerical);
model.solarSource.transmittanceSegment(positionKm, sourceSample, {
  wavelengthsNm,
  mediumSample,
  numerical
});

model.solarSource.transmittanceSegment(surfacePositionKm, sourceSample, {
  wavelengthsNm,
  surfacePoint,
  numerical
});
```

Produces:

```js
{
  solarTransmittance: {
    samples: [
      {
        sampleIndex,
        distanceFromObserverKm,
        positionKm,
        sourceSamples: [
          {
            sourceSampleIndex,
            sourceSampleId,
            direction,
            weight,
            solidAngleSr,
            sourceSpectrum,
            boundaryReason,
            visible,
            pathLengthKm,
            opticalDepthByWavelength,
            sourceTransmittanceByWavelength
          }
        ]
      }
    ],
    surfacePoint,
    metadata: {
      sampleCount,
      sourceSampleCount,
      includesSurfacePoint
    }
  }
}
```

`sourceSpectrum` is model-supplied source energy data carried for downstream
radiance stages:

```js
{
  kind: 'spectral-radiance' | 'spectral-irradiance',
  valuesByWavelength,
  units,
  derivation
}
```

`surfacePoint` is optional and present when `rayPath.surfaceHit` is a visible
surface endpoint:

```js
{
  distanceFromObserverKm,
  positionKm,
  surfaceHit,
  sourceSamples: [/* same source sample output shape */]
}
```

Ownership:

- Solar-source geometry, finite-disk sampling, source spectrum, visibility,
  occlusion, and source-path segment selection are model-owned.
- This stage owns Beer-Lambert integration over model-returned source-path
  segment samples.
- For a model-declared occluded source sample, `visible` is `false`,
  `sourceTransmittanceByWavelength` is a zero array, and
  `opticalDepthByWavelength` is `null`.
- Visible source-path segment samples must carry finite nonnegative `weightKm`
  values and finite nonnegative extinction arrays aligned to
  `validatedRequest.wavelengthsNm`.

Downstream use:

- `evaluateScatteringPhase` consumes source directions and sample ids.
- `integrateSingleScattering` consumes source spectrum, source transmittance,
  source weight/solid angle, and visibility.
- `resolveSurfaceRadiance` consumes `surfacePoint` source samples for direct
  surface irradiance.
- Diagnostics consume source path lengths, boundary reasons, visibility, and
  source optical depth.

Current implementation alignment:

- The current green implementation covers `samples`, source metadata,
  source direction, `sourceSpectrum`, visibility, path length, optical depth,
  transmittance, optional `surfacePoint`, and metadata counts.
- `pipeline-stages.js`, `types.d.ts`, stage code, and direct tests are aligned
  with the top-level `validatedRequest`, `mediumSamples`, and `rayPath`
  prerequisites for this stage.

## `evaluateScatteringPhase`

Purpose: compute angular phase terms that convert source light into the camera
ray.

Consumes:

```js
{
  validatedRequest: {
    ray,
    wavelengthsNm
  },
  mediumSamples,
  solarTransmittance
}
```

Produces:

```js
{
  scatteringPhase: {
    samples: [
      {
        sampleIndex,
        sourceSamples: [
          {
            sourceSampleIndex,
            sourceSampleId,
            cosTheta,
            scatteringAngleRad,
            species: [
              {
                name,
                phaseKind,
                parameters,
                phaseByWavelength
              }
            ]
          }
        ]
      }
    ],
    metadata: {
      convention,
      sampleCount,
      sourceSampleCount
    }
  }
}
```

Ownership:

- The sign convention is canonical here:
  `cosTheta = dot(sourceDirectionFromSample, directionFromSampleToCamera)`,
  where `directionFromSampleToCamera = -validatedRequest.ray.direction`.
- Rayleigh, Henyey-Greenstein/Mie, and future cloud phase values are evaluated
  here, not during single-scattering accumulation.
- Phase-function parameters come from `mediumSamples.species[].phase` or the
  selected medium model diagnostics; this stage does not invent aerosol or
  cloud parameters.
- The implemented phase kinds are `isotropic`, `rayleigh`, and
  `henyey-greenstein`. Positive-`g` Henyey-Greenstein uses the stage's recorded
  local sign convention so aerosol forward scattering aligns with a low-Sun
  camera ray.
- Species without phase metadata stay out of the phase list rather than
  inventing a model-owned phase function.
- Metadata records the convention plus medium/source sample counts for
  downstream diagnostics.

Downstream use:

- `integrateSingleScattering` consumes phase values by sample/source/species.
- Diagnostics consume angle convention, cosine, and scattering angle.

## `integrateSingleScattering`

Purpose: accumulate single-scattered spectral radiance along the camera ray.

Consumes:

```js
{
  validatedRequest: {
    wavelengthsNm
  },
  mediumSamples,
  viewOpticalDepth,
  solarTransmittance,
  scatteringPhase
}
```

Produces:

```js
{
  singleScattering: {
    samples: [
      {
        sampleIndex,
        sourceSamples: [
          {
            sourceSampleIndex,
            sourceSampleId,
            species: [
              {
                name,
                contributionByWavelength
              }
            ],
            contributionByWavelength
          }
        ],
        contributionByWavelength
      }
    ],
    components: {
      bySpecies: {
        [speciesName]: {
          radianceByWavelength
        }
      },
      rayleighInScatteredRadianceByWavelength,
      mieInScatteredRadianceByWavelength,
      cloudInScatteredRadianceByWavelength
    },
    inScatteredRadianceByWavelength
  }
}
```

Ownership:

- This stage owns the single-scattering product:
  `T_view * beta_sca * phase * source * T_source * ds`.
- It consumes source energy and transmittance from
  `integrateSolarTransmittance`, phase values from `evaluateScatteringPhase`,
  scattering coefficients and sample weights from `mediumSamples`, and view
  transmittance from `viewOpticalDepth`.
- It does not compute surface radiance, diffuse sky irradiance, display color,
  or multiple scattering.

Downstream use:

- `composeSpectralRadiance` consumes
  `singleScattering.inScatteredRadianceByWavelength`.
- Diagnostics consume component and per-species contribution summaries.

## `integrateDiffuseSkyAirlight`

Purpose: add a named, explicitly approximate higher-order diffuse sky airlight
component for high-optical-depth low-elevation views. This stage owns the
bounded diagnostic approximation separately from canonical single scattering
and reports aerosol/flat-geometry diagnostics for the bounded formula.

Consumes:

```js
{
  validatedRequest: {
    wavelengthsNm,
    numerical: {
      diffuseSkyAirlightStrength
    }
  },
  viewOpticalDepth,
  solarTransmittance,
  singleScattering
}
```

Produces:

```js
{
  diffuseSkyAirlight: {
    mode,
    radianceByWavelength,
    renderedSinglePlusSkyAirlightByWavelength,
    diagnostics: {
      activation,
      activationTau,
      activationPolicy,
      strength,
      lostViewTransmittanceByWavelength,
      sourceSpectrumByWavelength,
      canonicalSingleScatteringByWavelength,
      aerosolOpticalDepthByWavelength,
      aerosolOpticalDepthFractionByWavelength,
      maxAerosolOpticalDepth,
      aerosolSaturationByWavelength,
      aerosolParticipationByWavelength,
      neutralSourceSpectrum,
      neutralMixByWavelength,
      aerosolGainByWavelength,
      aerosolPolicy,
      tauRegime,
      flatGeometryLimitPolicy,
      contract,
      approximationWarning
    }
  }
}
```

Ownership:

- This stage owns only a named approximation to higher-order atmospheric
  airlight. It is not a full multiple-scattering solver and must report that
  limitation in diagnostics.
- The canonical single-scattering output remains owned by
  `integrateSingleScattering`; this stage must not rewrite
  `singleScattering.inScatteredRadianceByWavelength`.
- The implemented diagnostic policy is
  `aerosol-aware-lost-transmittance-haze-lift`. It activates from the maximum
  visible optical depth on the view path, uses Beer-Lambert lost view
  transmittance as the available veil signal, and modulates that signal by
  aerosol participation:

  ```text
  aerosolSaturation[w] = 1 - exp(-aerosolTau[w])
  aerosolParticipation[w] = aerosolOpticalDepthFraction[w] * aerosolSaturation[w]
  neutralMix[w] = min(0.6, aerosolParticipation[w])
  veilSource[w] = sourceSpectrum[w] * (1 - neutralMix[w])
    + mean(sourceSpectrum) * neutralMix[w]
  aerosolGain[w] = 1 + 1.5 * aerosolParticipation[w]
  added[w] = veilSource[w]
    * (1 - viewTransmittance[w])
    * activation
    * strength
    * aerosolGain[w]
  ```

  If aerosol/Mie optical depth is absent or zero, aerosol participation is zero
  and the formula reduces to the previous lost-transmittance proxy:
  `sourceSpectrum[w] * (1 - viewTransmittance[w]) * activation * strength`.
- Missing `numerical.diffuseSkyAirlightStrength` defaults to `0`, so the
  canonical stage is present but does not change existing baseline radiance
  unless a caller opts in.
- The aerosol-aware formula is deliberately bounded. `neutralMix` is capped at
  `0.6`, and `aerosolParticipation <= 1` keeps `aerosolGain <= 2.5`. This is
  required for flat or near-parallel paths where optical depth can continue
  growing instead of naturally exiting a spherical atmosphere.
- The stage must expose aerosol and flat-geometry diagnostics. In particular,
  reports need Mie/aerosol optical depth, aerosol optical-depth fraction,
  aerosol participation, max aerosol optical depth, tau regime, and a
  bounded/asymptotic flat-geometry policy marker.
- This approximation is source-backed as a model direction, not as a final
  closed-form radiative-transfer solution. It must stay opt-in or clearly
  named until calibrated against a stronger radiative-transfer reference.
- Negative or non-finite input radiance, source spectrum, transmittance,
  optical-depth, or strength values reject before accumulation.

Downstream use:

- `composeSpectralRadiance` consumes
  `diffuseSkyAirlight.radianceByWavelength` as an explicit
  component.
- Diagnostics consume activation, max-tau, lost-transmittance, source-spectrum,
  aerosol, flat-geometry, and limitation fields.

## `resolveSurfaceRadiance`

Purpose: compute surface-leaving spectral radiance for a visible surface hit
and attenuate it through the view path.

Consumes:

```js
{
  validatedRequest: {
    model,
    wavelengthsNm
  },
  rayPath,
  viewOpticalDepth,
  solarTransmittance
}
```

Produces:

```js
{
  surfaceRadiance: {
    hit,
    normal,
    directIrradianceByWavelength,
    diffuseSkyIrradianceByWavelength,
    surfaceLeavingRadianceByWavelength,
    viewAttenuatedRadianceByWavelength,
    components: {
      directByWavelength,
      diffuseByWavelength,
      emittedByWavelength
    },
    metadata
  }
}
```

For rays with no selected visible surface hit:

```js
{
  surfaceRadiance: {
    hit: null,
    viewAttenuatedRadianceByWavelength
  }
}
```

`viewAttenuatedRadianceByWavelength` is a zero array when `hit` is `null`.

Ownership:

- `rayPath.surfaceHit` owns whether the camera ray reaches a surface.
- `model.world.surfaceNormalAt(hit)` owns the geometric surface normal if the
  hit did not already include a valid normal.
- `solarTransmittance.surfacePoint` owns source visibility and transmittance at
  the surface point.
- `model.surface.radianceAt` owns material/BRDF response for the selected
  surface.
- Diffuse sky irradiance is disabled or fixture-owned until hemisphere
  integration is implemented.

Downstream use:

- `composeSpectralRadiance` consumes
  `surfaceRadiance.viewAttenuatedRadianceByWavelength`.
- Diagnostics consume hit, normal, direct/diffuse components, and metadata.

## `composeSpectralRadiance`

Purpose: sum all spectral radiance components that reach the observer.

Consumes:

```js
{
  validatedRequest: {
    wavelengthsNm
  },
  singleScattering,
  diffuseSkyAirlight,
  surfaceRadiance
}
```

Produces:

```js
{
  spectralRadiance: {
    wavelengthsNm,
    finalByWavelength,
    components: {
      inScatteredRadianceByWavelength,
      diffuseSkyAirlightRadianceByWavelength,
      surfaceViewAttenuatedRadianceByWavelength
    },
    metadata
  }
}
```

Ownership:

- This stage owns wavelength-by-wavelength physical radiance composition.
- `diffuseSkyAirlight` is canonical in normal stage order. Direct custom
  composition packets that omit it compose an explicit zero diffuse sky
  airlight component so focused tests and custom harnesses do not hide a
  display-side fallback.
- It does not tone-map, clamp, convert to XYZ/RGB, apply exposure, or build
  reports.
- Negative physical radiance components reject before composition; very bright
  radiance may exceed display range and remains unclamped.

Downstream use:

- Post-pipeline colorimetry consumes `spectralRadiance.finalByWavelength`.
- Diagnostics and reports consume component summaries.

## Post-Pipeline Consumers

The following consumers are deliberately outside the canonical transport
pipeline:

- `convertSpectralToColor`: consumes `spectralRadiance` and CIE/display
  choices, returns XYZ and linear RGB.
- `buildDiagnostics`: consumes a completed packet and report options, returns
  report-ready summaries.
- CLI/report builders: consume completed or stage-limited packets and emit
  deterministic JSON/Markdown artifacts.

These consumers may have their own contracts later, but they are not physical
transport stages.

## Known Alignment Follow-Ups

- Keep the placeholder downstream stages aligned as their real implementations
  replace placeholders: `evaluateScatteringPhase`, `integrateSingleScattering`,
  `resolveSurfaceRadiance`, and `composeSpectralRadiance` must continue to
  consume the fields listed here rather than re-querying duplicate sources.
- Remove any newly discovered stage-code fallbacks that read duplicate
  top-level request facts after `validateRequest`. Direct stage tests should
  craft `validatedRequest` when a stage requires canonical request data.
- Add contract-level fixture rows for stage adjacency beyond optical depth,
  especially solar transmittance to phase/scattering and surface radiance.
- Update `types.d.ts` after each contract-following code change so the ambient
  types mirror this document rather than becoming a second design authority.
