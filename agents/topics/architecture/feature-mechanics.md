# Feature Mechanics

## Purpose

Capture how features are actually added to this repo on the client side and how client/runtime feature mechanics work in practice.

This repo is side-effect driven and registry based, so the practical mechanics are easy to forget unless they are written down clearly.

The server is a distinct concern with different architectural mechanics and is not the main focus of this note.

This note should be read together with [build-and-assets.md](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md):

- use this document for feature scope, runtime activation, ownership, and code-organization mechanics
- use `build-and-assets.md` for build inclusion, copied assets, runtime asset paths, and `dist` behavior

## Architectural Context

The broader application architecture is documented separately in [remvc-architecture.md](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md).

That note covers:

- `REMVC`
- the registry as a centralized service locator
- the executor's startup role
- multiple scoped MVC groupings
- model/service boundaries
- view/presentation boundaries

## Feature Ownership And Structure

Component ownership in this repo is strongly tied to feature boundaries and reuse intent.

Current preferred pattern:

- features are intended to be self-contained units
- a feature may depend on common application capabilities, but the rest of the app should not need to know that the feature exists
- removing a feature should not negatively affect the rest of the application beyond removing that feature's own functionality
- components that are only meaningful inside one feature can live under that feature
- components that are already useful across features, or are likely to become cross-feature building blocks, should be created in or moved into [src/gc/components](/c:/dev/poly-gc-react/src/gc/components)
- shared support files for those components should move with them rather than leaving important behavior buried inside one feature
- dependencies should not be formed directly across features as a normal practice
- the exception is when a cross-feature dependency is explicitly intended and documented, such as one feature deliberately building on another

The practical test is simple:

- if another feature could reasonably use the component
- or if the component needs to be available as a general UI building block

then it probably belongs in the shared component layer rather than inside a single feature.

The inverse rule is also important and should be treated as explicit, not implied:

- code, images, or styles kept inside a feature should be assumed to be private to that feature
- they are not considered available for reuse outside that feature unless they are deliberately promoted into a shared location
- a feature should not quietly depend on internals from another feature
- the surrounding application should not become coupled to the existence of one removable feature
- the absence of a feature should not leave dead code in the application unless that code is providing a legitimate external service independent of the removed feature
- code that provides general facilities for features as a whole may remain, because it serves the feature system broadly rather than one removed feature specifically

That means feature-internal placement is not just a filesystem detail. It communicates ownership and availability. If another feature needs to depend on that asset, code, or styling, the right move is usually to move it into a shared layer rather than quietly reaching across feature boundaries.

## Naming And Placement Conventions

Another local convention worth stating explicitly is file naming and implementation style.

Current working rules are:

- files that contain classes are generally named in `PascalCase` after the class they contain
- this includes React component files
- files that implement services are generally named after the service in `kebab-case`
- controller services for game-like features may intentionally use a feature-prefixed controller filename such as `mjController`
- this reflects the feature namespace in both the service name and the filename, for example `mj:controller` and `mjController.jsx`
- CSS files and image asset files should always use `kebab-case`
- most code should be implemented in classes by default
- the main exception is truly stateless utility code with no meaningful common object model, where plain functions are acceptable
- JSDoc comments should use active voice and start with a verb phrase, for example `Call this method to...`
- event-method JSDoc descriptions should start with `Called by ... when ...`
- complex parameter or return detail should be described in the main description rather than pushed into `@param` or `@returns`
- JSDoc parameter lines should use the form `@param name - description`
- in plain `.js` files, JSDoc parameter and return tags should include explicit types, for example `@param {number} size - description`
- that explicit-type requirement is meant for `.js` files specifically and should not be read as a blanket rule for every file type in the repo
- when JSDoc needs complex object types, define them in a `types.d.ts` file so they are available globally to IntelliSense
- when a method parameter is intentionally unused, start its name with an underscore
- when defining types, document the properties as well as the main type
- class properties with complex types or non-obvious usage should have JSDoc comments when they are first introduced in the constructor
- class properties with obvious usage do not need JSDoc comments
- services should define a `.d.ts` file in the same folder as the service using the base filename of the service file
- that file should export an interface mirroring the service's exported methods
- when defining the exported service interface, derive the exported methods from the `this.implement(...)` call in the service constructor
- lifecycle methods such as `start` and `ready` are called directly by Polylith and do not need to be documented in the service `.d.ts` interface
- service interfaces should include JSDoc comments
- when the service implementation already has JSDoc, copy that documentation into the service interface where it still applies
- service `start()` should do local initialization only
- local initialization in `start()` should leave the service internally usable once dependencies become available
- service `start()` should not call methods on other services or assume those services are ready yet
- service `ready()` is the point where cross-service subscriptions, listener wiring, precache calls, and other dependency-driven setup should happen
- if a non-service class needs a registry service, it should wait until its own runtime-ready point, such as React `componentDidMount`, rather than subscribing in the constructor

