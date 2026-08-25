# Production Reference And GPU Shader Documentation Redundancy Audit

Status: section-level cleanup inventory; no redundant text has been removed.

This audit compares the 17 pre-existing Markdown documents under
`agents/topics/apps/flat/algorithm32/` with the canonical
[Production Reference And GPU Shader Rules And Guidance](production-reference-and-gpu-shader-rules.md).
It does not inspect or make cleanup claims about reconciliation, production
package, app, standards, archive, script, record, or temporary-artifact
documents outside this topic directory.

The audit records repeated policy and guidance, not every ordinary mention of
`Reference`, shaders, tests, fixtures, or evidence. Unique current state,
requirements, API signatures, cache physics, plan gates, source identities,
fixture rows, and historical findings remain owned by their existing documents.

## Dispositions

| Disposition | Meaning |
| --- | --- |
| **Replace** | The section is primarily a recap of rules now owned by the canonical guide. Replace it with a short link or remove it when routing already supplies that link. |
| **Trim** | The section mixes unique document-owned facts with duplicated rules. Keep the unique facts and replace the generic rule prose with a guide link. |
| **Retain + link** | The overlap is a useful local reminder beside a contract, checklist, or inventory. Keep only the minimum local statement and link to the guide for the full rule. |
| **Archive/correct** | The section is historical, stale, or conflicts with current production. Correct its authority/status before attempting mechanical deduplication. |

## Conflicts And Stale Copies To Resolve First

These are not safe search-and-delete cases. They contain conflicting or
obsolete claims that need an explicit current decision.

