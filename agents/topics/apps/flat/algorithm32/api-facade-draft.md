# Algorithm32 Primary Facade API Draft

Status: design draft. Names are provisional, but the caller-facing
responsibilities and ownership boundaries should be treated as the current
working API shape until replaced by an accepted API decision.

The primary API should be a configured facade object, one instance per
independent simulation window or render context. The facade owns validated
Algorithm32 configuration and coordinates an internal CPU/reference algorithm
execution class, a runtime shader builder, validation/error
handling, and the facade-owned shared configuration/facts model. It does not
own display conversion, live app UI state, runner state, camera choreography,
or local Sun calibration workflows.
In this document, the Algorithm32 algorithm means the specified atmospheric
transport steps and calculations; the
CPU/reference algorithm execution class runs CPU/reference operations using
those calculations.
Algorithm configuration facts are owned by source, atmosphere, geometry, and
spectral component models; algorithm execution consumes those facts for one
specific input and returns spectral transport results.
The facade creates a shared configuration/facts model from validated config
and passes that model reference to the CPU/reference algorithm execution class
and the runtime shader builder.

A separate pure math API namespace may be exported beside the facade for
generally useful deterministic scalar, vector, unit-conversion, numeric-array,
and sample-domain helpers. That namespace is not facade instance state and should not
know about Algorithm32 physics, display conversion, shader packing, or
validation/error policy.

## Design Goals

- Keep the common Three integration path short and hard to misuse.
- Let the normal caller install Algorithm32 into an existing composer with one
  awaited setup call.
- Keep long-running texture/cache generation explicit and outside frame
  rendering; the explicit operation may be `await setupShader(...)`.
- Keep Sun, atmosphere composition, and geometry behind their public
  interfaces.
- Keep local Sun calibration upstream; the facade receives a configured
  public `Sun`.
- Let CPU/reference evaluation and internal shader resource preparation consume
  the same canonical shared model without exposing texture/cache build
  mechanics to app callers.
- Fail loudly for unsupported runtime capabilities and stale or mismatched
  shader resources.

## Minimal Caller Path

Algorithm32 requires a composer-style render pipeline. The app remains
responsible for calling its composer once per frame, but the Algorithm32
caller does not manually render Algorithm32. Setup installs the Algorithm32
pass into the composer:

```ts
const algorithm32 = new Algorithm32(config);
const atmosphere = await algorithm32.setupShader({
  THREE,
  composer,
  scene,
  camera,
});
```

The app's existing frame loop remains the usual composer loop:

```ts
renderer.setAnimationLoop(() => {
  composer.render();
});
```

In that shape, `setupShader` asks the internal runtime shader builder to build
the Algorithm32 runtime shader from packaged shader source, the shared model,
and the current `ShaderRuntimeConfig`, while using the setup request only as
the runtime attachment location. Internally, the builder uses shader-side
assemblers for shader source, IncidentRadianceCache artifacts owned behind
concrete light-source implementations, and texture/cache packing artifacts; a
runtime capability model records the true renderer/device feature path; a
runtime attachment model owns the Three/composer attachment
facts such as composer, scene, camera, targets, resize state, pass insertion,
and disposal scope. The
builder constructs a shader binder that applies and updates the required
uniforms, samplers, textures, defines, display-conversion resources,
frame/config values, and runtime resources on the Three shader/pass objects.
The binder's output is live applied runtime state plus binding diagnostics or
update status, not another public data model. Then the facade installs the
resulting composer pass and returns a
handle for config updates, scene/camera replacement, debug views, diagnostics,
and disposal. The handle has no normal `render()` method because the composer
owns per-frame invocation.

When configuration changes, the caller replaces the facade configuration and
lets the installed shader handle refresh resources:

```ts
await atmosphere.setConfig(nextConfig);
```

That call may no-op when descriptors still match, or rebuild/rebind resources
when the new configuration requires it. It is still explicit because it is
awaited and outside the frame render call.

## Public Facade

```ts
export class Algorithm32 {
  constructor(config: Algorithm32Config);

  get config(): Algorithm32ConfigSnapshot;
  setConfig(config: Algorithm32Config): Algorithm32ConfigSnapshot;

  setupShader(request: ThreeShaderSetupRequest): Promise<Algorithm32ThreeShaderHandle>;

  evaluate(request: EvaluationRequest): EvaluationResult;

  getDiagnostics(request?: DiagnosticsRequest): Algorithm32Diagnostics;

  dispose(): void;
}
```

### Constructor

Creates an instance-scoped Algorithm32 facade from public configuration. The
constructor validates the configuration shape, canonicalizes derived
descriptors, creates the facade-owned shared configuration/facts model, and
initializes instance state. It should not build shader textures, allocate
large GPU resources, or touch app-owned scene state.

### `config`

Getter that returns a read-only snapshot of the current canonical configuration. The
returned value is for inspection and diagnostics, not mutation.

### `setConfig`

