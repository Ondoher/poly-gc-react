# SVG Preprocessor Tests

This folder contains non-browser Jasmine specs for SVG preprocessor pipeline
code.

Run with:

```text
npm run test:pipeline
```

This spec is also included by the broader scripts lane:

```text
npm run test:scripts
```

Keep specs close to the code they exercise. This Jasmine lane discovers
`*.spec.js` and `*.spec.mjs` files under `scripts/3d-assets/svg-preprocessor`.
