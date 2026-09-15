# Shared Script Helpers

This folder holds helpers shared by repository scripts.

## Options

The [normalized script inputs overlay](../../agents/topics/standards/overlay.md#add-normalized-script-inputs) owns the CLI boundary. The concrete `options.js` API is used after parsing arguments with `minimist`:

```js
const argv = parseArgs(process.argv.slice(2));
const options = getOptions(defaultOptions, argv, flags);
const params = argv._;
```

An example normalized runner call is `runScript({ params: ['normal'], options: { imageSet: true }, readFile, writeFile, logger })`. Collaborator seams follow [canonical testing](C:/Users/gande/.codex/documentation/standards/testing.md).
