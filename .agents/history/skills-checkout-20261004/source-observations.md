# Historical source observations

Preserved from shared skills reference notes on 4 October 2026. The loadable
inspection was recorded on 16 September 2026; this preservation is not a new check.

- `src/gc/features/tetris/build.json` and `tetris.js` declare a loadable and enter
  it through `load('tetris')` before adding/showing its page.
- `src/gc/features/mj/build.json` declares a game loadable.
- The font inventory records Merienda weights 400/700 through a Google Fonts CSS
  import for `--mj-ui-font-family`; this is not the family's full available range.

These references do not prove newer-version behavior, unloading, retries or
cancellation. Original locators: `planning/implementation-agents/coding-guidance.md`
and `typography-font-inventory.md`. Only this project's observations are included.
