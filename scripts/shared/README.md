# Shared Script Helpers

This folder holds helpers shared by repository scripts.

## Options

Use `options.js` for CLI option extraction after a script has parsed arguments
with `minimist`.

Keep `process.argv` and raw `argv` access at the CLI boundary:

```js
const argv = parseArgs(process.argv.slice(2));
const options = getOptions(defaultOptions, argv, flags);
const params = argv._;
```

For testable scripts, pass normalized `options` and positional `params` into
the script logic instead of reading `process.argv` or raw `argv` throughout the
module. Specs can then provide domain-shaped inputs and assert behavior without
spawning a process or knowing the CLI aliases.

Useful script-test shape:

```js
await runScript({
	params: ['normal'],
	options: { imageSet: true },
	readFile: fakeReadFile,
	writeFile: fakeWriteFile,
	logger: fakeLogger,
});
```

That keeps command parsing, option normalization, file IO, logging, and process
exit behavior easy to mock while keeping the real CLI responsible for turning
flags into the same normalized options object.
