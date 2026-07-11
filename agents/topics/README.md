# Agent Topics

This folder is the reorganized agent documentation tree. It replaces the old
flat topic list, which is preserved for migration at:

```text
agents/topics.bak/
```

## Top-Level Areas

- [Context](context/README.md): bootstrap, routing, active topic, and reload
  continuity.
- [Standards](standards/README.md): repo-wide engineering conventions that
  apply across products and apps.
- [Products](products/README.md): durable product and domain knowledge.
- [Apps](apps/README.md): deployable app surfaces in this monorepo.
- [References](references/README.md): supporting assets, research, images,
  palettes, PDFs, and contractor packages.
- [Archive](archive/README.md): historical notes kept for reference.
- [Documentation Restructure](documentation-restructure/README.md): migration
  plan for moving content out of `topics.bak`.

## Bootstrap Rule

On session bootstrap, load [Active Topic](active-topic.md) first. Then load the
topic README named by that file and only the files listed under its
`Minimal Reload Sources` section. If no minimal section exists, fall back to
the file's `Reload Sources` section.

Do not load this index, routing docs, architecture docs, archives, migration
docs, historical notes, or unrelated app docs during bootstrap unless the
active task clearly needs them. Use this index as an opt-in routing table, not
as default context.

## Migration Note

Until migration is complete, `topics.bak` remains the source to mine for old
content. Prefer creating focused docs in this new tree instead of copying old
folders wholesale.

Exception: do not mine `topics.bak` or other old local docs for active
clean-room tasks.
