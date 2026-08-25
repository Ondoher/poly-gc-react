import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import HorizonsMoonPhaseSampleProvider from '../moon-phase/HorizonsMoonPhaseSampleProvider.js';
import NextMoonPhaseResolver from '../moon-phase/NextMoonPhaseResolver.js';

const outputPath = resolve(stringArg('--output', 'scripts/flat/reconciliation/POC/src/moon-phase/fixtures/san-jose-date-basis-moon-phases.json'));
const afterTimeIso = stringArg('--after', '2024-06-20T00:00:00.000Z');
const provider = new HorizonsMoonPhaseSampleProvider();
const resolver = new NextMoonPhaseResolver({ sampleProvider: provider });
const events = [];

for (const phase of ['new', 'first-quarter', 'full', 'last-quarter']) {
    events.push(await resolver.resolve({ afterTimeIso, phase }));
}

const samplesByTime = new Map(provider.normalizedSamples.map((sample) => [sample.timeIso, sample]));
const rawQueries = provider.rawQueries.map((query) => ({
    targetId: query.targetId,
    url: query.url,
    queryHash: query.queryHash,
    apiVersion: query.apiVersion,
    payload: query.payload,
}));
const fixture = {
    schemaVersion: 1,
    id: 'san-jose-date-basis-moon-phases-v1',
    afterTimeIso,
    provenance: {
        source: 'reconciliation-poc-fixture',
        sourceVersion: rawQueries[0].apiVersion,
        queryHashes: [...new Set(rawQueries.map((query) => query.queryHash))],
        fetchedAtIso: new Date().toISOString(),
        normalizationVersion: 'moon-phase-v1',
    },
    events,
    samples: [...samplesByTime.values()].sort((a, b) => Date.parse(a.timeIso) - Date.parse(b.timeIso)),
    rawQueries,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'written', outputPath, sampleCount: fixture.samples.length, eventCount: events.length }));

function stringArg(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
}
