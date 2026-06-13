# GC App

Deployable game collection app surface.

Use this area for app routing, shell behavior, deployment notes, and app-level
integration that is not specific to a single game.

Progressive Web App notes belong here during migration. PWA is currently
implemented only for Mahjongg/GC, not as a repo-wide standard.

## Documents

- [PWA Checklist](pwa-checklist.md)

## Current PWA Facts

- Manifest source: `src/gc/assets/pwa/manifest.webmanifest`
- Template link: `src/gc/templates/main.html`
- Build copy rule: `builds/gc.json` copies `assets/pwa` into `dist/gc/pwa`
- Current scope/start URL: `/gc`
