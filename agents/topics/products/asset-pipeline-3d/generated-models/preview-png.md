# Preview PNG

Preview PNG generation renders the final colored-inlay GLB for Asset Review.

The renderer owns a shared Puppeteer browser per process so server queue runs
can render multiple faces without relaunching Chromium for every tile. CLI
entry points that render a single preview must close that shared renderer in a
`finally` block.

Detailed contract:

- [Generated Assets](../contracts/generated-assets.md)
- [Chromium Preview](../pipeline-runtime/chromium-preview.md)
- [Stage 14: Asset Review And Preview](../svg-processing/stage-14-asset-review-and-preview.md)