Replaces the full facade configuration with a new validated configuration.
Full replacement keeps ownership clearer than patch-style mutation and avoids
ambiguous partial state. The call increments the facade configuration version
and replaces or versions the shared configuration/facts model. Prepared shader
resources whose descriptors no longer match are invalidated. It should not
rebuild textures or upload GPU resources by itself.

Normal runtime consumers should usually call `await handle.setConfig(config)`
on the shader handle instead. That combines facade config replacement with the
resource refresh required by the installed runtime pass.

### `setupShader`

Builds and prepares the runtime Three shader integration for this facade. It
receives the caller-owned Three runtime surface, delegates shader construction
to the runtime shader builder, lets the builder's shader binder apply the
binding facts to the built Three shader/pass objects, installs the built pass
into the requested runtime location, and returns a handle that owns
Algorithm32-specific render targets, depth texture, `ShaderMaterial`,
fullscreen pass, uniforms, texture binding, resource validation, render
sequencing, resize, diagnostics, and disposal.

This is the normal product path for app rendering. It exists so the caller
does not need to make Algorithm32-specific decisions about shader material
flags, spectral packing, local incident-cache layout, pass mode uniforms,
render target setup, depth texture setup, source-light mapping, debug views,
or disposal order.

`setupShader` is awaited. It may validate, build, load, bind, or upload the
resources required by the selected runtime shader mode. It must not leave
long-running work to be discovered by the first frame render.

### `evaluate`

Runs the CPU/reference per-path transport surface against the facade's current
Sun, atmosphere composition, geometry, and execution configuration plus a
single `EvaluationRequest`. The returned transport output is spectral or
spectral-group information, not display-converted RGB.

This is for validation, tools, diagnostics, offline probes, and tests. It is
not the normal app renderer path and it should not require callers to
understand internal shader resource build state.

### `getDiagnostics`

Returns current facade diagnostics such as config version, active descriptors,
resource status, runtime capability status reported by adapters, selected
debug view, unsupported feature combinations, and recent validation failures.
It must not expose private cache packing internals except through public
descriptor types.

Validation is automatic in `constructor`, `setConfig`, `setupShader`,
`handle.setConfig`, and `evaluate`. Failures should throw or reject with
structured Algorithm32 errors. Explicit validation/preflight helpers may exist
as dev/test tooling, but they are not part of the primary app-facing facade.

### `dispose`

Disposes facade-owned resources and any adapters/resources created through the
facade that have not already been disposed. Calling `dispose` should make
later public operations fail loudly.

## Facade Configuration

```ts
export interface Algorithm32Config {
  inputs: Algorithm32Inputs;
  execution?: ExecutionConfig;
  shader?: ShaderRuntimeConfig;
}

export interface Algorithm32Inputs {
  sun: Sun;
  atmosphere: AtmosphereComposition;
  geometry: Geometry;
}
```

The three entries in `inputs` are the algorithm input abstractions. Execution
configuration controls numerical and performance policy. Shader configuration
is runtime configuration and controls pass behavior across setup and later
handle configuration updates. It is not just creation-time setup data.
Texture/cache artifacts, descriptors, packing, and upload metadata are runtime
implementation state, not public facade configuration.

```ts
export interface ShaderRuntimeConfig {
  mode?: ShaderRuntimeMode;
  debugView?: ShaderDebugView;
  cachePolicy?: ShaderCachePolicy;
  capabilityPolicy?: RuntimeCapabilityPolicy;
  renderTargetPolicy?: ShaderRenderTargetPolicy;
}
```

`ShaderRuntimeConfig` owns runtime behavior choices such as selected shader
mode, debug view, cache/resource policy, capability failure policy, and
render-target/HDR/depth policy. Those values participate in `constructor`,
`setConfig`, `setupShader`, and `handle.setConfig`. Runtime attachment handles
such as composer, scene, camera, renderer-compatible surface, and pass
insertion location are not configuration; they remain setup/handle inputs
because they are app-owned runtime objects.

Display conversion is not part of `Algorithm32Config` because Algorithm32's
core output is spectral radiance/transmittance. A separate
`Algorithm32DisplayConversion`-style consumer may live beside the facade and
consume Algorithm32 spectral output when a CPU/offline tool or runtime
renderer needs RGB, exposure, tone mapping, or debug-color mapping. That class
is not facade-owned state.

Local Sun altitude, diameter, latitude limits, calibration packets, orbit
resolution, and clock synchronization are not facade configuration fields
unless they have already resolved into the public `Sun` interface.

## Three Shader Setup Request

```ts
export interface ThreeShaderSetupRequest {
  THREE?: ThreeNamespace;
  composer: EffectComposerLike;
  scene: THREE.Scene;
  camera: THREE.Camera;
  displayConversion?: Algorithm32DisplayConversionShaderDescriptor;
}
```