| Document and section | Conflict or stale claim | Required cleanup |
| --- | --- | --- |
| [requirements.md - `A32-API-003 Error Taxonomy`](requirements.md#a32-api-003-error-taxonomy); [api-facade-draft.md - `getDiagnostics`](api-facade-draft.md#getdiagnostics); [production-design.md - document preamble](production-design.md#algorithm32-production-design) | Requirements demand a public error taxonomy, while the facade/design material defers stable public diagnostics and a stable error taxonomy. | Decide the public contract, then make the requirement, design, and facade agree. The guide should continue to own only lifecycle failure behavior. |
| [api-facade-draft.md - `What Stays Out`](api-facade-draft.md#what-stays-out) | It says rolled-back typed celestial CPU source/frame modules are direct production APIs. They are no longer in current production after record 067 was rolled back. | Remove or rewrite that sentence before treating the section as current API scope. |
| [external-reference-log.md - `Log Rules`](external-reference-log.md#log-rules) and [`Expected-Value Intake Workflow`](external-reference-log.md#expected-value-intake-workflow) | They mandate a legacy per-row JSON `reference` object and nearby derivation schema. Current production uses AMA-numbered references, compact precise pointers, and named first-party evidence. | Mark the schema as historical input format; do not retain it as current production guidance. Preserve unique source records. |
| [conclusions.md - `Data Flow`](conclusions.md#data-flow) | The flow uses obsolete or provisional surfaces such as `GeometryModel.resolveRayDistance` and older packet ownership. | Keep only as a dated historical conclusion or remove it from current routing; do not merge its API names into the guide. |
| [README.md - `Fresh Bootstrap Checkpoint`](README.md#fresh-bootstrap-checkpoint), [celestial-contribution-cache-plan.md - `Current Baseline`](celestial-contribution-cache-plan.md#current-baseline), and [status.md - `Current Verification`](status.md#current-verification) | Passing spec/build/UI baselines are copied into multiple current documents. | Keep changing counts and command results only in `status.md`; other documents should link to it. |
| [production-code-architecture-poc-review.md](production-code-architecture-poc-review.md) and [conclusions.md](conclusions.md) as current-topic routes | Both contain historical findings mixed with guidance that later design and implementation superseded. | Classify them explicitly as historical review/source-mining documents before trimming their duplicated guidance. |

## Handoff, Status, And Delta Documents

| Document | Exact section or region | Disposition | Redundant guidance to consolidate |
| --- | --- | --- | --- |
| [README.md](README.md) | Document preamble before `Current Implementation Reference` | Trim | CPU-reference versus GPU-product roles, facade/model ownership, `SpectralCalculator` sharing, shader-contribution ownership, unit packets, failure phases, renderer topology, evidence ownership, and reconciliation non-runtime rules. Retain topic orientation and genuinely current handoff facts. |
| [README.md](README.md) | [`Current Implementation Reference`](README.md#current-implementation-reference) | Replace | Implementation truth, retained topology, unit spelling, lifecycle failure behavior, oracle/runtime separation, and no reconciliation runtime link are all canonical-guide material. Retain only routing to current implementation, status, design, and delta owners. |
| [README.md](README.md) | [`Fresh Bootstrap Checkpoint`](README.md#fresh-bootstrap-checkpoint) | Trim | Mixed current implementation inventory with durable shader/resource/test rules and duplicated verification counts. Keep only concise current facts that belong in a bootstrap route; move counts to status and link the guide for rules. |
| [README.md](README.md) | [`Provenance Only`](README.md#provenance-only) | Retain + link | The catalog list is unique routing. Its archive-versus-production authority rule repeats the guide's promotion and claim-boundary rules. |
| [README.md](README.md) | [`Test Scaffold`](README.md#test-scaffold) | Replace | Test discovery, placement, fixture validation, citation syntax, coverage classification, and current counts repeat the guide and status. Retain at most the focused command and a link. |
| [README.md](README.md) | [`Production Split`](README.md#production-split) | Trim | Keep the path/topology inventory. Remove repeated `SpectralCalculator`, fixture-ledger, numbered-reference, short-code, named-evidence, and promotion rules. |
| [README.md](README.md) | [`Pre-Reconciliation Archive`](README.md#pre-reconciliation-archive) | Archive/correct | Unique historical POC details may remain, but its production recommendations repeat or predate current owner, cache, renderer, test, and promotion rules. It should not act as current guidance. |
| [README.md](README.md) | [`Promotion Rule`](README.md#promotion-rule) | Replace | Single-owner promotion and the ban on making production mine experiment lanes are now guide-owned rules. |
| [status.md](status.md) | [`Current Focus`](status.md#current-focus) and [`Current State`](status.md#current-state) | Trim | Retain concise live state. Link the guide instead of restating the full Reference/GPU split, renderer topology, owner roles, and incident-cache distinction. |
| [status.md](status.md) | [`Selected Cache Contract`](status.md#selected-cache-contract) | Retain + link | Keep the selected cache summary and unresolved decisions. The contribution order, no-second-transmittance, camera identity, disabled-zero, failure, evidence, and promotion rules already have canonical owners. |
| [status.md](status.md) | [`Working Rules`](status.md#working-rules) | Replace | Every bullet repeats the guide or cache design. A status document should hold current state and next action, not a parallel durable rule list. |
| [reconciliation-production-deltas.md](reconciliation-production-deltas.md) | Document preamble and [`Production Shape Constraint`](reconciliation-production-deltas.md#production-shape-constraint) | Replace | Reconciliation-as-oracle, no runtime dependency, and retained topology repeat the guide. Keep the document's ownership statement for the current gap only. |
| [reconciliation-production-deltas.md](reconciliation-production-deltas.md) | [`Selected Next Delta`](reconciliation-production-deltas.md#selected-next-delta) | Trim | The gap table is unique. Generic owner, failure, testing, reference-promotion, and no-runtime-import instructions should link to their canonical owners. |
| [reconciliation-production-deltas.md](reconciliation-production-deltas.md) | [`Exit Criteria`](reconciliation-production-deltas.md#exit-criteria) | Trim | Keep delta-closure conditions; link the guide for focused tests, reference/evidence promotion, disabled/invalid behavior, layered parity, and record-067 non-reuse. |

## Requirements And Production Architecture

Normative requirement IDs remain requirements even when their explanatory
implementation guidance is consolidated. The intended edit is to preserve the
required outcome and remove duplicate how-to prose.

| Document | Exact section or region | Disposition | Redundant guidance to consolidate |
| --- | --- | --- | --- |
| [requirements.md](requirements.md) | [`Requirement Principles`](requirements.md#requirement-principles) and [`Ownership Domains`](requirements.md#ownership-domains) | Trim | Single ownership, public versus internal seams, unit packets, CPU/GPU separation, shader-resource ownership, provenance, and validation strategy repeat the guide. Retain requirement-scoping rules. |
| [requirements.md](requirements.md) | [`A32-API-001`](requirements.md#a32-api-001-production-module-boundary), [`A32-API-002`](requirements.md#a32-api-002-public-api-interface-definitions), and [`A32-API-004`](requirements.md#a32-api-004-public-facade-with-private-resource-builders) | Trim | Retain normative API outcomes; remove duplicated module-boundary, ambient-type, facade/evaluator/builder, model-sharing, and private-resource guidance. |
| [requirements.md](requirements.md) | [`A32-API-003`](requirements.md#a32-api-003-error-taxonomy) | Archive/correct | Resolve the public-taxonomy conflict noted above, then keep only the accepted normative outcome. |
| [requirements.md](requirements.md) | [`A32-INP-001`](requirements.md#a32-inp-001-sun-input-models), [`A32-INP-002`](requirements.md#a32-inp-002-atmosphere-composition-models), and [`A32-INP-003`](requirements.md#a32-inp-003-geometry-models) | Trim | Keep domain-specific required inputs. Shared-interface-only consumption, canonical-owner, descriptor, unit, and shader-semantics rules belong in the guide. |
| [requirements.md](requirements.md) | [`A32-CFG-001`](requirements.md#a32-cfg-001-numerical-and-runtime-configuration) | Trim | Preserve the execution/runtime configuration requirement; remove duplicate numerical-policy, lifecycle, diagnostics, and runtime failure guidance. |
| [requirements.md](requirements.md) | [`A32-TRN-001`](requirements.md#a32-trn-001-cpu-reference-support), [`A32-TRN-002`](requirements.md#a32-trn-002-shared-transport-shape), and [`A32-TRN-003`](requirements.md#a32-trn-003-incident-radiance-cache) | Trim | Retain transport requirements. CPU oracle role, `SpectralCalculator` sharing, per-ray result boundary, incident-sampling precedence, and cache-owner split repeat the guide. |
| [requirements.md](requirements.md) | [`A32-TEX-001`](requirements.md#a32-tex-001-direct-incoming-radiance-oracle) through [`A32-TEX-005`](requirements.md#a32-tex-005-internal-shader-resource-building) | Trim | Retain required cache behavior and packing outcomes. Resource-builder ownership, descriptors, validation, packing tests, and private API rules repeat the guide. |
| [requirements.md](requirements.md) | [`A32-RUN-001`](requirements.md#a32-run-001-usable-production-shader) through [`A32-RUN-005`](requirements.md#a32-run-005-runtime-capabilities-and-fail-loud-binding) | Trim | Retain product/runtime requirements. Composer topology, live bindings, owner contributions, capability preflight, setup failure, frame failure, and pass lifecycle repeat the guide. |
| [requirements.md](requirements.md) | [`A32-DSP-001`](requirements.md#a32-dsp-001-spectral-display-conversion) | Trim | Retain the display requirement. Color ownership and the separation between spectral transport and display conversion repeat the guide. |
| [requirements.md](requirements.md) | [`A32-VAL-001`](requirements.md#a32-val-001-poc-promotion-validation), [`A32-VAL-002`](requirements.md#a32-val-002-parity-and-fixture-strategy), and [`A32-VAL-003`](requirements.md#a32-val-003-runtime-shader-validation-surface) | Trim | Retain acceptance outcomes and requirement IDs. Fixture metadata, independent expectations, numbered references, named evidence, layered parity, and claim discipline repeat the guide. |
| [requirements.md](requirements.md) | [`API Design Implications`](requirements.md#api-design-implications) | Replace | This is a derived recap of the facade, model, Reference/builder, Color, units, lifecycle, and validation rules already stated normatively and in the guide. |
| [requirements.md](requirements.md) | [`Explicit Non-Requirements For The First Production Contract`](requirements.md#explicit-non-requirements-for-the-first-production-contract) | Trim | Retain true scope exclusions; remove explanatory owner/runtime rules that merely restate why those exclusions exist. |
| [production-design.md](production-design.md) | Document preamble and [`Design Goal`](production-design.md#design-goal) | Trim | Keep design authority and current architecture goal. Consolidate reconciliation authority, production homes, CPU/GPU roles, provenance, units, error handling, and renderer ownership. |
| [production-design.md](production-design.md) | [`Celestial Contribution Cache Extension`](production-design.md#celestial-contribution-cache-extension) | Retain + link | Keep the extension's place in surrounding architecture; defer its detailed contribution order, identity, failure, test, and promotion rules to the cache design and guide. |
| [production-design.md](production-design.md) | [`Production Inputs`](production-design.md#production-inputs) and [`Production Boundaries`](production-design.md#production-boundaries) | Trim | Keep architecture-specific input/boundary decisions. Remove generic canonical-owner, unit packet, Reference/builder, runtime attachment, and Color rules. |
| [production-design.md](production-design.md) | [`Current Production Implementation`](production-design.md#current-production-implementation) | Trim | Keep implementation inventory that still belongs here. Move changing verification facts to status and consolidate test placement, citations, provenance, owner contributions, assembly, binding, and failure rules. |
| [production-design.md](production-design.md) | [`Validation And Error Handling Class`](production-design.md#validation-and-error-handling-class) | Archive/correct | It repeats lifecycle failure rules and contains aspirational public error/diagnostic design that must be reconciled with current production and `A32-API-003`. |
| [production-design.md](production-design.md) | [`Display Conversion Class`](production-design.md#display-conversion-class) | Trim | Retain Color architecture. Remove duplicate spectral/result/display boundary and sole-conversion rules. |
| [production-design.md](production-design.md) | [`Shared Aggregate Model Component Models`](production-design.md#shared-aggregate-model-component-models) and [`Domain-Specific Models Outside The Shared Aggregate`](production-design.md#domain-specific-models-outside-the-shared-aggregate) | Trim | Retain the model taxonomy. Single ownership, immutable/versioned facts, descriptor fingerprints, and consumer-only orchestration repeat the guide. |
| [production-design.md](production-design.md) | [`Initial Profile Constant Inventory`](production-design.md#initial-profile-constant-inventory) and [`Spectral Component Model`](production-design.md#spectral-component-model) | Trim | Keep unique constant/model facts; consolidate per-value provenance, unit-boundary, channel-order, fixture, and citation rules. |
| [production-design.md](production-design.md) | [`Non-Goals`](production-design.md#non-goals) and [`Design Decisions`](production-design.md#design-decisions) | Trim | Keep true scope decisions. The durable recap of facade, owners, Reference, shader builder/runtime, Color, error phases, tests, and citations should point to the guide. |

## Facade And App Integration

| Document | Exact section or region | Disposition | Redundant guidance to consolidate |
| --- | --- | --- | --- |
| [api-facade-draft.md](api-facade-draft.md) | Document preamble, [`Design Goals`](api-facade-draft.md#design-goals), and [`Minimal Caller Path`](api-facade-draft.md#minimal-caller-path) | Trim | Keep the draft's scope and caller example. Facade ownership, CPU/GPU roles, config/setup failure behavior, renderer topology, and internal-builder boundary repeat the guide. |
| [api-facade-draft.md](api-facade-draft.md) | [`Selected Celestial Cache Extension`](api-facade-draft.md#selected-celestial-cache-extension) | Retain + link | Keep additive API implications only; cache identity, contribution order, camera behavior, resource namespace, and proof requirements belong to the cache design and guide. |
| [api-facade-draft.md](api-facade-draft.md) | [`Public Facade`](api-facade-draft.md#public-facade), `Constructor`, `config`, `setConfig`, `setupShader`, `evaluate`, `getDiagnostics`, and `dispose` | Trim | Keep signatures and method-specific behavior. Remove repeated model ownership, selected-ray scope, awaited update, loud setup failure, live safe-state, and disposal rules. Resolve the diagnostics conflict first. |
| [api-facade-draft.md](api-facade-draft.md) | [`Facade Configuration`](api-facade-draft.md#facade-configuration), [`Three Shader Setup Request`](api-facade-draft.md#three-shader-setup-request), [`Returned Shader Handle`](api-facade-draft.md#returned-shader-handle), and [`Composer Pass Behavior`](api-facade-draft.md#composer-pass-behavior) | Trim | Keep packet fields and handle contract. Consolidate unit, attachment, pass-order, resource, update, failure, and cleanup guidance. |
| [api-facade-draft.md](api-facade-draft.md) | [`Advanced Or Internal Operations`](api-facade-draft.md#advanced-or-internal-operations) and [`What Stays Out`](api-facade-draft.md#what-stays-out) | Trim after correction | Keep public-surface exclusions; remove general private-builder/owner rules and correct the rolled-back celestial API statement. |
| [integration.md](integration.md) | Document preamble, [`Integration Contract`](integration.md#integration-contract), and [`Ownership Boundaries`](integration.md#ownership-boundaries) | Trim | Keep app-specific contract and ownership handoff. Renderer topology, caller-versus-owner responsibilities, no custom GLSL/packing, failure phases, and Color boundary repeat the guide. |
| [integration.md](integration.md) | [`Planned celestial contribution-cache extension`](integration.md#planned-celestial-contribution-cache-extension) | Retain + link | Keep only app-visible future effects. Detailed cache identity, contribution order, failure, and camera rules belong to the cache design and guide. |
| [integration.md](integration.md) | [`Algorithm32 Config`](integration.md#algorithm32-config), [`Runtime Bindings`](integration.md#runtime-bindings), and [`Shader Setup Request`](integration.md#shader-setup-request) with its field subsections | Trim | Keep exact app packet fields, frames, and mapping examples. Consolidate unit, validation, attachment, live-input, required-binding, and setup-failure rules. |
| [integration.md](integration.md) | [`React/R3F Composer`](integration.md#reactr3f-composer), [`Required Scene Objects`](integration.md#required-scene-objects), `Ground`, `Solid Endpoint Objects`, `Excluded Visual Objects`, and [`Lights And Endpoint Shading`](integration.md#lights-and-endpoint-shading) | Trim | Keep React/Three mechanics and scene policy. Owner-contribution, capture, display, and no-duplicate-atmosphere-material rules repeat the guide. |
| [integration.md](integration.md) | [`Units, Bindings, And Scene Frames`](integration.md#units-bindings-and-scene-frames) | Trim | Keep app-specific frame conversions; link the guide for durable unit packets and validated private canonical scalars. |
| [integration.md](integration.md) | [`Runtime Loop`](integration.md#runtime-loop), [`Config Changes`](integration.md#config-changes), [`Diagnostics And Validation`](integration.md#diagnostics-and-validation), and [`Algorithm32 Runtime API`](integration.md#algorithm32-runtime-api) | Trim | Keep exact integration calls. Awaited replacement, live refresh, resize, error phases, safe state, diagnostics, and lifecycle ownership repeat the guide. |
| [integration.md](integration.md) | [`Integration Checklist`](integration.md#integration-checklist) | Retain + link | Keep app-specific completion checks; remove production-wide testing, resource, provenance, and acceptance rules. |

## Production And Cache Plans

Checked progress and phase-specific gates remain in plans. Repeated coding,
testing, and citation criteria should become links so a plan does not become a
second rules document.

| Document | Exact section or region | Disposition | Redundant guidance to consolidate |
| --- | --- | --- | --- |
| [implementation-plan.md](implementation-plan.md) | [`Planning Rules`](implementation-plan.md#planning-rules) | Replace | The production topology, one-owner, source/evidence, testing, failure, and no-runtime-POC rules belong to the guide. Keep only plan-maintenance conventions if needed. |
| [implementation-plan.md](implementation-plan.md) | [`Current Scaffold Touch Points`](implementation-plan.md#current-scaffold-touch-points) | Trim | Keep any still-useful path inventory; move current state/counts to status and link the guide for placement and testing. |
| [implementation-plan.md](implementation-plan.md) | [`Milestone 0`](implementation-plan.md#milestone-0-contract-and-scaffold-alignment) through [`Milestone 6`](implementation-plan.md#milestone-6-three-runtime-integration-and-handle-lifecycle) | Trim | Preserve checked work and milestone-specific deliverables. Their repeated `Reference/citation criteria`, owner, unit, facade/builder, shader assembly, binding, and lifecycle blocks duplicate the guide. |
| [implementation-plan.md](implementation-plan.md) | [`Milestone 7`](implementation-plan.md#milestone-7-validation-fixtures-and-evidence) and [`Milestone 8`](implementation-plan.md#milestone-8-first-production-cut) | Trim | Preserve milestone gates and completed history. Fixture envelopes, independent expectations, numbered references, named evidence, layered parity, commands, and claim discipline repeat the guide. |
| [implementation-plan.md](implementation-plan.md) | [`Milestone 9`](implementation-plan.md#milestone-9-celestial-contribution-cache-extension) | Replace | The companion cache plan owns detailed work; the guide owns common coding/testing/provenance rules. Retain only delegation and top-level progress. |
| [celestial-contribution-cache-plan.md](celestial-contribution-cache-plan.md) | [`Objective`](celestial-contribution-cache-plan.md#objective), [`Current Baseline`](celestial-contribution-cache-plan.md#current-baseline), and [`Planning Rules`](celestial-contribution-cache-plan.md#planning-rules) | Trim | Keep the objective and phase state. Link status for changing baselines and the guide/design for common topology, owner, unit, failure, no-runtime-import, and provenance rules. |
| [celestial-contribution-cache-plan.md](celestial-contribution-cache-plan.md) | `A0. Common qualification harness` through `A6. Freeze the first supported matrix` | Retain + link | The measurements, candidate families, budgets, artifacts, and Gate A checklist are unique. Repeated oracle provenance, predeclared tolerance, claim-boundary, platform citation, and test-discipline instructions should link to the guide/dossier. |
| [celestial-contribution-cache-plan.md](celestial-contribution-cache-plan.md) | [`Phase B`](celestial-contribution-cache-plan.md#phase-b-contracts-and-canonical-source-seam), [`Phase C`](celestial-contribution-cache-plan.md#phase-c-cpu-builder-and-immutable-artifact), and [`Phase D`](celestial-contribution-cache-plan.md#phase-d-gpu-resources-and-lifecycle) | Retain + link | Keep cache-specific deliverables and gates. Canonical ownership, units, `SpectralCalculator` sharing, resource validation, update safety, restoration, disposal, tests, and citations repeat the guide. |
| [celestial-contribution-cache-plan.md](celestial-contribution-cache-plan.md) | [`Phase E`](celestial-contribution-cache-plan.md#phase-e-references-oracle-fixtures-and-evidence-promotion), `E0. Selected source and core-oracle promotion`, and `E1. Runtime, scene, and readback fixture promotion` | Trim | Keep ordered checkboxes and gate dependencies. General promotion rules duplicate the guide, while selected row identities/claim limits belong to the dossier. This is also the strongest direct duplication with the dossier's `Promotion Protocol`. |
| [celestial-contribution-cache-plan.md](celestial-contribution-cache-plan.md) | [`Phase F`](celestial-contribution-cache-plan.md#phase-f-runtime-query-and-composition) and [`Phase G`](celestial-contribution-cache-plan.md#phase-g-production-proof-and-handoff) | Retain + link | Keep cache-specific work and acceptance gates. Contribution order, no second transmittance, camera identity, error behavior, layered parity, standard commands, evidence audit, and record-067 rules repeat the guide/design. |

## Cache Design And Research Dossier

The cache design remains canonical for its physics, logical values, runtime
queries, invalidation table, and cache-specific acceptance cases. These rows
identify only its cross-cutting overlap with the new guide.

| Document | Exact section or region | Disposition | Redundant guidance to consolidate |
| --- | --- | --- | --- |
| [celestial-contribution-cache-design.md](celestial-contribution-cache-design.md) | Document preamble and [`Decision Summary`](celestial-contribution-cache-design.md#decision-summary) | Retain + link | Keep the cache definition and exclusions. Reconciliation authority, current implementation truth, record-067 status, topology preservation, and general proof rules repeat the guide/status. |
| [celestial-contribution-cache-design.md](celestial-contribution-cache-design.md) | [`Requirements Ledger`](celestial-contribution-cache-design.md#requirements-ledger), especially `CCC-R10` through `CCC-R15` | Retain + link | The requirement IDs remain canonical cache invariants. Their generic unit, no-runtime-import, failure, shader order, and layered-test explanations can link to the guide. |
| [celestial-contribution-cache-design.md](celestial-contribution-cache-design.md) | [`Architecture Placement`](celestial-contribution-cache-design.md#architecture-placement) and [`Ownership`](celestial-contribution-cache-design.md#ownership) | Trim | Keep cache-specific placement, builder/cache/preparation owners, and diagram. Generic facade, Reference, calculator, builder, runtime, attachment, Color, and app roles repeat the guide. |
| [celestial-contribution-cache-design.md](celestial-contribution-cache-design.md) | [`Logical Cache Contract`](celestial-contribution-cache-design.md#logical-cache-contract) and [`Cache Construction`](celestial-contribution-cache-design.md#cache-construction) | Retain + link | Keep descriptor/payload semantics and construction algorithm. Naming/placement, immutable ownership, unit validation, shared transport, provenance, packing, and awaited-build rules overlap the guide. |
| [celestial-contribution-cache-design.md](celestial-contribution-cache-design.md) | [`Common order`](celestial-contribution-cache-design.md#common-order), [`Shader And Facade Integration`](celestial-contribution-cache-design.md#shader-and-facade-integration), and [`Failure Policy`](celestial-contribution-cache-design.md#failure-policy) | Retain + link | Keep cache-specific slot, namespace, and invalid-query behavior. The surrounding assembly order, facade lifecycle, setup/live failure split, disabled-versus-invalid rule, and resource ownership repeat the guide. |
| [celestial-contribution-cache-design.md](celestial-contribution-cache-design.md) | [`Verification And Acceptance`](celestial-contribution-cache-design.md#verification-and-acceptance), including `Contract and builder tests`, `Resource and lifecycle tests`, `Runtime behavior tests`, and `Parity and qualification` | Trim | Keep every cache-specific test case and budget. Use the guide for fixture metadata, focused placement, generic resource lifecycle coverage, layered parity, proof-record discipline, and evidence promotion. |
| [celestial-contribution-cache-references.md](celestial-contribution-cache-references.md) | Document preamble and [`Identifier And Claim Rules`](celestial-contribution-cache-references.md#identifier-and-claim-rules) | Trim | Keep dossier-local `CCC-XR-*`/`CCC-EV-*` identifier meaning. General source pinning, claim boundaries, planning-versus-production identifiers, and promotion rules repeat the guide. |
| [celestial-contribution-cache-references.md](celestial-contribution-cache-references.md) | [`External Physics And Geometry References`](celestial-contribution-cache-references.md#external-physics-and-geometry-references), [`External Celestial Source References`](celestial-contribution-cache-references.md#external-celestial-source-references), [`External Placement And Platform References`](celestial-contribution-cache-references.md#external-placement-and-platform-references), and [`First-Party Oracle And Evidence Register`](celestial-contribution-cache-references.md#first-party-oracle-and-evidence-register) | Retain + link | Source/evidence identities, exact locators, checksums, quantities, roles, and non-claims are unique dossier data. Repeated instructions about how to cite, pin, classify, and promote them should link to the guide. |
| [celestial-contribution-cache-references.md](celestial-contribution-cache-references.md) | [`Phase Reference Map`](celestial-contribution-cache-references.md#phase-reference-map) | Replace | Phase routing duplicates the cache plan, which owns phase order. Keep source selection/claim limits in the dossier and let the plan link to them. |
| [celestial-contribution-cache-references.md](celestial-contribution-cache-references.md) | [`Promotion Protocol`](celestial-contribution-cache-references.md#promotion-protocol) | Trim | Keep only cache-row selection and claim-limit crosswalk. General numbered-reference, named-evidence, fixture-owner, hash, and record promotion rules belong to the guide; ordered E0/E1 work belongs to the plan. |

## Historical Reviews And Provenance Catalogs

These documents contain useful historical facts or source inventories. Their
general rules should not remain current merely because the underlying rows are
retained.

| Document | Exact section or region | Disposition | Redundant guidance to consolidate |
| --- | --- | --- | --- |
| [production-code-architecture-poc-review.md](production-code-architecture-poc-review.md) | [`Summary`](production-code-architecture-poc-review.md#summary), [`Current Implemented State`](production-code-architecture-poc-review.md#current-implemented-state), and [`What Fits`](production-code-architecture-poc-review.md#what-fits) | Archive/correct | Keep dated review findings. CPU/GPU roles, owner split, production topology, units, display ownership, tests, and promotion recommendations repeat current rules or status. |
| [production-code-architecture-poc-review.md](production-code-architecture-poc-review.md) | `High: Ray-length scene input parity is deferred to app integration`, `Resolved: POC endpoint display scales are intentionally excluded`, and `Resolved: Spectral wavelength unit spelling was inconsistent across promoted code` | Archive/correct | Preserve finding evidence and resolution history, but link current scene-input testing, display separation, and plural-unit rules rather than presenting the review as authority. |
| [production-code-architecture-poc-review.md](production-code-architecture-poc-review.md) | [`Recommended Resolution Order`](production-code-architecture-poc-review.md#recommended-resolution-order) | Archive/correct | Historical plan; current plan/status own remaining work and the guide owns verification discipline. |
| [conclusions.md](conclusions.md) | [`Core Conclusion`](conclusions.md#core-conclusion), [`High-Level Algorithm Steps`](conclusions.md#high-level-algorithm-steps), and subsystem sections `Light / Sun Source`, `Geometry`, `Atmosphere`, `Incident Radiance Cache / Support`, and `Color` | Archive/correct | Historical owner/algorithm summary substantially overlaps current Reference, transport, cache, shader, and Color rules. Preserve only unique factual conclusions not superseded by production design. |
| [conclusions.md](conclusions.md) | [`Data Flow`](conclusions.md#data-flow) | Archive/correct | Obsolete packet/API names conflict with current production; do not consolidate them into current guidance. |
| [conclusions.md](conclusions.md) | [`Numerical Sampling Controls`](conclusions.md#numerical-sampling-controls), `Flat / Local Sun POC Constants`, and `Inactive Or Rejected Constants` | Trim as historical | Keep unique constant/provenance ledgers. General execution-policy, source/evidence, fixture, tolerance, and claim-boundary rules repeat the guide. |
| [conclusions.md](conclusions.md) | [`Production Carry-Forward`](conclusions.md#production-carry-forward) and [`Follow-Up: Reconciliation Lane`](conclusions.md#follow-up-reconciliation-lane) | Archive/correct | Superseded production plan/promotion guidance. Current design, plans, status, and guide now own those decisions. |
| [external-reference-log.md](external-reference-log.md) | [`Original Title: Reference Decision Log`](external-reference-log.md#original-title-reference-decision-log), [`Log Rules`](external-reference-log.md#log-rules), and [`Expected-Value Intake Workflow`](external-reference-log.md#expected-value-intake-workflow) | Archive/correct | The traceability goals overlap the guide, while the mandated fixture schema is stale. Retain the document as a historical source catalog, not current intake policy. |
| [external-reference-log.md](external-reference-log.md) | `Reference Proof Output And Atmosphere Priority`; `ResolveRayPath Controlled Segment Fixtures`; `sampleViewPath Planned Fixture References`; `evaluateMedium Planned Fixture References`; `integrateViewOpticalDepth Hardening Fixture Source Map`; `integrateSolarTransmittance Fixture Source Map` | Trim as historical | Keep unique reference/fixture/source-map rows. Remove repeated rules about independent expectations, assumptions, tolerances, branch coverage, and current production placement. |
| [external-reference-log.md](external-reference-log.md) | `Implemented Stage Spec Assertion Source Maps`; `Shared Test Utility Source Maps`; `Fixture File Metadata Sweep Source Map`; `expectation-fixtures.spec.js Validation Source Map` | Trim as historical | Keep unique mapping records. Test placement, fixture-envelope validation, per-row provenance, and claim classification belong to the guide. |
| [fixture-sources.md](fixture-sources.md) | [`Original Title: Fixture Sources`](fixture-sources.md#original-title-fixture-sources), [`Ready Now`](fixture-sources.md#ready-now), [`Partially Ready`](fixture-sources.md#partially-ready), [`Not Ready`](fixture-sources.md#not-ready), [`Current Fixture Files`](fixture-sources.md#current-fixture-files), and [`Candidate evaluateMedium Source Data`](fixture-sources.md#candidate-evaluatemedium-source-data) | Retain + link as historical | Keep unique source-readiness and file inventories. General readiness, provenance, expected-value independence, fixture placement, and promotion instructions repeat the guide and may describe retired paths. |
| [evidence/README.md](evidence/README.md) | Entire document | Retain + link | Keep a one-line local directory purpose and inventory. Its source-mining-versus-production-ownership boundary repeats the guide. |
| [evidence/reference-fixtures/README.md](evidence/reference-fixtures/README.md) | Entire document | Retain + link | Keep copied-fixture provenance and inventory. Replace generic usage/ownership instructions with a guide link; the legacy embedded fields do not define current production fixture policy. |

## Sections That Remain Canonical, Not Redundant

The cleanup should not erase the following document-specific ownership:

- `status.md`: current implementation state, verification counts, open items,
  and immediate next action.
- `requirements.md`: accepted normative requirement IDs and required outcomes.
- `production-design.md`: surrounding production architecture and concrete
  implemented topology.
- `api-facade-draft.md`: provisional public signatures and packet fields.
- `integration.md`: exact app/React/Three calls, scene mapping, and examples.
- `implementation-plan.md` and `celestial-contribution-cache-plan.md`: ordered
  work, phase gates, checked progress, and historical completed checkboxes.
- `celestial-contribution-cache-design.md`: cache physics, logical measures,
  coordinates, query behavior, invalidation, and cache-specific acceptance.
- `celestial-contribution-cache-references.md`: exact source identities,
  locators, hashes, quantities, non-claims, and unresolved source gaps.
- `reconciliation-production-deltas.md`: the current gap inventory and closure
  state.
- Historical review, conclusion, reference, fixture, and evidence documents:
  unique dated findings, source records, and retained provenance only.

## Suggested Cleanup Order

1. Resolve the public error/diagnostics contract and remove the rolled-back
   celestial API claim.
2. Make the topic README route to the guide, then reduce README/status/delta
   rule recaps.
3. Preserve normative outcomes while trimming explanatory rule duplication in
   requirements and production design.
4. Preserve signatures and integration examples while trimming generic owner,
   lifecycle, failure, and test rules in the facade and integration guides.
5. Preserve checkboxes and gates while replacing repeated criteria blocks in
   both plans with guide and dossier links.
6. Preserve cache-specific behavior and source rows while trimming common
   rules from the cache design and dossier.
7. Mark reviews, conclusions, imported reference logs, fixture catalogs, and
   copied evidence README files as historical/provenance-only, then remove
   their stale current-policy language.
