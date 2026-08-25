import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import HorizonsGlobeMoonStateProvider from '../globe-moon/HorizonsGlobeMoonStateProvider.js';

const outputPath = resolve('scripts/flat/reconciliation/POC/src/globe-moon/fixtures/san-jose-2024-06-full-moon-state.json');
const timeIso = '2024-06-22T01:08:30.083Z';
const observer = Object.freeze({ id: 'san-jose', latitudeDegrees: 37.3382, longitudeDegrees: -121.8863, elevationKm: 0.025 });
const provider = new HorizonsGlobeMoonStateProvider();
const state = await provider.resolve({ timeIso, observer });
const fixture = { schemaVersion: 1, id: 'san-jose-2024-06-full-moon-state-v1', ...state, rawQueries: provider.rawQueries };
await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'written', outputPath, observerAgreementKm: state.observerState.validation.observerPositionAgreementKm }));
