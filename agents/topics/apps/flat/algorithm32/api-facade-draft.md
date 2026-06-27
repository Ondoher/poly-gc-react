# Algorithm32 Primary Facade API Draft

Status: design draft. Names are provisional, but the caller-facing
responsibilities and ownership boundaries should be treated as the current
working API shape until replaced by an accepted API decision.

The primary API should be a configured facade object, one instance per
independent simulation window or render context. The facade owns validated
Algorithm32 configuration and coordinates the internal CPU/reference,
texture/cache, runtime shader, and shared-core implementations. It does not
own live app UI state, runner state, camera choreography, or local Sun
calibration workflows.

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
- Let CPU/reference evaluation and internal shader resource preparation share
  private core mechanics without exposing texture/cache build mechanics to app
  callers.
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

In that shape, `setupShader` prepares required Algorithm32 resources, creates
the internal composer pass, installs it with the composer, and returns a
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

  getConfig(): Algorithm32ConfigSnapshot;
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
descriptors, and initializes instance state. It should not build shader
textures, allocate large GPU resources, or touch app-owned scene state.

### `getConfig`

Returns a read-only snapshot of the current canonical configuration. The
returned value is for inspection and diagnostics, not mutation.

### `setConfig`

Replaces the full facade configuration with a new validated configuration.
Full replacement keeps ownership clearer than patch-style mutation and avoids
ambiguous partial state. The call increments the facade configuration version
and invalidates prepared shader resources whose descriptors no longer match.
It should not rebuild textures or upload GPU resources by itself.

Normal runtime consumers should usually call `await handle.setConfig(config)`
on the shader handle instead. That combines facade config replacement with the
resource refresh required by the installed runtime pass.

### `setupShader`

Creates and prepares the runtime Three shader integration for this facade. It
receives the caller-owned Three runtime surface and returns a handle that owns
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
Sun, atmosphere composition, geometry, execution, and display configuration
plus a single `EvaluationRequest`.

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
  display?: DisplayConfig;
  shader?: ShaderRuntimeConfig;
}

export interface Algorithm32Inputs {
  sun: Sun;
  atmosphere: AtmosphereComposition;
  geometry: Geometry;
}
```

The three entries in `inputs` are the algorithm input abstractions. Execution
configuration controls numerical and performance policy. Display configuration
controls spectral-to-output-color conversion. Shader configuration controls
runtime pass behavior. Texture/cache artifacts, descriptors, packing, and
upload metadata are runtime implementation state, not public facade
configuration.

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
  capabilityPolicy?: RuntimeCapabilityPolicy;
}
```

`THREE` is required only if the package should avoid importing `three` as its
own peer dependency. `composer`, `scene`, and `camera` are the normal Three
objects the app already owns. The composer is required. It must expose the
render pipeline that the app already calls every frame, plus enough
EffectComposer-compatible surface for Algorithm32 to install a pass and infer
renderer/size details.

The `THREE.*` type names above are shorthand for Three-compatible runtime
types; the implementation can still type-import from `three` while receiving
the runtime namespace from the caller.

## Returned Shader Handle

```ts
export interface Algorithm32ThreeShaderHandle {
  setConfig(config: Algorithm32Config): Promise<Algorithm32ConfigSnapshot>;
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
composer-pass construction, source-light synchronization, pass ordering, and
low-level frame-pass rendering. These are implementation-owned and are not
part of the normal caller path.

## What Stays Out

- Local Sun configuration, calibration, calibration replay, and invalidation.
- Private Sun/source-family fields not present on the public `Sun` interface.
- Private atmosphere preset or coefficient derivation fields not present on
  the public `AtmosphereComposition` interface.
- Private geometry factory, projection, or app-scene fields not present on the
  public `Geometry` interface.
- Low-level transport functions, shader uniform mappers, cache packing helpers,
  source-matrix builders, and pass-mode constants.
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
