# Pipeline App Review Data Boundary

This document owns the contract between the pipeline app and the pipeline
server for review pages.

Detailed canonical artifact and state schemas belong to
[3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md).
The app should not mirror those schemas as editable UI state.

## Core Rule

The pipeline app speaks the language of the review domain, not the storage
implementation.

The server may synthesize page view models from canonical state, durable fact
artifacts, diagnostics, and generated outputs. Those synthesized view models
are UI payloads only; they are not another source of truth and they do not
need to match `pipeline.json` shape.

When a user edits a review page, the app should send domain actions or
review-specific draft payloads back to the server. The server owns translating
those actions into canonical mutations.

```text
canonical state + artifacts
-> server-synthesized review view
-> app user intent / domain command
-> server reconciliation
-> canonical state update
```

## Why This Boundary Exists

Decoupling app payloads from canonical state lets the backend change canonical
storage without forcing the React pages to change every time a canonical
record moves between `state.bindings`, `state.parts`, stage stamps, durable
fact artifacts, or generated-asset state.

It also keeps UI-only intent from leaking into canonical records. For example,
manual unbinding is an edit operation. It should not be represented by
overloading a durable binding strength.

## App Payload Rules

Review pages may receive view models shaped for the page's workflow:

- card lists
- selectable part rows
- selectable component rows
- current review state
- source/preview asset URLs
- summary counts
- unresolved issue lists
- display labels and grouping

These records can contain denormalized, repeated, or presentation-friendly
fields. They are not canonical state and should not be read by later stages.

Review pages should send user intent back as domain language, such as:

- assign selected components to a source part
- clear selected component assignment
- update assignment configuration
- rerun source assignment
- save rendering option overrides
- rerender with the current options
- accept the current review gate

The server then validates the request against current canonical state and
writes the canonical state changes.

## Binding Review Implication

Canonical source bindings are a compact mutable structure owned by the server
and stage runners. The app should not treat `state.bindings` as its editable
state model.

For Source Assignment, the app can render a synthesized source review model
with bound/unbound parts, selectable components, and draft selections. User
actions should be expressed as review operations. The server reconciles those
operations into canonical binding and part-state updates.

Manual unbind is the guiding example:

- The UI action is "clear this component's assignment" or "accept this part as
  source-absent".
- The request payload may carry that action as transient command data.
- The server removes or updates canonical binding records and, when needed,
  updates the affected part state.
- The server must not persist a fake canonical binding solely to remember that
  an unbind action happened.

`strength: "none"` keeps its durable meaning: a component should not be
considered for algorithmic binding and is not bound to any part. It must not
be overloaded as a transport marker for "the user just unbound this".

## Source Assignment Review Commands

Source Assignment review has a small edit command surface:

- bind components
- unbind components
- change assignment configuration
- rerun assignment

Binding components means the reviewer assigns selected source components to a
semantic part. The server reconciles that command into canonical bindings,
using `strength: "strong"` for user-assigned bindings unless the current gate
later promotes them to `accepted`.

Unbinding components means the reviewer clears selected component assignments.
The request may carry the unbind intent, but the server resolves it by removing
or changing canonical bindings and by recalculating affected part review state.
The unbind operation itself must not be persisted as binding provenance.

Changing assignment configuration updates the stage configuration that controls
Source Assignment behavior. Rerunning assignment applies the current
configuration to the current canonical inputs and regenerates tentative
assignment proposals while preserving canonical user/accepted constraints that
are still valid for the current gate.

Gate acceptance is a stage transition, not a general editable payload shape.
It promotes the current accepted review result through server-owned canonical
mutations and should reload the synthesized review view afterward.

The Source Assignment binding update payload is a per-component action map.
Each entry carries:

```json
{
  "componentId": "source-component-id",
  "partId": "semantic-part-id-or-null",
  "action": "bind | unbind | none"
}
```

The UI seeds this map with all currently bound components using
`action: "none"`. As the reviewer edits the page, the UI updates the relevant
entries:

- `bind`: server writes or updates the component binding for `partId` with
  `strength: "strong"`.
- `unbind`: server removes the component binding.
- `none`: server leaves the existing binding unchanged.

This shape is still a UI/server contract, not canonical state. It gives the UI
a stable working map while keeping mutation intent explicit enough that the
server does not need to infer bind versus unbind from a raw desired-state
snapshot. The server remains responsible for validating the request against
current canonical data and applying canonical mutations.

## Single-User Freshness Flow

Concurrency control is not a design goal. This is a local, single-developer
tool, so review routes do not need multi-user conflict resolution or durable
revision-token machinery.

The freshness problem that matters is stale UI data after a server-side stage
transition. Because there is no required async communication layer, a page can
continue showing an older synthesized view after another action advances a
stage, reruns downstream stages, or clears/rebuilds bindings. Review actions
may carry a lightweight page freshness token, stage marker, or loaded-state
fingerprint so the server can reject or reload stale page submissions after a
stage transition. Treat that as a UI freshness guard, not as general
concurrency control.

The app can keep local draft state between clicks, but that draft is only a
pending UI edit. Canonical truth remains on the server. After server-side
stage transitions, the app should reload the synthesized review view.

## Server Responsibilities

The server owns:

- synthesizing review views from canonical state and artifacts
- validating domain actions against current canonical state
- applying canonical mutations
- preserving single-source-of-truth rules
- failing loudly on invalid payloads
- hiding backend storage refactors from stable page workflows where possible

## App Responsibilities

The app owns:

- presenting the review workflow clearly
- maintaining local draft interaction state
- sending user intent through page views/controllers and `server-model`
- invalidating or reloading page data after server-side stage transitions
- avoiding direct dependencies on canonical `pipeline.json` nesting

## Related Documents

- [Pipeline App README](README.md)
- [Pipeline App Canonical Prompt](canonical-prompt.md)
- [Pipeline UI Refactor](pipeline-ui-refactor.md)
- [3D Asset Pipeline State Contract](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/state-contract.md)
- [Alignment Assignment Contract](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/alignment-assignment-contract.md)
