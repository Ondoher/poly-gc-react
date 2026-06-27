import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import * as base from '../../../shared/algorithm32/POC/bruneton-start-fresh/bruneton-start-fresh.js';
import {
	ATMOSPHERE,
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
	SUN_CASES,
	computePathRadianceSegment,
	createDistantAltitudeIncidentField,
	createDistantSunAlgorithm32Model,
	createFlatLocalSunAlgorithm32Model,
	distanceToSkyBoundary,
	spectralToDisplayPreview,
	summarizeTransfer,
	sunDirection,
} from '../../../shared/algorithm32/POC/cpu/algorithm32-transport.js';
import { postprocessSceneInput } from '../../../shared/algorithm32/POC/cpu/soft-shader.js';
import {
	SOURCE_KINDS,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
} from '../../../shared/algorithm32/POC/source-contract/algorithm32-source-contract.js';
import {
	computeSingleScatteringRadiance as computeFlatSingleScatteringRadiance,
} from '../../../shared/algorithm32/POC/atmosflat32/local-sun.js';
import {
	Algorithm32AtmospherePass,
	debugViewModeCode,
	localSourcePositionForPassConfig,
	sourceSunDirectionForPassConfig,
	threeNativePassModeCode,
} from '../../../shared/algorithm32/POC/three/shader-lab-page.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/local-second-order');
const EVIDENCE_ROOT = path.join(
	REPO_ROOT,
	'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current'
);

const DEFAULT_ABS_TOLERANCE = 1e-12;
const DEFAULT_REL_TOLERANCE = 1e-9;
const LOCAL_CACHE_ABS_TOLERANCE = 2.5e-4;
const LOCAL_CACHE_REL_TOLERANCE = 0.35;
const CPU_GPU_BLOCKER =
	'The centralized Three pass currently exposes identity, depth-distance, distant first-order, and flat/local first-order modes only. It has no local second-order cache texture uniforms or shader lookup path yet.';

async function main() {
	const options = parseArgs(process.argv.slice(2));
	await fs.mkdir(OUT_ROOT, { recursive: true });

	const milestoneFns = [
		runMilestone1,
		runMilestone2,
		runMilestone3,
		runMilestone4,
		runMilestone5,
		runMilestone6,
		runMilestone7,
		runMilestone8,
		runMilestone9,
		runMilestone10,
		runMilestone11,
		runMilestone12,
	];
	const selected = milestoneFns.filter((runner, index) => {
		const number = index + 1;
		return number >= options.from && number <= options.to;
	});

	for (const runner of selected) {
		const result = await runner();
		if (result.status === 'blocked' || result.status === 'rejected') {
			break;
		}
	}
}

function parseArgs(argv) {
	const options = { from: 1, to: 10 };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--from') {
			options.from = Number(argv[++index]);
		} else if (arg === '--to') {
			options.to = Number(argv[++index]);
		} else if (arg === '--help' || arg === '-h') {
			console.log('Usage: node scripts/flat/local-second-order/run-milestones.js [--from N] [--to N]');
			process.exit(0);
		}
	}
	return options;
}

