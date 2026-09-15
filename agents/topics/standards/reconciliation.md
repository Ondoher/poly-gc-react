# Standards Reconciliation

## Status

- Repository: `C:/dev/poly-gc-react`
- Canonical standards root: `C:/Users/gande/.codex/documentation/standards`
- Standards governance: [documentation.md — Mental Model](C:/Users/gande/.codex/documentation/standards/documentation.md#mental-model)
- Generated developer guide: [STANDARDS.md](../../../STANDARDS.md) (generated after successful attestation)
- Audit date: 2026-09-15
- Audit basis: first normalization; HEAD `556eab479f7ddd873e9c42579316c65af8a5c2c8` plus current repository-owned documentation.
- Phase: `normalized`
- Decision status: The developer explicitly requested reconciliation after approving every disposition. All approved changes are applied. Attestation validation passes and the generated guide is current.
- Review companion: [Rules Comparison](rules-comparison.md) groups differing,
  more specific local, less specific local, and additional local rules by rule
  type. Developer decisions remain recorded in this report.
- Normalization marker: [normalization.json](normalization.json), created and validated at `2026-09-15T16:45:50.809Z`; 42 audited input files.
- Initial repository standards fingerprint: `sha256:6b59d974faf43320a2cbae201fc5ecec97fb4bd965093ae856e08d0784c1b592`.
- Existing dirty work: Preexisting deployable-apps README changes were preserved; approved setup-contract labeling and adoption status were added.
- Governing work context remains Deployable Apps Deployment Update. This audit does not change the active topic.

## Scope And Evidence

This is standards-documentation/configuration reconciliation, not an application-code compliance review. Approved canonical rules, local authority/configuration, and topic references were updated. Source implementation, package configuration, installed versions, deployment, Git index, and commits were not changed.

Loaded Codex-root and repository-root instructions, active-topic routing and its minimal sources during bootstrap; examined the standards topics, relevant Pipeline page guidance, component-porting references, context/routing documents, testing READMEs, and script guidance. Searched repository Markdown for other engineering authority and obsolete topic controls. Inspected folder/file inventories and package command configuration to propose applicability. Scanned 166 tracked Markdown files in the root, agents, scripts, and spec surfaces for explicit local Markdown file targets. That link check skips external URLs, placeholders, and targets containing spaces; it is not a complete anchor or code-path validator.

Product requirements, SVG/geometry algorithms, pipeline schemas, tile-generation semantics, contractor deliverables, deployment credentials/configuration ownership, and recorded release behavior remain project facts. A requirement inside those documents is not automatically an engineering standard. Historical archives, backup copies, generated output, dependencies, and external ModMod source are not active authority. Independently rooted `deployed-apps/naginator` owns its own standards and is outside this audit.

Canonical comparisons used documentation, architecture, code-conventions, jsdoc, types, remvc, react, polylith, testing, app-shells, project-foundation, server, data-persistence, accessibility, localization, local-https, and socket-io sources. Canonical rule IDs and section citations below identify the relevant comparison; this is not a claim that application code satisfies those rules.

## Summary

All 38 findings have recorded developer decisions; none remains pending or deferred.

- Duplicate-note conflicts resolved: DIV-018 promotes the testing-sequence preference globally; DIV-032 retains server/watcher coordination locally.
- Remaining recommendations accepted: DIV-001, DIV-004, DIV-006, DIV-012, DIV-013, DIV-022, DIV-029, DIV-030, including the proposed folder configuration.
- Split decisions: DIV-019 owns test.js promotion; DIV-031 owns obsolete-plan removal. DIV-015 owns temporary asset copying; DIV-032 owns process coordination.
- Additional annotated concerns are recorded in DIV-033 through DIV-038.
- All approved promotions, local refinements, removals, and reference replacements have been applied.

| Recorded developer disposition | Count |
| ------------------------------ | ----: |
| `promote-global`               |     6 |
| `add-local`                    |     9 |
| `replace-local`                |     1 |
| `remove-local`                 |    12 |
| `already-covered`              |    10 |
| `pending`                      |     0 |

For configuration findings, `add-local` means creating the proposed applicability configuration after review, not manufacturing a governance overlay. For DIV-038 it records retention of local product requirements in their owning topic. `remove-local` means removing a conflicting instruction from the normative documentation; it does not authorize changing application source or falsely describing the installed implementation as migrated.

## Applied Folder Configuration For DIV-001

The [manifest](manifest.md) is the sole owner of the approved sets and assignments. The [overlay](overlay.md) owns local additions and replacements. The shared parser validates inheritance and deterministic longest-folder selection. Independently rooted Naginator remains outside host applicability.

Governance-only documentation folders receive the continuity and process rules through documentation.md sections. This resolves the report's suggested architecture target without expanding their selected standards. The GC randomness ADD has repository scope with explicit participating-domain boundaries in its rule; it does not impose GC dependencies on other apps or tooling.

Capability selection records intended rules, not implementation compliance. Root test orchestration, concrete Pipeline default selection, deployment setup migration, persistence contracts, local HTTPS defaults, and formatting readiness remain implementation/adoption concerns.

## Divergences

The source comparisons and recommendations below preserve the **audit baseline**. They do not define current rules. Developer decisions govern the applied results; current authority is the manifest, overlay, and selected canonical standards.

### DIV-001: Missing folder manifest and overlay

- Canonical source: [documentation.md — Folder Standards Manifest](C:/Users/gande/.codex/documentation/standards/documentation.md#folder-standards-manifest); [documentation.md — Repository Standards Overlay](C:/Users/gande/.codex/documentation/standards/documentation.md#repository-standards-overlay)
- Repository source: [agents/topics/standards/README.md](C:/dev/poly-gc-react/agents/topics/standards/README.md)
- Canonical rule: Named sets, a root folder assignment, canonical links, and one overlay determine applicability.
- Repository rule: No manifest.md or overlay.md exists; topic navigation currently leads to local rules.
- Behavioral difference: No file has a resolvable standards set; inheritance, scopes, and canonical links cannot be validated.
- Information at risk: Existing local guidance must be inventoried before creating the configuration.
- Agent recommendation: `add-local`
- Recommendation rationale: Create the proposed folder configuration below and one overlay during reconciliation; this is a configuration disposition, not an ADD targeting governance.
- Developer decision: `add-local`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Created manifest.md and overlay.md with the approved folder sets and assignments.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-002: Topics claim standards authority

- Canonical source: [documentation.md — Project Topics](C:/Users/gande/.codex/documentation/standards/documentation.md#project-topics); [documentation.md — Global Standards Ownership](C:/Users/gande/.codex/documentation/standards/documentation.md#global-standards-ownership)
- Repository source: [agents/topics/standards/README.md](C:/dev/poly-gc-react/agents/topics/standards/README.md); [agents/topics/context/routing.md — Main Areas](C:/dev/poly-gc-react/agents/topics/context/routing.md#main-areas); [agents/topics/README.md — Top-Level Areas](C:/dev/poly-gc-react/agents/topics/README.md#top-level-areas)
- Canonical rule: Global documents own engineering rules; topics own project facts.
- Repository rule: Standards README says the area owns repo-wide conventions; indexes route to topic-owned standards.
- Behavioral difference: Readers can treat local topic prose as competing engineering authority.
- Information at risk: Preserve routing, app identities, concrete paths, and implementation facts.
- Agent recommendation: `already-covered`
- Recommendation rationale: Replace authority claims and repeated rules with links to manifest/overlay and canonical subjects, applying the separately reviewed differences below.
- Developer decision: `already-covered`
- Developer notes: Section 1 / Engineering-rule authority: "use canonical rule". Replace topic-owned engineering authority with canonical references and manifest/overlay routing.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced topic authority claims in AGENTS, topic indexes, standards README, and context routing with manifest/overlay/canonical references.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-003: Current-state and history exceptions disagree

- Canonical source: [architecture.md — Canonical Documentation Ownership](C:/Users/gande/.codex/documentation/standards/architecture.md#canonical-documentation-ownership)
- Repository source: [AGENTS.md — Topic Bootstrap](C:/dev/poly-gc-react/AGENTS.md#topic-bootstrap); [agents/topics/standards/README.md — Documentation State](C:/dev/poly-gc-react/agents/topics/standards/README.md#documentation-state); [agents/topics/context/bootstrap.md](C:/dev/poly-gc-react/agents/topics/context/bootstrap.md)
- Canonical rule: Keep current facts, plans, and historical evidence separate.
- Repository rule: AGENTS limits chronology to the designated log, while older standards/context text allows decision sequences in status documents.
- Behavioral difference: An agent can accumulate history in a current status document under the older exception.
- Information at risk: Keep task checkboxes, experiment evidence, archives, and the active-topic reload procedure.
- Agent recommendation: `add-local`
- Recommendation rationale: Consolidate the repository-specific log and status-refresh convention in one ADD targeting architecture.md#Canonical Documentation Ownership, Scope: repository; keep operational bootstrap routing in AGENTS.
- Developer decision: `add-local`
- Developer notes: Sections 2 and 4 / History placement and Status refresh triggers: "keep local refinement" / "keep local". Retain designated-log chronology, checked-off plan progress, and explicit status-refresh triggers as local refinements; remove the conflicting older status-history allowance.
- Re-review required: `no`
- Reconciliation result: Applied. Consolidated topic continuity in the overlay; removed permissive status-history wording from standards/context docs. The section target is documentation.md#Project Topics so governance-only documentation folders receive the rule.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-004: Single ownership and changed contracts are already covered

- Canonical source: [architecture.md — Ownership Principles](C:/Users/gande/.codex/documentation/standards/architecture.md#ownership-principles); [remvc.md — Models And Services](C:/Users/gande/.codex/documentation/standards/remvc.md#models-and-services); [types.md — General Types](C:/Users/gande/.codex/documentation/standards/types.md#general-types)
- Repository source: [AGENTS.md — Topic Bootstrap](C:/dev/poly-gc-react/AGENTS.md#topic-bootstrap)
- Canonical rule: Canonical facts have one owner; synthesized views are disposable; changed contracts replace declarations and consumers absent an accepted compatibility requirement.
- Repository rule: AGENTS repeats these requirements for manifests, sidecars, generated data, integrations, and docs.
- Behavioral difference: No material conflict; duplicate owners can drift.
- Information at risk: The explicit examples illustrate this repository and may remain as non-normative project context.
- Agent recommendation: `already-covered`
- Recommendation rationale: Reference the canonical rules instead of maintaining a second general rule list.
- Developer decision: `already-covered`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced duplicated AGENTS ownership and changed-contract prose with selected canonical references.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-005: Shared extraction based on hypothetical reuse

- Canonical source: [architecture.md — Feature Ownership](C:/Users/gande/.codex/documentation/standards/architecture.md#feature-ownership); [react.md — Shared And Feature-Local Ownership](C:/Users/gande/.codex/documentation/standards/react.md#shared-and-feature-local-ownership)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Feature Ownership And Structure](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#feature-ownership-and-structure)
- Canonical rule: Promote only after a real stable shared contract exists; hypothetical reuse is insufficient.
- Repository rule: Components likely to become cross-feature building blocks should move to the shared layer.
- Behavioral difference: Local guidance permits premature shared abstractions.
- Information at risk: Keep src/gc/components as the GC-specific shared location, with Pipeline ownership separate.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the speculative-reuse criterion and reference canonical promotion criteria.
- Developer decision: `promote-global`
- Developer notes: Section 1 / When to promote shared components: "promote local rule to be canonical". The developer selects actual OR reasonably anticipated cross-feature reuse as grounds for promotion, replacing the canonical prohibition on hypothetical reuse. Promote the reusable principle without copying the GC path into global rules; reconcile connected architecture/React statements consistently. This explicitly supersedes the agent remove-local recommendation.
- Re-review required: `no`
- Reconciliation result: Applied. Promoted anticipated component reuse in ARCHITECTURE-006/028 and REACT-017/049. Canonical private-helper extraction criteria remain intact; local feature/React/Pipeline guidance now references canonical ownership.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-006: Feature privacy and removal rules are already covered

- Canonical source: [architecture.md — Feature Ownership](C:/Users/gande/.codex/documentation/standards/architecture.md#feature-ownership); [polylith.md — Synthetic Modules And Features](C:/Users/gande/.codex/documentation/standards/polylith.md#synthetic-modules-and-features)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Feature Ownership And Structure](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#feature-ownership-and-structure); [agents/topics/standards/architecture/feature-mechanics.md — Runtime Feature Activation](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#runtime-feature-activation); [agents/topics/standards/architecture/overview.md — Feature Boundaries](C:/dev/poly-gc-react/agents/topics/standards/architecture/overview.md#feature-boundaries)
- Canonical rule: Private feature trees, deliberate public composition seams, side-effect activation, and complete removability define feature boundaries.
- Repository rule: The local documents repeat those requirements, including documented intentional cross-feature composition.
- Behavioral difference: The documented public-entry exception is compatible; it is not general permission to import internals.
- Information at risk: Retain concrete feature/build examples and app-specific shared paths.
- Agent recommendation: `already-covered`
- Recommendation rationale: Reference canonical privacy, activation, and removal rules; preserve implementation examples.
- Developer decision: `already-covered`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced feature privacy, removal, and activation copies with canonical references; retained local shared-component paths and activation facts.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-007: Service filenames permit camelCase controllers

- Canonical source: [code-conventions.md — JavaScript And Module Shape](C:/Users/gande/.codex/documentation/standards/code-conventions.md#javascript-and-module-shape)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Registry services use identifier-derived kebab-case or the documented feature-local controller/view basename exceptions.
- Repository rule: Names such as mjController.jsx are an explicitly permitted feature-prefixed controller convention.
- Behavioral difference: Local convention permits a basename the canonical naming rule does not.
- Information at risk: The mj:controller service identity is separate from its implementation basename; historical examples need not become new naming policy.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the camelCase naming permission. Record existing names as implementation facts; source renames require a separate implementation task.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Controller service filenames: "use canonical rule". Adopt canonical registry-service filename conventions and remove the local camelCase exception.
- Re-review required: `no`
- Reconciliation result: Applied. Removed the camelCase controller naming exception; retained mjController.jsx only as an existing filename fact.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-008: Service declarations export interfaces instead of remaining ambient

- Canonical source: [jsdoc.md — Types and declarations](C:/Users/gande/.codex/documentation/standards/jsdoc.md#types-and-declarations); [types.md — Interface Types](C:/Users/gande/.codex/documentation/standards/types.md#interface-types)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Adjacent service declarations are ambient, contain no imports/exports, extend the shared EventBus, and describe implemented public methods.
- Repository rule: The service .d.ts should export an interface mirroring this.implement(...).
- Behavioral difference: Exporting makes the declaration module-scoped rather than the required ambient contract.
- Information at risk: Preserve adjacent basenames, public method documentation, and lifecycle exclusions.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the exported-interface instruction and reference canonical ambient service contracts. Do not rewrite source declarations in a documentation audit.
- Developer decision: `promote-global`
- Developer notes: Section 1 / Service declaration exports: "that's an error in the canonical rules. promote local correction". Correct canonical service declarations to export their public service interface; do not extend that correction to unrelated ambient data types. Section 3 / Service event contract: "use canoni" means retain the shared EventBus inheritance contract, avoid per-service event-method redeclarations, and retain lifecycle exclusions. These notes address different aspects, not conflicting export decisions. Reconcile connected code-conventions/jsdoc/types language during the eventual promotion.
- Re-review required: `no`
- Reconciliation result: Applied. Updated CODE-CONVENTIONS-015/016, JSDOC-001/002/006, and TYPES-002/012 for adjacent exported service interfaces. Shared EventBus remains canonical; general data contracts remain ambient. Removed local duplicate declaration/event instructions.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-009: JSDoc type requirement excludes JSX

- Canonical source: [jsdoc.md — Tags](C:/Users/gande/.codex/documentation/standards/jsdoc.md#tags)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Both JavaScript and JSX parameter/return tags carry explicit types.
- Repository rule: Explicit types are required for .js specifically and are expressly not a blanket requirement for other file types.
- Behavioral difference: JSX can remain untyped under local guidance.
- Information at risk: Retain complex types in their canonical ambient declarations.
- Agent recommendation: `remove-local`
- Recommendation rationale: Replace the .js-only qualification and untyped tag example with a canonical reference.
- Developer decision: `remove-local`
- Developer notes: Section 1 / File types requiring typed tags: "use canonical rule". Typed parameter/return tags apply to both JS and JSX.
- Re-review required: `no`
- Reconciliation result: Applied. Removed the local JS-only explicit-type restriction; canonical JSDoc now governs JS and JSX.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-010: JSDoc descriptions overgeneralize verb phrases

- Canonical source: [jsdoc.md — Descriptions](C:/Users/gande/.codex/documentation/standards/jsdoc.md#descriptions)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Non-callables use noun phrases; constructors use Creates; public methods use Call this method to; callbacks may name their caller.
- Repository rule: All JSDoc comments should start with active verb phrases; events use Called by ... when ....
- Behavioral difference: The general instruction also governs types/properties where canonical noun descriptions are required.
- Information at risk: Preserve caller/event timing where it explains the contract.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the universal verb-phrase requirement and defer description forms to canonical JSDoc.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Description grammar: "use canonical rule". Adopt entity-specific canonical description forms.
- Re-review required: `no`
- Reconciliation result: Applied. Removed universal verb-phrase JSDoc instructions in favor of canonical declaration/callable wording.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-011: Class, utility, and constant ownership guidance is weaker

- Canonical source: [code-conventions.md — Classes And Utilities](C:/Users/gande/.codex/documentation/standards/code-conventions.md#classes-and-utilities); [code-conventions.md — JavaScript And Module Shape](C:/Users/gande/.codex/documentation/standards/code-conventions.md#javascript-and-module-shape); [types.md — Class Types](C:/Users/gande/.codex/documentation/standards/types.md#class-types)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions); [agents/topics/standards/scripts/README.md — General Guidance](C:/dev/poly-gc-react/agents/topics/standards/scripts/README.md#general-guidance)
- Canonical rule: Class-private support stays in private instance methods; reusable operations need a real cohesive owner; shared constants use consts.js.
- Repository rule: Stateless code may be plain functions; data constants belong in nearby consts.js without distinguishing shared from private.
- Behavioral difference: Purity alone can justify extracting class-owned helpers or constants into artificial modules.
- Information at risk: Keep the thin CLI and cohesive runner/processor design rationale.
- Agent recommendation: `remove-local`
- Recommendation rationale: Replace the broad utility/constant exceptions with canonical ownership rules; retain repository tooling facts.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Placement of constants: "use canonical"; section 3 / Stateless helper extraction: "use canonical". Adopt canonical constant ownership and class-private helper rules for both parts of this finding.
- Re-review required: `no`
- Reconciliation result: Applied. Removed broad utility-purity and all-constants extraction rules; canonical private class helpers and shared constants govern.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-012: REMVC and service lifecycle repetitions

- Canonical source: [remvc.md — Registry](C:/Users/gande/.codex/documentation/standards/remvc.md#registry); [remvc.md — Service Lifecycle](C:/Users/gande/.codex/documentation/standards/remvc.md#service-lifecycle); [remvc.md — Views And React Presentation](C:/Users/gande/.codex/documentation/standards/remvc.md#views-and-react-presentation)
- Repository source: [agents/topics/standards/architecture/remvc.md](C:/dev/poly-gc-react/agents/topics/standards/architecture/remvc.md); [agents/topics/standards/architecture/overview.md — Dependency Direction](C:/dev/poly-gc-react/agents/topics/standards/architecture/overview.md#dependency-direction); [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Registry-centered app services, constructor seams within private units, local start, dependency-ready setup, and view-mediated presentation are canonical.
- Repository rule: Local documents repeat these boundaries and describe direct controller rendering as an existing compromise.
- Behavioral difference: No substantive exception is established by describing current imperfect implementation.
- Information at risk: Preserve historical origin and accurate current architecture limitations as project facts.
- Agent recommendation: `already-covered`
- Recommendation rationale: Replace repeated requirements with canonical links, retaining concrete architecture facts and the exploratory event-tag note as context.
- Developer decision: `already-covered`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced REMVC, dependency, and lifecycle rule copies with canonical references; preserved conversion history and known direct-controller-rendering behavior.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-013: React and CSS layout rules are already covered

- Canonical source: [react.md — Component Shape](C:/Users/gande/.codex/documentation/standards/react.md#component-shape); [react.md — CSS And Layout Ownership](C:/Users/gande/.codex/documentation/standards/react.md#css-and-layout-ownership)
- Repository source: [AGENTS.md — Topic Bootstrap](C:/dev/poly-gc-react/AGENTS.md#topic-bootstrap); [agents/topics/standards/react-code/README.md](C:/dev/poly-gc-react/agents/topics/standards/react-code/README.md); [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Classes for substantial presentation, semantic render regions, local interaction state, CSS ownership, Grid, and decorative backgrounds are canonical.
- Repository rule: The repository repeats these rules across AGENTS, React, feature, and asset notes.
- Behavioral difference: Duplicate rule sources add drift without a distinct project requirement.
- Information at risk: Keep app-specific visual requirements and stylesheet locations.
- Agent recommendation: `already-covered`
- Recommendation rationale: Replace repeated rules with canonical links; use the narrower decisions for private helpers and shared extraction.
- Developer decision: `already-covered`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced local React/CSS/layout copies with canonical references; retained app component directories and asset output examples.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-014: Copied asset rules versus the local CSS-import ban

- Canonical source: [polylith.md — Copied Assets And Runtime Paths](C:/Users/gande/.codex/documentation/standards/polylith.md#copied-assets-and-runtime-paths)
- Repository source: [agents/topics/standards/architecture/build-and-assets.md — Imported CSS](C:/dev/poly-gc-react/agents/topics/standards/architecture/build-and-assets.md#imported-css); [agents/topics/standards/architecture/build-and-assets.md — Practical Placement Rules](C:/dev/poly-gc-react/agents/topics/standards/architecture/build-and-assets.md#practical-placement-rules)
- Canonical rule: Build descriptors own copied source/output paths; emitted layout owns runtime URLs.
- Repository rule: Shipped styling should use declared assets/css; CSS imports are deprecated.
- Behavioral difference: Canonical copied-asset rules do not independently ban imported CSS.
- Information at risk: Preserve the chosen copied-stylesheet delivery contract and GC/Pipeline path examples.
- Agent recommendation: `add-local`
- Recommendation rationale: Move only the CSS-import deprecation/default into ADD polylith.md#Copied Assets And Runtime Paths, Scope: folder:src/. Replace other repeated asset rules with canonical references.
- Developer decision: `promote-global`
- Developer notes: Section 2 / Shipped CSS delivery: "create a synthesized rule and promote"; section 4 / imported CSS: "update canonicalwith import prohibition". Proposed synthesis for later application: In Polylith applications, ship stylesheets through declared copied-asset descriptors rather than JavaScript/JSX CSS module imports. Keep CSS with its app/feature owner under the declared asset tree and derive URLs from the emitted layout. Prohibit CSS module imports for shipped styling. This combines canonical asset ownership/path rules with the requested import prohibition; it does not prohibit CSS url(...) asset references.
- Re-review required: `no`
- Reconciliation result: Applied. Added POLYLITH-056 for copied shipped stylesheets and the prohibition on JS/JSX CSS module imports; retained CSS url() asset references. Local build notes reference the canonical section.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-015: Live-dev asset copy shortcut

- Canonical source: [polylith.md — Copied Assets And Runtime Paths](C:/Users/gande/.codex/documentation/standards/polylith.md#copied-assets-and-runtime-paths); [polylith.md — Commands And Troubleshooting](C:/Users/gande/.codex/documentation/standards/polylith.md#commands-and-troubleshooting)
- Repository source: [agents/topics/standards/architecture/overview.md — Build And Assets](C:/dev/poly-gc-react/agents/topics/standards/architecture/overview.md#build-and-assets); [AGENTS.md — Topic Bootstrap](C:/dev/poly-gc-react/AGENTS.md#topic-bootstrap)
- Canonical rule: Use declared build assets and package commands; authored input owns generated output.
- Repository rule: Newly added assets may be copied temporarily to matching dist paths, with normal builder reconciliation later. The no-duplicate-server convention is separately tracked in DIV-032.
- Behavioral difference: The local workflow permits a temporary generated-output refresh outside the normal builder.
- Information at risk: Preserve the no-duplicate-server operating convention; temporary copies must never become authored authority.
- Agent recommendation: `add-local`
- Recommendation rationale: Place the asset-only shortcut in ADD polylith.md#Copied Assets And Runtime Paths, Scope: repository, deriving destinations from build metadata. Resolve process-coordination ownership separately under DIV-032.
- Developer decision: `add-local`
- Developer notes: Sections 2 and 4 / newly added assets: "keep loca overridel" / "keep local". Retain the narrowly scoped temporary asset-copy workflow locally, using destinations derived from build metadata and eventual builder reconciliation. ADD is appropriate because the canonical asset rule does not forbid this workflow. Server/watcher coordination is separately tracked in DIV-032 and is confirmed local.
- Re-review required: `no`
- Reconciliation result: Applied. Added the temporary live asset refresh overlay with exact metadata-derived destinations and an assets-only boundary.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-016: Seeded Random utility selection is local

- Canonical source: [testing.md — Durable Test Principles](C:/Users/gande/.codex/documentation/standards/testing.md#durable-test-principles); [code-conventions.md — Classes And Utilities](C:/Users/gande/.codex/documentation/standards/code-conventions.md#classes-and-utilities)
- Repository source: [agents/topics/standards/architecture/randomness.md](C:/dev/poly-gc-react/agents/topics/standards/architecture/randomness.md)
- Canonical rule: Tests control randomness; reusable helpers have coherent ownership.
- Repository rule: Prefer src/gc/utils/random.js, seed at orchestration entry, avoid mid-flow reseeding, and select helpers by mutation/distribution semantics.
- Behavioral difference: Canonical standards do not prescribe this repository utility or its API.
- Information at risk: Keep pick/choose semantics and generator examples as utility/domain documentation.
- Agent recommendation: `add-local`
- Recommendation rationale: Use ADD testing.md#Durable Test Principles for GC and difficulty-script scopes (src/gc/, engines/mah-jong-experimental/, scripts/difficulty/). Apply the shared utility only where that GC-domain dependency is intended; do not force SAT or Pipeline to depend on GC.
- Developer decision: `add-local`
- Developer notes: Sections 2 and 4 / Random source, seeding, and selection helpers: "keep local rule" / "keep local". Preserve the GC utility, entry-point seeding, intentional-only reseeding, and pick/choose/distribution guidance in its existing domain scope.
- Re-review required: `no`
- Reconciliation result: Applied. Added one GC randomness overlay limited in its rule text to the existing participating GC folders; retained local utility API and replay examples.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-017: Test architecture and behavioral guidance are already covered

- Canonical source: [testing.md — Browser Build And Runner Boundary](C:/Users/gande/.codex/documentation/standards/testing.md#browser-build-and-runner-boundary); [testing.md — Service And Lifecycle Tests](C:/Users/gande/.codex/documentation/standards/testing.md#service-and-lifecycle-tests); [testing.md — Durable Test Principles](C:/Users/gande/.codex/documentation/standards/testing.md#durable-test-principles)
- Repository source: [agents/topics/standards/testing/testing.md](C:/dev/poly-gc-react/agents/topics/standards/testing/testing.md); [spec/README.md](C:/dev/poly-gc-react/spec/README.md); [spec/helpers/README.md](C:/dev/poly-gc-react/spec/helpers/README.md)
- Canonical rule: Polylith bundles browser specs, Karma/Jasmine runs them, direct Node lanes cover non-browser behavior, and tests prove observable domain promises.
- Repository rule: Local testing documentation repeats these boundaries with concrete command/config paths.
- Behavioral difference: Runner configuration and product scenarios are useful local facts, not alternate standards.
- Information at risk: Retain command names, testGroups examples, shared harness paths, and domain scenarios.
- Agent recommendation: `already-covered`
- Recommendation rationale: Replace generic testing rules with canonical references and preserve the repository test-lane inventory.
- Developer decision: `already-covered`
- Developer notes: Section 3 / Behavioral test obligations: "use canonical". Adopt canonical behavioral, failure, cleanup, determinism, and asynchronous-completion precision; preserve concrete local lane and domain examples as facts.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced generic testing instructions in testing/spec guidance with canonical references; retained lane commands, configs, discovery facts, and SVG-domain scenarios.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-018: Testing workflow explicitly prefers tests after implementation

- Canonical source: [testing.md — Durable Test Principles](C:/Users/gande/.codex/documentation/standards/testing.md#durable-test-principles)
- Repository source: [agents/topics/standards/testing/testing.md — Domain-Level Testing](C:/dev/poly-gc-react/agents/topics/standards/testing/testing.md#domain-level-testing)
- Canonical rule: Tests establish observable behavioral contracts; no mandatory implementation-versus-test ordering is specified.
- Repository rule: The intended posture is test-following-development rather than strict TDD.
- Behavioral difference: Local guidance adds a preferred engineering sequence.
- Information at risk: Do not convert the preference into permission to omit needed regression verification.
- Agent recommendation: `add-local`
- Recommendation rationale: Record the development-order preference once in ADD testing.md#Durable Test Principles, Scope: repository.
- Developer decision: `promote-global`
- Developer notes: The developer explicitly resolved the duplicate-note conflict: "2: promote". Promote the preference for design and implementation first, followed by tests against intended public behavior, to canonical testing guidance. Preserve it as a preference rather than a prohibition on other sequences or permission to omit verification. This supersedes the section 4 keep-local note and the agent add-local recommendation.
- Re-review required: `no`
- Reconciliation result: Applied. Added TESTING-065 for the implementation-first preference without prohibiting test-first work or omitting verification.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-019: Browser test entry filename differs

- Canonical source: [testing.md — Locations And Ownership](C:/Users/gande/.codex/documentation/standards/testing.md#locations-and-ownership); [polylith.md — Browser Tests](C:/Users/gande/.codex/documentation/standards/polylith.md#browser-tests)
- Repository source: [agents/topics/standards/testing/testing.md — How Specs Enter The Test Build](C:/dev/poly-gc-react/agents/topics/standards/testing/testing.md#how-specs-enter-the-test-build); `testing/implementation-plan.md` (removed; historical audit source)
- Canonical rule: App entry is src/<app>/spec.js importing @polylith/tests, with testGroups selecting owned specs.
- Repository rule: The current test guide uses src/<app>/test.js importing @polylith/tests. Its testGroups discovery agrees with canonical discovery. Obsolete manual-aggregation instructions are separately tracked in DIV-031.
- Behavioral difference: The current local and canonical guides differ on the browser entry basename, not on the discovery mechanism.
- Information at risk: Preserve verified commands; do not rewrite historical progress as current policy.
- Agent recommendation: `remove-local`
- Recommendation rationale: Original recommendation: adopt canonical spec.js naming. The developer instead chose promotion of test.js; apply the recorded developer decision. The separate obsolete-plan removal belongs to DIV-031.
- Developer decision: `promote-global`
- Developer notes: Section 1 / Browser test entry filename: "promote local as canonical". Make src/<app>/test.js the canonical browser test entry while retaining @polylith/tests and testGroups discovery. Update connected canonical testing/Polylith filename examples consistently during reconciliation. The obsolete manual-import plan is a separate remove-local decision in DIV-031; do not remove the current test lane.
- Re-review required: `no`
- Reconciliation result: Applied. Updated canonical testing and Polylith browser entry examples to src/<app>/test.js; retained synthetic discovery and server spec.js entries.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-020: Root test command does not represent complete repository verification

- Canonical source: [testing.md — Commands](C:/Users/gande/.codex/documentation/standards/testing.md#commands); [polylith.md — Commands And Troubleshooting](C:/Users/gande/.codex/documentation/standards/polylith.md#commands-and-troubleshooting)
- Repository source: [package.json](C:/dev/poly-gc-react/package.json); [agents/topics/standards/testing/testing.md — Current Test Support](C:/dev/poly-gc-react/agents/topics/standards/testing/testing.md#current-test-support)
- Canonical rule: Root npm test covers every owned test-bearing resident app and applicable server/shared lanes; child repositories test themselves.
- Repository rule: npm test delegates only to test:ui:gc while Pipeline, engine, and scripts lanes are separately documented.
- Behavioral difference: A default test invocation can omit other owned verification.
- Information at risk: The targeted GC loop remains useful; child Naginator tests remain independently owned.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove any implication that GC-only npm test proves complete repository verification; record the command gap for a separate implementation task rather than modifying scripts during reconciliation.
- Developer decision: `remove-local`
- Developer notes: Section 3 / Complete repository test command: "use canonical". Adopt complete owned-app/server/shared test orchestration as the governing contract; retain targeted commands as narrower loops. Recording this decision does not change package scripts or certify their coverage.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced the implied complete-root-test claim with the canonical contract and explicitly documented the existing GC-only root command as an implementation follow-up.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-021: Normalized script inputs need one rule owner

- Canonical source: [code-conventions.md — Validation And Failure Policy](C:/Users/gande/.codex/documentation/standards/code-conventions.md#validation-and-failure-policy); [testing.md — Private Collaborators And Test Seams](C:/Users/gande/.codex/documentation/standards/testing.md#private-collaborators-and-test-seams)
- Repository source: [scripts/shared/README.md — Options](C:/dev/poly-gc-react/scripts/shared/README.md#options)
- Canonical rule: Normalize at ingress and keep test seams within legitimate owner contracts.
- Repository rule: CLI parsing stays at the boundary, options.js normalizes values, and runners receive options/params with controlled I/O/logger seams.
- Behavioral difference: The specific argv/options helper contract is useful local tooling guidance outside the overlay.
- Information at risk: Keep the options.js API example; distinguish constructor/resource seams from test-only runtime parameters.
- Agent recommendation: `add-local`
- Recommendation rationale: Move only the boundary rule into ADD code-conventions.md#Validation And Failure Policy, Scope: folder:scripts/; retain helper API facts in its README and reference canonical test seams.
- Developer decision: `add-local`
- Developer notes: Sections 2 and 4 / CLI normalization: "keep local". Keep the local options.js and normalized options/params boundary convention.
- Re-review required: `no`
- Reconciliation result: Applied. Added the scripts-scoped normalized-input overlay; retained options.js API examples and referenced canonical test seams.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-022: Pipeline page instructions repeat general architectural rules

- Canonical source: [remvc.md — Feature Activation And Privacy](C:/Users/gande/.codex/documentation/standards/remvc.md#feature-activation-and-privacy); [app-shells.md — Shell Ownership](C:/Users/gande/.codex/documentation/standards/app-shells.md#shell-ownership); [react.md — Shared And Feature-Local Ownership](C:/Users/gande/.codex/documentation/standards/react.md#shared-and-feature-local-ownership)
- Repository source: [agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md — Page Boundary](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#page-boundary); [agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md — Prompt](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md#prompt); [agents/topics/products/asset-pipeline-3d/pipeline-app/app-shell.md — Current Pattern](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/app-shell.md#current-pattern)
- Canonical rule: Features own pages, models, views, CSS and tests; controllers coordinate behavior; views relay presentation.
- Repository rule: Pipeline runbooks/prompts repeat these requirements alongside page catalog, tileset behavior, and server-model contracts.
- Behavioral difference: Repeated engineering rules can become competing authority; Pipeline-specific behavior remains legitimate topic content.
- Information at risk: Preserve page workflow, API paths, concrete registration methods, tileset changes, and stage ownership.
- Agent recommendation: `already-covered`
- Recommendation rationale: Reference canonical architecture for generic boundaries; retain Pipeline facts and resolve the independent route/loading/model differences below.
- Developer decision: `already-covered`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced generic Pipeline runbook/prompt/current-log engineering rules with canonical references; preserved page workflows, API paths, registration methods, and tileset behavior.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-023: Pipeline shared model registration is mandatory locally

- Canonical source: [remvc.md — Models And Services](C:/Users/gande/.codex/documentation/standards/remvc.md#models-and-services)
- Repository source: [agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md — Page Boundary](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#page-boundary)
- Canonical rule: A model may expose a stable registered capability where justified; a service is not mandatory for every small domain object.
- Repository rule: Any model logic shared by two Pipeline pages moves to src/pipeline/models as a registry-backed model service.
- Behavioral difference: The local rule requires a registry seam even for shared pure model logic.
- Information at risk: Pipeline server-model and live shared model service contracts remain implementation facts.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the unconditional registration rule; use canonical criteria for deciding when a shared model is a registry capability.
- Developer decision: `add-local`
- Developer notes: Sections 2 and 4 / Model logic shared by Pipeline pages: "keep local refinement" / "keep local". Retain mandatory registry-backed placement in src/pipeline/models for logic shared by Pipeline pages. Target remvc.md#Models And Services with Scope: folder:src/pipeline/; the local rule narrows the allowed choice without adding a redundant facade requirement. This supersedes the remove-local recommendation.
- Re-review required: `no`
- Reconciliation result: Applied. Added the Pipeline-scoped mandatory shared-model registration overlay without requiring a redundant facade.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-024: Pipeline page records duplicate full routes

- Canonical source: [app-shells.md — URL Ownership](C:/Users/gande/.codex/documentation/standards/app-shells.md#url-ownership)
- Repository source: [agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md — Controller Shape](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#controller-shape)
- Canonical rule: The URL service owns full paths; page records own only page slugs.
- Repository rule: The page-registration example stores both urlSlug and route: /pipeline/<page-id>.
- Behavioral difference: The template creates a second route owner and hard-codes the app mount.
- Information at risk: Retain stable page ids, slugs, order, labels, and controller names.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the full-route field from the normative template; preserve existing runtime shape only as explicitly current implementation context.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Full route ownership: "use canonical". Page metadata owns slugs; the URL service owns full paths.
- Re-review required: `no`
- Reconciliation result: Applied. Removed full route from the Pipeline page-registration template; retained id, label, urlSlug, order, and controller.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-025: Pipeline initial-page policy conflicts with explicit defaults

- Canonical source: [app-shells.md — Page Registry](C:/Users/gande/.codex/documentation/standards/app-shells.md#page-registry); [app-shells.md — Empty, Initial, And Not-Found States](C:/Users/gande/.codex/documentation/standards/app-shells.md#empty-initial-and-not-found-states)
- Repository source: [agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md — Prompt](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md#prompt)
- Canonical rule: The executor selects an explicit default; unknown routes remain not-found; registry order is not a default policy.
- Repository rule: Initial load uses a matching URL slug and otherwise the first registered page.
- Behavioral difference: Changing registration order can change startup workflow and hide unknown URLs.
- Information at risk: The intended initial Pipeline page must be explicit before changing behavior.
- Agent recommendation: `defer`
- Recommendation rationale: Developer must identify the intended default and unknown-route behavior. Then decide canonical adoption or a narrow documented exception; do not infer a product choice from page order.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Initial and unknown page selection: "use canonical". Adopt explicit default selection and preserved unknown-route/not-found behavior. This resolves the standards disposition; the concrete initial Pipeline page remains a product choice for implementation and is not inferred from registration order.
- Re-review required: `no`
- Reconciliation result: Applied. Removed first-registered-page fallback from the normative Pipeline prompt; referenced canonical explicit-default and not-found behavior. Concrete default selection remains implementation work.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-026: Pipeline loading begins in the React mount template

- Canonical source: [remvc.md — Controllers](C:/Users/gande/.codex/documentation/standards/remvc.md#controllers); [remvc.md — Views And React Presentation](C:/Users/gande/.codex/documentation/standards/remvc.md#views-and-react-presentation)
- Repository source: [agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md — React Page Shape](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#react-page-shape); [agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md — Prompt](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md#prompt)
- Canonical rule: Controller owns feature loading and workflow; view mounting alone does not trigger unrelated data work.
- Repository rule: The page calls pageView.load({ quiet: true }) on mount; Reference Approval waits for component mount before requesting data.
- Behavioral difference: Presentation lifetime becomes the trigger for domain loading.
- Information at risk: Preserve the need for ready presentation subscriptions and stale-data handling.
- Agent recommendation: `remove-local`
- Recommendation rationale: Replace the generic page-owned loading instruction with controller-owned activation plus an explicit presentation-ready signal where the product requires it. Runtime changes are a separate task.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Data-loading trigger: "use canonical". Adopt controller-owned loading and view-mediated presentation readiness. The comparison correctly distinguishes a mount trigger from proof of domain ownership: pageView.load may relay to the controller. No source-compliance finding or source rewrite is claimed here.
- Re-review required: `no`
- Reconciliation result: Applied. Removed React mount as the generic owner of data loading; documented controller activation with view-mediated readiness where needed.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-027: Custom Pipeline tabs versus canonical MUI tabs

- Canonical source: [app-shells.md — Top Tabs](C:/Users/gande/.codex/documentation/standards/app-shells.md#top-tabs); [app-shells.md — Responsive And Accessibility Rules](C:/Users/gande/.codex/documentation/standards/app-shells.md#responsive-and-accessibility-rules)
- Repository source: [agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md — Prompt](C:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/canonical-prompt.md#prompt); [agents/topics/standards/components/porting-guidance.md](C:/dev/poly-gc-react/agents/topics/standards/components/porting-guidance.md)
- Canonical rule: Canonical top-tab shells require MUI Tabs and MUI keyboard behavior.
- Repository rule: Pipeline uses its own shared controls and themed tab shell; component porting guidance discourages automatic MUI adoption.
- Behavioral difference: Selecting app-shells without an explicit variant decision can implicitly require replacing the existing UI toolkit.
- Information at risk: Preserve product styling and keyboard/focus semantics; lack of MUI is not an exemption from accessibility.
- Agent recommendation: `replace-local`
- Recommendation rationale: For src/pipeline/ only, propose REPLACE app-shells.md#Top Tabs allowing custom semantic, keyboard-operable tabs with responsive ownership preserved, plus REPLACE app-shells.md#Responsive And Accessibility Rules preserving all applicable obligations while replacing the MUI-specific mechanism. Do not apply mui.md/base-components.md without an actual selected component system.
- Developer decision: `replace-local`
- Developer notes: Section 1 / Top-tab component system: "MUI is only required for apps implementing MUI. override locall". Retain a local conditional rule: MUI-specific mechanisms apply only where the app has selected MUI; non-MUI apps retain semantic, keyboard, focus, responsive, and accessibility obligations using their selected controls. Apply section-specific app-shells replacements to the affected non-MUI owning folders (currently the Pipeline comparison); do not turn this into a blanket accessibility exemption or global canonical change.
- Re-review required: `no`
- Reconciliation result: Applied. Added two Pipeline-scoped section replacements for top tabs and responsive/accessibility mechanisms, conditional on MUI selection while preserving applicable behavior requirements.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-028: Deployment setup contract differs from current canonical documentation

- Canonical source: [polylith.md — Repository And Deployment Roles](C:/Users/gande/.codex/documentation/standards/polylith.md#repository-and-deployment-roles); [server.md — Server-Root Composition](C:/Users/gande/.codex/documentation/standards/server.md#server-root-composition)
- Repository source: [agents/topics/standards/deployment/deployable-apps/README.md — Host Bootstrap Contract](C:/dev/poly-gc-react/agents/topics/standards/deployment/deployable-apps/README.md#host-bootstrap-contract); [package.json](C:/dev/poly-gc-react/package.json)
- Canonical rule: POLYLITH-055 specifies setup(context, isMaster), master then selected discovered setup once per repository, before routers.
- Repository rule: The topic describes a default-exported root-only setup and explicitly ignores discovered setup; package.json pins Polylith 1.2.1.
- Behavioral difference: These are materially different setup invocation and ownership contracts.
- Information at risk: Do not erase accurate release behavior or assume installed 1.2.1 implements newer canonical semantics.
- Agent recommendation: `defer`
- Recommendation rationale: Resolve the intended runtime/version contract before reconciliation. Keep installed behavior as project fact; if retaining a normative difference, record exact section-scoped exceptions only after that decision. No package upgrade or deployment is authorized by audit.
- Developer decision: `remove-local`
- Developer notes: Section 1 / both deployment setup rows: accept canonical for now; the developer plans to change this contract today. Adopt the current canonical setup signature/context and master-then-discovered setup sequence as the reviewed direction, replacing the previous defer disposition. Preserve the accurate installed 1.2.1 behavior as current implementation context until separately changed; planned work is not completion, package-upgrade authorization, or deployment evidence.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced the normative root-only deployment setup contract with canonical direction. Installed Polylith 1.2.1 signature/sequence remains explicitly labeled implementation evidence; runtime migration is listed as next work.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-029: Broken repository navigation links

- Canonical source: [documentation.md — Project Topics](C:/Users/gande/.codex/documentation/standards/documentation.md#project-topics)
- Repository source: [agents/topics/apps/README.md](C:/dev/poly-gc-react/agents/topics/apps/README.md); [agents/topics/documentation-restructure/migration-phases.md](C:/dev/poly-gc-react/agents/topics/documentation-restructure/migration-phases.md); [agents/topics/products/game-collection/mahjongg-solitaire/telemetry/telemetry-analysis.md](C:/dev/poly-gc-react/agents/topics/products/game-collection/mahjongg-solitaire/telemetry/telemetry-analysis.md)
- Canonical rule: Project routing should resolve to the owning current source.
- Repository rule: Three explicit Markdown file targets do not exist (listed in findings below).
- Behavioral difference: Readers are routed to missing app, archive, or deployment documentation.
- Information at risk: Do not invent replacement Flat or archive content.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove obsolete Flat navigation, resolve the migration archive link against the retained archive, and point telemetry deployment guidance to the current production runbook. Confirm archive intent if no retained equivalent exists.
- Developer decision: `remove-local`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Removed obsolete Flat navigation, repaired the retained archive and telemetry runbook links, and repaired the same migrated-topic navigation defect found during expanded checking in the engine README (to the retained engine/design-notes.md).
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-030: Canonical type documentation contains a broken section link

- Canonical source: [types.md — Interface Types](C:/Users/gande/.codex/documentation/standards/types.md#interface-types); [jsdoc.md — Tags](C:/Users/gande/.codex/documentation/standards/jsdoc.md#tags)
- Repository source: [agents/topics/standards/architecture/feature-mechanics.md — Naming And Placement Conventions](C:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: TYPES-014 links jsdoc.md#implemented-interfaces, but the @implements rule is JSDOC-022 under Tags.
- Repository rule: Local type guidance would begin relying on this canonical reference after normalization.
- Behavioral difference: The canonical link cannot resolve to the named heading.
- Information at risk: Preserve the @implements requirement; only navigation is defective.
- Agent recommendation: `promote-global`
- Recommendation rationale: Repair the canonical link to jsdoc.md#tags during approved reconciliation; this is a global reference repair with no repository-specific policy.
- Developer decision: `promote-global`
- Developer notes: The developer instructed: "follow the recommendation on all the pending decisions". Accept the recommendation and its stated scope, preserving separately recorded local refinements and canonical corrections.
- Re-review required: `no`
- Reconciliation result: Applied. Repaired TYPES-014 to jsdoc.md#tags without changing @implements requirements.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-031: Obsolete browser test aggregation plan

- Canonical source: [Testing browser discovery](C:/Users/gande/.codex/documentation/standards/testing.md#browser-build-and-runner-boundary)
- Repository source: `testing/implementation-plan.md` (removed; historical audit source); [current guide](testing/testing.md#how-specs-enter-the-test-build)
- Canonical rule: Polylith testGroups select specs through @polylith/tests.
- Repository rule: The old plan manually aggregates individual specs and says the lane is not wired; the current local guide already agrees with canonical discovery.
- Behavioral difference: This is a local mismatch between old and current documentation, separate from entry naming.
- Information at risk: Preserve the established test lane and current synthetic discovery.
- Agent recommendation: `remove-local`
- Recommendation rationale: Remove the obsolete manual-import testing plan and repair its navigation references; retain the working test lane and current guide.
- Developer decision: `remove-local`
- Developer notes: Section 1 / Browser spec discovery: "the older test lan has to be removed locally". In the preceding conversation this was identified as the older implementation plan, so remove that obsolete plan/instructions, not the current runtime test lane. Split from DIV-019 to preserve the distinct promotion decision for test.js.
- Re-review required: `no`
- Reconciliation result: Applied. Deleted the obsolete testing/implementation-plan.md and replaced incoming links with historical source labels. Current test discovery and executable lanes remain intact.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-032: Server and watcher coordination ownership

- Canonical source: [Polylith commands](C:/Users/gande/.codex/documentation/standards/polylith.md#commands-and-troubleshooting)
- Repository source: [AGENTS](../../../AGENTS.md); [comparison sections 2 and 4](rules-comparison.md)
- Canonical rule: Use declared project build/serve commands.
- Repository rule: Assume server/watcher already running; do not start duplicates without an explicit request.
- Behavioral difference: This adds a session/process-coordination requirement; the developer resolved its ownership as local.
- Information at risk: Preserve process coordination while avoiding unsupported assumptions about every other repository.
- Agent recommendation: `add-local`
- Recommendation rationale: Keep the existing session assumption local unless the developer selects global promotion.
- Developer decision: `add-local`
- Developer notes: The developer explicitly resolved the duplicate-note conflict: "1: keep local". Retain the assumption that the local server/watcher already run and the requirement not to start duplicates without an explicit request as repository-local operating guidance. Do not promote this session assumption globally. This supersedes the section 2 promote-to-canonical note.
- Re-review required: `no`
- Reconciliation result: Applied. Added the existing-development-processes overlay and replaced duplicated process instructions with references. The documentation loading section keeps this operating rule applicable to every assigned set.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-033: Complex type ownership precision

- Canonical source: [Type ownership](C:/Users/gande/.codex/documentation/standards/types.md#class-types); [JSDoc declarations](C:/Users/gande/.codex/documentation/standards/jsdoc.md#types-and-declarations)
- Repository source: [Local type guidance](architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Public API types use the owning ambient types.d.ts; class-private types have their own location; unions are named and documented; ambient bridges and repeated inline shapes are prohibited.
- Repository rule: The local summary says to use globally available types.d.ts for complex objects and document properties.
- Behavioral difference: The local summary omits the finer ownership and declaration constraints.
- Information at risk: Do not apply ambient data-type rules to undo the separately approved exported service-interface correction in DIV-008.
- Agent recommendation: `already-covered`
- Recommendation rationale: Use canonical precision through references, keeping DIV-008 as the specific service-interface correction.
- Developer decision: `already-covered`
- Developer notes: Section 3 / Complex type ownership: "use canonical". Added from the annotated comparison row that previously had no DIV identifier.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced local complex-type simplifications with canonical references, retaining the approved exported-service exception and ambient general data ownership.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-034: JSDoc coverage and observable failure detail

- Canonical source: [Descriptions](C:/Users/gande/.codex/documentation/standards/jsdoc.md#descriptions); [Tags](C:/Users/gande/.codex/documentation/standards/jsdoc.md#tags)
- Repository source: [Local JSDoc guidance](architecture/feature-mechanics.md#naming-and-placement-conventions)
- Canonical rule: Document every declared function/method, private support included, and caller-observable thrown errors, async rejection, and cancellation.
- Repository rule: The local summary focuses on description style, service interfaces, and non-obvious properties.
- Behavioral difference: The local summary does not state the complete coverage and failure-contract obligations.
- Information at risk: Keep concise contract-oriented documentation rather than implementation narration.
- Agent recommendation: `already-covered`
- Recommendation rationale: Reference canonical coverage and failure documentation rules.
- Developer decision: `already-covered`
- Developer notes: Section 3 / What receives JSDoc: "use canonical". Added from the annotated comparison row without an existing DIV identifier.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced duplicated or less precise JSDoc guidance with canonical callable, declaration, and failure-contract references.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-035: React class criteria, event handlers, and cleanup precision

- Canonical source: [Component shape](C:/Users/gande/.codex/documentation/standards/react.md#component-shape); [Events](C:/Users/gande/.codex/documentation/standards/react.md#props-state-and-events); [Lifecycle](C:/Users/gande/.codex/documentation/standards/react.md#effects-and-lifecycle)
- Repository source: [Local React guidance](react-code/README.md); [Pipeline page template](../products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#react-page-shape)
- Canonical rule: Define precise class/function criteria, require named event-handler references, clean all owned resources, and handle stale async work and partial setup.
- Repository rule: The local guide prefers substantial classes and callbacks; the page template unlistens on unmount but does not state the whole canonical contract.
- Behavioral difference: Local summaries are less specific, rather than explicit exemptions.
- Information at risk: Do not treat silence as a permission to bypass canonical requirements.
- Agent recommendation: `already-covered`
- Recommendation rationale: Reference canonical precision for these three concerns.
- Developer decision: `already-covered`
- Developer notes: Section 3 / Class-versus-function criteria, Event callback shape, and Lifecycle cleanup each say "use canonical". These newly identified rows are grouped because they have the same disposition and React rule owner. DIV-013 remains a separate unreviewed duplicate-rule cleanup item.
- Re-review required: `no`
- Reconciliation result: Applied. Replaced local React shape/event/lifecycle simplifications with canonical references, including cleanup requirements.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-036: Repository-specific compaction and reload procedure

- Canonical source: [Foundation bootstrap](C:/Users/gande/.codex/documentation/standards/project-foundation.md#documentation-bootstrap); [Governance loading](C:/Users/gande/.codex/documentation/standards/documentation.md#loading-procedure)
- Repository source: [AGENTS](../../../AGENTS.md); [active topic](../active-topic.md)
- Canonical rule: Bootstrap loads applicable instructions and active work context, with standards applicability resolved separately.
- Repository rule: The repository names Fresh Agent Route and Minimal Reload Sources/Reload Sources and mandates an active-topic reload after compaction/resume.
- Behavioral difference: The local procedure adds a specific reload convention to general bootstrap guidance.
- Information at risk: Retain actual project context links; this recorded decision does not immediately change current operating instructions.
- Agent recommendation: `remove-local`
- Recommendation rationale: Use canonical bootstrap guidance and preserve project routing facts without an independent conflicting procedure.
- Developer decision: `remove-local`
- Developer notes: Section 4 / After compaction or resume: "use canonical bootstrap guidance". Applies to the extra reload procedure, not approval to bypass applicable root instructions or existing skill gates before reconciliation.
- Re-review required: `no`
- Reconciliation result: Applied. Removed custom compaction/resume reload instructions and Fresh Agent Route; linked canonical loading/bootstrap guidance while retaining active topic, focus, and reload-source ownership.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-037: Pipeline controller and view service naming pair

- Canonical source: [Module naming](C:/Users/gande/.codex/documentation/standards/code-conventions.md#javascript-and-module-shape); [Shell ownership](C:/Users/gande/.codex/documentation/standards/app-shells.md#shell-ownership)
- Repository source: [Pipeline file shape](../products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#file-shape)
- Canonical rule: Use stable capability-oriented service identities and canonical implementation basenames.
- Repository rule: Pipeline page controllers use <page-id>-controller and views use <page-id>-view.
- Behavioral difference: The exact paired suffix convention is an additional app-local requirement.
- Information at risk: Do not impose the Pipeline identity convention on sibling apps or change the separately approved filename rule.
- Agent recommendation: `add-local`
- Recommendation rationale: Retain the naming pair in a narrow local addition targeting code-conventions.md#JavaScript And Module Shape, Scope: folder:src/pipeline/.
- Developer decision: `add-local`
- Developer notes: Section 4 / Name page controller services and page view services: "keep local".
- Re-review required: `no`
- Reconciliation result: Applied. Added the Pipeline page-controller/view service identity overlay; the runbook references this sole local rule owner.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

### DIV-038: Pipeline card nesting and task-focused copy

- Canonical source: [Project topic ownership](C:/Users/gande/.codex/documentation/standards/documentation.md#project-topics)
- Repository source: [Pipeline CSS shape](../products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#css-shape); [React page shape](../products/asset-pipeline-3d/pipeline-app/new-page-runbook.md#react-page-shape)
- Canonical rule: Product presentation requirements remain in their owning project topic.
- Repository rule: Use cards for repeated page items without nested cards; keep copy task-focused and avoid UI explanations unless an empty/error state warrants them.
- Behavioral difference: These are deliberate Pipeline product-presentation requirements, not missing generic engineering standards.
- Information at risk: Preserve the intended Pipeline visual/copy behavior without generalizing it to other apps.
- Agent recommendation: `add-local`
- Recommendation rationale: Retain these product rules in the Pipeline topic. Here add-local records local retention, not an engineering overlay or canonical promotion.
- Developer decision: `add-local`
- Developer notes: Section 4 / Keep repeated page items as cards and Keep page text task-focused both say "keep local". Keep these as product-owned topic facts under governance, not ADD entries that redefine generic React or accessibility rules.
- Re-review required: `no`
- Reconciliation result: Applied. Retained task-focused copy and no-nested-card requirements as Pipeline product requirements in the new-page runbook; did not create an engineering overlay for product design.
- Validation evidence: Re-read against the applied result and shared final validation below; no application-code compliance claim.

## Configuration And Reference Validation

All approved sources were re-read before application. Validation passed for 9 sets, 19 existing folder assignments, 9 overlays, 16 selected canonical documents, 790 unique canonical rule IDs, and deterministic mappings for 2,597 present repository-owned files. Both Pipeline replacements survive section-specific resolution. The retained archive target is `agents/topics/archive/mvp-summary.md`; the migrated engine design topic also exists. The removed test plan is cited only as a historical source.

Two helper defects found while applying the approved configuration were corrected in the global normalize-standards scripts: `overlayForPath` now returns `replacements` selected independently per canonical section, and attestation discovery stops at nested Git/Polylith repository boundaries. The folder helper passes that result through; the only direct property consumer was updated in its regression test. Seven shared-parser/attestation tests pass, including both Pipeline-style section replacements, nested Git directories/gitfiles, independent Polylith roots, and durable-marker validation. Naginator is excluded from host provenance and was not edited.

Formatting setup was completed in the subsequent authorized setup task. See [formatting status](README.md#formatting-status) for current verification; normalization itself is not an aggregate code-compliance review.

## Review gate

- [x] Every divergence has been reviewed manually.
- [x] No developer decision remains pending or deferred.
- [x] Decision-specific clarification is sufficient.
- [x] No source or precedence ambiguity remains.
- [x] The developer explicitly requested reconciliation.

## Generated developer guide

- Guide status: `current`.
- Guide source fingerprint: `sha256:e960183cf223adb5becde28562dc91465a61afdb96198e4bc4859d243d63e662`.
- Guide validation evidence: write returned `created`; check returned `current`, both with exit code 0.

## Final validation

- [x] All 38 approved decisions applied; no pending, ambiguous, or deferred dispositions.
- [x] Canonical promotions contain no repository-specific paths or identities.
- [x] Manifest inheritance, existing folders, canonical root/sections, and deterministic precedence validated.
- [x] Local engineering refinements have one overlay owner; topics retain project facts.
- [x] Re-audit found no unexplained engineering-rule divergence.
- [x] Checked 185 Markdown files and 761 resolving Markdown links; audited-source anchors and comparison/report table columns pass. The guide link is checked after generation.
- [x] Seven normalization-helper regression tests pass.
- [x] git diff --check passes.
- [x] First attestation created and validated with exit code 0; independently rooted apps excluded.
- [x] Generated guide check reports current.

Normalization status: `normalized`. Implementation adoption work remains as explicitly scoped above; it is not a deferred standards decision.
