import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { createCalspecSiriusIrradianceDensity } from '../external-celestial-sources/createCalspecSiriusIrradianceDensity.js';
import { createCanonicalSolarIrradianceDensity } from '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from '../external-celestial-sources/fixtureManifest.js';
import { appendRunLog, createFreshRecordDirectory, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv); await createFreshRecordDirectory(recordDirectory);
try {
    const basis = createCanonicalSpectralDensityBasis();
    const fits = await readFile(resolve('scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/sirius_stis_005.fits'));
    const sirius = createCalspecSiriusIrradianceDensity(fits, basis);
    const solar = createCanonicalSolarIrradianceDensity(basis);
    const criteria = [
        { name: 'sirius-calspec-source-is-absolute-and-binned', status: sirius.packet.quantity === 'spectral-irradiance-density' && sirius.packet.values.length === 15 ? 'accepted' : 'rejected' },
        { name: 'sirius-fixture-hash-matches-manifest', status: sirius.packet.provenance.sourceHashSha256 === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec.sourceHashSha256 ? 'accepted' : 'rejected' },
        { name: 'canonical-solar-wrapper-is-present', status: solar.values.length === 15 ? 'accepted' : 'rejected' },
        { name: 'no-display-derived-values', status: sirius.packet.units.includes('W m^-2') && solar.units.includes('W m^-2') ? 'accepted' : 'rejected' },
    ];
    const status = criteria.every((c) => c.status === 'accepted') ? 'accepted' : 'rejected';
    await writeJson(recordDirectory, 'inputs.json', { stage: 'ER5-physical-source-calibration', sources: ['STScI CALSPEC Sirius', 'canonical solar wrapper'], basis: basis.describe() });
    await writeJson(recordDirectory, 'source-descriptors.json', { sirius: sirius.packet.describe(), solar: solar.describe() });
    await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
    await writeJson(recordDirectory, 'result.json', { status, er5Status: status, acceptedCriterionCount: criteria.filter((c) => c.status === 'accepted').length, criterionCount: criteria.length, nextPhase: status === 'accepted' ? 'ER5 lunar calibration' : 'ER5 correction' });
    await writeText(recordDirectory, 'state-goal.md', '# State Goal\n\nAccept retained physical stellar and solar source ownership before lunar calibration.\n');
    await writeText(recordDirectory, 'report.md', `# ER5 Physical Source Calibration\n\nStatus: **${status}**\n\n${criteria.filter((c) => c.status === 'accepted').length}/${criteria.length} criteria accepted.\n`);
    await appendRunLog(recordDirectory, `er5PhysicalSourceCalibration ${status}; Sirius and canonical solar source ownership checked.`);
    console.log(JSON.stringify({ status, er5Status: status, recordDirectory }));
} catch (error) { await writeJson(recordDirectory, 'failure.json', { status: 'invalid', error: { name: error.name, message: error.message, code: error.code ?? null } }); await writeJson(recordDirectory, 'result.json', { status: 'invalid', er5Status: 'invalid-attempt' }); throw error; }