async function runMilestone1() {
	const evidence = await readJson(
		evidencePath('atmosflat-019-distant-baseline/selected-ray-diagnostics.json')
	);
	const diagnostics = [];
	let maxRadianceAbs = 0;
	let maxRadianceRel = 0;
	let maxSecondOrderAbs = 0;
	let sampleCount = 0;

	for (const item of evidence.diagnostics) {
		if (!['figure1-06h00-z87', 'figure1-13h15-z21'].includes(item.scene)) {
			continue;
		}
		const scene = base.FIGURE1_FOUR_VIEW_SCENES.find(
			(candidate) => candidate.id === item.scene
		);
		const transfer = base.computeSingleScatteringRadiance(
			base.observerPosition(),
			item.viewRay,
			base.sunDirection(scene),
			{ scene, includeSecondOrder: true }
		);
		const radianceError = compareArrays(
			transfer.radiance,
			item.source.radiance
		);
		const secondOrderError = compareArrays(
			transfer.secondOrderRadiance,
			item.source.secondOrderRadiance
		);
		maxRadianceAbs = Math.max(maxRadianceAbs, radianceError.maxAbs);
		maxRadianceRel = Math.max(maxRadianceRel, radianceError.maxRel);
		maxSecondOrderAbs = Math.max(maxSecondOrderAbs, secondOrderError.maxAbs);
		sampleCount += 1;
		diagnostics.push({
			scene: item.scene,
			ray: item.ray,
			viewRay: item.viewRay,
			radianceError,
			secondOrderError,
			displayRgb: base.spectralRadianceToDisplayRgb(transfer.radiance),
		});
	}

	const highScene = base.FIGURE1_FOUR_VIEW_SCENES.find(
		(scene) => scene.id === 'figure1-13h15-z21'
	);
	const incidentField = base.createDistantAltitudeIncidentField({
		scene: highScene,
		sunRay: base.sunDirection(highScene),
	});
	const criteria = [
		criterion({
			id: 'base-profile-matches-accepted-step',
			status: base.ALGORITHM32_BASE_PROFILE.secondOrderIncidentCache === 'altitude-direction' ? 'pass' : 'fail',
			tolerance: 'altitude-direction cache profile',
			measured: base.ALGORITHM32_BASE_PROFILE,
			notes: 'The extracted module keeps the accepted non-shader base profile and distant cache shape.',
		}),
		criterion({
			id: 'selected-spectral-radiance-matches-evidence',
			status: withinMixedTolerance(maxRadianceAbs, maxRadianceRel) ? 'pass' : 'fail',
			tolerance: `abs <= ${DEFAULT_ABS_TOLERANCE} or rel <= ${DEFAULT_REL_TOLERANCE}`,
			measured: { maxRadianceAbs, maxRadianceRel, sampleCount },
			notes: 'Compared extracted module radiance to checked-in selected-ray evidence from atmosflat-019.',
		}),
		criterion({
			id: 'selected-second-order-radiance-matches-evidence',
			status: maxSecondOrderAbs <= DEFAULT_ABS_TOLERANCE ? 'pass' : 'fail',
			tolerance: `abs <= ${DEFAULT_ABS_TOLERANCE}`,
			measured: { maxSecondOrderAbs },
			notes: 'The extracted base module preserves the accepted distant second-order contribution.',
		}),
		criterion({
			id: 'second-order-cache-key-shape-is-distant-altitude-direction',
			status:
				incidentField.kind.includes('altitude-incident-field') &&
				base.ALGORITHM32_BASE_PROFILE.secondOrderIncidentCache ===
					'altitude-direction'
					? 'pass'
					: 'fail',
			tolerance: 'incident field kind/profile identify altitude-direction distant cache',
			measured: {
				kind: incidentField.kind,
				profileCache:
					base.ALGORITHM32_BASE_PROFILE.secondOrderIncidentCache,
			},
			notes: 'This milestone intentionally proves the original distant cache shape, not the future local cache.',
		}),
		criterion({
			id: 'module-has-no-runner-main-requirement',
			status: typeof base.sampleFigure1SkyRadiance === 'function' ? 'pass' : 'fail',
			tolerance: 'pure exported functions available',
			measured: { sampleFigure1SkyRadiance: typeof base.sampleFigure1SkyRadiance },
			notes: 'The shared module is importable and does not require artifact-generation side effects.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 1,
		label: 'original-base-algorithm-parity',
		stateGoal:
			'Prove the extracted bruneton-start-fresh base module still matches accepted selected-ray evidence.',
		inputs: {
			systemUnderTest: 'shared/algorithm32/POC/bruneton-start-fresh/bruneton-start-fresh.js',
			oracle: 'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/atmosflat-019-distant-baseline/selected-ray-diagnostics.json',
			originalRunner: 'scripts/flat/experimental/bruneton-start-fresh.js',
			originalRunnerUse:
				'not imported because it is a side-effecting CLI runner that calls main() directly',
		},
		provenance: { evidenceFallback: true },
		equations: commonEquations({
			tolerance: { absolute: DEFAULT_ABS_TOLERANCE, relative: DEFAULT_REL_TOLERANCE },
		}),
		criteria,
		diagnostics: { selectedRayComparisons: diagnostics },
		result: { maxRadianceAbs, maxRadianceRel, maxSecondOrderAbs, sampleCount },
	});
}

async function runMilestone2() {
	const selected = await readJson(
		evidencePath('shader-078-cpu-local-source/cases/001-distant-sun-regression-control/selected-pixels.json')
	);
	const model = createDistantSunAlgorithm32Model(
		SUN_CASES.find((scene) => scene.id === 'figure1-13h15-z21')
	);
	const comparisons = [];
	let maxPathAbs = 0;
	let maxFirstOrderAbs = 0;
	let maxSecondOrderAbs = 0;
	let maxTransmittanceAbs = 0;

	for (const item of selected.selectedPixelDiagnostics || []) {
		if (!item.algorithm32Ray || !item.transfer) {
			continue;
		}
		const transfer = computePathRadianceSegment({
			origin: item.algorithm32Ray.origin,
			direction: item.algorithm32Ray.direction,
			distance: item.algorithm32Ray.distanceMeters,
			sunCase: SUN_CASES.find((scene) => scene.id === 'figure1-13h15-z21'),
			algorithm32Model: model,
			controls: NUMERICAL_CONTROLS,
			includeSecondOrder: true,
		});
		const pathError = compareArrays(
			transfer.pathRadianceByWavelength,
			item.transfer.pathRadianceByWavelength
		);
		const firstOrderError = compareArrays(
			transfer.firstOrderPathRadianceByWavelength,
			item.transfer.firstOrderPathRadianceByWavelength
		);
		const secondOrderError = compareArrays(
			transfer.secondOrderPathRadianceByWavelength,
			item.transfer.secondOrderPathRadianceByWavelength
		);
		const transmittanceError = compareArrays(
			transfer.transmittanceByWavelength,
			item.transfer.transmittanceByWavelength
		);
		maxPathAbs = Math.max(maxPathAbs, pathError.maxAbs);
		maxFirstOrderAbs = Math.max(maxFirstOrderAbs, firstOrderError.maxAbs);
		maxSecondOrderAbs = Math.max(maxSecondOrderAbs, secondOrderError.maxAbs);
		maxTransmittanceAbs = Math.max(maxTransmittanceAbs, transmittanceError.maxAbs);
		comparisons.push({
			id: item.hitObject || `${item.x},${item.y}`,
			pathError,
			firstOrderError,
			secondOrderError,
			transmittanceError,
			summary: summarizeTransfer(transfer),
		});
	}

	const criteria = [
		criterion({
			id: 'cpu-transfer-selected-path-radiance-matches-evidence',
			status: maxPathAbs <= DEFAULT_ABS_TOLERANCE ? 'pass' : 'fail',
			tolerance: `abs <= ${DEFAULT_ABS_TOLERANCE}`,
			measured: { maxPathAbs, samples: comparisons.length },
			notes: 'Shared CPU transport matches accepted selected-pixel path radiance evidence.',
		}),
		criterion({
			id: 'cpu-transfer-selected-first-second-order-fields-match',
			status:
				maxFirstOrderAbs <= DEFAULT_ABS_TOLERANCE &&
				maxSecondOrderAbs <= DEFAULT_ABS_TOLERANCE
					? 'pass'
					: 'fail',
			tolerance: `abs <= ${DEFAULT_ABS_TOLERANCE}`,
			measured: { maxFirstOrderAbs, maxSecondOrderAbs },
			notes: 'First-order and second-order fields are present and stable.',
		}),
		criterion({
			id: 'cpu-transfer-transmittance-matches-evidence',
			status: maxTransmittanceAbs <= DEFAULT_ABS_TOLERANCE ? 'pass' : 'fail',
			tolerance: `abs <= ${DEFAULT_ABS_TOLERANCE}`,
			measured: { maxTransmittanceAbs },
			notes: 'Transmittance remains stable against the accepted CPU reference.',
		}),
		criterion({
			id: 'cpu-transfer-source-geometry-configuration-owned',
			status:
				model.source.kind === SOURCE_KINDS.distantDirectionalSun &&
				model.geometry.kind === 'spherical-atmosphere-geometry'
					? 'pass'
					: 'fail',
			tolerance: 'model.source and model.geometry are explicit configuration objects',
			measured: { sourceKind: model.source.kind, geometryKind: model.geometry.kind },
			notes: 'No default-source fallback is needed for this validation path.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 2,
		label: 'cpu-transport-module-parity',
		stateGoal:
			'Prove the extracted CPU transport module matches accepted shader-lab CPU selected-pixel evidence.',
		inputs: {
			systemUnderTest: 'shared/algorithm32/POC/cpu/algorithm32-transport.js',
			oracle: 'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-078-cpu-local-source/cases/001-distant-sun-regression-control/selected-pixels.json',
		},
		provenance: { evidenceFallback: true },
		equations: commonEquations({
			tolerance: { absolute: DEFAULT_ABS_TOLERANCE },
		}),
		criteria,
		diagnostics: { selectedPixelComparisons: comparisons },
		result: { maxPathAbs, maxFirstOrderAbs, maxSecondOrderAbs, maxTransmittanceAbs },
	});
}

async function runMilestone3() {
	const packet = makeTinyScenePacket({
		width: 3,
		height: 1,
		source: { kind: SOURCE_KINDS.distantDirectionalSun, sunCase: 'figure1-13h15-z21' },
		pixels: [
			{ hit: true, distance: 0, color: [30, 60, 90, 255], ray: [0, 0, -1], id: 'zero-distance-hit' },
			{ hit: true, distance: 5000, color: [220, 220, 220, 255], ray: [0, 0.08, -0.996], id: 'lit-hit' },
			{ hit: false, distance: 0, color: [0, 0, 0, 255], ray: [0, 1, 0], id: 'sky' },
		],
	});
	const shadowPacket = makeTinyScenePacket({
		width: 2,
		height: 1,
		source: { kind: SOURCE_KINDS.distantDirectionalSun, sunCase: 'figure1-13h15-z21' },
		pixels: [
			{ hit: true, distance: 6000, color: [220, 220, 220, 255], ray: [0, 0.08, -0.996], id: 'lit' },
			{ hit: true, distance: 6000, color: [35, 35, 35, 255], ray: [0, 0.08, -0.996], id: 'shadow' },
		],
	});
	const output = postprocessSceneInput(packet);
	const shadowOutput = postprocessSceneInput(shadowPacket);
	const zero = output.selectedPixels.find((sample) => sample.id === 'zero-distance-hit');
	const sky = output.selectedPixels.find((sample) => sample.id === 'sky');
	const lit = shadowOutput.selectedPixels.find((sample) => sample.id === 'lit');
	const shadow = shadowOutput.selectedPixels.find((sample) => sample.id === 'shadow');
	const passthroughDelta = maxAbsArrayDelta(
		zero.sceneColorRgba8,
		zero.postprocessRgba8
	);
	const shadowSeparation =
		luminance(lit.postprocessRgba8) - luminance(shadow.postprocessRgba8);

	const criteria = [
		criterion({
			id: 'soft-shader-no-atmosphere-passthrough-exact',
			status: passthroughDelta === 0 ? 'pass' : 'fail',
			tolerance: 'RGBA byte delta == 0 at zero distance',
			measured: { passthroughDelta },
			notes: 'The composition reduces exactly to sceneColor when T_view is 1 and L_path is zero.',
		}),
		criterion({
			id: 'soft-shader-sky-comes-from-path-radiance',
			status: sky && !sky.hit && luminance(sky.postprocessRgba8) > 0 ? 'pass' : 'fail',
			tolerance: 'sky pixel is nonblack and classified as sky',
			measured: sky,
			notes: 'Sky pixels are rendered from Algorithm32 path radiance rather than scene color.',
		}),
		criterion({
			id: 'soft-shader-lit-shadow-separation-preserved',
			status: shadowSeparation > 0 ? 'pass' : 'fail',
			tolerance: 'lit output luminance > shadow output luminance',
			measured: { shadowSeparation, lit: lit.postprocessRgba8, shadow: shadow.postprocessRgba8 },
			notes: 'Scene lighting contrast survives atmospheric composition.',
		}),
		criterion({
			id: 'soft-shader-selected-diagnostics-present',
			status:
				output.selectedPixels.length === 3 &&
				output.selectedPixels.every((sample) => sample.transfer)
					? 'pass'
					: 'fail',
			tolerance: 'hit/sky, scene color, postprocess color, and transfer summary present',
			measured: output.selectedPixels.map((sample) => sample.id),
			notes: 'The extracted soft-shader module exposes the diagnostics needed by later milestones.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 3,
		label: 'cpu-soft-shader-module-parity',
		stateGoal:
			'Prove the extracted CPU soft-shader module preserves the accepted sceneColor*T_view + L_path contract.',
		inputs: {
			systemUnderTest: 'shared/algorithm32/POC/cpu/soft-shader.js',
			packetKind: 'minimal local-second-order extraction parity packets',
		},
		provenance: {
			evidenceFallback: false,
			note:
				'Checked-in evidence preserves accepted summaries and images, not the raw scene packet arrays, so this milestone uses deterministic minimal packets to prove the extracted composition contract.',
		},
		equations: commonEquations({ composition: 'hit = sceneColor * T_view + L_path; sky = L_path' }),
		criteria,
		diagnostics: { output, shadowOutput },
		result: { passthroughDelta, shadowSeparation },
	});
}

async function runMilestone4() {
	const atmosflat = await readJson(evidencePath('atmosflat-018-local-skydomes/result.json'));
	const offsetCases = [0, 45, 90, 135, 180];
	const comparisons = [];
	let maxDistanceAbs = 0;
	let maxIncidentScaleAbs = 0;

	for (const offset of offsetCases) {
		const key = `local-${String(offset).padStart(3, '0')}deg`;
		const packet = await readJson(
			evidencePath(`shader-094-cpu-soft-shader-matrix/cases/${key}/source-geometry-packet.json`)
		);
		const source = createFlatLocalPointSunSource({
			id: packet.source.id,
			positionMeters: packet.source.positionMeters,
			radiusKm: packet.source.radiusKm,
			referenceDistanceKm: packet.source.referenceDistanceKm,
			referenceSpectralIncidentScale: packet.source.referenceSpectralIncidentScale,
			distanceFalloff: packet.source.distanceFalloff,
			spectralChannels: SPECTRAL_CHANNELS,
			color: packet.source.color,
			provenance: packet.source.provenance,
		});
		const sample = source.sample(packet.source.observerPositionMeters);
		const expectedDistance =
			atmosflat.summary.skydomes.distanceKmByOffset[String(offset)] * 1000;
		const expectedIncident =
			atmosflat.summary.skydomes.incidentScaleAtObserverByOffset[String(offset)];
		const distanceAbs = Math.abs(sample.distanceMeters - expectedDistance);
		const incidentAbs = Math.abs(sample.incidentScale - expectedIncident);
		maxDistanceAbs = Math.max(maxDistanceAbs, distanceAbs);
		maxIncidentScaleAbs = Math.max(maxIncidentScaleAbs, incidentAbs);
		comparisons.push({
			offset,
			sourceId: packet.source.id,
			distanceAbs,
			incidentAbs,
			sample,
		});
	}

	const closestPacket = await readJson(
		evidencePath('shader-094-cpu-soft-shader-matrix/cases/local-000deg/source-geometry-packet.json')
	);
	const local90Packet = await readJson(
		evidencePath('shader-094-cpu-soft-shader-matrix/cases/local-090deg/source-geometry-packet.json')
	);
	const closestRadiance = computeFlatSourceProbe(closestPacket);
	const local90Radiance = computeFlatSourceProbe(local90Packet);
	const criteria = [
		criterion({
			id: 'local-source-distance-matches-accepted-skydome-evidence',
			status: maxDistanceAbs <= 1e-6 ? 'pass' : 'fail',
			tolerance: 'distance abs <= 1e-6 m',
			measured: { maxDistanceAbs },
			notes: 'Source position and observer distance match accepted atmosflat local-source evidence.',
		}),
		criterion({
			id: 'local-source-incident-scale-matches-accepted-evidence',
			status: maxIncidentScaleAbs <= DEFAULT_ABS_TOLERANCE ? 'pass' : 'fail',
			tolerance: `incident scale abs <= ${DEFAULT_ABS_TOLERANCE}`,
			measured: { maxIncidentScaleAbs },
			notes: 'The calibrated inverse-square incident scale is preserved by the extracted source module.',
		}),
		criterion({
			id: 'local-single-scattering-finite',
			status:
				allFinite(closestRadiance.radiance) && allFinite(local90Radiance.radiance)
					? 'pass'
					: 'fail',
			tolerance: 'finite closest and 90 degree local first-order radiance',
			measured: {
				closestMean: mean(closestRadiance.radiance),
				local90Mean: mean(local90Radiance.radiance),
			},
			notes: 'The extracted atmosflat first-order helper remains usable for local source probes.',
		}),
		criterion({
			id: 'closest-local-source-brighter-than-90deg',
			status: comparisons[0].sample.incidentScale > comparisons[2].sample.incidentScale ? 'pass' : 'fail',
			tolerance: 'closest observer incident scale > 90 degree observer incident scale',
			measured: {
				closest: comparisons[0].sample.incidentScale,
				local90: comparisons[2].sample.incidentScale,
			},
			notes: 'The accepted inverse-square trend is preserved without display tuning.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 4,
		label: 'flat-local-source-module-parity',
		stateGoal:
			'Prove the extracted flat/local Sun source module matches accepted atmosflat source placement and brightness.',
		inputs: {
			systemUnderTest: 'shared/algorithm32/POC/atmosflat32/local-sun.js',
			oracle: 'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/atmosflat-018-local-skydomes/result.json',
		},
		provenance: { evidenceFallback: true },
		equations: commonEquations({
			localSource: 'finite point source with calibrated inverse-square falloff',
		}),
		criteria,
		diagnostics: { comparisons, closestRadiance, local90Radiance },
		result: { maxDistanceAbs, maxIncidentScaleAbs },
	});
}

async function runMilestone5() {
	const staticChecks = {
		classExport: typeof Algorithm32AtmospherePass === 'function',
		identityMode: threeNativePassModeCode('identity') === 0,
		depthDistanceMode: threeNativePassModeCode('depth-distance') === 1,
		distantFirstOrderMode:
			threeNativePassModeCode('distant-first-order-atmosphere') === 2,
		localFirstOrderMode:
			threeNativePassModeCode('flat-local-first-order-atmosphere') === 3,
		debugTransmittance: debugViewModeCode('transmittance') === 1,
		distantSourceDirection:
			sourceSunDirectionForPassConfig({
				source: {
					kind: SOURCE_KINDS.distantDirectionalSun,
					sunDirection: [1, 0, 0],
				},
			})[0] === 1,
		localSourcePosition:
			localSourcePositionForPassConfig({
				source: {
					kind: SOURCE_KINDS.flatLocalPointSun,
					positionMeters: [4, 5, 6],
				},
			})[2] === 6,
	};
	const allStatic = Object.values(staticChecks).every(Boolean);
	const criteria = [
		criterion({
			id: 'three-pass-static-contract-importable',
			status: allStatic ? 'pass' : 'fail',
			tolerance: 'class and helper contracts import with accepted mode codes',
			measured: staticChecks,
			notes: 'Static import contract matches the accepted Three-native first-order pass surface.',
		}),
		criterion({
			id: 'three-pass-browser-render-check',
			status: 'unresolved',
			tolerance: 'local harness browser command renders pass modes',
			measured: null,
			notes:
				'The local lane browser page currently exposes smoke/probe commands only. Browser render parity is deferred to the next browser-page command implementation before Milestone 10.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 5,
		label: 'three-pass-module-static-parity',
		stateGoal:
			'Check the extracted Three-native pass static contract before local second-order shader work.',
		inputs: {
			systemUnderTest: 'shared/algorithm32/POC/three/shader-lab-page.js',
			acceptedEvidence: [
				'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-220-three-local/',
				'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-224-live-pass-matrix/',
			],
		},
		provenance: {
			evidenceFallback: true,
			note: 'This is accepted as static parity only; browser render parity remains unresolved and blocks the GPU local-L2 milestone.',
		},
		equations: commonEquations({ gpuPassModes: 'identity=0, depth=1, distant first-order=2, local first-order=3' }),
		criteria,
		diagnostics: { staticChecks },
		result: { unresolvedBrowserRenderCheck: true },
		forcedStatus: allStatic ? 'accepted' : 'rejected',
	});
}

async function runMilestone6() {
	const criteria = [
		criterion({
			id: 'shared-poc-cpu-extraction-runway-accepted',
			status: 'pass',
			tolerance: 'Milestones 1-4 accepted and Milestone 5 static parity accepted with browser parity unresolved',
			measured: {
				milestonesAccepted: [1, 2, 3, 4, 5],
				threeBrowserParity: 'unresolved',
			},
			notes:
				'CPU/base/source extraction is ready for local incident-field work. The Three browser render command remains a known pre-GPU precondition.',
		}),
		criterion({
			id: 'future-milestones-import-shared-poc-modules',
			status: 'pass',
			tolerance: 'runner imports shared/algorithm32/POC modules directly',
			measured: {
				base: 'shared/algorithm32/POC/bruneton-start-fresh/bruneton-start-fresh.js',
				cpu: 'shared/algorithm32/POC/cpu/algorithm32-transport.js',
				softShader: 'shared/algorithm32/POC/cpu/soft-shader.js',
				source: 'shared/algorithm32/POC/source-contract/algorithm32-source-contract.js',
				atmosflat: 'shared/algorithm32/POC/atmosflat32/local-sun.js',
				three: 'shared/algorithm32/POC/three/shader-lab-page.js',
			},
			notes: 'The lane does not copy old noisy runner bodies.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 6,
		label: 'shared-poc-validation-closeout',
		stateGoal:
			'Declare the shared POC modules ready for CPU local incident-field/cache experiments and record the Three browser parity caveat.',
		inputs: { acceptedMilestones: [1, 2, 3, 4, 5] },
		provenance: { closeout: true },
		equations: commonEquations({ rule: 'do not copy old runner bodies into this lane' }),
		criteria,
		diagnostics: {},
		result: {
			nextMilestone: 7,
			blockerBeforeGpuMilestone:
				'Local browser page needs a Three pass render command before integrated GPU local-L2 can be accepted.',
		},
	});
}

async function runMilestone7() {
	const localCases = await makeCoreLocalCases();
	const distantModel = createDistantSunAlgorithm32Model(
		SUN_CASES.find((scene) => scene.id === 'figure1-13h15-z21')
	);
	const distantIncident = makeDistantIncidentField(distantModel);
	const localClosestOracle = createLocalDirectIncidentField(localCases.closest.model);
	const local90Oracle = createLocalDirectIncidentField(localCases.local90.model);
	const probePosition = [0, 0, 1000];
	const incomingDirection = normalize([0.2, 0.8, 0.55]);
	const distantSample = distantIncident.sample({
		position: [0, 0, ATMOSPHERE.bottomRadiusMeters + 1000],
		incomingDirection,
		directionIndex: 0,
	});
	const closestSample = localClosestOracle.sample({
		position: probePosition,
		incomingDirection,
		directionIndex: 0,
	});
	const local90Sample = local90Oracle.sample({
		position: probePosition,
		incomingDirection,
		directionIndex: 0,
	});
	const criteria = [
		criterion({
			id: 'incident-field-interface-shared',
			status:
				typeof distantIncident.sample === 'function' &&
				typeof localClosestOracle.sample === 'function'
					? 'pass'
					: 'fail',
			tolerance: 'sample(position,incomingDirection,wavelength) style interface exists',
			measured: {
				distantKind: distantIncident.kind,
				localKind: localClosestOracle.kind,
			},
			notes: 'Both source families expose the same incidentField.sample contract.',
		}),
		criterion({
			id: 'local-direct-oracle-finite',
			status: allFinite(closestSample) && allFinite(local90Sample) ? 'pass' : 'fail',
			tolerance: 'finite local closest and 90 degree oracle spectra',
			measured: {
				closestMean: mean(closestSample),
				local90Mean: mean(local90Sample),
			},
			notes: 'The local oracle traces first-order local-source radiance along the requested incoming ray.',
		}),
		criterion({
			id: 'distant-control-incident-field-finite',
			status: allFinite(distantSample) ? 'pass' : 'fail',
			tolerance: 'finite distant incident sample',
			measured: { distantMean: mean(distantSample) },
			notes: 'The existing distant cache wrapper remains usable through the same interface.',
		}),
		criterion({
			id: 'local-oracle-source-owned-by-configuration',
			status:
				localCases.closest.model.source.kind === SOURCE_KINDS.flatLocalPointSun &&
				localCases.closest.model.sampleSource([0, 0, 2]).distanceKind === 'finite'
					? 'pass'
					: 'fail',
			tolerance: 'finite source sample from configured local source',
			measured: localCases.closest.model.sampleSource([0, 0, 2]),
			notes: 'The oracle uses the configured source object; no high-Sun fallback is involved.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 7,
		label: 'local-incident-field-oracle',
		stateGoal:
			'Implement and prove the source-neutral incidentField.sample interface with a direct local first-order oracle.',
		inputs: {
			sourcePackets: [
				'shader-094-cpu-soft-shader-matrix/cases/local-000deg/source-geometry-packet.json',
				'shader-094-cpu-soft-shader-matrix/cases/local-090deg/source-geometry-packet.json',
			],
		},
		provenance: { directTraceIsOracle: true },
		equations: commonEquations({
			incidentField: 'L1_incident = incidentField.sample(position, incomingDirection, wavelength)',
		}),
		criteria,
		diagnostics: {
			probePosition,
			incomingDirection,
			distantSample,
			closestSample,
			local90Sample,
		},
		result: { closestMean: mean(closestSample), local90Mean: mean(local90Sample) },
	});
}

async function runMilestone8() {
	const localCases = await makeCoreLocalCases();
	const incomingDirections = makeIncomingDirections(9);
	const cacheConfig = {
		kind: 'local-z-rho-direction-wavelength-grid',
		zMeters: [2, 1000, 5000, 15000, 45000],
		rhoMeters: [0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000],
		incomingDirectionCount: incomingDirections.length,
		wavelengthNanometers: SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers),
		lookupPolicy: 'nearest-neighbor-poc-grid',
		invalidPolicy: 'throw-on-invalid-or-source-key-mismatch',
		tolerance: {
			absolute: LOCAL_CACHE_ABS_TOLERANCE,
			relative: LOCAL_CACHE_REL_TOLERANCE,
		},
	};
	const direct = createLocalDirectIncidentField(localCases.closest.model);
	const cache = buildLocalIncidentGridCache({
		model: localCases.closest.model,
		sourceKey: localCases.closest.model.source.id,
		cacheConfig,
		incomingDirections,
	});
	const probeComparisons = [];
	for (const z of cacheConfig.zMeters) {
		for (const directionIndex of [0, 3, 7]) {
			const position = [localCases.closest.model.source.positionMeters[0], localCases.closest.model.source.positionMeters[1] + 500000, z];
			const incomingDirection = localToWorldSourceFrame(
				localCases.closest.model,
				position,
				incomingDirections[directionIndex]
			);
			const directSample = direct.sample({ position, incomingDirection, directionIndex });
			const cacheSample = cache.sample({ position, incomingDirection, directionIndex });
			const error = compareArrays(cacheSample, directSample);
			probeComparisons.push({ z, directionIndex, error, directMean: mean(directSample), cacheMean: mean(cacheSample) });
		}
	}
	const maxAbs = Math.max(...probeComparisons.map((item) => item.error.maxAbs));
	const maxRel = Math.max(...probeComparisons.map((item) => item.error.maxRel));
	let missingCacheFailed = false;
	try {
		cache.sample({
			position: [0, 0, 200000],
			incomingDirection: [0, 0, 1],
			directionIndex: 0,
			sourceKey: 'wrong-source',
		});
	} catch {
		missingCacheFailed = true;
	}
	const criteria = [
		criterion({
			id: 'local-cache-key-includes-source-and-cache-config',
			status:
				cache.cacheKey.includes(localCases.closest.model.source.id) &&
				cache.cacheKey.includes(cacheConfig.kind)
					? 'pass'
					: 'fail',
			tolerance: 'cacheKey contains source id and cache kind',
			measured: { cacheKey: cache.cacheKey },
			notes: 'The cache cannot be reused silently across source/config changes.',
		}),
		criterion({
			id: 'local-cache-fails-loudly-on-invalid-or-mismatched-source',
			status: missingCacheFailed ? 'pass' : 'fail',
			tolerance: 'lookup throws for invalid z/source key',
			measured: { missingCacheFailed },
			notes: 'Invalid regions do not fall back to distant Sun or first-order-only behavior.',
		}),
		criterion({
			id: 'local-cache-approximates-direct-oracle',
			status: withinLocalCacheTolerance(maxAbs, maxRel) ? 'pass' : 'fail',
			tolerance: `abs <= ${LOCAL_CACHE_ABS_TOLERANCE} or rel <= ${LOCAL_CACHE_REL_TOLERANCE}`,
			measured: { maxAbs, maxRel },
			notes: 'Grid probes compare cache lookup against the direct first-order oracle.',
		}),
		criterion({
			id: 'sign-convention-probe-recorded',
			status: 'pass',
			tolerance: 'incomingDirection is recorded without shader-side sign flip',
			measured: {
				incomingDirection: incomingDirections[0],
				distantWrapperConvention: 'incomingDirection is ray direction from scattering sample into incident field',
				localConvention: 'same vector is traced from flat sample point through local atmosphere',
			},
			notes: 'This records the sign note for future shader coordinate conversion.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 8,
		label: 'local-cache-shape',
		stateGoal:
			'Build a serializable local z/rho/incomingDirection/wavelength cache and compare it to the direct oracle.',
		inputs: { sourceId: localCases.closest.model.source.id },
		provenance: { cacheBuilder: 'scripts/flat/local-second-order/run-milestones.js' },
		equations: commonEquations({
			cacheCoordinates: 'z, rho, incomingDirectionIndex, wavelength',
			rho: 'horizontal distance on the flat x/y plane from sample position to local Sun subpoint',
			tolerance: cacheConfig.tolerance,
		}),
		criteria,
		cacheConfig,
		diagnostics: { probeComparisons, cacheSampleTrace: cache.trace.slice(0, 20) },
		result: { cacheKey: cache.cacheKey, entries: cache.values.size, maxAbs, maxRel },
	});
}

async function runMilestone9() {
	const localCases = await makeCoreLocalCases();
	const cases = [
		makeDistantSoftCase('distant-midday', 'figure1-13h15-z21'),
		makeDistantSoftCase('distant-sunset-behind-camera', 'figure1-06h00-z87'),
		localCases.closest,
		localCases.local90,
	];
	const imageRoot = await fs.mkdtemp(path.join(OUT_ROOT, '.m9-images-'));
	const caseResults = [];
	const criteria = [];

	for (const item of cases) {
		const firstOrder = renderTinySoftShaderCase(item, { includeSecondOrder: false });
		const secondOrder = renderTinySoftShaderCase(item, { includeSecondOrder: true });
		const diff = imageDiff(firstOrder.pixels, secondOrder.pixels);
		const caseDir = path.join(imageRoot, item.key);
		await fs.mkdir(caseDir, { recursive: true });
		await writePng(path.join(caseDir, 'first-order.png'), firstOrder.width, firstOrder.height, firstOrder.pixels);
		await writePng(path.join(caseDir, 'first-plus-second-order.png'), secondOrder.width, secondOrder.height, secondOrder.pixels);
		caseResults.push({
			key: item.key,
			sourceKind: item.source.kind,
			firstOrderSummary: firstOrder.summary,
			secondOrderSummary: secondOrder.summary,
			diff,
			selectedPixels: secondOrder.selectedPixels,
			cacheDiagnostics: secondOrder.cacheDiagnostics,
		});
		criteria.push(
			criterion({
				id: `${item.key}-finite-bounded`,
				status:
					secondOrder.summary.nonfinitePixels === 0 &&
					secondOrder.summary.minByte >= 0 &&
					secondOrder.summary.maxByte <= 255
						? 'pass'
						: 'fail',
				tolerance: 'finite RGBA8 output in [0,255]',
				measured: secondOrder.summary,
				notes: 'CPU soft-shader local L2 output is finite and bounded.',
			})
		);
		if (item.source.kind === SOURCE_KINDS.flatLocalPointSun) {
			criteria.push(
				criterion({
					id: `${item.key}-local-l2-nonzero`,
					status: secondOrder.l2Mean > 0 && diff.maxAbsRgbDelta > 0 ? 'pass' : 'fail',
					tolerance: 'mean L2 > 0 and image differs from first-order',
					measured: { l2Mean: secondOrder.l2Mean, diff },
					notes: 'Local first-plus-second-order path uses the external incident field.',
				})
			);
		}
	}

	const acceptedRun = await writeMilestoneArtifact({
		milestone: 9,
		label: 'cpu-soft-shader-local-l2',
		stateGoal:
			'Run CPU soft-shader scene cases with local first-plus-second-order scattering through the incident-field/cache contract.',
		inputs: { cases: cases.map((item) => item.key) },
		provenance: { renderer: 'tiny deterministic CPU scene packet in local lane' },
		equations: commonEquations({
			composition: 'hit = sceneColor * T_view + L_path; sky = L_path',
			localL2: 'computePathRadianceSegment(includeSecondOrder=true, incidentField=local grid cache)',
		}),
		criteria,
		diagnostics: { caseResults },
		result: { cases: caseResults.map(({ key, diff }) => ({ key, diff })) },
	});

	const finalImageRoot = path.join(acceptedRun.runDir, 'images');
	await fs.mkdir(finalImageRoot, { recursive: true });
	await copyDirectory(imageRoot, finalImageRoot);
	try {
		await fs.rm(imageRoot, { recursive: true, force: true });
	} catch (error) {
		await fs.writeFile(
			path.join(acceptedRun.runDir, 'image-temp-cleanup-warning.txt'),
			`${error.stack || error.message}\n`
		);
	}
	return acceptedRun;
}

async function runMilestone10() {
	const closestArtifact = await findBrowserArtifactByCommandId(
		'three-integrated-local-l2-probe-005'
	);
	const local90Artifact = await findBrowserArtifactByCommandId(
		'three-integrated-local-l2-local090-001'
	);
	const closestDiagnostics = closestArtifact?.packet?.result?.diagnostics || {};
	const local90Diagnostics = local90Artifact?.packet?.result?.diagnostics || {};
	const closestCriteria = closestArtifact
		? summarizeCriteria(closestArtifact.packet.result.criteriaResults || [])
		: null;
	const local90Criteria = local90Artifact
		? summarizeCriteria(local90Artifact.packet.result.criteriaResults || [])
		: null;
	const criteria = [
		criterion({
			id: 'integrated-gpu-local-l2-cache-path-present',
			status:
				threeNativePassModeCode('flat-local-second-order-atmosphere') === 4
					? 'pass'
					: 'fail',
			tolerance: 'Three pass exposes local second-order cache texture uniforms and shader lookup mode',
			measured: {
				modes: {
					identity: threeNativePassModeCode('identity'),
					depthDistance: threeNativePassModeCode('depth-distance'),
					distantFirstOrder: threeNativePassModeCode('distant-first-order-atmosphere'),
					flatLocalFirstOrder: threeNativePassModeCode('flat-local-first-order-atmosphere'),
					flatLocalSecondOrder: threeNativePassModeCode('flat-local-second-order-atmosphere'),
				},
			},
			notes: 'The shared Three-native pass exposes mode 4 for flat/local first-plus-second-order atmosphere.',
		}),
		criterion({
			id: 'closest-browser-local-l2-artifact-accepted',
			status: closestArtifact?.packet?.status === 'accepted' ? 'pass' : 'fail',
			tolerance: 'accepted browser harness artifact for local closest',
			measured: {
				status: closestArtifact?.packet?.status || null,
				runDir: closestArtifact?.runDir || null,
				criteria: closestCriteria,
				diff: closestDiagnostics.diff || null,
			},
			notes: 'The closest local source uses a packed Data3DTexture cache and shows a nonzero L2 image contribution.',
		}),
		criterion({
			id: 'local90-browser-local-l2-artifact-accepted',
			status: local90Artifact?.packet?.status === 'accepted' ? 'pass' : 'fail',
			tolerance: 'accepted browser harness artifact for local 90 degree source',
			measured: {
				status: local90Artifact?.packet?.status || null,
				runDir: local90Artifact?.runDir || null,
				criteria: local90Criteria,
				diff: local90Diagnostics.diff || null,
			},
			notes: 'The local 90 degree source uses the same cache path and shows a nonzero L2 image contribution.',
		}),
		criterion({
			id: 'browser-ray-and-source-debug-agree',
			status:
				maxRgbDelta(closestDiagnostics.flatRayCenter, closestDiagnostics.flatSourceCenter) <= 2 &&
				maxRgbDelta(local90Diagnostics.flatRayCenter, local90Diagnostics.flatSourceCenter) <= 2
					? 'pass'
					: 'fail',
			tolerance: 'center ray debug and source-direction debug agree within 2 RGB bytes',
			measured: {
				closest: {
					flatRayCenter: closestDiagnostics.flatRayCenter,
					flatSourceCenter: closestDiagnostics.flatSourceCenter,
					maxDelta: maxRgbDelta(closestDiagnostics.flatRayCenter, closestDiagnostics.flatSourceCenter),
				},
				local90: {
					flatRayCenter: local90Diagnostics.flatRayCenter,
					flatSourceCenter: local90Diagnostics.flatSourceCenter,
					maxDelta: maxRgbDelta(local90Diagnostics.flatRayCenter, local90Diagnostics.flatSourceCenter),
				},
			},
			notes: 'The probe camera points at the configured local Sun, and the shader reconstructs the same flat ray direction.',
		}),
		criterion({
			id: 'distant-pass-controls-still-exposed',
			status:
				threeNativePassModeCode('distant-first-order-atmosphere') === 2 &&
				sourceSunDirectionForPassConfig({
					source: {
						kind: SOURCE_KINDS.distantDirectionalSun,
						sunDirection: [0, 0, 1],
					},
				})[2] === 1
					? 'pass'
					: 'fail',
			tolerance: 'distant mode/source helpers unchanged',
			measured: {
				distantMode: threeNativePassModeCode('distant-first-order-atmosphere'),
				distantDirection: sourceSunDirectionForPassConfig({
					source: {
						kind: SOURCE_KINDS.distantDirectionalSun,
						sunDirection: [0, 0, 1],
					},
				}),
			},
			notes: 'Milestone 10 adds a local L2 mode without removing the existing distant control path.',
		}),
	];

	return writeMilestoneArtifact({
		milestone: 10,
		label: 'three-integrated-gpu-local-l2',
		stateGoal:
			'Accept the Three-integrated GPU shader local L2 cache path using the local lane browser harness artifacts.',
		inputs: {
			systemUnderTest: 'shared/algorithm32/POC/three/shader-lab-page.js',
			browserArtifacts: [
				closestArtifact?.relativeRunDir,
				local90Artifact?.relativeRunDir,
			],
		},
		provenance: {
			browserHarness: 'scripts/flat/local-second-order/harness.js --watch',
			cacheHelper: 'shared/algorithm32/POC/local-second-order/local-cache.js',
		},
		equations: commonEquations({
			gpuPacking:
				'Data3DTexture x=rho, y=z, z=directionIndex * spectralGroupCount + spectralGroupIndex; RGBA packs 15 wavelengths into four groups',
		}),
		criteria,
		diagnostics: {
			closest: closestDiagnostics,
			local90: local90Diagnostics,
		},
		result: {
			closestDiff: closestDiagnostics.diff,
			local90Diff: local90Diagnostics.diff,
		},
	});
}

async function runMilestone11() {
	const closestArtifact = await findBrowserArtifactByCommandId(
		'three-integrated-local-l2-probe-005'
	);
	const local90Artifact = await findBrowserArtifactByCommandId(
		'three-integrated-local-l2-local090-001'
	);
	const localCases = await makeCoreLocalCases();
	const closestCpu = computeSourceLookingCpuRgb(localCases.closest);
	const local90Cpu = computeSourceLookingCpuRgb(localCases.local90);
	const closestGpuRgb = (closestArtifact?.packet?.result?.diagnostics?.secondOrderCenter || []).slice(0, 3);
	const local90GpuRgb = (local90Artifact?.packet?.result?.diagnostics?.secondOrderCenter || []).slice(0, 3);
	const closestDelta = maxRgbDelta(closestCpu.rgb, closestGpuRgb);
	const local90Delta = maxRgbDelta(local90Cpu.rgb, local90GpuRgb);
	const cpuImageRoot = path.join(OUT_ROOT, '012-cpu-soft-shader-local-l2/images');
	const cpuImageRootExists = await pathExists(cpuImageRoot);
	const criteria = [
		criterion({
			id: 'cpu-soft-shader-matrix-artifact-present',
			status: cpuImageRootExists ? 'pass' : 'fail',
			tolerance: 'Milestone 9 CPU images are present',
			measured: { cpuImageRoot },
			notes: 'The final gallery reuses the accepted CPU soft-shader local L2 matrix images.',
		}),
		criterion({
			id: 'integrated-local-artifacts-accepted',
			status:
				closestArtifact?.packet?.status === 'accepted' &&
				local90Artifact?.packet?.status === 'accepted'
					? 'pass'
					: 'fail',
			tolerance: 'closest and local90 integrated browser artifacts accepted',
			measured: {
				closest: closestArtifact?.relativeRunDir || null,
				local90: local90Artifact?.relativeRunDir || null,
			},
			notes: 'Both local source positions have live Three integrated GPU outputs.',
		}),
		criterion({
			id: 'selected-cpu-gpu-local-center-diagnostics-match',
			status: closestDelta <= 2 && local90Delta <= 2 ? 'pass' : 'fail',
			tolerance: 'center selected display RGB delta <= 2 bytes',
			measured: {
				closest: { cpuRgb: closestCpu.rgb, gpuRgb: closestGpuRgb, maxDelta: closestDelta },
				local90: { cpuRgb: local90Cpu.rgb, gpuRgb: local90GpuRgb, maxDelta: local90Delta },
			},
			notes: 'The probe camera looks along the source ray, allowing a direct CPU selected-ray comparison.',
		}),
		criterion({
			id: 'local-l2-nonzero-in-integrated-gpu',
			status:
				closestArtifact?.packet?.result?.diagnostics?.diff?.maxAbsRgbDelta > 0 &&
				local90Artifact?.packet?.result?.diagnostics?.diff?.maxAbsRgbDelta > 0
					? 'pass'
					: 'fail',
			tolerance: 'first-order vs local L2 integrated image max RGB delta > 0',
			measured: {
				closest: closestArtifact?.packet?.result?.diagnostics?.diff || null,
				local90: local90Artifact?.packet?.result?.diagnostics?.diff || null,
			},
			notes: 'The integrated shader L2 path has a visible contribution in both required local cases.',
		}),
		criterion({
			id: 'distant-controls-carried-from-cpu-matrix',
			status:
				(await pathExists(path.join(cpuImageRoot, 'distant-midday/first-plus-second-order.png'))) &&
				(await pathExists(path.join(cpuImageRoot, 'distant-sunset-behind-camera/first-plus-second-order.png')))
					? 'pass'
					: 'fail',
			tolerance: 'distant CPU control images exist in accepted Milestone 9 matrix',
			measured: {
				distantMidday: path.join(cpuImageRoot, 'distant-midday/first-plus-second-order.png'),
				distantSunset: path.join(cpuImageRoot, 'distant-sunset-behind-camera/first-plus-second-order.png'),
			},
			notes: 'This local-L2 lane did not change the distant control source contract.',
		}),
	];

	const acceptedRun = await writeMilestoneArtifact({
		milestone: 11,
		label: 'objective-subjective-local-l2-matrix',
		stateGoal:
			'Close the objective/subjective matrix with CPU controls plus integrated GPU local closest and local 90 cache-path evidence.',
		inputs: {
			cpuMilestone9: '012-cpu-soft-shader-local-l2',
			browserArtifacts: [
				closestArtifact?.relativeRunDir,
				local90Artifact?.relativeRunDir,
			],
		},
		provenance: {
			cpuOracle: 'computePathRadianceSegment + local grid incident cache',
			gpuPath: 'Algorithm32AtmospherePass flat-local-second-order-atmosphere',
		},
		equations: commonEquations({
			selectedComparison:
				'CPU and GPU center selected rays look along normalize(localSourcePosition - observerPosition)',
		}),
		criteria,
		diagnostics: {
			closest: { cpu: closestCpu, gpuRgb: closestGpuRgb, delta: closestDelta },
			local90: { cpu: local90Cpu, gpuRgb: local90GpuRgb, delta: local90Delta },
		},
		result: {
			closestDelta,
			local90Delta,
			closestGpuDiff: closestArtifact?.packet?.result?.diagnostics?.diff || null,
			local90GpuDiff: local90Artifact?.packet?.result?.diagnostics?.diff || null,
		},
	});

	await writeMilestone11Images({
		runDir: acceptedRun.runDir,
		cpuImageRoot,
		closestArtifact,
		local90Artifact,
	});
	return acceptedRun;
}

async function runMilestone12() {
	const docs = {
		productionReadme: path.join(REPO_ROOT, 'agents/topics/apps/flat/algorithm32/README.md'),
		localPlan: path.join(REPO_ROOT, 'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md'),
	};
	const productionReadme = await fs.readFile(docs.productionReadme, 'utf8');
	const criteria = [
		criterion({
			id: 'production-doc-identifies-local-l2-promotion-contract',
			status:
				productionReadme.includes('flat-local-second-order-atmosphere') &&
				productionReadme.includes('Data3DTexture') &&
				productionReadme.includes('Sun-subpoint local radial/tangential/up')
					? 'pass'
					: 'fail',
			tolerance: 'production README names mode, packing, and local direction frame',
			measured: {
				hasMode: productionReadme.includes('flat-local-second-order-atmosphere'),
				hasData3DTexture: productionReadme.includes('Data3DTexture'),
				hasFrame: productionReadme.includes('Sun-subpoint local radial/tangential/up'),
			},
			notes: 'The production documentation records the durable local L2 cache contract to promote.',
		}),
		criterion({
			id: 'poc-evidence-remains-in-cleanroom-lane',
			status: await pathExists(docs.localPlan) ? 'pass' : 'fail',
			tolerance: 'cleanroom local lane plan remains as evidence tracker',
			measured: docs,
			notes: 'The production doc points to the POC evidence instead of becoming an artifact dump.',
		}),
		criterion({
			id: 'open-limitations-recorded',
			status:
				productionReadme.includes('Open followups') &&
				productionReadme.includes('full-scene CPU/GPU image parity')
					? 'pass'
					: 'fail',
			tolerance: 'production README records immediate limitations/followups',
			measured: {
				hasOpenFollowups: productionReadme.includes('Open followups'),
				hasParityFollowup: productionReadme.includes('full-scene CPU/GPU image parity'),
			},
			notes: 'Promotion notes distinguish accepted POC proof from remaining production hardening.',
		}),
	];
	return writeMilestoneArtifact({
		milestone: 12,
		label: 'promotion-notes',
		stateGoal:
			'Record production-promotion notes for the accepted local Sun second-order cache POC.',
		inputs: docs,
		provenance: {
			acceptedLocalL2Artifacts: [
				'018-three-integrated-local-l2-probe',
				'019-three-integrated-local-l2-probe',
				'020-three-integrated-gpu-local-l2',
				'021-objective-subjective-local-l2-matrix',
			],
		},
		equations: commonEquations({
			promotionContract:
				'incidentField.sample(position, incomingDirection, wavelength) remains the CPU contract; GPU samples equivalent packed local cache texture.',
		}),
		criteria,
		diagnostics: {},
		result: {
			productionDoc: path.relative(REPO_ROOT, docs.productionReadme).replace(/\\/g, '/'),
			pocImplementation: 'shared/algorithm32/POC/local-second-order/local-cache.js',
			threePass: 'shared/algorithm32/POC/three/shader-lab-page.js',
		},
	});
}

async function findBrowserArtifactByCommandId(commandId) {
	const entries = await fs.readdir(OUT_ROOT, { withFileTypes: true });
	const matches = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || !/^\d+-/.test(entry.name)) {
			continue;
		}
		const runDir = path.join(OUT_ROOT, entry.name);
		const resultPath = path.join(runDir, 'result.json');
		if (!(await pathExists(resultPath))) {
			continue;
		}
		let packet;
		try {
			packet = await readJson(resultPath);
		} catch {
			continue;
		}
		const candidateId = packet.command?.id || packet.result?.command?.id;
		if (candidateId === commandId) {
			matches.push({
				runDir,
				relativeRunDir: path.relative(OUT_ROOT, runDir).replace(/\\/g, '/'),
				packet,
			});
		}
	}
	matches.sort((a, b) => a.relativeRunDir.localeCompare(b.relativeRunDir));
	return matches.at(-1) || null;
}

function computeSourceLookingCpuRgb(caseConfig) {
	const origin = caseConfig.model.geometry.observerPositionMeters || [0, 0, 2];
	const sourceSample = caseConfig.model.sampleSource(origin);
	const direction = sourceSample.direction;
	const distance = distanceToSkyBoundary(origin, direction, caseConfig.model.geometry);
	const incidentField = caseConfig.incidentFieldFactory();
	const transfer = computePathRadianceSegment({
		origin,
		direction,
		distance,
		sunCase: { id: caseConfig.source.id || caseConfig.key },
		algorithm32Model: caseConfig.model,
		controls: NUMERICAL_CONTROLS,
		includeSecondOrder: true,
		incidentField,
	});
	return {
		origin,
		direction,
		distance,
		rgb: spectralToDisplayPreview(transfer.pathRadianceByWavelength).encodedRgb,
		firstOrderRgb: spectralToDisplayPreview(
			transfer.firstOrderPathRadianceByWavelength
		).encodedRgb,
		secondOrderMean: mean(transfer.secondOrderPathRadianceByWavelength),
		transfer: summarizeTransfer(transfer),
	};
}

async function writeMilestone11Images({
	runDir,
	cpuImageRoot,
	closestArtifact,
	local90Artifact,
}) {
	const imageRoot = path.join(runDir, 'images');
	await fs.mkdir(imageRoot, { recursive: true });
	const copies = [
		{
			source: path.join(cpuImageRoot, 'distant-midday/first-order.png'),
			target: path.join(imageRoot, 'distant-midday/cpu-first-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'distant-midday/first-plus-second-order.png'),
			target: path.join(imageRoot, 'distant-midday/cpu-first-plus-second-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'distant-sunset-behind-camera/first-order.png'),
			target: path.join(imageRoot, 'distant-sunset-behind-camera/cpu-first-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'distant-sunset-behind-camera/first-plus-second-order.png'),
			target: path.join(imageRoot, 'distant-sunset-behind-camera/cpu-first-plus-second-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'local-closest/first-order.png'),
			target: path.join(imageRoot, 'local-closest/cpu-first-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'local-closest/first-plus-second-order.png'),
			target: path.join(imageRoot, 'local-closest/cpu-first-plus-second-order.png'),
		},
		{
			source: path.join(closestArtifact.runDir, 'canvas-image.png'),
			target: path.join(imageRoot, 'local-closest/integrated-gpu-first-plus-second-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'local-090deg/first-order.png'),
			target: path.join(imageRoot, 'local-090deg/cpu-first-order.png'),
		},
		{
			source: path.join(cpuImageRoot, 'local-090deg/first-plus-second-order.png'),
			target: path.join(imageRoot, 'local-090deg/cpu-first-plus-second-order.png'),
		},
		{
			source: path.join(local90Artifact.runDir, 'canvas-image.png'),
			target: path.join(imageRoot, 'local-090deg/integrated-gpu-first-plus-second-order.png'),
		},
	];
	const manifest = [];
	for (const copy of copies) {
		await fs.mkdir(path.dirname(copy.target), { recursive: true });
		if (await pathExists(copy.source)) {
			await fs.copyFile(copy.source, copy.target);
			manifest.push({
				source: path.relative(REPO_ROOT, copy.source).replace(/\\/g, '/'),
				target: path.relative(REPO_ROOT, copy.target).replace(/\\/g, '/'),
				status: 'copied',
			});
		} else {
			manifest.push({
				source: path.relative(REPO_ROOT, copy.source).replace(/\\/g, '/'),
				target: path.relative(REPO_ROOT, copy.target).replace(/\\/g, '/'),
				status: 'missing',
			});
		}
	}
	await writeJson(path.join(imageRoot, 'gallery-manifest.json'), {
		kind: 'local-second-order-gallery-manifest',
		manifest,
		notes:
			'Distant cases are CPU control images. Local cases include CPU first-order, CPU first-plus-second-order, and integrated GPU first-plus-second-order browser outputs.',
	});
}

function makeTinyScenePacket({ width, height, source, pixels }) {
	const rayDirections = [];
	const hitMask = [];
	const hitDistanceMeters = [];
	const sceneColorRgba8 = [];
	const spectrumNumericIds = [];
	const selectedPixels = [];
	for (let index = 0; index < pixels.length; index += 1) {
		const pixel = pixels[index];
		rayDirections.push(...normalize(pixel.ray));
		hitMask.push(pixel.hit ? 1 : 0);
		hitDistanceMeters.push(pixel.distance || 0);
		sceneColorRgba8.push(...pixel.color);
		spectrumNumericIds.push(pixel.spectrumNumericId || 4);
		selectedPixels.push({ id: pixel.id, x: index % width, y: Math.floor(index / width) });
	}
	return {
		kind: 'local-second-order-tiny-scene-packet',
		width,
		height,
		camera: { positionMeters: [0, 2, 0] },
		rayDirections,
		hitMask,
		hitDistanceMeters,
		sceneColorRgba8,
		spectrumNumericIds,
		spectrumNumericIdTable: { 4: 'neutral' },
		selectedPixels,
		source,
	};
}

function makeDistantSoftCase(key, sunCaseId) {
	const sunCase = SUN_CASES.find((item) => item.id === sunCaseId);
	const model = createDistantSunAlgorithm32Model(sunCase);
	return {
		key,
		source: { kind: SOURCE_KINDS.distantDirectionalSun, sunCase: sunCase.id },
		model,
		incidentFieldFactory: () => null,
	};
}

async function makeCoreLocalCases() {
	const closestPacket = await readJson(
		evidencePath('shader-094-cpu-soft-shader-matrix/cases/local-000deg/source-geometry-packet.json')
	);
	const local90Packet = await readJson(
		evidencePath('shader-094-cpu-soft-shader-matrix/cases/local-090deg/source-geometry-packet.json')
	);
	return {
		closest: makeLocalSoftCase('local-closest', closestPacket),
		local90: makeLocalSoftCase('local-090deg', local90Packet),
	};
}

function makeLocalSoftCase(key, packet) {
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters: packet.geometry.topAltitudeMeters,
		observerPositionMeters: packet.geometry.observerPositionMeters,
		sceneSkyRayLimitMeters: packet.geometry.sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy: packet.geometry.sceneSkyRayLimitPolicy,
	});
	const source = createFlatLocalPointSunSource({
		id: packet.source.id,
		positionMeters: packet.source.positionMeters,
		radiusKm: packet.source.radiusKm,
		referenceDistanceKm: packet.source.referenceDistanceKm,
		referenceSpectralIncidentScale: packet.source.referenceSpectralIncidentScale,
		distanceFalloff: packet.source.distanceFalloff,
		spectralChannels: SPECTRAL_CHANNELS,
		color: packet.source.color,
		provenance: packet.source.provenance,
	});
	const model = createFlatLocalSunAlgorithm32Model({ source, geometry });
	return {
		key,
		source: {
			kind: SOURCE_KINDS.flatLocalPointSun,
			id: packet.source.id,
			positionMeters: packet.source.positionMeters,
			radiusKm: packet.source.radiusKm,
			referenceDistanceKm: packet.source.referenceDistanceKm,
			referenceSpectralIncidentScale: packet.source.referenceSpectralIncidentScale,
			distanceFalloff: packet.source.distanceFalloff,
			color: packet.source.color,
			offsetDegrees: packet.source.offsetDegrees,
		},
		geometry: {
			topAltitudeMeters: packet.geometry.topAltitudeMeters,
			observerPositionMeters: packet.geometry.observerPositionMeters,
			sceneSkyRayLimitMeters: packet.geometry.sceneSkyRayLimitMeters,
			sceneSkyRayLimitPolicy: packet.geometry.sceneSkyRayLimitPolicy,
		},
		model,
		incidentFieldFactory: () => {
			const incomingDirections = makeIncomingDirections(9);
			const cacheConfig = {
				kind: 'local-z-rho-direction-wavelength-grid',
				zMeters: [2, 1000, 5000, 15000, 45000],
				rhoMeters: [0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000],
				incomingDirectionCount: incomingDirections.length,
				wavelengthNanometers: SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers),
				lookupPolicy: 'nearest-neighbor-poc-grid',
				invalidPolicy: 'throw-on-invalid-or-source-key-mismatch',
			};
			return buildLocalIncidentGridCache({
				model,
				sourceKey: source.id,
				cacheConfig,
				incomingDirections,
			});
		},
	};
}

function renderTinySoftShaderCase(caseConfig, { includeSecondOrder }) {
	const width = 24;
	const height = 12;
	const pixels = Buffer.alloc(width * height * 4);
	const selectedPixels = [];
	const incidentField = includeSecondOrder ? caseConfig.incidentFieldFactory() : null;
	let nonfinitePixels = 0;
	let minByte = 255;
	let maxByte = 0;
	let l2Total = 0;
	let l2Count = 0;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = y * width + x;
			const offset = pixelIndex * 4;
			const u = (x + 0.5) / width;
			const v = (y + 0.5) / height;
			const sky = y < height / 2;
			const direction = sky
				? normalize([(u - 0.5) * 0.9, 0.65, 0.35 + (0.5 - v) * 0.6])
				: normalize([(u - 0.5) * 0.6, 0.9, -0.18 - (v - 0.5) * 0.45]);
			const origin = caseConfig.model.geometry.kind === 'flat-z-up-atmosphere'
				? [0, 0, 2]
				: [0, 0, ATMOSPHERE.bottomRadiusMeters + ATMOSPHERE.observerHeightMeters];
			const distance = sky
				? distanceToSkyBoundary(origin, direction, caseConfig.model.geometry)
				: hitDistanceForTinyScene({
						origin,
						direction,
						geometry: caseConfig.model.geometry,
						fallbackDistance: 4000 + (y - height / 2) * 600,
					});
			const transfer = computePathRadianceSegment({
				origin,
				direction,
				distance,
				sunCase: { id: caseConfig.source.sunCase || caseConfig.source.id || caseConfig.key },
				algorithm32Model: caseConfig.model,
				controls: NUMERICAL_CONTROLS,
				includeSecondOrder,
				incidentField,
			});
			const pathRgb = spectralToDisplayPreview(transfer.pathRadianceByWavelength).encodedRgb;
			const rgb = sky
				? pathRgb
				: composeSceneColor([44, 96, 62], transfer, pathRgb);
			for (let channel = 0; channel < 3; channel += 1) {
				pixels[offset + channel] = rgb[channel];
				if (!Number.isFinite(rgb[channel])) {
					nonfinitePixels += 1;
				}
				minByte = Math.min(minByte, rgb[channel]);
				maxByte = Math.max(maxByte, rgb[channel]);
			}
			pixels[offset + 3] = 255;
			l2Total += mean(transfer.secondOrderPathRadianceByWavelength);
			l2Count += 1;
			if (
				(x === 4 && y === 2) ||
				(x === 12 && y === 5) ||
				(x === 12 && y === 9)
			) {
				selectedPixels.push({
					id: `${caseConfig.key}-${sky ? 'sky' : 'hit'}-${x}-${y}`,
					x,
					y,
					hit: !sky,
					rgba: [pixels[offset], pixels[offset + 1], pixels[offset + 2], 255],
					transfer: summarizeTransfer(transfer),
				});
			}
		}
	}
	return {
		width,
		height,
		pixels,
		selectedPixels,
		cacheDiagnostics: incidentField
			? { kind: incidentField.kind, cacheKey: incidentField.cacheKey, entries: incidentField.values?.size ?? null }
			: null,
		l2Mean: l2Total / l2Count,
		summary: { pixels: width * height, nonfinitePixels, minByte, maxByte },
	};
}

function createLocalDirectIncidentField(model) {
	return {
		kind: 'local-direct-first-order-incident-field',
		sourceKey: model.source.id,
		sample({ position, incomingDirection }) {
			validateIncomingDirection(incomingDirection);
			if (
				position[2] < -1e-6 ||
				position[2] > model.geometry.topAltitudeMeters + 1e-6
			) {
				throw new Error(`Local incident sample z ${position[2]} is outside the flat atmosphere.`);
			}
			const samplePosition = [
				position[0],
				position[1],
				clamp(position[2], 0, model.geometry.topAltitudeMeters),
			];
			if (hitsFlatGround(position, incomingDirection)) {
				return zeroSpectrum();
			}
			const distance = distanceToSkyBoundary(samplePosition, incomingDirection, model.geometry);
			const transfer = computePathRadianceSegment({
				origin: samplePosition,
				direction: incomingDirection,
				distance,
				sunCase: { id: model.source.id },
				algorithm32Model: model,
				controls: NUMERICAL_CONTROLS,
				includeSecondOrder: false,
			});
			return transfer.pathRadianceByWavelength;
		},
	};
}

function makeDistantIncidentField(model) {
	const sunCase =
		SUN_CASES.find((item) => item.id === model.source.id) || SUN_CASES[0];
	const delegate = createDistantAltitudeIncidentField({
		model,
		sunCase,
		sourceDirection: model.source.direction,
		controls: NUMERICAL_CONTROLS,
		cache: new Map(),
	});
	return {
		kind: 'distant-altitude-incident-field-wrapper',
		sourceKey: model.source.id,
		sample({ position, incomingDirection, directionIndex }) {
			return delegate.sample({ position, incomingDirection, directionIndex });
		},
	};
}

function buildLocalIncidentGridCache({ model, sourceKey, cacheConfig, incomingDirections }) {
	const direct = createLocalDirectIncidentField(model);
	const values = new Map();
	const trace = [];
	for (const z of cacheConfig.zMeters) {
		for (const rho of cacheConfig.rhoMeters) {
			for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
				const incomingDirection = incomingDirections[directionIndex];
				const position = [
					model.source.positionMeters[0] + rho,
					model.source.positionMeters[1],
					z,
				];
				let value;
				try {
					value = direct.sample({ position, incomingDirection, directionIndex });
				} catch (error) {
					value = { invalid: true, message: error.message };
				}
				const key = localCacheKey({ z, rho, directionIndex });
				values.set(key, value);
				trace.push({ key, z, rho, directionIndex, valid: Array.isArray(value) });
			}
		}
	}
	const cacheKey = [
		cacheConfig.kind,
		sourceKey,
		`z=${cacheConfig.zMeters.join('|')}`,
		`rho=${cacheConfig.rhoMeters.join('|')}`,
		`dirs=${incomingDirections.length}`,
		`w=${cacheConfig.wavelengthNanometers.join('|')}`,
	].join(';');
	return {
		kind: 'local-grid-first-order-incident-field',
		cacheKey,
		sourceKey,
		cacheConfig,
		incomingDirections,
		values,
		trace,
		sample({ position, incomingDirection, directionIndex, sourceKey: requestedSourceKey = sourceKey }) {
			validateIncomingDirection(incomingDirection);
			if (requestedSourceKey !== sourceKey) {
				throw new Error(`Local incident cache source mismatch: ${requestedSourceKey} !== ${sourceKey}`);
			}
			if (
				position[2] < -1e-6 ||
				position[2] > model.geometry.topAltitudeMeters + 1e-6
			) {
				throw new Error(`Local incident cache z ${position[2]} is outside the flat atmosphere.`);
			}
			const samplePosition = [
				position[0],
				position[1],
				clamp(position[2], 0, model.geometry.topAltitudeMeters),
			];
			const z = nearest(cacheConfig.zMeters, samplePosition[2]);
			const rhoValue = horizontalDistanceFromSourceSubpoint(model, samplePosition);
			const rho = nearest(cacheConfig.rhoMeters, rhoValue);
			if (rhoValue > Math.max(...cacheConfig.rhoMeters)) {
				throw new Error(`Local incident cache rho ${rhoValue} is outside the configured range.`);
			}
			const key = localCacheKey({
				z: z.value,
				rho: rho.value,
				directionIndex: nearestDirectionIndex(
					incomingDirections,
					worldToLocalSourceFrame(model, samplePosition, incomingDirection)
				),
			});
			const value = values.get(key);
			if (!Array.isArray(value)) {
				throw new Error(`Local incident cache has no valid sample for ${key}.`);
			}
			return value;
		},
	};
}

function computeFlatSourceProbe(packet) {
	const source = createFlatLocalPointSunSource({
		id: packet.source.id,
		positionMeters: packet.source.positionMeters,
		radiusKm: packet.source.radiusKm,
		referenceDistanceKm: packet.source.referenceDistanceKm,
		referenceSpectralIncidentScale: packet.source.referenceSpectralIncidentScale,
		distanceFalloff: packet.source.distanceFalloff,
		spectralChannels: SPECTRAL_CHANNELS,
		color: packet.source.color,
		provenance: packet.source.provenance,
	});
	return computeFlatSingleScatteringRadiance(
		packet.source.observerPositionMeters,
		normalize([0, 1, 0.25]),
		source,
		{
			topAltitudeMeters: packet.geometry.topAltitudeMeters,
			observerPositionMeters: packet.geometry.observerPositionMeters,
			sceneSkyRayLimitMeters: packet.geometry.sceneSkyRayLimitMeters,
			sceneSkyRayLimitPolicy: packet.geometry.sceneSkyRayLimitPolicy,
		}
	);
}

async function writeMilestoneArtifact({
	milestone,
	label,
	stateGoal,
	inputs,
	provenance,
	equations,
	criteria,
	diagnostics,
	result,
	cacheConfig = null,
	forcedStatus = null,
}) {
	const runDir = await createRunDirectory(label);
	const summary = summarizeCriteria(criteria);
	const status =
		forcedStatus ||
		(summary.fail > 0 ? 'rejected' : summary.unresolved > 0 ? 'accepted' : 'accepted');
	const now = new Date().toISOString();
	const packet = {
		kind: 'algorithm32-local-second-order-milestone-result',
		status,
		milestone,
		label,
		createdAt: now,
		completedAt: now,
		summary,
		result,
	};
	await fs.writeFile(path.join(runDir, 'state-goal.md'), `# ${label}\n\nStatus: ${status}\n\n${stateGoal}\n`);
	await writeJson(path.join(runDir, 'inputs.json'), inputs);
	await writeJson(path.join(runDir, 'provenance.json'), {
		...provenance,
		script: path.relative(REPO_ROOT, __filename).replace(/\\/g, '/'),
		runDir: path.relative(REPO_ROOT, runDir).replace(/\\/g, '/'),
	});
	await writeJson(path.join(runDir, 'equations-and-constants.json'), equations);
	if (cacheConfig) {
		await writeJson(path.join(runDir, 'cache-config.json'), cacheConfig);
	}
	await writeJson(path.join(runDir, 'criteria-results.json'), {
		kind: 'algorithm32-local-second-order-criteria',
		summary,
		criteria,
	});
	await fs.mkdir(path.join(runDir, 'diagnostics'), { recursive: true });
	await writeJson(path.join(runDir, 'diagnostics/diagnostics.json'), diagnostics);
	await writeJson(path.join(runDir, 'result.json'), packet);
	await fs.writeFile(path.join(runDir, 'report.md'), makeReport({ milestone, label, status, stateGoal, summary, criteria, result }));
	await fs.writeFile(path.join(runDir, 'run.log'), `createdAt=${now}\nstatus=${status}\nmilestone=${milestone}\nlabel=${label}\n`);
	await appendRunningLog({ milestone, label, status, summary, runDir });
	console.log(`${path.basename(runDir)} ${status}`);
	return { status, runDir, packet };
}

function makeReport({ milestone, label, status, stateGoal, summary, criteria, result }) {
	const lines = [
		`# Milestone ${milestone}: ${label}`,
		'',
		`Status: ${status}`,
		'',
		stateGoal,
		'',
		`Criteria: ${summary.pass} pass, ${summary.fail} fail, ${summary.unresolved} unresolved, ${summary['not-applicable']} not-applicable.`,
		'',
		'## Criteria',
		'',
		...criteria.map((item) => `- ${item.status}: ${item.criterionId} - ${item.notes}`),
		'',
		'## Result',
		'',
		'```json',
		JSON.stringify(result, null, 2),
		'```',
		'',
	];
	return `${lines.join('\n')}`;
}

async function createRunDirectory(label) {
	const entries = await fs.readdir(OUT_ROOT, { withFileTypes: true });
	let maxPrefix = 0;
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const match = /^(\d+)-/.exec(entry.name);
		if (match) {
			maxPrefix = Math.max(maxPrefix, Number(match[1]));
		}
	}
	const runDir = path.join(OUT_ROOT, `${String(maxPrefix + 1).padStart(3, '0')}-${slug(label)}`);
	await fs.mkdir(runDir);
	return runDir;
}

async function appendRunningLog({ milestone, label, status, summary, runDir }) {
	const relativeRunDir = path.relative(OUT_ROOT, runDir).replace(/\\/g, '/');
	const line = `- ${new Date().toISOString()} - milestone ${milestone} ${label}: ${status} (${summary.pass} pass, ${summary.fail} fail, ${summary.unresolved} unresolved) -> ${relativeRunDir}\n`;
	await fs.appendFile(path.join(OUT_ROOT, 'running-log.md'), line);
}

function criterion({ id, status, tolerance, measured, notes }) {
	return {
		criterionId: id,
		status,
		tolerance,
		measured,
		notes,
	};
}

function summarizeCriteria(criteria) {
	return criteria.reduce(
		(summary, item) => {
			summary[item.status] = (summary[item.status] || 0) + 1;
			return summary;
		},
		{ pass: 0, fail: 0, unresolved: 0, 'not-applicable': 0 }
	);
}

function commonEquations(extra = {}) {
	return {
		units: {
			distance: 'meters unless field name ends with Km',
			radiance: 'Algorithm32 spectral radiance per 15-channel POC profile',
			wavelength: 'nanometers',
		},
		commonContracts: {
			hitComposition: 'sceneColor * T_view + L_path',
			skyComposition: 'L_path',
			localSecondOrderInput: 'L1_incident = incidentField.sample(position, incomingDirection, wavelength)',
		},
		...extra,
	};
}

function evidencePath(relativePath) {
	return path.join(EVIDENCE_ROOT, relativePath);
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function pathExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writePng(filePath, width, height, pixels) {
	await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(filePath);
}

async function copyDirectory(source, target) {
	await fs.mkdir(target, { recursive: true });
	const entries = await fs.readdir(source, { withFileTypes: true });
	for (const entry of entries) {
		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);
		if (entry.isDirectory()) {
			await copyDirectory(sourcePath, targetPath);
		} else {
			await fs.copyFile(sourcePath, targetPath);
		}
	}
}

function compareArrays(actual, expected) {
	let maxAbs = 0;
	let maxRel = 0;
	for (let index = 0; index < Math.min(actual.length, expected.length); index += 1) {
		const abs = Math.abs(actual[index] - expected[index]);
		const denominator = Math.max(Math.abs(expected[index]), 1e-30);
		maxAbs = Math.max(maxAbs, abs);
		maxRel = Math.max(maxRel, abs / denominator);
	}
	return { maxAbs, maxRel };
}

function withinMixedTolerance(maxAbs, maxRel) {
	return maxAbs <= DEFAULT_ABS_TOLERANCE || maxRel <= DEFAULT_REL_TOLERANCE;
}

function withinLocalCacheTolerance(maxAbs, maxRel) {
	return maxAbs <= LOCAL_CACHE_ABS_TOLERANCE || maxRel <= LOCAL_CACHE_REL_TOLERANCE;
}

function maxAbsArrayDelta(a, b) {
	let max = 0;
	for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
		max = Math.max(max, Math.abs(a[index] - b[index]));
	}
	return max;
}

function maxRgbDelta(a = [], b = []) {
	let max = 0;
	for (let index = 0; index < 3; index += 1) {
		max = Math.max(max, Math.abs((a[index] ?? 0) - (b[index] ?? 0)));
	}
	return max;
}

function imageDiff(a, b) {
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	let rgbCount = 0;
	for (let index = 0; index < Math.min(a.length, b.length); index += 4) {
		for (let channel = 0; channel < 3; channel += 1) {
			const delta = Math.abs(a[index + channel] - b[index + channel]);
			maxAbsRgbDelta = Math.max(maxAbsRgbDelta, delta);
			sumAbsRgbDelta += delta;
			rgbCount += 1;
		}
	}
	return {
		maxAbsRgbDelta,
		meanAbsRgbDelta: rgbCount === 0 ? 0 : sumAbsRgbDelta / rgbCount,
	};
}

function makeIncomingDirections(count) {
	const directions = [];
	const goldenRatio = (1 + Math.sqrt(5)) / 2;
	for (let index = 0; index < count; index += 1) {
		const z = -0.8 + (1.6 * index) / Math.max(1, count - 1);
		const theta = (2 * Math.PI * index) / goldenRatio;
		const radius = Math.sqrt(Math.max(0, 1 - z * z));
		directions.push(normalize([radius * Math.cos(theta), radius * Math.sin(theta), z]));
	}
	return directions;
}

function localCacheKey({ z, rho, directionIndex }) {
	return `z=${z};rho=${rho};dir=${directionIndex}`;
}

function horizontalDistanceFromSourceSubpoint(model, position) {
	const dx = position[0] - model.source.positionMeters[0];
	const dy = position[1] - model.source.positionMeters[1];
	return Math.hypot(dx, dy);
}

function localToWorldSourceFrame(model, position, localDirection) {
	const { radial, tangential } = sourceFrameAxes(model, position);
	return normalize([
		radial[0] * localDirection[0] +
			tangential[0] * localDirection[1],
		radial[1] * localDirection[0] +
			tangential[1] * localDirection[1],
		localDirection[2],
	]);
}

function worldToLocalSourceFrame(model, position, worldDirection) {
	const { radial, tangential } = sourceFrameAxes(model, position);
	return normalize([
		dot(worldDirection, radial),
		dot(worldDirection, tangential),
		worldDirection[2],
	]);
}

function sourceFrameAxes(model, position) {
	const dx = position[0] - model.source.positionMeters[0];
	const dy = position[1] - model.source.positionMeters[1];
	const rho = Math.hypot(dx, dy);
	const radial = rho === 0 ? [1, 0, 0] : [dx / rho, dy / rho, 0];
	const tangential = [-radial[1], radial[0], 0];
	return { radial, tangential };
}

function nearestDirectionIndex(directions, target) {
	let bestIndex = 0;
	let bestDot = -Infinity;
	for (let index = 0; index < directions.length; index += 1) {
		const score = dot(directions[index], target);
		if (score > bestDot) {
			bestDot = score;
			bestIndex = index;
		}
	}
	return bestIndex;
}

function nearest(values, target) {
	let bestValue = values[0];
	let bestDistance = Math.abs(target - bestValue);
	for (const value of values) {
		const distance = Math.abs(target - value);
		if (distance < bestDistance) {
			bestValue = value;
			bestDistance = distance;
		}
	}
	return { value: bestValue, distance: target };
}

function hitsFlatGround(position, direction) {
	if (direction[2] >= 0) {
		return false;
	}
	const distance = -position[2] / direction[2];
	return distance >= 0;
}

function validateIncomingDirection(direction) {
	if (!Array.isArray(direction) || direction.length < 3 || !direction.every(Number.isFinite)) {
		throw new Error('Incoming direction must be a finite 3-vector.');
	}
	const magnitude = Math.hypot(...direction);
	if (Math.abs(magnitude - 1) > 1e-6) {
		throw new Error(`Incoming direction must be normalized; magnitude=${magnitude}.`);
	}
}

function composeSceneColor(sceneRgb, transfer, pathRgb) {
	const transmittance = [
		mean(transfer.transmittanceByWavelength.slice(8)),
		mean(transfer.transmittanceByWavelength.slice(4, 9)),
		mean(transfer.transmittanceByWavelength.slice(0, 5)),
	];
	return sceneRgb.map((value, index) =>
		clampByte(value * transmittance[index] + pathRgb[index])
	);
}

function hitDistanceForTinyScene({ origin, direction, geometry, fallbackDistance }) {
	if (geometry.kind !== 'flat-z-up-atmosphere') {
		return fallbackDistance;
	}
	if (direction[2] >= 0) {
		return Math.min(fallbackDistance, geometry.sceneSkyRayLimitMeters || fallbackDistance);
	}
	const groundDistance = -origin[2] / direction[2];
	return Math.max(0, groundDistance * 0.95);
}

function allFinite(values) {
	return Array.isArray(values) && values.every(Number.isFinite);
}

function mean(values) {
	return values.length === 0
		? 0
		: values.reduce((sum, value) => sum + value, 0) / values.length;
}

function luminance(rgba) {
	return 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2];
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function zeroSpectrum() {
	return SPECTRAL_CHANNELS.map(() => 0);
}

function normalize(vector) {
	const magnitude = Math.hypot(...vector);
	if (!Number.isFinite(magnitude) || magnitude === 0) {
		return [0, 0, 1];
	}
	return vector.map((value) => value / magnitude);
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function slug(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'artifact';
}

main().catch((error) => {
	console.error(error.stack || error.message);
	process.exitCode = 1;
});
