# Agent Topics

This folder is the reorganized agent documentation tree. It replaces the old
flat topic list, which is preserved for migration at:

```text
agents/topics.bak/
```

## Top-Level Areas

- [Context](context/README.md): bootstrap, routing, active topic, and reload
  continuity.
- [Standards](standards/README.md): folder applicability, local overlay, and project implementation references.
- [Products](products/README.md): durable product and domain knowledge.
- [Apps](apps/README.md): deployable app surfaces in this monorepo.
- [References](references/README.md): supporting assets, research, images,
  palettes, PDFs, and contractor packages.
- [Archive](archive/README.md): historical notes kept for reference.
- [Documentation Restructure](documentation-restructure/README.md): migration
  plan for moving content out of `topics.bak`.

## Bootstrap Rule

See [Bootstrap](context/bootstrap.md) for the canonical procedure and local work-context pointer. Topics do not select engineering standards.

## Migration Note

Until migration is complete, `topics.bak` remains the source to mine for old
content. Prefer creating focused docs in this new tree instead of copying old
folders wholesale.

Exception: do not mine `topics.bak` or other old local docs for active
clean-room tasks.
