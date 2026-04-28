# PSD Maps Tools

This folder is an isolated workspace for experimenting with PSD-driven tile face
extraction.

The immediate goal is to inspect a single PSD face file, extract flat raster
layers where possible, and capture enough layer-style metadata to translate
Photoshop effects into runtime-friendly depth-intent maps.

Current first-pass workflow:

1. Install local dependencies in this folder.
2. Run `npm run inspect -- <path-to-psd>`.
3. Review the emitted JSON summary to understand layer structure and style data.

The first prototype favors observability over polished output so we can learn
what the PSDs actually contain before committing to a full export pipeline.
