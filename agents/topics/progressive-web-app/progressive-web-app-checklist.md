# Progressive Web App Checklist

Use this checklist for the initial deployment PWA setup.

Implementation note:

- use [MVP Implementation Checklist](/c:/dev/poly-gc-react/agents/topics/mvp/mvp-implementation-checklist.md) to track the first-release coding work for manifest, icons, HTML integration, and other MVP PWA tasks

Current assumptions:

- the first deployment should be installable as a PWA
- the app does not currently have a manifest or service worker
- initial scope should stay simple and reliable
- we should avoid caching behavior that makes deployment debugging harder

Current chosen values:

- App name: `Mah Jongg Solitaire`
- Short name: `Mah Jongg`
- Theme color: `#6b2424`
  This matches the current MJ shell/dialog color family and the frame background in [mj.css](/c:/dev/poly-gc-react/src/gc/features/mj/assets/css/mj.css).
- Background color: `#6b2424`
- Display: `standalone`
- Orientation: `landscape`
- Start URL: `/gc`
- Scope: `/gc`

Recommended first release:

- make the app installable
- serve the app over HTTPS
- add a manifest, icons, and browser metadata
- either skip the service worker at first or keep it extremely conservative
- avoid full offline support until normal deploys are stable

## Recommended First-Pass Decisions For This Repo

Use these defaults unless we discover a repo-specific constraint that changes them.

- App name: use the final public-facing site/app name rather than the repo name.
- Short name: keep it brief enough for a phone home screen label.
- Start URL: use `/` for the first release unless the deployed app lives under a subpath.
- Scope: use `/` for the first release unless the deployed app lives under a subpath.
- Display mode: use `standalone`.
- Orientation: request `landscape` in the manifest for the initial release.
- Theme color: pick one brand color and keep it consistent between the manifest and HTML metadata.
- Background color: use the app's primary launch background color, usually a dark or light neutral that matches the first paint.
- Icons: ship at least `192x192`, `512x512`, and one maskable icon.
- iOS polish: include Apple touch icon support if possible, but do not let it block the first deploy.
- Service worker: do not ship one in the very first PWA pass unless installability testing shows we need it.
- Offline support: treat it as out of scope for the initial release.
- Portrait layout: treat full portrait optimization as intentionally out of scope for the first deployment.
- Portrait fallback: if the app opens in portrait anyway, prefer a simple fallback state or guidance rather than a full HUD/layout redesign right now.
- HTML caching: if we later add a service worker, avoid caching HTML documents aggressively.
- Asset caching: if we later add a service worker, limit it to stable static assets first.
- Deployment validation: after the first PWA release, always test a second deploy to make sure updates appear normally.

Repo-specific direction:

- Manifest link and `theme-color` metadata should be added to [src/gc/templates/index.html](/c:/dev/poly-gc-react/src/gc/templates/index.html).
- The manifest, icons, and any future service worker need stable public output paths that fit the repo's build/copy model.
- Because this repo currently uses a simple `git pull` deployment flow, we should favor installability-first and postpone tricky caching behavior until deploy updates are proven stable.

## Installability Baseline

- [x] Choose the production app name and short name
  The browser uses these in install prompts, app launch surfaces, and home-screen labels.
- [x] Decide the start URL and scope
  These define which URL opens when the installed app launches and which pages count as part of the app.
- [x] Choose theme color and background color
  These colors affect browser UI treatment, splash screens, and install surfaces.
- [x] Define the display mode
  `standalone` is usually the most natural choice for an installed app.
- [ ] Decide whether the first release is installable only or also offline-capable
  Installability is easier and safer than shipping offline caching immediately.
- [x] Prepare app icons in the required sizes
  At minimum, plan for a 192x192 icon and a 512x512 icon.
- [x] Prepare a maskable icon variant
  This helps installed app icons render well on Android launch surfaces.

## Web App Manifest

- [x] Create the web app manifest file
  This is the core metadata file that lets the browser recognize the site as installable.
- [x] Add the app name and short name
- [x] Add `start_url`
- [x] Add `scope`
- [x] Add `display`
- [x] Add `orientation`
- [x] Add `theme_color`
- [x] Add `background_color`
- [x] Add a description
  This is optional but useful for clarity and future store-like surfaces.
