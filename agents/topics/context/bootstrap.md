# Bootstrap

Load [Active Topic](../active-topic.md) at the start of a session. Then load
the topic README named there and only the paths listed under
`Minimal Reload Sources`. If the active topic does not define a minimal reload
set, fall back to `Reload Sources`.

Keep bootstrap to current-state handoff docs. Do not load routing,
architecture, archive, historical, migration, adjacent topic, or code files
just because they are linked nearby. Open them only when the current task
requires that context.

Do not load migrated historical docs from `agents/topics.bak` unless the active
task explicitly needs them.

Agent-facing docs should be current-state docs by default. Historical material
belongs only in experiment evidence, intentional status/task trackers, or
clearly marked archives.
