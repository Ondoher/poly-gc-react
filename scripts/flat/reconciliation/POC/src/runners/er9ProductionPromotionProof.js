// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER9 scoped production promotion decision.
// - tmp/atmosphere/reconciliation/065-er8-cpu-convergence-and-poc-cleanup,
//   accepted 26/26 CPU convergence and cleanup dependency.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { extname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import LocalModuleGraphHasher from '../provenance/LocalModuleGraphHasher.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const require = createRequire(import.meta.url);
const Jasmine = require('jasmine');
const { parse: parseJavaScript } = require('@babel/parser');

const RUNNER = 'er9ProductionPromotionProof';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '067-er9-production-promotion-proof';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const SEALED_ER8_RECORD_ID = '065-er8-cpu-convergence-and-poc-cleanup';
const SEALED_ER8_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ER8_RECORD_ID}`;
const INVALID_PREDECESSOR_RECORD_ID = '066-er9-production-promotion-proof';
const INVALID_PREDECESSOR_DIRECTORY =
    `tmp/atmosphere/reconciliation/${INVALID_PREDECESSOR_RECORD_ID}`;
const INVALID_PREDECESSOR_FILES = freezeJsonValue({
    result: 'result.json',
    failure: 'failure.json',
});
const INVALID_PREDECESSOR_PINS = freezeJsonValue({
    result: '8b86f6090429416414892c59cbcab28ef4ca6352dbd42552aff7d565bce7df0b',
    failure: '09125cdfa706fa218ff347cf767297e5a2b853b74625d9e3883782d9bcf23e7f',
});
const PRODUCTION_ROOT = 'shared/algorithm32/production';
const CANONICAL_CHANNEL_COUNT = 15;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

const TOLERANCES = freezeJsonValue({
    sealedArtifactSha256: 'exact lowercase SHA-256 equality',
    sealedAcceptedCriterionCount: 26,
    moduleAllowlist: 'exact sorted path equality',
    pointResponseAbsolute: 1e-15,
    sunDiskReconstructionRelative: 1e-10,
    shaderPacketRelative: 5e-12,
    evaluatorAbsolute: 0,
    compositionAbsolute: 1e-12,
    productionFailedSpecCount: 0,
    appSyntaxErrorCount: 0,
});

const SEALED_ER8_FILES = freezeJsonValue({
    result: 'result.json',
    criteria: 'criteria-results.json',
    convergence: 'convergence-results.json',
    cleanup: 'cleanup-inventory.json',
    publicSurface: 'public-surface.json',
    activeGraph: 'active-module-graph.json',
});

const SEALED_ER8_PINS = freezeJsonValue({
    result: 'f988215c1d7dc195fcfd36eb3fe4b10516623025b2916b710b27f13841647973',
    criteria: 'ad20888f158ae5fb65f0bec27ffc676409fd7537137c3078b5a174af9eba34f9',
    convergence: 'e6c2028d4baaf43003db0c2f3ea56d6abe3f2ae7d2713d96064d1714fc8b1187',
    cleanup: '27bcbd04d36c2580f8ba914a6478d29e8a1aec64cd8a4ecde1d146ef74eaca9d',
    publicSurface: '7e9b093eb6c0bfe75020f1a4e325d0efbf4b87beeca09c91d8ea9ea1fd847ffe',
    activeGraph: '22204bf10ed6908c5e79e19e091df2674c5c50aef2665d4dd4b8e590f9f3122e',
});

const PRODUCTION_GRAPH_ENTRIES = Object.freeze([
    'shared/algorithm32/production/celestial-sources/consts.js',
    'shared/algorithm32/production/celestial-sources/createCanonicalSolarIrradianceDensity.js',
    'shared/algorithm32/production/celestial-sources/createCanonicalSpectralDensityBasis.js',
    'shared/algorithm32/production/celestial-sources/ExternalCelestialSource.js',
    'shared/algorithm32/production/celestial-sources/SpectralDensityBasis.js',
    'shared/algorithm32/production/celestial-sources/SpectralDensityPacket.js',
    'shared/algorithm32/production/light-sources/DistantSunLightSource.js',
    'shared/algorithm32/production/implementation/SpectralCalculator.js',
    'shared/algorithm32/production/camera/PerspectiveCameraRaster.js',
    'shared/algorithm32/production/directional-visibility/ExactDirectionalVisibilityResolver.js',
    'shared/algorithm32/production/point-source-raster/BilinearPointResponse.js',
    'shared/algorithm32/production/point-source-raster/TransportedPointSourceAccumulator.js',
    'shared/algorithm32/production/extended-source-integration/SphericalCapQuadrature.js',
    'shared/algorithm32/production/extended-source-integration/TransportedExtendedSourceIntegrator.js',
    'shared/algorithm32/production/extended-source-integration/CanonicalUniformSunDiskSource.js',
    'shared/algorithm32/production/physical-frame/Algorithm32SpectralFrameEvaluator.js',
    'shared/algorithm32/production/physical-frame/PhysicalSpectralFrameComposer.js',
]);

const PRODUCTION_MODULE_ALLOWLIST = Object.freeze([
    'shared/algorithm32/production/camera/PerspectiveCameraRaster.js',
    'shared/algorithm32/production/celestial-sources/ExternalCelestialSource.js',
    'shared/algorithm32/production/celestial-sources/SpectralDensityBasis.js',
    'shared/algorithm32/production/celestial-sources/SpectralDensityPacket.js',
    'shared/algorithm32/production/celestial-sources/consts.js',
    'shared/algorithm32/production/celestial-sources/createCanonicalSolarIrradianceDensity.js',
    'shared/algorithm32/production/celestial-sources/createCanonicalSpectralDensityBasis.js',
    'shared/algorithm32/production/constants/Algorithm32CanonicalData.js',
    'shared/algorithm32/production/directional-visibility/ExactDirectionalVisibilityResolver.js',
    'shared/algorithm32/production/errors/Algorithm32ConfigurationError.js',
    'shared/algorithm32/production/extended-source-integration/CanonicalUniformSunDiskSource.js',
    'shared/algorithm32/production/extended-source-integration/SphericalCapQuadrature.js',
    'shared/algorithm32/production/extended-source-integration/TransportedExtendedSourceIntegrator.js',
    'shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js',
    'shared/algorithm32/production/light-sources/DistantSunLightSource.js',
    'shared/algorithm32/production/light-sources/IncidentRadianceDirections.js',
    'shared/algorithm32/production/light-sources/ThreeShadowObjectConfigurator.js',
    'shared/algorithm32/production/implementation/SpectralCalculator.js',
    'shared/algorithm32/production/physical-frame/Algorithm32SpectralFrameEvaluator.js',
    'shared/algorithm32/production/physical-frame/PhysicalSpectralFrameComposer.js',
    'shared/algorithm32/production/point-source-raster/BilinearPointResponse.js',
    'shared/algorithm32/production/point-source-raster/TransportedPointSourceAccumulator.js',
    'shared/algorithm32/production/provenance/stableHash.js',
    'shared/algorithm32/production/shader/TextureBuilder.js',
    'shared/algorithm32/production/utils/VectorMath.js',
]);

const APP_CONSUMER_FILES = Object.freeze([
    'src/flat/shared/algorithm32-production-config.js',
    'src/flat32/index.js',
]);
const GOVERNING_DECISION_PINS = freezeJsonValue({
    'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md':
        'b1699bf471bafb3fb0d8a0c2dfc28ad6569a2d93a59ea8fce7073ab33eb71a36',
    'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md':
        '6249936bac6cec6cd6ec7f5d37c1df1bce48916e87573c2d26bb6e935e55d5ba',
});
const INTEGRATION_GRAPH_ENTRIES = Object.freeze([
    'shared/algorithm32/production/Algorithm32.js',
    'shared/algorithm32/production/atmospheres/CanonicalAtmosphere.js',
    'shared/algorithm32/production/color/BrunetonColorDisplayModel.js',
    'shared/algorithm32/production/light-sources/DistantSunLightSource.js',
    'shared/algorithm32/production/light-sources/LocalSunLightSource.js',
    'shared/algorithm32/production/models/SharedModel.js',
    'shared/algorithm32/production/shader/ShaderDescriptorBuilder.js',
]);
const JASMINE_CONFIG_PATH = 'spec/support/jasmine-algorithm32-production.json';
const JASMINE_PACKAGE_PATH = 'node_modules/jasmine/package.json';
const JASMINE_IMPLEMENTATION_PATH = 'node_modules/jasmine/lib/jasmine.js';
const BABEL_PARSER_PACKAGE_PATH = 'node_modules/@babel/parser/package.json';
const BABEL_PARSER_IMPLEMENTATION_PATH = 'node_modules/@babel/parser/lib/index.js';

const EXPECTED_SELECTED_SCOPE_IDS = Object.freeze([
    'typed-celestial-source-contract',
    'cpu-celestial-source-to-frame-seam',
    'canonical-sun-single-owner',
]);
const EXPECTED_NOT_SELECTED_SCOPE_IDS = Object.freeze([
    'assembled-visible-celestial-gpu-browser',
    'observer-background-visibility',
    'diffuse-celestial-fields',
    'live-calspec-lime-horizons-acquisition',
]);
const EXPECTED_XA_G12_REASON =
    'XA-G12 applies to a promoted assembled GPU slice; this decision selects no such slice.';
const EXPECTED_GPU_ATMOSPHERE_DISPOSITION =
    'unchanged and independent; no CPU atmosphere answer is uploaded';

const SELECTION = freezeJsonValue({
    phase: 'ER9',
    selected: [
        {
            id: 'typed-celestial-source-contract',
            scope: 'canonical 15-channel basis, typed point/extended packets, and source measure coupling',
        },
        {
            id: 'cpu-celestial-source-to-frame-seam',
            scope: 'camera, exact visibility, point response/transport, directional extended integration, Algorithm32 frame adaptation, and physical frame composition',
        },
        {
            id: 'canonical-sun-single-owner',
            scope: 'one typed canonical irradiance packet for DistantSun CPU, descriptor, shader constants, and the derived uniform visible disk',
        },
    ],
    notSelected: [
        {
            id: 'assembled-visible-celestial-gpu-browser',
            disposition: 'deferred; no visible celestial GPU/browser slice is promoted by this record',
        },
        {
            id: 'observer-background-visibility',
            disposition: 'deferred by accepted ER7 pre-display-only claim boundary',
        },
        {
            id: 'diffuse-celestial-fields',
            disposition: 'deferred',
        },
        {
            id: 'live-calspec-lime-horizons-acquisition',
            disposition: 'not selected; no network, live source reader, lunar model, or ephemeris acquisition enters production ownership',
        },
    ],
    xaG12: {
        status: 'not-applicable-not-selected',
        reason: 'XA-G12 applies to a promoted assembled GPU slice; this decision selects no such slice.',
    },
    selectedGpuSlices: [],
    gpuAtmosphereEvaluation: 'unchanged and independent; no CPU atmosphere answer is uploaded',
    observerClaimed: false,
    diffuseClaimed: false,
    networkAcquisition: false,
    imageArtifacts: false,
});

const PRODUCTION_MAPPING = freezeJsonValue([
    mapping('typed source constants',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/consts.js',
        'shared/algorithm32/production/celestial-sources/consts.js'),
    mapping('typed spectral-density basis',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityBasis.js',
        'shared/algorithm32/production/celestial-sources/SpectralDensityBasis.js'),
    mapping('typed spectral-density packet',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityPacket.js',
        'shared/algorithm32/production/celestial-sources/SpectralDensityPacket.js'),
    mapping('point/extended source-measure coupling',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/ExternalCelestialSource.js',
        'shared/algorithm32/production/celestial-sources/ExternalCelestialSource.js'),
    mapping('canonical rich basis factory',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCanonicalSpectralDensityBasis.js',
        'shared/algorithm32/production/celestial-sources/createCanonicalSpectralDensityBasis.js'),
    mapping('canonical solar packet factory',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCanonicalSolarIrradianceDensity.js',
        'shared/algorithm32/production/celestial-sources/createCanonicalSolarIrradianceDensity.js'),
    mapping('fail-loud typed configuration error',
        'scripts/flat/reconciliation/POC/src/errors/ReconciliationConfigurationError.js',
        'shared/algorithm32/production/errors/Algorithm32ConfigurationError.js'),
    mapping('browser-safe stable source identity',
        'scripts/flat/reconciliation/POC/src/provenance/stableHash.js',
        'shared/algorithm32/production/provenance/stableHash.js'),
    mapping('canonical solar packet CPU/descriptor/shader binding',
        'accepted record-050 canonical Sun single-owner contract',
        'shared/algorithm32/production/light-sources/DistantSunLightSource.js'),
    mapping('exact perspective camera',
        'scripts/flat/reconciliation/POC/src/camera/PerspectiveCameraRaster.js',
        'shared/algorithm32/production/camera/PerspectiveCameraRaster.js'),
    mapping('exact geometry-only visibility',
        'scripts/flat/reconciliation/POC/src/directional-visibility/ExactDirectionalVisibilityResolver.js',
        'shared/algorithm32/production/directional-visibility/ExactDirectionalVisibilityResolver.js'),
    mapping('normalized point response and transported point flux',
        'scripts/flat/reconciliation/POC/src/point-source-raster',
        'shared/algorithm32/production/point-source-raster'),
    mapping('one-path directional extended integration and Sun disk',
        'scripts/flat/reconciliation/POC/src/extended-source-integration',
        'shared/algorithm32/production/extended-source-integration'),
    mapping('Algorithm32 directional frame adapter',
        'scripts/flat/reconciliation/POC/src/physical-frame/FrozenAtmosphereSpectralFrameEvaluator.js',
        'shared/algorithm32/production/physical-frame/Algorithm32SpectralFrameEvaluator.js'),
    mapping('single-display physical frame composer',
        'scripts/flat/reconciliation/POC/src/physical-frame/PhysicalSpectralFrameComposer.js',
        'shared/algorithm32/production/physical-frame/PhysicalSpectralFrameComposer.js'),
    mapping('canonical rich-basis channel-count integration',
        'scripts/flat/reconciliation/POC/src/calculator/SpectralCalculator.js',
        'shared/algorithm32/production/implementation/SpectralCalculator.js'),
]);

const CRITERIA_DEFINITIONS = freezeJsonValue([
    definition('sealed-hashes', 'dependency', 'record 065 key artifact hashes exactly match the predeclared pins'),
    definition('sealed-acceptance', 'dependency', 'record 065 is accepted with exactly 26 of 26 accepted criteria'),
    definition('selection-exact', 'selection', 'the selected and deferred ER9 scopes exactly match the predeclared decision'),
    definition('gpu-na', 'selection', 'assembled visible-celestial GPU/browser work is not selected and XA-G12 is explicitly not applicable'),
    definition('allowlist-exact', 'production-graph', 'the selected production graph is exactly the predeclared 25-module allowlist'),
    definition('graph-isolated', 'production-graph', 'selected browser modules contain no reconciliation POC, tmp, archive, or Node crypto dependency'),
    definition('stable-sha256-known-vector', 'production-graph', 'the browser-safe production stable hash matches the standard SHA-256 empty-object vector'),
    definition('basis-rich', 'typed-source', 'the canonical production basis retains 15 ordered unit-bearing bins and a reconstructable fingerprint'),
    definition('solar-packet-rich', 'typed-source', 'the canonical solar packet retains exact quantity, units, basis identity, provenance, uncertainty, and fingerprint'),
    definition('source-coupling', 'typed-source', 'point and extended source kinds accept only their matching spectral measures'),
    definition('sun-cpu-owner', 'canonical-sun', 'DistantSun CPU direct lighting consumes the canonical packet values by identity'),
    definition('sun-descriptor-owner', 'canonical-sun', 'DistantSun descriptor retains the exact canonical packet fingerprint and facts'),
    definition('sun-shader-owner', 'canonical-sun', 'DistantSun shader constants reconstruct the canonical packet within 5e-12 relative'),
    definition('point-conservation', 'cpu-point', 'on-frame point radiance times exact pixel solid angle plus off-raster flux reconstructs transported irradiance within 1e-15'),
    definition('point-off-raster', 'cpu-point', 'a rear-hemisphere source retains exactly one fully off-raster response without renormalization'),
    definition('visibility-depth', 'cpu-visibility', 'exact directional visibility selects the nearest physical blocker before finite source depth'),
    definition('sun-disk', 'cpu-extended', 'the production uniform Sun disk reconstructs its canonical irradiance within 1e-10 relative'),
    definition('extended-transport', 'cpu-extended', 'the production directional extended integrator conserves transported radiance and feeds the composer on the same basis'),
    definition('frame-adapter', 'cpu-frame', 'Algorithm32SpectralFrameEvaluator consumes the flat production evaluate result without nested legacy output'),
    definition('frame-composition', 'cpu-frame', 'physical composition retains path, transported endpoint, extended, point, and final spectra before exactly one display call'),
    definition('production-tests', 'verification', 'the installed Jasmine API completes the exact production suite with a positive spec count and no failures'),
    definition('app-syntax', 'verification', 'the installed Babel parser accepts both production app consumer modules with zero syntax errors'),
    definition('claim-boundary', 'selection', 'the proof performs no network, image, observer, diffuse, CALSPEC, LIME, or Horizons result acquisition'),
]);

const mode = parseMode(process.argv);
const startedAt = performance.now();
let recordCreated = false;
let completedPhases = [];

await createFreshRecordDirectory(mode.recordDirectory);
recordCreated = true;

try {
    await writeInitialArtifacts(mode.recordDirectory, mode);
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} started; record 067 is record-only, offline, and contains no image path.`,
    );

    const invalidPredecessor = await loadInvalidPredecessor();
    completedPhases.push('invalid-predecessor');
    await writeJson(
        mode.recordDirectory,
        'invalid-predecessor.json',
        invalidPredecessor,
    );

    const governingDecision = await loadGoverningDecision();
    completedPhases.push('governing-decision');
    await writeJson(mode.recordDirectory, 'governing-decision.json', governingDecision);

    const sealedEr8 = await loadSealedEr8();
    completedPhases.push('sealed-er8');
    await writeJson(mode.recordDirectory, 'sealed-er8-dependency.json', sealedEr8.record);

    const graphAudit = await auditProductionGraph();
    completedPhases.push('production-graph');
    await writeJson(mode.recordDirectory, 'production-manifest.json', graphAudit.manifest);
    await writeJson(mode.recordDirectory, 'module-graph.json', graphAudit.graph);
    await writeJson(mode.recordDirectory, 'integration-manifest.json', graphAudit.integrationManifest);
    await writeJson(mode.recordDirectory, 'integration-module-graph.json', graphAudit.integrationGraph);

    const conformance = await runProductionConformance();
    completedPhases.push('production-conformance');
    await writeJson(mode.recordDirectory, 'source-ownership.json', conformance.sourceOwnership);
    await writeJson(mode.recordDirectory, 'conformance.json', conformance);

    const verificationInputs = await buildVerificationInputManifest(graphAudit);
    await writeJson(mode.recordDirectory, 'verification-input-manifest.json', verificationInputs);
    const testLog = await runVerificationCommands(mode.recordDirectory);
    completedPhases.push('in-process-verification');
    await writeJson(mode.recordDirectory, 'test-log.json', testLog);
    await writeText(mode.recordDirectory, 'test-log.txt', formatTestLog(testLog));

    const claimBoundaryAudit = await auditClaimBoundary(
        mode.recordDirectory,
        graphAudit.graph,
        graphAudit.integrationGraph,
        verificationInputs,
    );
    completedPhases.push('claim-boundary-audit');
    await writeJson(
        mode.recordDirectory,
        'claim-boundary-audit.json',
        claimBoundaryAudit,
    );

    const criteria = buildCriteria({
        sealedEr8,
        governingDecision,
        graphAudit,
        conformance,
        testLog,
        claimBoundaryAudit,
    });
    const statuses = deriveStatuses(criteria);
    const result = freezeJsonValue({
        status: statuses.overallStatus,
        dependencyStatus: statuses.dependencyStatus,
        selectionStatus: statuses.selectionStatus,
        productionGraphStatus: statuses.productionGraphStatus,
        typedSourceStatus: statuses.typedSourceStatus,
        cpuSeamStatus: statuses.cpuSeamStatus,
        canonicalSunStatus: statuses.canonicalSunStatus,
        verificationStatus: statuses.verificationStatus,
        gpuParityStatus: 'not-applicable-not-selected',
        xaG12Status: 'not-applicable-not-selected',
        acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length,
        criterionCount: criteria.length,
        selectedProductionScopes: SELECTION.selected.map((entry) => entry.id),
        selectedGpuSlices: [],
        observerClaimed: false,
        diffuseClaimed: false,
        networkAcquisition: false,
        imageArtifacts: false,
        elapsedMilliseconds: performance.now() - startedAt,
        nextStep: statuses.overallStatus === 'accepted'
            ? 'complete the Phase-6 reset with the selected production CPU contracts and keep assembled visible-celestial GPU/browser work deferred'
            : 'route the rejected criterion to its owning selected production layer without expanding scope or weakening tolerance',
    });

    await writeJson(mode.recordDirectory, 'criteria-results.json', {
        status: statuses.overallStatus,
        statuses,
        criteria,
    });
    await writeJson(mode.recordDirectory, 'result.json', result);
    await writeJson(mode.recordDirectory, 'provenance.json', await buildProvenance());
    await writeText(mode.recordDirectory, 'report.md', reportText(result, criteria));
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} ${result.status}; accepted=${result.acceptedCriterionCount}/${result.criterionCount}; GPU XA-G12=${result.xaG12Status}.`,
    );

    console.log(JSON.stringify({
        status: result.status,
        acceptedCriterionCount: result.acceptedCriterionCount,
        criterionCount: result.criterionCount,
        gpuParityStatus: result.gpuParityStatus,
        recordDirectory: mode.recordDirectory,
    }));
} catch (error) {
    if (recordCreated) {
        await writeFailureArtifacts(mode.recordDirectory, error, completedPhases, startedAt);
    }
    throw error;
}

async function writeInitialArtifacts(recordDirectory, resolvedMode) {
    await writeText(recordDirectory, 'state-goal.md', stateGoalText());
    await writeJson(recordDirectory, 'command.json', {
        runner: RUNNER,
        runnerPath: RUNNER_PATH,
        recordId: EXPECTED_RECORD_ID,
        recordDirectory,
        argv: resolvedMode.argv,
        command:
            `node ${RUNNER_PATH} --record ${EXPECTED_RECORD_DIRECTORY}`,
        startedAt: nowIso(),
        verificationExecution: 'in-process Jasmine and @babel/parser APIs',
        childProcessesPermitted: false,
        networkPermitted: false,
        imageArtifactsPermitted: false,
        rerunPermitted: false,
    });
    await writeJson(recordDirectory, 'criteria-and-tolerances.json', {
        criteria: CRITERIA_DEFINITIONS,
        tolerances: TOLERANCES,
    });
    await writeJson(recordDirectory, 'selection.json', SELECTION);
    await writeJson(recordDirectory, 'production-mapping.json', PRODUCTION_MAPPING);
}

async function loadInvalidPredecessor() {
    const actualPins = {};
    const parsed = {};
    for (const [id, filename] of Object.entries(INVALID_PREDECESSOR_FILES)) {
        const bytes = await readFile(resolve(INVALID_PREDECESSOR_DIRECTORY, filename));
        actualPins[id] = hashBytes(bytes);
        parsed[id] = parseJson(bytes, filename);
    }
    const hashesAccepted = stableHash(actualPins)
        === stableHash(INVALID_PREDECESSOR_PINS);
    const dispositionAccepted = parsed.result.status === 'invalid'
        && parsed.result.acceptedCriterionCount === 0
        && parsed.result.criterionCount === CRITERIA_DEFINITIONS.length
        && parsed.failure.status === 'invalid'
        && parsed.failure.message === 'spawn EPERM'
        && stableHash(parsed.failure.completedPhases) === stableHash([
            'governing-decision',
            'sealed-er8',
            'production-graph',
            'production-conformance',
        ]);
    if (!hashesAccepted || !dispositionAccepted) {
        throw new Error('Immutable record 066 no longer matches its predeclared invalid-run pins.');
    }
    return freezeJsonValue({
        kind: 'er9-invalid-predecessor-v1',
        recordId: INVALID_PREDECESSOR_RECORD_ID,
        directory: INVALID_PREDECESSOR_DIRECTORY,
        files: INVALID_PREDECESSOR_FILES,
        expectedPins: INVALID_PREDECESSOR_PINS,
        actualPins,
        hashesAccepted,
        dispositionAccepted,
        status: 'invalid-infrastructure-attempt',
        reason: 'spawn EPERM before the production test process started',
        inheritedAcceptanceEvidence: false,
        requiredFreshWork: [
            'governing decision verification',
            'sealed ER8 verification',
            'production manifests and graphs',
            'direct production conformance',
            'verification input manifest',
            'full production Jasmine suite',
            'both app-consumer syntax checks',
            'claim-boundary audit',
            'formal criteria and status derivation',
        ],
    });
}

async function loadSealedEr8() {
    const actualPins = {};
    const parsed = {};
    for (const [id, filename] of Object.entries(SEALED_ER8_FILES)) {
        const bytes = await readFile(resolve(SEALED_ER8_DIRECTORY, filename));
        actualPins[id] = hashBytes(bytes);
        parsed[id] = parseJson(bytes, filename);
    }
    const hashesAccepted = stableHash(actualPins) === stableHash(SEALED_ER8_PINS);
    const acceptedCriteria = parsed.criteria.criteria.filter((entry) =>
        entry.status === 'accepted');
    const acceptanceAccepted = parsed.result.status === 'accepted'
        && parsed.result.acceptedCriterionCount === 26
        && parsed.result.criterionCount === 26
        && parsed.criteria.status === 'accepted'
        && parsed.criteria.criteria.length === 26
        && acceptedCriteria.length === 26
        && parsed.criteria.criteria.every((entry) => entry.status === 'accepted');
    return freezeJsonValue({
        result: parsed.result,
        record: {
            recordId: SEALED_ER8_RECORD_ID,
            directory: SEALED_ER8_DIRECTORY,
            files: SEALED_ER8_FILES,
            expectedPins: SEALED_ER8_PINS,
            actualPins,
            hashesAccepted,
            acceptanceAccepted,
            status: parsed.result.status,
            acceptedCriterionCount: acceptedCriteria.length,
            criterionCount: parsed.criteria.criteria.length,
            convergenceStatus: parsed.result.convergenceStatus,
            cleanupStatus: parsed.result.cleanupStatus,
            retainedArtifactFingerprints: {
                convergence: stableHash(parsed.convergence),
                cleanup: stableHash(parsed.cleanup),
                publicSurface: stableHash(parsed.publicSurface),
                activeGraph: stableHash(parsed.activeGraph),
            },
        },
    });
}

async function loadGoverningDecision() {
    const actualPins = {};
    const requiredText = {
        'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md': [
            '### ER9 selected production scope',
            'production-owned typed point/extended source packets',
            'XA-G12 is not applicable to the',
            'unselected assembled visible-celestial GPU slice',
        ],
        'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md': [
            'select the generic typed/CPU seam and canonical Sun owner;',
            'do not select assembled visible-celestial GPU/browser work.',
        ],
    };
    const phraseFindings = [];
    for (const path of Object.keys(GOVERNING_DECISION_PINS)) {
        const bytes = await readFile(resolve(path));
        const source = bytes.toString('utf8');
        actualPins[path] = hashBytes(bytes);
        for (const phrase of requiredText[path]) {
            phraseFindings.push({
                path,
                phrase,
                present: source.includes(phrase),
            });
        }
    }
    const hashesAccepted = stableHash(actualPins) === stableHash(GOVERNING_DECISION_PINS);
    const phrasesAccepted = phraseFindings.every((entry) => entry.present);
    return freezeJsonValue({
        kind: 'er9-governing-selection-decision-v1',
        expectedPins: GOVERNING_DECISION_PINS,
        actualPins,
        phraseFindings,
        hashesAccepted,
        phrasesAccepted,
        accepted: hashesAccepted && phrasesAccepted,
    });
}

async function auditProductionGraph() {
    const hasher = new LocalModuleGraphHasher({
        workspaceRoot: process.cwd(),
        allowedRoot: PRODUCTION_ROOT,
    });
    const graph = await hasher.collect(PRODUCTION_GRAPH_ENTRIES);
    const actualPaths = Object.keys(graph.files).sort();
    const expectedPaths = [...PRODUCTION_MODULE_ALLOWLIST].sort();
    const allowlistAccepted = stableHash(actualPaths) === stableHash(expectedPaths);
    const forbiddenFindings = [];
    for (const path of actualPaths) {
        const source = await readFile(resolve(path), 'utf8');
        for (const rule of forbiddenProductionRules()) {
            if (rule.pattern.test(source)) {
                forbiddenFindings.push({ path, rule: rule.id });
            }
        }
    }
    const manifest = freezeJsonValue({
        kind: 'er9-selected-production-module-manifest-v1',
        entries: [...PRODUCTION_GRAPH_ENTRIES].sort(),
        exactAllowlist: expectedPaths,
        actualPaths,
        allowlistAccepted,
        modules: Object.fromEntries(actualPaths.map((path) => [path, {
            sha256: graph.files[path].sha256,
            byteLength: graph.files[path].byteLength,
        }])),
        graphFingerprint: graph.graphFingerprint,
        manifestFingerprint: stableHash({
            entries: [...PRODUCTION_GRAPH_ENTRIES].sort(),
            exactAllowlist: expectedPaths,
            modules: Object.fromEntries(actualPaths.map((path) => [path, graph.files[path].sha256])),
        }),
    });
    const integrationHasher = new LocalModuleGraphHasher({
        workspaceRoot: process.cwd(),
        allowedRoot: PRODUCTION_ROOT,
    });
    const integrationGraph = await integrationHasher.collect(INTEGRATION_GRAPH_ENTRIES);
    const integrationPaths = Object.keys(integrationGraph.files).sort();
    const integrationForbiddenFindings = await findForbiddenProductionSources(
        integrationPaths,
    );
    const integrationManifest = freezeJsonValue({
        kind: 'er9-production-integration-manifest-v1',
        entries: [...INTEGRATION_GRAPH_ENTRIES].sort(),
        actualPaths: integrationPaths,
        modules: Object.fromEntries(integrationPaths.map((path) => [path, {
            sha256: integrationGraph.files[path].sha256,
            byteLength: integrationGraph.files[path].byteLength,
        }])),
        graphFingerprint: integrationGraph.graphFingerprint,
        forbiddenFindings: integrationForbiddenFindings,
        isolationAccepted: integrationForbiddenFindings.length === 0,
    });
    return freezeJsonValue({
        manifest,
        graph: {
            ...graph,
            forbiddenRules: forbiddenProductionRules().map((rule) => rule.id),
            forbiddenFindings,
            isolationAccepted: forbiddenFindings.length === 0,
        },
        allowlistAccepted,
        isolationAccepted: forbiddenFindings.length === 0,
        integrationGraph: {
            ...integrationGraph,
            forbiddenFindings: integrationForbiddenFindings,
            isolationAccepted: integrationForbiddenFindings.length === 0,
        },
        integrationManifest,
    });
}

async function findForbiddenProductionSources(paths) {
    const findings = [];
    for (const path of paths) {
        const source = await readFile(resolve(path), 'utf8');
        for (const rule of forbiddenProductionRules()) {
            if (rule.pattern.test(source)) {
                findings.push({ path, rule: rule.id });
            }
        }
    }
    return findings;
}

async function auditClaimBoundary(
    recordDirectory,
    productionGraph,
    integrationGraph,
    verificationInputs,
) {
    const auditedSources = [...new Set([
        RUNNER_PATH,
        ...Object.keys(productionGraph.files),
        ...Object.keys(integrationGraph.files),
        ...verificationInputs.auditableSourcePaths,
    ])].sort();
    const forbiddenImportSpecifiers = new Set([
        'node:' + 'http',
        'node:' + 'https',
        'node:' + 'net',
        'node:' + 'tls',
        'node:' + 'dns',
        'undi' + 'ci',
    ]);
    const forbiddenCallNames = [
        'fet' + 'ch',
        'XML' + 'HttpRequest',
        'Web' + 'Socket',
    ];
    const networkFindings = [];
    for (const path of auditedSources) {
        const source = await readFile(resolve(path), 'utf8');
        const importSpecifiers = extractModuleSpecifiers(source);
        for (const specifier of importSpecifiers) {
            if (forbiddenImportSpecifiers.has(specifier)) {
                networkFindings.push({ path, kind: 'import', value: specifier });
            }
        }
        for (const callName of forbiddenCallNames) {
            const pattern = new RegExp(`\\b${callName}\\s*\\(`, 'u');
            if (pattern.test(source)) {
                networkFindings.push({ path, kind: 'call', value: callName });
            }
        }
    }

    const existingArtifactNames = (await readdir(resolve(recordDirectory))).sort();
    const plannedFinalArtifactNames = [
        'claim-boundary-audit.json',
        'criteria-results.json',
        'provenance.json',
        'report.md',
        'result.json',
    ];
    const allArtifactNames = [...new Set([
        ...existingArtifactNames,
        ...plannedFinalArtifactNames,
    ])].sort();
    const imageExtensions = new Set([
        '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.tif', '.tiff', '.webp',
    ]);
    const imageArtifactFindings = allArtifactNames.filter((name) =>
        imageExtensions.has(extname(name).toLowerCase()));
    const artifactExtensions = Object.fromEntries(allArtifactNames.map((name) => [
        name,
        extname(name).toLowerCase() || '(none)',
    ]));
    return freezeJsonValue({
        kind: 'er9-claim-boundary-static-audit-v1',
        auditedSources,
        forbiddenNetworkImportSpecifiers: [...forbiddenImportSpecifiers].sort(),
        forbiddenNetworkCallNames: forbiddenCallNames,
        networkFindings,
        existingArtifactNames,
        plannedFinalArtifactNames,
        allArtifactNames,
        artifactExtensions,
        imageArtifactFindings,
        declarations: {
            networkAcquisition: SELECTION.networkAcquisition,
            imageArtifacts: SELECTION.imageArtifacts,
            observerClaimed: SELECTION.observerClaimed,
            diffuseClaimed: SELECTION.diffuseClaimed,
        },
        verificationScriptAccepted: verificationInputs.scriptAccepted,
        accepted: networkFindings.length === 0
            && imageArtifactFindings.length === 0
            && SELECTION.networkAcquisition === false
            && SELECTION.imageArtifacts === false
            && SELECTION.observerClaimed === false
            && SELECTION.diffuseClaimed === false
            && verificationInputs.scriptAccepted,
    });
}

async function buildVerificationInputManifest(graphAudit) {
    const specFiles = await collectFilesRecursively(
        PRODUCTION_ROOT,
        (path) => /\/_tests\/.*\.spec\.(?:m)?js$/u.test(path.replaceAll('\\', '/')),
    );
    const helperFiles = await collectFilesRecursively(
        'spec/helpers',
        (path) => /\.(?:m)?js$/u.test(path),
    );
    const productionAuditFiles = await collectFilesRecursively(
        PRODUCTION_ROOT,
        (path) => !path.replaceAll('\\', '/').includes('/quarantine/')
            && /(?:\.js|\.d\.ts|\.json|\.md)$/u.test(path),
    );
    const paths = [...new Set([
        'package.json',
        'package-lock.json',
        JASMINE_PACKAGE_PATH,
        JASMINE_IMPLEMENTATION_PATH,
        BABEL_PARSER_PACKAGE_PATH,
        BABEL_PARSER_IMPLEMENTATION_PATH,
        JASMINE_CONFIG_PATH,
        ...APP_CONSUMER_FILES,
        ...specFiles,
        ...helperFiles,
        ...productionAuditFiles,
        ...Object.keys(graphAudit.graph.files),
        ...Object.keys(graphAudit.integrationGraph.files),
    ])].sort();
    const files = {};
    for (const path of paths) {
        const bytes = await readFile(resolve(path));
        files[path] = {
            sha256: hashBytes(bytes),
            byteLength: bytes.byteLength,
        };
    }
    const packageJson = parseJson(await readFile(resolve('package.json')), 'package.json');
    const script = packageJson.scripts?.['test:algorithm32:production'];
    const lifecycleScripts = {
        pre: packageJson.scripts?.['pretest:algorithm32:production'] ?? null,
        command: script ?? null,
        post: packageJson.scripts?.['posttest:algorithm32:production'] ?? null,
    };
    const expectedCommand = `jasmine --config=${JASMINE_CONFIG_PATH}`;
    const scriptAccepted = script === expectedCommand
        && lifecycleScripts.pre === null
        && lifecycleScripts.post === null;
    const jasminePackage = parseJson(
        await readFile(resolve(JASMINE_PACKAGE_PATH)),
        JASMINE_PACKAGE_PATH,
    );
    const babelParserPackage = parseJson(
        await readFile(resolve(BABEL_PARSER_PACKAGE_PATH)),
        BABEL_PARSER_PACKAGE_PATH,
    );
    return freezeJsonValue({
        kind: 'er9-verification-input-manifest-v1',
        files,
        fileCount: paths.length,
        specFiles,
        helperFiles,
        productionAuditFiles,
        appConsumerFiles: APP_CONSUMER_FILES,
        lifecycleScripts,
        expectedCommand,
        scriptAccepted,
        executionMechanism: {
            productionSuite: 'installed Jasmine API with exact repository config',
            appSyntax: 'installed @babel/parser API with sourceType module and JSX enabled',
            childProcesses: false,
            correctionFromRecord066:
                'replace only sandbox-denied process spawning; retain exact suite, inputs, criteria, and tolerances',
        },
        toolchain: {
            jasmine: {
                version: jasminePackage.version,
                packagePath: JASMINE_PACKAGE_PATH,
                implementationPath: JASMINE_IMPLEMENTATION_PATH,
            },
            babelParser: {
                version: babelParserPackage.version,
                packagePath: BABEL_PARSER_PACKAGE_PATH,
                implementationPath: BABEL_PARSER_IMPLEMENTATION_PATH,
            },
        },
        auditableSourcePaths: paths.filter((path) => /\.(?:js|mjs|json)$/u.test(path)),
        fingerprint: stableHash(files),
    });
}

async function collectFilesRecursively(root, predicate) {
    const result = [];
    const queue = [root];
    while (queue.length > 0) {
        const directory = queue.shift();
        const entries = await readdir(resolve(directory), { withFileTypes: true });
        for (const entry of entries) {
            const path = `${directory}/${entry.name}`.replaceAll('\\', '/');
            if (entry.isDirectory()) {
                queue.push(path);
            } else if (entry.isFile() && predicate(path)) {
                result.push(path);
            }
        }
    }
    return result.sort();
}

async function runProductionConformance() {
    const modules = await loadProductionModules();
    const basis = modules.createCanonicalSpectralDensityBasis();
    const solarPacket = modules.createCanonicalSolarIrradianceDensity(basis);
    const camera = new modules.PerspectiveCameraRaster({
        widthPixels: 1,
        heightPixels: 1,
        verticalFovDegrees: 60,
    });
    const stableSha256 = evaluateStableSha256(modules);
    const legacyAliasAudit = await evaluateLegacyAliasAudit();
    const basisEvidence = evaluateBasis(basis, modules);
    const packetEvidence = evaluateSolarPacket(solarPacket, basis, modules);
    const sourceCoupling = evaluateSourceCoupling(solarPacket, modules);
    const distantSun = evaluateDistantSun(solarPacket, modules);
    const point = evaluatePointTransport(solarPacket, camera, modules);
    const visibility = evaluateVisibility(modules);
    const sunDisk = evaluateSunDisk(solarPacket, modules);
    const extendedTransport = evaluateExtendedTransport(
        sunDisk.adapter,
        camera,
        modules,
    );
    const frameAdapter = evaluateFrameAdapter(basis, modules);
    const composition = evaluateComposition({
        basis,
        camera,
        pointAccumulation: point.onFrame.accumulation,
        extendedIntegration: extendedTransport.integration,
        modules,
    });
    const sourceOwnership = freezeJsonValue({
        canonicalBasisFingerprint: basis.fingerprint,
        canonicalSolarPacketFingerprint: solarPacket.fingerprint,
        canonicalSolarSourceIdentity: solarPacket.provenance,
        owners: {
            atmosphereAndCpuDirectLighting: {
                owner: 'DistantSunLightSource configured typed packet',
                packetFingerprint: distantSun.descriptorPacketFingerprint,
                valuesRetainedByIdentity: distantSun.cpuValuesRetainedByIdentity,
            },
            shaderDirectLighting: {
                owner: 'DistantSunLightSource configured typed packet',
                packetFingerprint: distantSun.shaderPacketFingerprint,
                maximumRelativeValueResidual: distantSun.shaderMaximumRelativeResidual,
            },
            visibleSunDisk: {
                owner: 'derived adapter referencing the same canonical irradiance packet',
                packetFingerprint: sunDisk.record.canonicalIrradiancePacketFingerprint,
                irradianceRetainedByIdentity: sunDisk.record.irradianceRetainedByIdentity,
            },
        },
        duplicateRuntimeSolarPacket: false,
        sourceSpecificGain: false,
    });
    return freezeJsonValue({
        basis: basisEvidence,
        stableSha256,
        legacyAliasAudit,
        solarPacket: packetEvidence,
        sourceCoupling,
        distantSun,
        point: {
            onFrame: point.onFrame.record,
            rearHemisphere: point.rearHemisphere,
        },
        visibility,
        sunDisk: sunDisk.record,
        extendedTransport: extendedTransport.record,
        frameAdapter,
        composition,
        sourceOwnership,
    });
}

async function loadProductionModules() {
    const paths = {
        sourceConsts: `${PRODUCTION_ROOT}/celestial-sources/consts.js`,
        canonicalData: `${PRODUCTION_ROOT}/constants/Algorithm32CanonicalData.js`,
        basisFactory: `${PRODUCTION_ROOT}/celestial-sources/createCanonicalSpectralDensityBasis.js`,
        solarFactory: `${PRODUCTION_ROOT}/celestial-sources/createCanonicalSolarIrradianceDensity.js`,
        ExternalCelestialSource: `${PRODUCTION_ROOT}/celestial-sources/ExternalCelestialSource.js`,
        SpectralDensityBasis: `${PRODUCTION_ROOT}/celestial-sources/SpectralDensityBasis.js`,
        SpectralDensityPacket: `${PRODUCTION_ROOT}/celestial-sources/SpectralDensityPacket.js`,
        DistantSunLightSource: `${PRODUCTION_ROOT}/light-sources/DistantSunLightSource.js`,
        PerspectiveCameraRaster: `${PRODUCTION_ROOT}/camera/PerspectiveCameraRaster.js`,
        ExactDirectionalVisibilityResolver: `${PRODUCTION_ROOT}/directional-visibility/ExactDirectionalVisibilityResolver.js`,
        BilinearPointResponse: `${PRODUCTION_ROOT}/point-source-raster/BilinearPointResponse.js`,
        TransportedPointSourceAccumulator: `${PRODUCTION_ROOT}/point-source-raster/TransportedPointSourceAccumulator.js`,
        CanonicalUniformSunDiskSource: `${PRODUCTION_ROOT}/extended-source-integration/CanonicalUniformSunDiskSource.js`,
        Algorithm32SpectralFrameEvaluator: `${PRODUCTION_ROOT}/physical-frame/Algorithm32SpectralFrameEvaluator.js`,
        PhysicalSpectralFrameComposer: `${PRODUCTION_ROOT}/physical-frame/PhysicalSpectralFrameComposer.js`,
        SphericalCapQuadrature: `${PRODUCTION_ROOT}/extended-source-integration/SphericalCapQuadrature.js`,
        TransportedExtendedSourceIntegrator: `${PRODUCTION_ROOT}/extended-source-integration/TransportedExtendedSourceIntegrator.js`,
        SharedModel: `${PRODUCTION_ROOT}/models/SharedModel.js`,
        ShaderDescriptorBuilder: `${PRODUCTION_ROOT}/shader/ShaderDescriptorBuilder.js`,
        productionStableHash: `${PRODUCTION_ROOT}/provenance/stableHash.js`,
    };
    const loaded = Object.fromEntries(await Promise.all(Object.entries(paths).map(
        async ([id, path]) => [id, await import(pathToFileURL(resolve(path)).href)],
    )));
    return Object.freeze({
        ...loaded.sourceConsts,
        ...loaded.canonicalData,
        createCanonicalSpectralDensityBasis:
            loaded.basisFactory.createCanonicalSpectralDensityBasis,
        createCanonicalSolarIrradianceDensity:
            loaded.solarFactory.createCanonicalSolarIrradianceDensity,
        ExternalCelestialSource: loaded.ExternalCelestialSource.default,
        SpectralDensityBasis: loaded.SpectralDensityBasis.default,
        SpectralDensityPacket: loaded.SpectralDensityPacket.default,
        DistantSunLightSource: loaded.DistantSunLightSource.default,
        PerspectiveCameraRaster: loaded.PerspectiveCameraRaster.default,
        ExactDirectionalVisibilityResolver:
            loaded.ExactDirectionalVisibilityResolver.default,
        BilinearPointResponse: loaded.BilinearPointResponse.default,
        TransportedPointSourceAccumulator:
            loaded.TransportedPointSourceAccumulator.default,
        CanonicalUniformSunDiskSource:
            loaded.CanonicalUniformSunDiskSource.default,
        Algorithm32SpectralFrameEvaluator:
            loaded.Algorithm32SpectralFrameEvaluator.default,
        PhysicalSpectralFrameComposer:
            loaded.PhysicalSpectralFrameComposer.default,
        SphericalCapQuadrature: loaded.SphericalCapQuadrature.default,
        TransportedExtendedSourceIntegrator:
            loaded.TransportedExtendedSourceIntegrator.default,
        SharedModel: loaded.SharedModel.SharedModel,
        ShaderDescriptorBuilder: loaded.ShaderDescriptorBuilder.default,
        productionStableHash: loaded.productionStableHash.stableHash,
    });
}

function evaluateStableSha256(modules) {
    const expected = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
    const actual = modules.productionStableHash({});
    const orderedLeft = modules.productionStableHash({ z: 2, a: 1 });
    const orderedRight = modules.productionStableHash({ a: 1, z: 2 });
    return freezeJsonValue({
        algorithm: 'SHA-256',
        canonicalInput: '{}',
        expected,
        actual,
        canonicalKeyOrderAccepted: orderedLeft === orderedRight,
        accepted: actual === expected && orderedLeft === orderedRight,
    });
}

async function evaluateLegacyAliasAudit() {
    const distantPath = `${PRODUCTION_ROOT}/light-sources/DistantSunLightSource.js`;
    const basisPath = `${PRODUCTION_ROOT}/celestial-sources/SpectralDensityBasis.js`;
    const distantSource = await readFile(resolve(distantPath), 'utf8');
    const basisSource = await readFile(resolve(basisPath), 'utf8');
    const appFindings = [];
    for (const path of APP_CONSUMER_FILES) {
        const source = await readFile(resolve(path), 'utf8');
        const constructions = [...source.matchAll(
            /new\s+DistantSunLightSource\s*\(\s*\{([\s\S]*?)\}\s*\)/gu,
        )];
        if (constructions.length === 0) {
            appFindings.push({ path, finding: 'missing-distant-sun-construction' });
        }
        for (const construction of constructions) {
            if (!/\bspectralIrradianceDensity\s*:/u.test(construction[1])) {
                appFindings.push({ path, finding: 'missing-typed-packet-field' });
            }
            if (/\bspectralChannels\s*:/u.test(construction[1])) {
                appFindings.push({ path, finding: 'legacy-spectralChannels-field' });
            }
        }
    }
    const findings = [
        ...(/\bspectralChannels\b/u.test(distantSource)
            ? [{ path: distantPath, finding: 'legacy-spectralChannels-identifier' }]
            : []),
        ...(/LIGHT_SOURCE_SOLAR_IRRADIANCE/u.test(distantSource)
            ? [{ path: distantPath, finding: 'legacy-hardcoded-solar-constant' }]
            : []),
        ...(/\b(?:this|configuration)\.wavelengths\b/u.test(basisSource)
            ? [{ path: basisPath, finding: 'canonical-wavelengths-alias' }]
            : []),
        ...appFindings,
    ];
    return freezeJsonValue({
        kind: 'er9-legacy-alias-source-audit-v1',
        auditedPaths: [distantPath, basisPath, ...APP_CONSUMER_FILES],
        findings,
        accepted: findings.length === 0,
    });
}

function evaluateBasis(basis, modules) {
    const channels = basis.channels;
    const ordered = channels.every((channel, index) =>
        index === 0 || channel.centerNanometers > channels[index - 1].centerNanometers);
    const boundsAndWidthsAccepted = channels.every((channel) =>
        Number.isFinite(channel.lowerBoundNanometers)
        && Number.isFinite(channel.centerNanometers)
        && Number.isFinite(channel.upperBoundNanometers)
        && Number.isFinite(channel.widthNanometers)
        && channel.lowerBoundNanometers < channel.centerNanometers
        && channel.centerNanometers < channel.upperBoundNanometers
        && Math.abs(
            channel.upperBoundNanometers
                - channel.lowerBoundNanometers
                - channel.widthNanometers,
        ) <= 1e-12);
    const reconstructed = new modules.SpectralDensityBasis(basis.describe());
    return freezeJsonValue({
        id: basis.id,
        channelCount: channels.length,
        wavelengthUnits: basis.wavelengthUnits,
        sampleSemantics: basis.sampleSemantics,
        quadrature: basis.quadrature,
        fingerprint: basis.fingerprint,
        channels,
        ordered,
        boundsAndWidthsAccepted,
        reconstructionFingerprint: reconstructed.fingerprint,
        accepted: basis.id === modules.CANONICAL_DENSITY_BASIS_ID
            && channels.length === CANONICAL_CHANNEL_COUNT
            && basis.wavelengthUnits === modules.WAVELENGTH_UNITS_NANOMETERS
            && basis.sampleSemantics === modules.CANONICAL_DENSITY_SAMPLE_SEMANTICS
            && basis.quadrature === modules.CANONICAL_DENSITY_QUADRATURE
            && FINGERPRINT_PATTERN.test(basis.fingerprint)
            && ordered
            && boundsAndWidthsAccepted
            && reconstructed.fingerprint === basis.fingerprint,
    });
}

function evaluateSolarPacket(packet, basis, modules) {
    const reconstructed = new modules.SpectralDensityPacket({
        quantity: packet.quantity,
        units: packet.units,
        basis,
        values: packet.values,
        provenance: packet.provenance,
        uncertainty: packet.uncertainty,
    });
    return freezeJsonValue({
        quantity: packet.quantity,
        units: packet.units,
        basisFingerprint: packet.basis.fingerprint,
        basisRetainedByIdentity: packet.basis === basis,
        valueCount: packet.values.length,
        values: packet.values,
        provenance: packet.provenance,
        uncertainty: packet.uncertainty,
        fingerprint: packet.fingerprint,
        reconstructionFingerprint: reconstructed.fingerprint,
        accepted: packet.quantity === modules.SPECTRAL_IRRADIANCE_DENSITY
            && packet.units === modules.SPECTRAL_DENSITY_UNITS[
                modules.SPECTRAL_IRRADIANCE_DENSITY
            ]
            && packet.basis === basis
            && packet.values.length === CANONICAL_CHANNEL_COUNT
            && packet.values.every((value) => Number.isFinite(value) && value >= 0)
            && stableHash(packet.values) === stableHash(
                modules.CANONICAL_SPECTRAL_CHANNELS.map((channel) =>
                    channel.solarIrradiance),
            )
            && stableHash(packet.provenance)
                === stableHash(modules.CANONICAL_SOLAR_IRRADIANCE_PROVENANCE)
            && FINGERPRINT_PATTERN.test(packet.fingerprint)
            && FINGERPRINT_PATTERN.test(packet.provenance.sourceHashSha256)
            && typeof packet.uncertainty.status === 'string'
            && reconstructed.fingerprint === packet.fingerprint,
    });
}

function evaluateSourceCoupling(solarPacket, modules) {
    const point = new modules.ExternalCelestialSource({
        id: 'er9-proof-point',
        kind: modules.POINT_CELESTIAL_SOURCE,
        geometry: { kind: 'infinite-direction', owner: 'er9-proof' },
        spectralMeasure: solarPacket,
    });
    const radiancePacket = new modules.SpectralDensityPacket({
        quantity: modules.SPECTRAL_RADIANCE_DENSITY,
        units: modules.SPECTRAL_DENSITY_UNITS[
            modules.SPECTRAL_RADIANCE_DENSITY
        ],
        basis: solarPacket.basis,
        values: solarPacket.values.map((value) => value / Math.PI),
        provenance: {
            sourceId: 'er9-analytic-radiance-coupling-proof',
            sourceVersion: 'v1',
            sourceHashSha256: stableHash({
                source: solarPacket.fingerprint,
                derivation: 'proof-only divide by pi',
            }),
            derivation: 'proof-only divide by pi; not a promoted physical source',
        },
        uncertainty: {
            status: 'analytic-fixture',
            model: 'identity-and-quantity-discriminator-only',
            notes: [
                'This packet exercises typed source coupling and makes no physical radiance claim.',
            ],
        },
    });
    const extended = new modules.ExternalCelestialSource({
        id: 'er9-proof-extended',
        kind: modules.EXTENDED_CELESTIAL_SOURCE,
        geometry: { kind: 'uniform-angular-disk', owner: 'er9-proof' },
        spectralMeasure: radiancePacket,
    });
    let extendedIrradianceRejected = false;
    try {
        new modules.ExternalCelestialSource({
            id: 'er9-invalid-extended',
            kind: modules.EXTENDED_CELESTIAL_SOURCE,
            geometry: { kind: 'uniform-disk', owner: 'er9-proof' },
            spectralMeasure: solarPacket,
        });
    } catch {
        extendedIrradianceRejected = true;
    }
    let pointRadianceRejected = false;
    try {
        new modules.ExternalCelestialSource({
            id: 'er9-invalid-point',
            kind: modules.POINT_CELESTIAL_SOURCE,
            geometry: { kind: 'infinite-direction', owner: 'er9-proof' },
            spectralMeasure: radiancePacket,
        });
    } catch {
        pointRadianceRejected = true;
    }
    return freezeJsonValue({
        pointKind: point.kind,
        pointQuantity: point.spectralMeasure.quantity,
        pointMeasureRetainedByIdentity: point.spectralMeasure === solarPacket,
        extendedKind: extended.kind,
        extendedQuantity: extended.spectralMeasure.quantity,
        extendedMeasureRetainedByIdentity:
            extended.spectralMeasure === radiancePacket,
        radiancePacketFingerprint: radiancePacket.fingerprint,
        mismatchedExtendedIrradianceRejected: extendedIrradianceRejected,
        mismatchedPointRadianceRejected: pointRadianceRejected,
        accepted: point.kind === modules.POINT_CELESTIAL_SOURCE
            && point.spectralMeasure === solarPacket
            && point.spectralMeasure.quantity
                === modules.SPECTRAL_IRRADIANCE_DENSITY
            && extended.kind === modules.EXTENDED_CELESTIAL_SOURCE
            && extended.spectralMeasure === radiancePacket
            && extended.spectralMeasure.quantity
                === modules.SPECTRAL_RADIANCE_DENSITY
            && extendedIrradianceRejected
            && pointRadianceRejected,
    });
}

function evaluateDistantSun(solarPacket, modules) {
    const directionToLight = Object.freeze([0, 0, -1]);
    const source = new modules.DistantSunLightSource({
        directionToLight,
        spectralIrradianceDensity: solarPacket,
        angularRadiusRadians: 0.00465,
    });
    const direct = source.sampleDirectLighting({
        spectralBasis: solarPacket.basis,
    });
    const descriptor = source.describe();
    const sharedModel = new modules.SharedModel({
        version: 1,
        lightSource: source,
        atmosphere: { describe: () => ({ kind: 'er9-proof-atmosphere' }) },
        geometry: { describe: () => ({ kind: 'er9-proof-geometry' }) },
        spectralBasis: solarPacket.basis,
    });
    const shaderDescriptor = new modules.ShaderDescriptorBuilder().build({
        model: sharedModel,
        color: { describe: () => ({ kind: 'er9-proof-color' }) },
        config: { config: { execution: {}, shader: {} } },
        variantId: 'er9-production-packet-proof',
    });
    const contribution = source.createShaderContribution({ descriptor: shaderDescriptor });
    const constantsBlock = contribution.functions.find((entry) =>
        entry.id === 'light-source-constants');
    const shaderValues = parseShaderFloatArray(constantsBlock?.code);
    const shaderResiduals = solarPacket.values.map((value, index) =>
        relativeResidual(shaderValues[index], value));
    const shaderMaximumRelativeResidual = Math.max(...shaderResiduals);
    let legacyConfigurationRejected = false;
    let bareArrayRejected = false;
    let mismatchedCpuBasisRejected = false;
    let mismatchedShaderBasisRejected = false;
    try {
        new modules.DistantSunLightSource({
            directionToLight,
            spectralIrradianceDensity: solarPacket,
            angularRadiusRadians: 0.00465,
            spectralChannels: solarPacket.values,
        });
    } catch {
        legacyConfigurationRejected = true;
    }
    try {
        new modules.DistantSunLightSource({
            directionToLight,
            spectralIrradianceDensity: solarPacket.values,
            angularRadiusRadians: 0.00465,
        });
    } catch {
        bareArrayRejected = true;
    }
    try {
        source.sampleDirectLighting({
            spectralBasis: {
                ...solarPacket.basis.describe(),
                fingerprint: 'f'.repeat(64),
            },
        });
    } catch {
        mismatchedCpuBasisRejected = true;
    }
    try {
        source.createShaderContribution({
            descriptor: {
                ...shaderDescriptor,
                spectralBasis: {
                    ...shaderDescriptor.spectralBasis,
                    facts: {
                        ...shaderDescriptor.spectralBasis.facts,
                        basis: {
                            ...shaderDescriptor.spectralBasis.facts.basis,
                            fingerprint: 'f'.repeat(64),
                        },
                    },
                },
            },
        });
    } catch {
        mismatchedShaderBasisRejected = true;
    }
    return freezeJsonValue({
        descriptorBuilder: 'ShaderDescriptorBuilder-through-SharedModel',
        sharedModelSpectralBasisFingerprint:
            shaderDescriptor.spectralBasis.facts.basis.fingerprint,
        cpuValuesRetainedByIdentity: direct.incidentRadiance === solarPacket.values,
        cpuValues: direct.incidentRadiance,
        descriptorPacketFingerprint:
            descriptor.spectralIrradianceDensity.fingerprint,
        descriptorPacketFactsAccepted:
            stableHash(descriptor.spectralIrradianceDensity)
                === stableHash(solarPacket.describe()),
        shaderPacketFingerprint:
            shaderDescriptor.lightSource.facts.spectralIrradianceDensity.fingerprint,
        shaderConstantsSource: constantsBlock.code,
        shaderValues,
        shaderResiduals,
        shaderMaximumRelativeResidual,
        legacyConfigurationRejected,
        bareArrayRejected,
        mismatchedCpuBasisRejected,
        mismatchedShaderBasisRejected,
        cpuAccepted: direct.incidentRadiance === solarPacket.values
            && mismatchedCpuBasisRejected,
        descriptorAccepted:
            descriptor.spectralIrradianceDensity.fingerprint === solarPacket.fingerprint
            && stableHash(descriptor.spectralIrradianceDensity)
                === stableHash(solarPacket.describe()),
        shaderAccepted: shaderValues.length === solarPacket.values.length
            && shaderMaximumRelativeResidual <= TOLERANCES.shaderPacketRelative
            && shaderDescriptor.lightSource.facts.spectralIrradianceDensity.fingerprint
                === solarPacket.fingerprint
            && shaderDescriptor.spectralBasis.facts.basis.fingerprint
                === solarPacket.basis.fingerprint
            && legacyConfigurationRejected
            && bareArrayRejected
            && mismatchedShaderBasisRejected,
    });
}

function evaluatePointTransport(solarPacket, camera, modules) {
    const response = new modules.BilinearPointResponse();
    const visibilityResolver = new modules.ExactDirectionalVisibilityResolver({
        blockers: [],
        depthTieToleranceMeters: 0,
    });
    const transmittanceSampler = {
        fingerprint: 'c'.repeat(64),
        sampleExactSourceTransmittance: () => ({
            units: '1',
            basisFingerprint: solarPacket.basis.fingerprint,
            values: Array(CANONICAL_CHANNEL_COUNT).fill(1),
        }),
    };
    const accumulator = new modules.TransportedPointSourceAccumulator({
        camera,
        response,
        visibilityResolver,
        transmittanceSampler,
    });
    const onFrameSource = createPointSource(
        'er9-on-frame-point', solarPacket, modules,
    );
    const accumulation = accumulator.accumulate({
        source: onFrameSource,
        sourceDirectionCamera: [0, 0, -1],
        sourceDepth: { kind: 'infinite' },
    });
    const rearSource = createPointSource(
        'er9-rear-point', solarPacket, modules,
    );
    const rear = accumulator.accumulate({
        source: rearSource,
        sourceDirectionCamera: [0, 0, 1],
        sourceDepth: { kind: 'infinite' },
    });
    const independentAccounting = independentPointAccounting(accumulation);
    return Object.freeze({
        onFrame: {
            accumulation,
            record: freezeJsonValue({
                sourceId: accumulation.source.id,
                onFrameWeight: accumulation.response.onFrameWeight,
                offRasterWeight: accumulation.response.offRasterWeight,
                accountingMaximumAbsoluteResidual:
                    accumulation.accounting.maximumAbsoluteResidual,
                independentAccounting,
                pixelCount: accumulation.pixels.length,
                accepted:
                    accumulation.accounting.maximumAbsoluteResidual
                        <= TOLERANCES.pointResponseAbsolute
                    && independentAccounting.maximumAbsoluteResidual
                        <= TOLERANCES.pointResponseAbsolute
                    && Math.abs(
                        accumulation.response.onFrameWeight
                            + accumulation.response.offRasterWeight
                            - 1,
                    ) <= TOLERANCES.pointResponseAbsolute,
            }),
        },
        rearHemisphere: freezeJsonValue({
            sourceId: rear.source.id,
            onFrameWeight: rear.response.onFrameWeight,
            offRasterWeight: rear.response.offRasterWeight,
            projectionStatus: rear.response.projectionStatus,
            pixelCount: rear.pixels.length,
            accountingMaximumAbsoluteResidual:
                rear.accounting.maximumAbsoluteResidual,
            accepted: rear.response.onFrameWeight === 0
                && rear.response.offRasterWeight === 1
                && rear.response.projectionStatus
                    === 'outside-forward-camera-hemisphere'
                && rear.pixels.length === 0
                && rear.accounting.maximumAbsoluteResidual
                    <= TOLERANCES.pointResponseAbsolute,
        }),
    });
}

function independentPointAccounting(accumulation) {
    const accounted = [...accumulation.offRasterSpectralIrradiance.values];
    for (const pixel of accumulation.pixels) {
        for (let channel = 0; channel < accounted.length; channel += 1) {
            accounted[channel] += pixel.pointSpectralRadianceDensity[channel]
                * pixel.pixelSolidAngleSteradians;
        }
    }
    const residuals = accounted.map((value, channel) =>
        value - accumulation.transmittedSpectralIrradiance.values[channel]);
    return freezeJsonValue({
        equation: 'sum(pixel radiance * exact pixel solid angle) + off-raster irradiance - transmitted irradiance',
        accounted,
        transmitted: accumulation.transmittedSpectralIrradiance.values,
        residuals,
        maximumAbsoluteResidual: Math.max(...residuals.map(Math.abs)),
    });
}

function evaluateVisibility(modules) {
    const resolver = new modules.ExactDirectionalVisibilityResolver({
        depthTieToleranceMeters: 1e-9,
        blockers: [
            {
                id: 'far-scene',
                kind: 'scene',
                fingerprint: 'd'.repeat(64),
                intersectExactRay: () => ({ distanceMeters: 20, featureId: 'far' }),
            },
            {
                id: 'near-globe',
                kind: 'globe',
                fingerprint: 'e'.repeat(64),
                intersectExactRay: () => ({ distanceMeters: 5, featureId: 'near' }),
            },
        ],
    });
    const result = resolver.resolveExactSourceVisibility({
        sourceId: 'finite-source',
        sourceGeometry: { kind: 'finite-proof-source' },
        directionCamera: [0, 0, -1],
        directionFrame: 'camera-space-unit-vector-forward-minus-z',
        depth: { kind: 'finite', distanceMeters: 10 },
    });
    return freezeJsonValue({
        visible: result.visible,
        occluder: result.occluder,
        selection: result.diagnostics.selection,
        accepted: result.visible === false
            && result.occluder.id === 'near-globe'
            && result.occluder.distanceMeters === 5
            && result.diagnostics.selection.occluderId === 'near-globe',
    });
}

function evaluateSunDisk(solarPacket, modules) {
    const adapter = new modules.CanonicalUniformSunDiskSource({
        id: 'er9-canonical-uniform-sun',
        irradiancePacket: solarPacket,
        angularRadiusRadians: 0.00465,
        centerDirectionCamera: [0, 0, -1],
    });
    const independentlyReconstructed = adapter.packet.values.map((value) =>
        value * adapter.projectedSolidAngleSteradians);
    const independentRelativeResiduals = independentlyReconstructed.map((value, index) =>
        relativeResidual(value, solarPacket.values[index]));
    const independentMaximumRelativeResidual = Math.max(...independentRelativeResiduals);
    const record = freezeJsonValue({
        canonicalIrradiancePacketFingerprint:
            adapter.canonicalIrradiancePacketFingerprint,
        irradianceRetainedByIdentity: adapter.irradiancePacket === solarPacket,
        radiancePacketFingerprint: adapter.packet.fingerprint,
        sourceFingerprint: adapter.source.fingerprint,
        reconstruction: adapter.reconstruction,
        independentReconstruction: {
            formula: 'derived radiance * projected solid angle',
            values: independentlyReconstructed,
            relativeResiduals: independentRelativeResiduals,
            maximumRelativeResidual: independentMaximumRelativeResidual,
        },
        accepted: adapter.irradiancePacket === solarPacket
            && adapter.canonicalIrradiancePacketFingerprint === solarPacket.fingerprint
            && adapter.reconstruction.maxRelativeResidual
                <= TOLERANCES.sunDiskReconstructionRelative
            && independentMaximumRelativeResidual
                <= TOLERANCES.sunDiskReconstructionRelative,
    });
    return Object.freeze({ adapter, record });
}

function evaluateExtendedTransport(adapter, camera, modules) {
    const exactVisibilityResolver = new modules.ExactDirectionalVisibilityResolver({
        blockers: [],
        depthTieToleranceMeters: 0,
    });
    const visibilityRays = [];
    const transmittanceRays = [];
    const visibilityResolver = {
        fingerprint: exactVisibilityResolver.fingerprint,
        resolveExtendedSampleVisibility(ray) {
            visibilityRays.push(ray);
            return exactVisibilityResolver.resolveExtendedSampleVisibility(ray);
        },
    };
    const transmittanceSampler = {
        fingerprint: '9'.repeat(64),
        sampleExtendedSampleTransmittance(ray) {
            transmittanceRays.push(ray);
            return {
                units: '1',
                basisFingerprint: adapter.packet.basis.fingerprint,
                values: Array(CANONICAL_CHANNEL_COUNT).fill(1),
            };
        },
    };
    const integrator = new modules.TransportedExtendedSourceIntegrator({
        camera,
        visibilityResolver,
        transmittanceSampler,
    });
    const integration = integrator.integrate({
        source: adapter,
        sourceDepth: { kind: 'infinite' },
        radialCount: 2,
        azimuthCount: 8,
    });
    const independentOnFrame = Array(CANONICAL_CHANNEL_COUNT).fill(0);
    for (const pixel of integration.pixels) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            independentOnFrame[channel] +=
                pixel.transportedExtendedSpectralRadianceDensity[channel]
                * pixel.pixelSolidAngleSteradians;
        }
    }
    const expectedOnFrame = integration.integrals.onFrame.transmitted
        .spectralRadianceSolidAngleIntegral.values;
    const residuals = independentOnFrame.map((value, index) =>
        value - expectedOnFrame[index]);
    const maximumAbsoluteResidual = Math.max(...residuals.map(Math.abs));
    const sampledSolidAngle = integration.samples.reduce((sum, sample) =>
        sum + sample.solidAngleWeightSteradians, 0);
    const independentExpected = adapter.packet.values.map((value) =>
        value * sampledSolidAngle);
    const independentSampleIntegral = Array(CANONICAL_CHANNEL_COUNT).fill(0);
    for (const sample of integration.samples) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            independentSampleIntegral[channel] +=
                sample.transmittedSpectralRadiance.values[channel]
                * sample.solidAngleWeightSteradians;
        }
    }
    const pixelToExpectedResidual = independentOnFrame.map((value, index) =>
        value - independentExpected[index]);
    const sampleToExpectedResidual = independentSampleIntegral.map((value, index) =>
        value - independentExpected[index]);
    const pixelToExpectedMaximumAbsoluteResidual = Math.max(
        ...pixelToExpectedResidual.map(Math.abs),
    );
    const sampleToExpectedMaximumAbsoluteResidual = Math.max(
        ...sampleToExpectedResidual.map(Math.abs),
    );
    const callbackRayIdentityAccepted = visibilityRays.length === transmittanceRays.length
        && visibilityRays.every((ray, index) => ray === transmittanceRays[index]);
    const record = freezeJsonValue({
        sampleCount: integration.samples.length,
        visibilityCallCount: integration.transportCalls.visibilityCallCount,
        transmittanceCallCount: integration.transportCalls.transmittanceCallCount,
        sameExactSampleRayObject:
            integration.transportCalls.sameDirectionAndDepthObjectForVisibleCallbacks,
        pixelCount: integration.pixels.length,
        basisFingerprint: integration.fingerprints.basis,
        independentOnFrame,
        expectedOnFrame,
        residuals,
        maximumAbsoluteResidual,
        sampledSolidAngle,
        independentExpected,
        independentSampleIntegral,
        pixelToExpectedResidual,
        sampleToExpectedResidual,
        pixelToExpectedMaximumAbsoluteResidual,
        sampleToExpectedMaximumAbsoluteResidual,
        callbackRayIdentityAccepted,
        componentConservation: integration.componentConservation,
        accepted: integration.samples.length === 16
            && integration.transportCalls.visibilityCallCount === 16
            && integration.transportCalls.transmittanceCallCount === 16
            && integration.transportCalls.sameDirectionAndDepthObjectForVisibleCallbacks
            && integration.pixels.length === 1
            && integration.fingerprints.basis === adapter.packet.basis.fingerprint
            && maximumAbsoluteResidual <= TOLERANCES.compositionAbsolute
            && pixelToExpectedMaximumAbsoluteResidual
                <= TOLERANCES.compositionAbsolute
            && sampleToExpectedMaximumAbsoluteResidual
                <= TOLERANCES.compositionAbsolute
            && callbackRayIdentityAccepted,
    });
    return Object.freeze({ integration, record });
}

function evaluateFrameAdapter(basis, modules) {
    const camera = new modules.PerspectiveCameraRaster({
        widthPixels: 1,
        heightPixels: 1,
        verticalFovDegrees: 60,
    });
    const calls = [];
    const algorithm32 = {
        config: {
            model: {
                spectral: {
                    basis: { fingerprint: basis.fingerprint },
                },
            },
        },
        evaluate(request) {
            calls.push(freezeJsonValue(request));
            return Object.freeze({
                pathRadiance: Object.freeze(Array(CANONICAL_CHANNEL_COUNT).fill(0.25)),
                transmittance: Object.freeze(Array(CANONICAL_CHANNEL_COUNT).fill(0.75)),
                viewRaySegment: Object.freeze({
                    ray: Object.freeze({
                        origin: Object.freeze([0, 0, 0]),
                        direction: Object.freeze([...request.viewRayRequest.direction]),
                    }),
                    startDistanceMeters: 0,
                    endDistanceMeters: request.viewRayRequest.endDistanceMeters ?? 100,
                }),
                pathIntegrationPoints: Object.freeze([]),
            });
        },
    };
    const evaluator = new modules.Algorithm32SpectralFrameEvaluator({
        camera,
        algorithm32,
        basisFingerprint: basis.fingerprint,
        cameraToAtmosphereMatrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
        algorithm32Descriptor: { kind: 'er9-flat-production-output-proof-v1' },
    });
    const output = evaluator.evaluateCameraDirection(
        [0, 0, -1],
        { kind: 'finite', distanceMeters: 20 },
    );
    let mismatchedBasisRejected = false;
    try {
        new modules.Algorithm32SpectralFrameEvaluator({
            camera,
            algorithm32,
            basisFingerprint: 'f'.repeat(64),
            cameraToAtmosphereMatrix: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ],
            algorithm32Descriptor: { kind: 'er9-mismatched-basis-proof-v1' },
        });
    } catch {
        mismatchedBasisRejected = true;
    }
    return freezeJsonValue({
        calls,
        output,
        nestedLegacyPathRadianceUsed: false,
        mismatchedBasisRejected,
        accepted: calls.length === 1
            && calls[0].viewRayRequest.endDistanceMeters === 20
            && maxAbsoluteDifference(
                output.pathSpectralRadianceDensity.values,
                Array(CANONICAL_CHANNEL_COUNT).fill(0.25),
            ) <= TOLERANCES.evaluatorAbsolute
            && maxAbsoluteDifference(
                output.viewSpectralTransmittance.values,
                Array(CANONICAL_CHANNEL_COUNT).fill(0.75),
            ) <= TOLERANCES.evaluatorAbsolute
            && output.pathLengthMeters === 20
            && mismatchedBasisRejected,
    });
}

function evaluateComposition({
    basis,
    camera,
    pointAccumulation,
    extendedIntegration,
    modules,
}) {
    if (pointAccumulation.fingerprints.camera !== camera.fingerprint) {
        throw new Error('Point proof camera identity does not match composer proof camera.');
    }
    const displayInputs = [];
    const displayModel = {
        describeDisplayConversion: () => ({
            kind: 'er9-one-display-call-proof-v1',
            output: 'bounded-test-rgb',
            spectralBasisFingerprint: basis.fingerprint,
        }),
        radianceToDisplayRgb(values) {
            displayInputs.push(Object.freeze([...values]));
            return Object.freeze([0.25, 0.5, 0.75]);
        },
    };
    const composer = new modules.PhysicalSpectralFrameComposer({
        camera,
        displayModel,
    });
    const path = Array(CANONICAL_CHANNEL_COUNT).fill(1);
    const transmittance = Array(CANONICAL_CHANNEL_COUNT).fill(0.5);
    const endpoint = Array(CANONICAL_CHANNEL_COUNT).fill(2);
    const extended = extendedIntegration.pixels[0]
        .transportedExtendedSpectralRadianceDensity;
    const composition = composer.compose({
        basisFingerprint: basis.fingerprint,
        basePixels: [{
            pixelX: 0,
            pixelY: 0,
            pathSpectralRadianceDensity: radiancePacket(path, basis.fingerprint),
            viewSpectralTransmittance: transmittancePacket(
                transmittance, basis.fingerprint,
            ),
            endpointSpectralRadianceDensity: radiancePacket(
                endpoint, basis.fingerprint,
            ),
        }],
        extendedIntegrations: [extendedIntegration],
        pointAccumulations: [pointAccumulation],
    });
    let mismatchedDisplayBasisRejected = false;
    try {
        composer.compose({
            basisFingerprint: 'f'.repeat(64),
            basePixels: [],
            extendedIntegrations: [],
            pointAccumulations: [],
        });
    } catch {
        mismatchedDisplayBasisRejected = true;
    }
    const pixel = composition.pixels[0];
    const expectedFinal = path.map((value, index) =>
        value
        + endpoint[index] * transmittance[index]
        + extended[index]
        + pointAccumulation.pixels[0].pointSpectralRadianceDensity[index]);
    return freezeJsonValue({
        displayInputs,
        displayPass: composition.displayPass,
        components: pixel.components,
        finalSpectralRadianceDensity: pixel.finalSpectralRadianceDensity,
        expectedFinal,
        maximumExpectedResidual: maxAbsoluteDifference(
            pixel.finalSpectralRadianceDensity,
            expectedFinal,
        ),
        maximumCompositionResidual: composition.maximumAbsoluteCompositionResidual,
        mismatchedDisplayBasisRejected,
        accepted: composition.displayPass.actualCallCount === 1
            && displayInputs.length === 1
            && stableHash(displayInputs[0])
                === stableHash(pixel.finalSpectralRadianceDensity)
            && maxAbsoluteDifference(
                pixel.components.pathSpectralRadianceDensity,
                path,
            ) <= TOLERANCES.compositionAbsolute
            && maxAbsoluteDifference(
                pixel.components.transportedEndpointSpectralRadianceDensity,
                Array(CANONICAL_CHANNEL_COUNT).fill(1),
            ) <= TOLERANCES.compositionAbsolute
            && maxAbsoluteDifference(
                pixel.components.extendedSpectralRadianceDensity,
                extended,
            ) <= TOLERANCES.compositionAbsolute
            && maxAbsoluteDifference(
                pixel.components.pointSpectralRadianceDensity,
                pointAccumulation.pixels[0].pointSpectralRadianceDensity,
            ) <= TOLERANCES.compositionAbsolute
            && maxAbsoluteDifference(
                pixel.finalSpectralRadianceDensity,
                expectedFinal,
            ) <= TOLERANCES.compositionAbsolute
            && composition.maximumAbsoluteCompositionResidual
                <= TOLERANCES.compositionAbsolute
            && mismatchedDisplayBasisRejected,
    });
}

async function runVerificationCommands(recordDirectory) {
    const productionSuite = await runProductionSuiteInProcess();
    await writeJson(
        recordDirectory,
        'production-suite-results.json',
        productionSuite,
    );
    await writeText(
        recordDirectory,
        'production-suite-report.txt',
        formatProductionSuiteReport(productionSuite),
    );

    const appSyntax = await parseAppConsumerModulesInProcess();
    await writeJson(recordDirectory, 'app-syntax-results.json', appSyntax);

    const productionTestsAccepted = productionSuite.accepted;
    const appSyntaxAccepted = appSyntax.accepted;
    return freezeJsonValue({
        kind: 'er9-in-process-verification-v1',
        correctionFromRecord066:
            'Jasmine and parser APIs replace only the sandbox-denied child-process orchestration.',
        childProcesses: false,
        productionSuite,
        appSyntax,
        productionTestsAccepted,
        appSyntaxAccepted,
    });
}

async function runProductionSuiteInProcess() {
    const suiteStarted = performance.now();
    const specResults = [];
    let jasmineStarted = null;
    let jasmineDone = null;
    const runner = new Jasmine({ projectBaseDir: process.cwd() });
    await runner.loadConfigFile(JASMINE_CONFIG_PATH);
    runner.exitOnCompletion = false;
    runner.clearReporters();
    runner.addReporter({
        jasmineStarted(details) {
            jasmineStarted = serializeJasmineRunDetails(details);
        },
        specDone(result) {
            specResults.push(serializeJasmineSpecResult(result));
        },
        jasmineDone(details) {
            jasmineDone = serializeJasmineRunDetails(details);
        },
    });
    const overallResult = await runner.execute();
    const serializedOverallResult = serializeJasmineRunDetails(overallResult);
    const overallStatus = serializedOverallResult.overallStatus
        ?? jasmineDone?.overallStatus
        ?? null;
    const failedSpecCount = specResults.filter((entry) =>
        entry.status === 'failed' || entry.failedExpectations.length > 0).length;
    const pendingSpecCount = specResults.filter((entry) =>
        entry.status === 'pending' || entry.status === 'excluded').length;
    const passedSpecCount = specResults.filter((entry) =>
        entry.status === 'passed').length;
    const specCount = specResults.length;
    const accepted = overallStatus === 'passed'
        && specCount > 0
        && failedSpecCount === TOLERANCES.productionFailedSpecCount;
    return freezeJsonValue({
        kind: 'er9-production-jasmine-suite-v1',
        execution: 'in-process installed Jasmine API',
        configPath: JASMINE_CONFIG_PATH,
        childProcess: false,
        jasmineStarted,
        jasmineDone,
        overallResult: serializedOverallResult,
        overallStatus,
        specCount,
        passedSpecCount,
        failedSpecCount,
        pendingSpecCount,
        specs: specResults,
        elapsedMilliseconds: performance.now() - suiteStarted,
        accepted,
    });
}

async function parseAppConsumerModulesInProcess() {
    const parserPackage = parseJson(
        await readFile(resolve(BABEL_PARSER_PACKAGE_PATH)),
        BABEL_PARSER_PACKAGE_PATH,
    );
    const files = [];
    for (const path of APP_CONSUMER_FILES) {
        const source = await readFile(resolve(path), 'utf8');
        const entry = {
            path,
            sha256: hashBytes(Buffer.from(source, 'utf8')),
            byteLength: Buffer.byteLength(source, 'utf8'),
            parserOptions: {
                sourceType: 'module',
                plugins: ['jsx'],
                errorRecovery: false,
                allowAwaitOutsideFunction: false,
            },
        };
        try {
            const parsed = parseJavaScript(source, {
                ...entry.parserOptions,
                sourceFilename: path,
            });
            files.push({
                ...entry,
                parsed: true,
                sourceType: parsed.program.sourceType,
                programBodyCount: parsed.program.body.length,
                errorCount: Array.isArray(parsed.errors) ? parsed.errors.length : 0,
                errors: Array.isArray(parsed.errors)
                    ? parsed.errors.map(serializeParserError)
                    : [],
            });
        } catch (error) {
            files.push({
                ...entry,
                parsed: false,
                sourceType: null,
                programBodyCount: 0,
                errorCount: 1,
                errors: [serializeParserError(error)],
            });
        }
    }
    const errorCount = files.reduce((sum, entry) => sum + entry.errorCount, 0);
    const accepted = files.length === APP_CONSUMER_FILES.length
        && files.every((entry) =>
            entry.parsed
            && entry.sourceType === 'module'
            && entry.programBodyCount > 0)
        && errorCount === TOLERANCES.appSyntaxErrorCount;
    return freezeJsonValue({
        kind: 'er9-app-consumer-syntax-v1',
        execution: 'in-process installed @babel/parser API',
        childProcess: false,
        parserVersion: parserPackage.version,
        parserPackagePath: BABEL_PARSER_PACKAGE_PATH,
        parserImplementationPath: BABEL_PARSER_IMPLEMENTATION_PATH,
        fileCount: files.length,
        expectedFileCount: APP_CONSUMER_FILES.length,
        errorCount,
        files,
        accepted,
    });
}

function serializeJasmineSpecResult(result) {
    return {
        id: result.id ?? null,
        description: result.description ?? null,
        fullName: result.fullName ?? null,
        status: result.status ?? null,
        pendingReason: result.pendingReason ?? null,
        duration: result.duration ?? null,
        failedExpectations: (result.failedExpectations ?? [])
            .map(serializeJasmineExpectation),
        deprecationWarnings: (result.deprecationWarnings ?? [])
            .map(serializeJasmineExpectation),
    };
}

function serializeJasmineRunDetails(details) {
    if (!details || typeof details !== 'object') {
        return {};
    }
    return {
        overallStatus: details.overallStatus ?? null,
        totalSpecsDefined: details.totalSpecsDefined ?? null,
        incompleteReason: details.incompleteReason ?? null,
        order: details.order ? {
            random: details.order.random ?? null,
            seed: details.order.seed ?? null,
        } : null,
        failedExpectations: (details.failedExpectations ?? [])
            .map(serializeJasmineExpectation),
        deprecationWarnings: (details.deprecationWarnings ?? [])
            .map(serializeJasmineExpectation),
    };
}

function serializeJasmineExpectation(expectation) {
    return {
        matcherName: expectation.matcherName ?? null,
        message: expectation.message ?? null,
        stack: expectation.stack ?? null,
        globalErrorType: expectation.globalErrorType ?? null,
    };
}

function serializeParserError(error) {
    return {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        code: error?.code ?? null,
        reasonCode: error?.reasonCode ?? null,
        position: Number.isInteger(error?.pos) ? error.pos : null,
        line: Number.isInteger(error?.loc?.line) ? error.loc.line : null,
        column: Number.isInteger(error?.loc?.column) ? error.loc.column : null,
    };
}

function buildCriteria({
    sealedEr8,
    governingDecision,
    graphAudit,
    conformance,
    testLog,
    claimBoundaryAudit,
}) {
    const evidence = {
        'sealed-hashes': sealedEr8.record,
        'sealed-acceptance': sealedEr8.record,
        'selection-exact': { selection: SELECTION, governingDecision },
        'gpu-na': { xaG12: SELECTION.xaG12, governingDecision },
        'allowlist-exact': graphAudit.manifest,
        'graph-isolated': {
            forbiddenFindings: graphAudit.graph.forbiddenFindings,
            integrationForbiddenFindings:
                graphAudit.integrationGraph.forbiddenFindings,
            legacyAliasAudit: conformance.legacyAliasAudit,
        },
        'stable-sha256-known-vector': conformance.stableSha256,
        'basis-rich': conformance.basis,
        'solar-packet-rich': conformance.solarPacket,
        'source-coupling': conformance.sourceCoupling,
        'sun-cpu-owner': conformance.distantSun,
        'sun-descriptor-owner': conformance.distantSun,
        'sun-shader-owner': conformance.distantSun,
        'point-conservation': conformance.point.onFrame,
        'point-off-raster': conformance.point.rearHemisphere,
        'visibility-depth': conformance.visibility,
        'sun-disk': conformance.sunDisk,
        'extended-transport': conformance.extendedTransport,
        'frame-adapter': conformance.frameAdapter,
        'frame-composition': conformance.composition,
        'production-tests': {
            suite: testLog.productionSuite,
            accepted: testLog.productionTestsAccepted,
        },
        'app-syntax': testLog.appSyntax,
        'claim-boundary': claimBoundaryAudit,
    };
    const accepted = {
        'sealed-hashes': sealedEr8.record.hashesAccepted,
        'sealed-acceptance': sealedEr8.record.acceptanceAccepted,
        'selection-exact': governingDecision.accepted
            && stableHash(SELECTION.selected.map((entry) => entry.id))
            === stableHash(EXPECTED_SELECTED_SCOPE_IDS)
            && stableHash(SELECTION.notSelected.map((entry) => entry.id))
                === stableHash(EXPECTED_NOT_SELECTED_SCOPE_IDS)
            && Array.isArray(SELECTION.selectedGpuSlices)
            && SELECTION.selectedGpuSlices.length === 0
            && SELECTION.xaG12.status === 'not-applicable-not-selected'
            && SELECTION.xaG12.reason === EXPECTED_XA_G12_REASON
            && SELECTION.gpuAtmosphereEvaluation
                === EXPECTED_GPU_ATMOSPHERE_DISPOSITION
            && SELECTION.observerClaimed === false
            && SELECTION.diffuseClaimed === false
            && SELECTION.networkAcquisition === false
            && SELECTION.imageArtifacts === false,
        'gpu-na': governingDecision.accepted
            && SELECTION.xaG12.status === 'not-applicable-not-selected'
            && SELECTION.xaG12.reason === EXPECTED_XA_G12_REASON
            && SELECTION.selectedGpuSlices.length === 0
            && SELECTION.gpuAtmosphereEvaluation
                === EXPECTED_GPU_ATMOSPHERE_DISPOSITION
            && SELECTION.notSelected[0]?.id
                === 'assembled-visible-celestial-gpu-browser'
            && SELECTION.notSelected[0]?.disposition
                === 'deferred; no visible celestial GPU/browser slice is promoted by this record',
        'allowlist-exact': graphAudit.allowlistAccepted,
        'graph-isolated': graphAudit.isolationAccepted
            && graphAudit.integrationGraph.isolationAccepted
            && conformance.legacyAliasAudit.accepted,
        'stable-sha256-known-vector': conformance.stableSha256.accepted,
        'basis-rich': conformance.basis.accepted,
        'solar-packet-rich': conformance.solarPacket.accepted,
        'source-coupling': conformance.sourceCoupling.accepted,
        'sun-cpu-owner': conformance.distantSun.cpuAccepted,
        'sun-descriptor-owner': conformance.distantSun.descriptorAccepted,
        'sun-shader-owner': conformance.distantSun.shaderAccepted,
        'point-conservation': conformance.point.onFrame.accepted,
        'point-off-raster': conformance.point.rearHemisphere.accepted,
        'visibility-depth': conformance.visibility.accepted,
        'sun-disk': conformance.sunDisk.accepted,
        'extended-transport': conformance.extendedTransport.accepted,
        'frame-adapter': conformance.frameAdapter.accepted,
        'frame-composition': conformance.composition.accepted,
        'production-tests': testLog.productionTestsAccepted,
        'app-syntax': testLog.appSyntaxAccepted,
        'claim-boundary': claimBoundaryAudit.accepted
            && claimBoundaryAudit.networkFindings.length === 0
            && claimBoundaryAudit.imageArtifactFindings.length === 0,
    };
    return freezeJsonValue(CRITERIA_DEFINITIONS.map((definitionEntry) => ({
        ...definitionEntry,
        status: accepted[definitionEntry.id] ? 'accepted' : 'rejected',
        evidence: evidence[definitionEntry.id],
    })));
}

function deriveStatuses(criteria) {
    const accepted = (...scopes) => criteria
        .filter((entry) => scopes.includes(entry.scope))
        .every((entry) => entry.status === 'accepted');
    return freezeJsonValue({
        dependencyStatus: accepted('dependency') ? 'accepted' : 'rejected',
        selectionStatus: accepted('selection') ? 'accepted' : 'rejected',
        productionGraphStatus:
            accepted('production-graph') ? 'accepted' : 'rejected',
        typedSourceStatus: accepted('typed-source') ? 'accepted' : 'rejected',
        canonicalSunStatus:
            accepted('canonical-sun') ? 'accepted' : 'rejected',
        cpuSeamStatus: accepted(
            'cpu-point', 'cpu-visibility', 'cpu-extended', 'cpu-frame',
        ) ? 'accepted' : 'rejected',
        verificationStatus: accepted('verification') ? 'accepted' : 'rejected',
        gpuParityStatus: 'not-applicable-not-selected',
        overallStatus: criteria.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected',
    });
}

async function buildProvenance() {
    const paths = [
        RUNNER_PATH,
        'scripts/flat/reconciliation/POC/src/runners/recordWriter.js',
        'scripts/flat/reconciliation/POC/src/provenance/LocalModuleGraphHasher.js',
        'scripts/flat/reconciliation/POC/src/provenance/stableHash.js',
        'package.json',
        'package-lock.json',
        JASMINE_CONFIG_PATH,
        JASMINE_PACKAGE_PATH,
        JASMINE_IMPLEMENTATION_PATH,
        BABEL_PARSER_PACKAGE_PATH,
        BABEL_PARSER_IMPLEMENTATION_PATH,
    ];
    const files = {};
    for (const path of paths) {
        const bytes = await readFile(resolve(path));
        files[path] = {
            sha256: hashBytes(bytes),
            byteLength: bytes.byteLength,
        };
    }
    return freezeJsonValue({
        kind: 'er9-production-promotion-proof-provenance-v1',
        files,
        productionManifest: 'production-manifest.json',
        integrationManifest: 'integration-manifest.json',
        verificationInputManifest: 'verification-input-manifest.json',
        governingDecision: 'governing-decision.json',
        sealedDependency: 'sealed-er8-dependency.json',
        networkAcquisition: false,
    });
}

async function writeFailureArtifacts(recordDirectory, error, phases, start) {
    const failure = freezeJsonValue({
        status: 'invalid',
        runner: RUNNER,
        recordId: EXPECTED_RECORD_ID,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? null : null,
        completedPhases: phases,
        elapsedMilliseconds: performance.now() - start,
        networkAcquisition: false,
        imageArtifacts: false,
        rerunPermitted: false,
    });
    try {
        await writeJson(recordDirectory, 'failure.json', failure);
        await writeJson(recordDirectory, 'result.json', {
            status: 'invalid',
            acceptedCriterionCount: 0,
            criterionCount: CRITERIA_DEFINITIONS.length,
            gpuParityStatus: 'not-applicable-not-selected',
            failure: failure.message,
        });
        await appendRunLog(
            recordDirectory,
            `${RUNNER} invalid after phases ${phases.join(', ') || 'none'}: ${failure.message}`,
        );
    } catch {
        // Preserve the original failure when failure-artifact writing also fails.
    }
}

function parseMode(argv) {
    const recordDirectory = parseRecordDirectory(argv);
    if (argv.length !== 4 || argv[2] !== '--record') {
        throw new Error(
            `Runner requires exactly --record ${EXPECTED_RECORD_DIRECTORY}.`,
        );
    }
    if (recordDirectory.replaceAll('\\', '/') !== EXPECTED_RECORD_DIRECTORY) {
        throw new Error(
            `This predeclared runner may write only ${EXPECTED_RECORD_DIRECTORY}.`,
        );
    }
    return Object.freeze({
        recordDirectory,
        argv: Object.freeze([...argv]),
    });
}

function forbiddenProductionRules() {
    return [
        { id: 'no-scripts-flat-reconciliation', pattern: /scripts[\\/]flat[\\/]reconciliation/iu },
        { id: 'no-tmp-runtime-path', pattern: /tmp[\\/]atmosphere|tmp[\\/]reconciliation/iu },
        { id: 'no-archive-runtime-path', pattern: /archive[\\/]/iu },
        { id: 'no-node-crypto', pattern: /(?:node:crypto|from\s+['"]crypto['"]|import\s*\(\s*['"]crypto['"]\s*\))/iu },
    ];
}

function extractModuleSpecifiers(source) {
    const specifiers = [];
    const patterns = [
        /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    ];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            specifiers.push(match[1]);
        }
    }
    return Object.freeze([...new Set(specifiers)]);
}

function createPointSource(id, packet, modules) {
    return new modules.ExternalCelestialSource({
        id,
        kind: modules.POINT_CELESTIAL_SOURCE,
        geometry: { kind: 'infinite-direction', owner: 'er9-proof' },
        spectralMeasure: packet,
    });
}

function parseShaderFloatArray(source) {
    const match = /float\[\d+\]\(([^)]*)\)/u.exec(source ?? '');
    if (!match) {
        return Object.freeze([]);
    }
    return Object.freeze(match[1].split(',').map((entry) => Number(entry.trim())));
}

function relativeResidual(actual, expected) {
    if (expected === 0) {
        return actual === 0 ? 0 : Number.POSITIVE_INFINITY;
    }
    return Math.abs(actual - expected) / Math.abs(expected);
}

function maxAbsoluteDifference(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

function radiancePacket(values, basisFingerprint) {
    return {
        quantity: 'spectral-radiance-density',
        units: 'W m^-2 sr^-1 nm^-1',
        basisFingerprint,
        values,
    };
}

function transmittancePacket(values, basisFingerprint) {
    return {
        quantity: 'spectral-transmittance',
        units: '1',
        basisFingerprint,
        values,
    };
}

function mapping(contract, acceptedSource, productionOwner) {
    return Object.freeze({
        contract,
        acceptedSource,
        productionOwner,
        runtimeDependencyOnPoc: false,
        compatibilityAlias: false,
    });
}

function definition(id, scope, name) {
    return Object.freeze({ id, scope, name });
}

function hashBytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function parseJson(bytes, filename) {
    try {
        return JSON.parse(bytes.toString('utf8'));
    } catch (error) {
        throw new Error(`Cannot parse sealed ${filename}: ${error.message}`);
    }
}

function formatTestLog(testLog) {
    const suite = testLog.productionSuite;
    const syntax = testLog.appSyntax;
    return [
        'ER9 IN-PROCESS VERIFICATION',
        'CHILD PROCESSES false',
        `JASMINE STATUS ${suite.overallStatus}`,
        `JASMINE SPECS ${suite.specCount}`,
        `JASMINE PASSED ${suite.passedSpecCount}`,
        `JASMINE FAILED ${suite.failedSpecCount}`,
        `JASMINE PENDING ${suite.pendingSpecCount}`,
        `APP FILES ${syntax.fileCount}/${syntax.expectedFileCount}`,
        `APP SYNTAX ERRORS ${syntax.errorCount}`,
        `OVERALL ${testLog.productionTestsAccepted && testLog.appSyntaxAccepted ? 'accepted' : 'rejected'}`,
        '',
    ].join('\n');
}

function formatProductionSuiteReport(suite) {
    const rejected = suite.specs.filter((entry) =>
        entry.status !== 'passed' || entry.failedExpectations.length > 0);
    return [
        'ER9 PRODUCTION JASMINE SUITE',
        `CONFIG ${suite.configPath}`,
        `EXECUTION ${suite.execution}`,
        `CHILD PROCESS ${suite.childProcess}`,
        `OVERALL ${suite.overallStatus}`,
        `SPECS ${suite.specCount}`,
        `PASSED ${suite.passedSpecCount}`,
        `FAILED ${suite.failedSpecCount}`,
        `PENDING ${suite.pendingSpecCount}`,
        `ACCEPTED ${suite.accepted}`,
        ...rejected.flatMap((entry) => [
            `SPEC ${entry.status} ${entry.fullName}`,
            ...entry.failedExpectations.map((failure) => `  ${failure.message}`),
        ]),
        '',
    ].join('\n');
}

function stateGoalText() {
    return `# State And Goal

Record: ${EXPECTED_RECORD_ID}
Phase: ER9 GPU and production promotion decision

Goal: prove the smallest selected production scope after accepted ER8. The
selected scope is the typed source contract, CPU celestial source-to-frame
seam, and one canonical Sun owner shared by CPU facts, descriptors, shader
constants, and the visible-disk derivation.

Assembled visible-celestial GPU/browser work is not selected, so XA-G12 is
explicitly not applicable. Observer/background visibility, diffuse fields,
and live CALSPEC, LIME, or Horizons acquisition are also not selected. This
record performs no network request and writes no image.

Record 066 is an immutable invalid infrastructure attempt: its first child-
process spawn was denied before any production test started. This record
freshly regenerates every proof surface and executes the exact production
Jasmine configuration plus both app syntax checks through installed in-process
APIs. Structured suite and parser evidence is retained here.

The runner may execute exactly once into this fresh directory. A failed or
interrupted attempt remains immutable and must never be rerun.
`;
}

function reportText(result, criteria) {
    const rejected = criteria.filter((entry) => entry.status !== 'accepted');
    return `# ER9 Production Promotion Proof

- Overall: ${result.status}
- Accepted criteria: ${result.acceptedCriterionCount}/${result.criterionCount}
- Typed sources: ${result.typedSourceStatus}
- CPU seam: ${result.cpuSeamStatus}
- Canonical Sun: ${result.canonicalSunStatus}
- Production graph: ${result.productionGraphStatus}
- Verification: ${result.verificationStatus}
- GPU parity/XA-G12: ${result.gpuParityStatus}
- Network acquisition: no
- Image artifacts: no

${rejected.length === 0
        ? 'All predeclared selected-scope criteria accepted.'
        : `Rejected criteria:\n${rejected.map((entry) => `- ${entry.id}: ${entry.name}`).join('\n')}`}
`;
}