- [x] Add standard icons
- [x] Add maskable icons
- [x] Link the manifest from the HTML template
- [x] Make sure the manifest asset path matches the repo build/output model
  The file needs to land at a stable public URL in the deployed app.

## Browser Integration

- [x] Add `theme-color` metadata to the HTML template
  This helps browsers style top bars and install UI consistently with the app.
- [ ] Add a favicon if one is not already present
- [ ] Add Apple touch icons if we want iOS home-screen support
  iOS uses different metadata and does not fully follow the standard install flow.
- [ ] Add Apple mobile-web-app metadata if we want iOS install polish
- [ ] Check that the app can be launched directly at the configured start URL without errors
  This is important because installed launches do not necessarily enter through the same URL path as normal browsing.
- [ ] Decide what the app should do if a device still opens in portrait
  A simple message, rotate-device prompt, or restricted fallback layout is enough for the first release.

## Service Worker Strategy

- [ ] Decide whether the initial deploy should include a service worker
  A service worker is required for some PWA features, but it is also the easiest way to create stale deploy bugs.
- [ ] If yes, keep the first version conservative
- [ ] Decide which requests should never be cached
  HTML documents and rapidly changing runtime data are common candidates to exclude from first-pass caching.
- [ ] Cache only a safe app shell or static asset subset
- [ ] Avoid aggressive HTML caching on the first deploy
- [ ] Decide whether the worker should use cache-first, network-first, or stale-while-revalidate for each asset class
- [ ] Define an update strategy that does not hide new releases
  New deployments should become visible without confusing users or trapping them on old files.
- [ ] Decide how to handle an updated service worker
  For example: prompt for refresh, auto-activate on close, or activate immediately.
- [ ] Add service worker registration code
- [ ] Make sure the service worker file is served from a path that gives it the intended scope
- [ ] Make sure deployment can safely replace versioned static assets the worker may cache

## Offline Behavior

- [ ] Decide whether the first deploy needs offline support or installability only
- [ ] If offline support is included, define the offline fallback behavior
  For example: cached shell only, a friendly offline page, or partial gameplay with no server-backed features.
- [ ] Decide whether portrait mode should show a rotate-device prompt
- [ ] Decide which app routes should work offline
- [ ] Decide which assets are critical for an offline launch
- [ ] Decide how runtime fetch failures should be surfaced to the user
- [ ] Decide whether queued writes or deferred sync are needed
  This is only necessary if the app will create user actions that must survive offline time.

## Deployment And Validation

- [ ] Confirm the production site is served over HTTPS
- [ ] Confirm the chosen domain and final production URLs
- [ ] Verify the manifest is served with the correct path
- [ ] Verify icons are publicly reachable
- [ ] Verify the manifest references match the deployed asset paths exactly
- [ ] Verify installed launches prefer landscape where supported
- [ ] Verify the service worker path and scope
- [ ] Test installability in Chrome on desktop
- [ ] Test installability in Chrome on Android if possible
- [ ] Test iOS home-screen install behavior if iOS support matters
- [ ] Test what happens when the app opens in portrait anyway
- [ ] Run a Lighthouse PWA check
- [ ] Test a second deployment after the initial PWA release
  This is one of the most important checks because it proves the caching strategy will not break normal updates.
- [ ] Confirm a new deploy updates correctly without stale cached HTML
- [ ] Confirm the app still works with a hard refresh and with previously cached assets present

## Security And Policy Checks

- [ ] Review whether the manifest or service worker introduces any unexpected public paths
- [ ] Confirm CSP or other response headers will not block the manifest or worker
- [ ] Confirm the service worker does not cache sensitive responses
- [ ] Confirm no secrets or private config are exposed through cached assets

## Repo And Build Integration

- [ ] Decide where the manifest file should live in this repo
- [ ] Decide where icons should live in this repo
- [ ] Decide how those files will be copied into the deployed output
- [ ] Decide where service worker registration code belongs in the app startup path
- [ ] Decide whether the service worker file should be generated or hand-authored
- [ ] Document the repo-specific build steps needed for PWA assets

## Follow-Up Notes

- [ ] Document the exact asset paths used by the manifest
- [ ] Document the exact manifest fields we shipped
- [ ] Document the service worker caching rules
- [ ] Document how to safely ship future icon or manifest changes
- [ ] Document how PWA behavior interacts with deploys and rollbacks
- [ ] Document the recommended debugging steps for stale-cache issues
