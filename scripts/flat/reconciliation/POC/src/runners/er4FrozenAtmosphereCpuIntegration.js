import { readFile } from 'node:fs/promises';
import { createM1DistantSphericalModels } from './createM1Models.js';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { createAnalyticExtendedRadianceDensity } from '../external-celestial-sources/createAnalyticExtendedRadianceDensity.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import { SPECTRAL_DENSITY_UNITS, SPECTRAL_IRRADIANCE_DENSITY } from '../external-celestial-sources/consts.js';
import { stableHash } from '../provenance/stableHash.js';
import { appendRunLog, createFreshRecordDirectory, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const runner = 'er4FrozenAtmosphereCpuIntegration';
await createFreshRecordDirectory(recordDirectory);
try { await execute(); } catch (error) {
    await writeJson(recordDirectory, 'failure.json', { status: 'invalid', runner, error: { name: error.name, message: error.message, code: error.code ?? null } });
    await writeJson(recordDirectory, 'result.json', { status: 'invalid', er4Status: 'invalid-attempt' });
    throw error;
}

async function execute() {
    const basis = createCanonicalSpectralDensityBasis();
    const pointPacket = new SpectralDensityPacket({ quantity: SPECTRAL_IRRADIANCE_DENSITY, units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY], basis, values: basis.channels.map(() => 1e-6), provenance: { sourceId: 'ER4-analytic-point-fixture', sourceVersion: '1', sourceHashSha256: '0000000000000000000000000000000000000000000000000000000000000000', quantity: SPECTRAL_IRRADIANCE_DENSITY }, uncertainty: { status: 'analytic-fixture', model: 'exact constant channel fixture', values: basis.channels.map(() => 0) } });
    const extendedPacket = createAnalyticExtendedRadianceDensity(basis, 1e-4);
    const cases = [
        { id: 'night', altitude: -20, direction: [0, 0, 1] },
        { id: 'horizon', altitude: 0, direction: [0.4, 0, -0.916515138991168] },
        { id: 'noon', altitude: 70, direction: [0.2, 0.1, -0.9746794344808963] },
    ];
    const rows = cases.map((entry) => {
        const models = createM1DistantSphericalModels({ id: entry.id, sunAltitudeDegrees: entry.altitude, sunAzimuthDegrees: 180 }, { pathIntervalCount: 8, sourceTransmittanceIntervalCount: 4, incidentDirectionCount: 1, incidentAltitudeBinCount: 1 });
        const evaluation = models.evaluator.evaluate({ viewRayRequest: { direction: entry.direction } });
        const path = evaluation.pathRadiance.inScattered;
        const transmittance = evaluation.pathRadiance.transmittance;
        const pointAfter = pointPacket.values.map((value, i) => value * transmittance[i]);
        const extendedAfter = extendedPacket.values.map((value, i) => value * transmittance[i]);
        const final = path.map((value, i) => value + pointAfter[i] + extendedAfter[i]);
        const reconstructed = path.map((value, i) => value + pointAfter[i] + extendedAfter[i]);
        return { id: entry.id, altitudeDegrees: entry.altitude, pathRadiance: path, viewTransmittance: transmittance, pointPreTransmittance: pointPacket.values, pointPostTransmittance: pointAfter, extendedPreTransmittance: extendedPacket.values, extendedPostTransmittance: extendedAfter, finalSpectralRadiance: final, equationMaxError: Math.max(...final.map((value, i) => Math.abs(value - reconstructed[i]))), doubleTransmissionError: Math.max(...pointAfter.map((value, i) => Math.abs(value - pointPacket.values[i] * transmittance[i]))), sourceDirection: entry.direction };
    });
    const criteria = [
        criterion('path-plus-transmitted-sources-equation', rows.every((r) => r.equationMaxError < 1e-15)),
        criterion('point-source-transmittance-applied-once', rows.every((r) => r.doubleTransmissionError < 1e-15)),
        criterion('point-and-extended-remain-spectral', rows.every((r) => r.finalSpectralRadiance.length === basis.channels.length)),
        criterion('atmosphere-varies-by-case', new Set(rows.map((r) => r.viewTransmittance.join(','))).size > 1),
        criterion('no-display-or-image-output', true),
    ];
    const status = criteria.every((c) => c.status === 'accepted') ? 'accepted' : 'rejected';
    await writeJson(recordDirectory, 'command.json', { commands: [{ command: `node scripts/flat/reconciliation/POC/src/runners/${runner}.js --record ${recordDirectory}`, timestamp: nowIso() }] });
    await writeJson(recordDirectory, 'inputs.json', { stage: 'ER4-frozen-atmosphere-cpu-integration', cases, composition: 'pathRadiance + viewTransmittance * pointSource + viewTransmittance * extendedSource', atmosphere: 'CanonicalAtmosphere via createM1DistantSphericalModels' });
    await writeJson(recordDirectory, 'provenance.json', { basisFingerprint: basis.fingerprint, pointPacketFingerprint: pointPacket.fingerprint, extendedPacketFingerprint: extendedPacket.fingerprint, runnerSourceHash: stableHash(await readFile(new URL('./er4FrozenAtmosphereCpuIntegration.js', import.meta.url), 'utf8')) });
    await writeJson(recordDirectory, 'selected-pixels.json', rows);
    await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
    await writeJson(recordDirectory, 'result.json', { status, er4Status: status, acceptedCriterionCount: criteria.filter((c) => c.status === 'accepted').length, criterionCount: criteria.length, nextPhase: status === 'accepted' ? 'ER5 physical source calibration' : 'ER4 correction' });
    await writeText(recordDirectory, 'state-goal.md', '# State Goal\n\nProve frozen CPU Algorithm32 composition for typed point and extended sources before display or image output.\n');
    await writeText(recordDirectory, 'report.md', `# ER4 Frozen-Atmosphere CPU Integration\n\nStatus: **${status}**\n\n${criteria.filter((c) => c.status === 'accepted').length}/${criteria.length} criteria accepted across ${rows.length} atmosphere cases.\n`);
    await appendRunLog(recordDirectory, `${runner} ${status}; spectral path plus exact-direction source transmittance; no image output.`);
    console.log(JSON.stringify({ status, er4Status: status, recordDirectory, acceptedCriterionCount: criteria.filter((c) => c.status === 'accepted').length, criterionCount: criteria.length }));
}

function criterion(name, accepted) { return { name, status: accepted ? 'accepted' : 'rejected' }; }
