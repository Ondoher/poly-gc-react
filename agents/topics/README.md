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

On session bootstrap, load:

1. [Active Topic](active-topic.md)
2. [Context Bootstrap](context/bootstrap.md)
3. [Routing](context/routing.md)
4. [Architecture Overview](standards/architecture/overview.md)

Then load the active product/app README and any focused reload sources listed
by the active topic.

## Migration Note

Until migration is complete, `topics.bak` remains the source to mine for old
content. Prefer creating focused docs in this new tree instead of copying old
folders wholesale.
