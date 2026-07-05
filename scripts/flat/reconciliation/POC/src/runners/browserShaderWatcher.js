// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.4.1.

import BrowserShaderJobRunner from '../browser/BrowserShaderJobRunner.js';

const options = parseArgs(process.argv.slice(2));

if (options.help) {
    printHelp();
} else {
    const runner = new BrowserShaderJobRunner(options);
    if (options.mode === 'dry-run') {
        const result = await runner.dryRun();
        console.log(JSON.stringify(result));
    } else if (options.mode === 'watch') {
        await runner.watch();
    } else {
        const result = await runner.runOnce();
        console.log(JSON.stringify({
            status: result.packet.status,
            runDir: result.runDir,
        }));
    }
}

function parseArgs(argv) {
    const options = {
        mode: 'once',
        headed: false,
        outRoot: undefined,
        commandPath: undefined,
        pageRoot: undefined,
        pollMs: undefined,
        port: undefined,
        pageTimeoutMs: undefined,
        useSwiftShader: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--once') {
            options.mode = 'once';
        } else if (arg === '--watch') {
            options.mode = 'watch';
        } else if (arg === '--dry-run') {
            options.mode = 'dry-run';
        } else if (arg === '--headed') {
            options.headed = true;
        } else if (arg === '--use-swiftshader') {
            options.useSwiftShader = true;
        } else if (arg === '--out-root') {
            options.outRoot = argv[index + 1];
            index += 1;
        } else if (arg === '--command') {
            options.commandPath = argv[index + 1];
            index += 1;
        } else if (arg === '--page-root') {
            options.pageRoot = argv[index + 1];
            index += 1;
        } else if (arg === '--poll-ms') {
            options.pollMs = Number(argv[index + 1]);
            index += 1;
        } else if (arg === '--page-timeout-ms') {
            options.pageTimeoutMs = Number(argv[index + 1]);
            index += 1;
        } else if (arg === '--port') {
            options.port = Number(argv[index + 1]);
            index += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    return options;
}

function printHelp() {
    console.log(`Algorithm32 reconciliation browser shader watcher

Usage:
  node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --dry-run
  node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --once
  node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch

Options:
  --dry-run              Validate command/progress paths without launching a browser.
  --once                 Run the current JSON command once and exit.
  --watch                Keep Chromium open and rerun when the command file changes.
  --headed               Show Chromium instead of headless mode.
  --use-swiftshader      Use SwiftShader software GL for fallback diagnostics.
  --out-root <path>      Output root. Default: tmp/atmosphere/reconciliation
  --command <path>       Command JSON path. Default: scripts/flat/reconciliation/POC/browser-jobs/browser-command.json
  --page-root <path>     Browser page root. Default: scripts/flat/reconciliation/POC/browser-page
  --poll-ms <ms>         Watch polling interval. Default: 750
  --page-timeout-ms <ms> Page navigation/evaluation timeout. Default: 300000
  --port <port>          Static server port, or 0 for an ephemeral port.
`);
}
