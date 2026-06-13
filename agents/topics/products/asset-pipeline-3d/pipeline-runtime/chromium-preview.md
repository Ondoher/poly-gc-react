# Long-Running Chromium Preview Rendering

This note captures the planned direction for generated asset preview PNG
rendering. It exists because starting a fresh Puppeteer/Chromium process for
every image export is too slow for full tileset generation.

## Problem

`preview-png` generation currently pays too much process/browser startup cost
when many faces need exported images. The expensive part is not only the image
render itself; repeatedly launching Chromium and tearing it down dominates
batch runtime.

The goal is to keep one Chromium browser warm across many generated preview
exports while preserving cancellation, cleanup, and crash recovery.

## Decision

Yes, the pipeline can keep one Puppeteer browser instance running and reuse it
across image exports. The preferred runtime shape is:

```text
server queue
-> start or reuse one preview worker
-> worker owns one Puppeteer browser
-> each render job creates or reuses an isolated page
-> worker returns PNG result/status
-> server closes worker/browser on queue shutdown or fatal failure
```

Use one long-lived `browser` and short-lived `page` instances. Reusing the
browser avoids Chromium launch cost; closing each page after a render limits
state leakage and memory growth.

## Implementation Shape

If preview generation remains a separate Node CLI process per face, a module
singleton inside `generated-asset-preview-renderer.js` will not solve the
startup problem because each child process has its own memory and exits after
one face.

The better implementation is a persistent preview worker:

- The server queue starts the worker once for a batch.
- The worker owns the shared Puppeteer browser.
- The server sends render jobs over stdin, IPC, or another small local protocol.
- The worker returns structured success/failure records.
- The server stops the worker when the queue completes, is cancelled, or hits a
  fatal renderer error.

The shared renderer module can still expose a browser manager:

```js
let sharedBrowser = null;
let sharedBrowserPromise = null;

export async function getSharedPreviewBrowser(options = {}) {}
export async function renderGeneratedAssetPreview(options = {}) {}
export async function closeSharedPreviewBrowser() {}
```

`getSharedPreviewBrowser()` should return the existing connected browser when
possible, reuse an in-flight launch promise when another render is already
starting Chromium, and launch a new browser only when no connected browser
exists.

## Render Job Lifecycle

Each render job should do roughly this:

```js
const browser = await getSharedPreviewBrowser();
const page = await browser.newPage();

try {
  // Set viewport.
  // Load preview HTML/scene.
  // Wait for the render-ready signal.
  // Screenshot/export PNG.
} finally {
  await page.close().catch(() => {});
}
```

This keeps Chromium warm without letting page state accumulate across faces.

## Server Queue Integration

The server queue should not launch a new preview CLI process for every face if
the goal is to save Chromium startup time. Instead, route preview jobs through
the persistent worker.

If a short-term CLI bridge is still needed, make behavior explicit:

- Server/queue path: keep the shared browser alive for the batch.
- Standalone CLI path: close the shared browser in `finally` before process
  exit.

An environment flag such as `ASSET_PREVIEW_KEEP_BROWSER=1` can describe intent,
but it only helps if multiple jobs run in the same process. It does not make a
singleton survive across separate child-process invocations.

## Cleanup And Recovery

The browser manager should listen for disconnects:

```js
browser.on("disconnected", () => {
  sharedBrowser = null;
  sharedBrowserPromise = null;
});
```

Required cleanup behavior:

- Close each page after its render attempt.
- On queue cancellation, stop accepting new jobs and close the active page if
  possible.
- On queue completion, either close the worker/browser or intentionally keep it
  warm only if the server owns an explicit idle lifecycle.
- On browser crash/disconnect, clear cached browser state.
- Retry one render once with a fresh browser when the failure clearly came from
  a dead browser.

## Risks

- A disconnected browser can make every following render fail until the shared
  browser reference is cleared.
- Long batches can leak memory if pages are reused carelessly or not closed.
- Queue cancellation can leave an orphan page/browser if the worker protocol
  does not include cancellation and shutdown messages.
- A shared browser is process-local. It does not help if each render still runs
  in a fresh Node process.

## Verification

For a multi-face preview run:

- Browser launch count should be `1` for the batch.
- Each face should create and close a page, or explicitly reset a pooled page.
- Generated PNGs should match the current per-face output contract.
- Cancelling the queue should stop in-flight and pending preview jobs.
- A simulated browser disconnect should clear cached browser state and allow a
  later render to relaunch.

