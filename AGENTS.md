# Topic Bootstrap

On bootstrap, read only:

- [Active Topic](/c:/dev/poly-gc-react/agents/topics/active-topic.md)

After context compaction or an interrupted/resumed session, reload the active
topic file first and follow its Fresh Agent Route before continuing work.

Use the active topic file as the routing authority. If it names an active
topic, load the topic README named there, then load only the files listed under
`Minimal Reload Sources`. If there is no `Minimal Reload Sources` section, load
the files listed under `Reload Sources`.

Do not load the topics index, architecture overview, routing docs, archives,
production docs, code files, or adjacent topic docs during bootstrap unless the
current task clearly needs them. If a task needs routing, open the topics index
or routing doc then. If a task creates or moves code, open the architecture
overview or naming conventions then.

When switching topics, update the active topic file to the new topic id and
minimal reload set. If the user asks to add extra reload sources, add focused
relevant paths to that same file. After loading the active topic README and
minimal reload sources, announce the loaded topic and focus indicated by the
active topic file or topic README.

Topic continuity rules:

- Current-state, routing, design, and tracker documents must not accumulate
  running history. Put chronology only in the topic's designated log file. A
  plan may retain historical progress only as items that are checked off as
  work completes. Replace stale current facts instead of appending successor
  narratives.
- After a design decision, update the relevant topic status/design docs.
- After an implementation step, update relevant status docs with what changed,
  what was verified, and what remains next.
- After any explicit request for documentation updates, update all relevant
  topic docs and remove stale/redundant wording.
- When the user says "checkpoint", refresh status docs and, when relevant,
  add or update focused subtopic notes in the current topic document.
- In all of these cases, specifically make sure any relevant status document
  reflects the current state before finishing.

Working conventions:

- Backwards compatibility is technical debt. When a design contract changes,
  commit to the new design across all integrations, schemas, tests, fixtures,
  generated data, and docs instead of preserving legacy aliases or fallback
  behavior unless the user explicitly asks for a migration bridge.
- Always keep a single source of truth for canonical facts. Do not duplicate
  ownership of paths, settings, status, counts, selections, or derived metadata
  across manifests, sidecars, UI state, generated artifacts, and docs. Store
  each fact in its owning canonical artifact, and let stale consumers fail
  loudly instead of keeping shadow copies in sync. It is acceptable for the
  server to synthesize UI-facing view models from multiple canonical sources,
  as long as the synthesized response is not treated as another source of truth.
- Prefer CSS background images for decorative or layout-affecting assets such as frames, corners, borders, and chrome.
- Prefer `<img>` tags for content images where intrinsic image semantics matter.
- Prefer CSS Grid as the primary layout system for arranging major UI regions and HUD elements where it fits naturally.
- Use React/JSX to define semantic boxes and regions, and use CSS to place those regions within the layout.
- Assume the Polylith watcher and local server are already running during
  normal development sessions. Do not start duplicate dev servers/watchers
  unless the user explicitly asks. Running `npm run build` is still acceptable
  as a syntax/build smoke check, especially because JSX files are not covered
  by direct `node --check`.
- For file naming, placement, and JSDoc style, consult [Naming And Placement Conventions](/c:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md#naming-and-placement-conventions) when creating or moving files, or when naming/JSDoc style is relevant.