Script-specific guidance now lives in the scripts topic:

- [Scripts Overview](/c:/dev/poly-gc-react/agents/topics/scripts/scripts.md)

This is useful context because it explains why many repo filenames and structures do not follow more typical modern frontend naming preferences. The project is intentionally class-heavy, and filenames are expected to reflect that design.

One practical reason behind the service-file naming rule is discoverability. The service name is often the first thing a developer encounters in the code or registry, so matching the implementation filename to that service name makes filesystem search a more direct navigation path.

Informative note:

- some current game-like features use a feature-prefixed controller filename such as `mjController.jsx` to mirror a namespaced service like `mj:controller`
- this is a current convention in parts of the repo and may be revisited later

There is also an important CSS ownership rule.

Current preferred pattern:

- global stylesheets such as gc.css should only contain styles intended to apply broadly across many components
- component-specific layout, focus, state, or interaction styling should live with the component itself
- feature-specific styling should prefer feature-local stylesheets rather than accumulating in a global file
- if CSS or image assets need to be copied into `dist`, follow the placement rules in [build-and-assets.md](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md)
- if runtime asset path questions arise, use [build-and-assets.md](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md) as the source of truth

This matters because broad stylesheets should act as shared foundation layers:

- theme variables
- typography defaults
- broad shared visual defaults and overrides
- shared utility-like patterns

They should not become a dumping ground for one-off component rules. When a style primarily exists to support one component, that style should usually move into a component-local stylesheet instead.

There is also a preferred component-organization pattern for React view code.

Current preferred pattern:

- break larger component renders into small focused render methods when the component has several distinct semantic regions
- use those render methods to express purposeful UI subregions such as control groups, metadata blocks, button stacks, and layout halves
- create explicit wrapper elements for those subregions in JSX rather than relying on CSS to infer structure from a flat list of children
- let the component own the markup and CSS classes for its internal organization
- keep component-local visual and internal layout rules in the component's own stylesheet
- keep parent-level placement, sizing, and region positioning rules in the parent region stylesheet
- when a component needs materially different arrangements across modes such as landscape and portrait, prefer keeping the same semantic groups and changing how those groups are laid out rather than rewriting the child list for each mode
- when a piece of UI content is conceptually separate from a control, such as a difficulty label versus a game-number entry control, make it a separate component region instead of burying it inside the control component

The practical goal is to keep JSX readable and structural:

- the component should describe what boxes exist
- the component stylesheet should describe how that component behaves internally
- the surrounding layout stylesheet should describe where that component sits in the larger feature layout

This pattern makes later layout changes safer because the semantic grouping is already visible in the markup, and CSS changes do not need to reverse-engineer intent from an overly flat child structure.

## Runtime Feature Activation

Client feature activation depends on side-effect imports.

If the files are not imported, the services are never instantiated and the feature does not exist.

This is the feature/runtime side of activation.

The complementary build-side questions are covered in [build-and-assets.md](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md):

- whether the feature is included in an app build
- whether its shipped CSS and images are copied into `dist`
- how runtime asset paths should be derived from `build.json`