`THREE` is required only if the package should avoid importing `three` as its
own peer dependency. `composer`, `scene`, and `camera` are the normal Three
objects the app already owns. The composer is required. It must expose the
render pipeline that the app already calls every frame, plus enough
EffectComposer-compatible surface for Algorithm32 to install a pass and infer
renderer/size details. Runtime behavior policy comes from
`Algorithm32Config.shader`; the setup request supplies the runtime attachment
location, not an alternate runtime configuration packet. `displayConversion`
is an optional shader-facing
descriptor supplied by an external display-conversion consumer. It lets the
runtime shader builder turn Algorithm32 spectral output into screen pixels
without making display conversion part of `Algorithm32Config`, the shared
aggregate model, or Algorithm32 algorithm execution.

The `THREE.*` type names above are shorthand for Three-compatible runtime
types; the implementation can still type-import from `three` while receiving
the runtime namespace from the caller.

## Returned Shader Handle

```ts
export interface Algorithm32ThreeShaderHandle {
  setConfig(config: Algorithm32Config): Promise<Algorithm32ConfigSnapshot>;
  setDisplayConversion(descriptor: Algorithm32DisplayConversionShaderDescriptor): void;
  setScene(scene: THREE.Scene): void;
  setCamera(camera: THREE.Camera): void;
  setDebugView(debugView: ShaderDebugView): void;

  getDiagnostics(): ShaderDiagnostics;
  dispose(): void;
}
```

The handle is for lifecycle and state updates, not per-frame rendering. The
composer calls the installed Algorithm32 pass during `composer.render()`.

`setConfig` is the normal runtime config-update method for the handle. It
replaces the facade configuration and performs any required resource
validation, build, bind, or upload before the next frame renders.

`setDisplayConversion` updates the external display-conversion descriptor used
by the installed runtime shader handle. It does not replace Algorithm32
configuration and must not change the shared aggregate model. The descriptor
is expected to be produced by an adjacent `Algorithm32DisplayConversion`-style
consumer and validated against the facade's current spectral descriptor before
use.

`setScene` and `setCamera` are for apps whose scene or camera objects change
after setup. Apps that mutate the existing scene or camera do not need to call
them.

Resize should flow through the composer. Algorithm32's installed pass should
respond to composer size changes without requiring an Algorithm32-specific
resize call in the normal path.

## Composer Pass Behavior

Setup should install a composer-compatible Algorithm32 pass using the
composer's pass API, normally:

```ts
composer.addPass(algorithm32Pass);
```

If production requires a specific pass position, `setupShader` should own that
policy and use the composer API that matches it, such as `insertPass`. The
caller should not have to construct `RenderPass`, `ShaderPass`, render targets,
depth textures, fullscreen quads, shader materials, or Algorithm32 uniforms.

The actual GPU shader trigger inside this operation is a normal Three render
of the adapter-owned fullscreen pass scene, roughly:

```ts
renderer.render(passScene, passCamera);
```

Three sees the fullscreen quad's `ShaderMaterial`, binds the compiled GPU
program, and the GPU runs the Algorithm32 fragment shader for the covered
pixels.

## Advanced Or Internal Operations

The implementation will still need operations such as resource preparation,
texture/cache building, texture-artifact binding, descriptor validation,
runtime shader building, composer-pass construction, source-light
synchronization, pass ordering, and low-level frame-pass rendering. These are
implementation-owned and are not part of the normal caller path.

Internally, shader binding should be represented by an active shader binder
rather than a passive public plan. The binder may own a private shader binding
map containing the data facts it needs to bind uniforms, samplers, defines,
resource ids, descriptor versions, update categories, and compatibility
labels. The map is internal data; the binder performs the binding.

## Related API Surfaces

The generally useful pure math namespace is a sibling API surface, not a method
family on `Algorithm32`. The current concrete production utility objects are
`ScalarMath`, `UnitMath`, `VectorMath`, `ArrayMath`, and `SampleMath`, with
`MathUtils.js` re-exporting them by name. They should contain only plain
deterministic helpers such as `clamp`, unit
conversion, vector tuple math, generic numeric-array operations, and
nearest-sample/padding utilities.
Wavelength-aware spectral facts/descriptors stay with the shared model because
they depend on Algorithm32 atmosphere configuration and spectral meaning.

## What Stays Out

- Local Sun configuration, calibration, calibration replay, and invalidation.
- Private Sun/source-family fields not present on the public `Sun` interface.
- Private atmosphere preset or coefficient derivation fields not present on
  the public `AtmosphereComposition` interface.
- Private geometry factory, projection, or app-scene fields not present on the
  public `Geometry` interface.
- Low-level transport functions, shader uniform mappers, cache packing helpers,
  source-matrix builders, and pass-mode constants.
- Generally useful pure math helpers as facade methods.
- App UI state, runner/watch state, camera choreography, and artifact-gallery
  state.
- Validation scene packets as normal rendering inputs.

## Naming Questions

- Should `setConfig` be named `configure` or `replaceConfig` to emphasize full
  replacement?
- Should `setupShader` always append with `composer.addPass`, or should it
  detect/replace the app's existing scene render pass?
- What minimal `EffectComposerLike` surface should be required so app-specific
  composer wrappers can integrate without exposing raw Three internals?
