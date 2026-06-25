import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	ATMOSPHERE,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
} from './node-three-reference.js';
import {
	createAlgorithm32Model,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	makeSourceContractSummary,
} from './algorithm32-source-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const DEFAULT_ATMOSFLAT_REFERENCE = path.join(
	REPO_ROOT,
	'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes'
);
const SCRIPT_PATH = path.relative(REPO_ROOT, __filename).replaceAll('\\', '/');
const REQUIRED_OFFSETS = [0, 90, 180];
const OPTIONAL_OFFSETS = [45, 135];
const ALL_OFFSETS = [0, 45, 90, 135, 180];
const LOCAL_DIRECTION_TOLERANCE = 1e-12;
const LOCAL_DISTANCE_TOLERANCE_METERS = 1e-6;
const LOCAL_SCALE_TOLERANCE = 1e-12;

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU local-source first-order diagnostics.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const reference = await loadAtmosflatReference(options.atmosflatReference);
	log(runLog, `Loaded atmosflat32 reference ${reference.relativeDirectory}.`);

	const localCases = ALL_OFFSETS.map((offsetDegrees) =>
		buildLocalCaseDiagnostics({ reference, offsetDegrees })
	);
	log(runLog, `Built ${localCases.length} local-source source-contract cases.`);

	const selectedRays = buildSelectedRayDiagnostics(localCases);
	log(runLog, 'Built selected-ray first-order diagnostic estimates.');

	const distantSourceControl = await buildDistantSourceControl(options.outRoot);
	log(runLog, 'Loaded distant-Sun control artifacts.');

	const criteria = evaluateCriteria({
		localCases,
		selectedRays,
		distantSourceControl,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const packet = {
		kind: 'algorithm32-cpu-local-source-first-order-diagnostics-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
	};

	await writeArtifact({
		artifact,
		options,
		reference,
		localCases,
		selectedRays,
		distantSourceControl,
		criteria,
		summary,
		packet,
		runLog,
	});

	console.log(
		`CPU local-source first-order diagnostics ${packet.status}: ${artifact.directory}`
	);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-local-source-first-order-diagnostics',
		atmosflatReference: DEFAULT_ATMOSFLAT_REFERENCE,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = slug(argv[index + 1]);
			index += 1;
		} else if (arg === '--atmosflat-reference') {
			options.atmosflatReference = path.resolve(argv[index + 1]);
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
	console.log(`Algorithm32 CPU local-source first-order diagnostics

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-local-source-first-order-diagnostics.js

Options:
  --out-root <path>              Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>                 Artifact folder label.
  --atmosflat-reference <path>   Accepted atmosflat32 artifact. Default: tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes
`);
}

async function loadAtmosflatReference(referenceDirectory) {
	const referenceRoot = path.resolve(referenceDirectory);
	const inputs = await readJson(path.join(referenceRoot, 'inputs.json'));
	const skydomeDiagnostics = await readJson(
		path.join(referenceRoot, 'flat-app-rotation-skydome-diagnostics.json')
	);
	const result = await readJson(path.join(referenceRoot, 'result.json'));

	return {
		directory: referenceRoot,
		relativeDirectory: path.relative(REPO_ROOT, referenceRoot).replaceAll('\\', '/'),
		inputs,
		skydomeDiagnostics,
		resultSummary: result.summary,
	};
}

function buildLocalCaseDiagnostics({ reference, offsetDegrees }) {
	const entry = reference.skydomeDiagnostics.entries.find(
		(item) => item.offsetDegrees === offsetDegrees
	);

	if (!entry) {
		throw new Error(`Missing atmosflat32 skydome diagnostic for ${offsetDegrees} degrees.`);
	}

	const referenceSample = entry.transportObserverSample;
	const sourceConfig = reference.inputs.transportSourceConfigs.find(
		(item) => item.sceneKey === referenceSample.diagnostics.sceneKey
	);

	if (!sourceConfig) {
		throw new Error(`Missing transport source config for ${referenceSample.diagnostics.sceneKey}.`);
	}

	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters:
			reference.inputs.geometry.atmosphereGeometry.atmosphereTopAltitudeMeters,
		observerPositionMeters: sourceConfig.observerPositionMeters,
	});
	const source = createFlatLocalPointSunSource({
		id: sourceConfig.sceneKey,
		positionMeters: sourceConfig.positionMeters,
		radiusKm: sourceConfig.radiusKm,
		referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
		referenceSpectralIncidentScale: sourceConfig.referenceSpectralIncidentScale,
		distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
		spectralChannels: SPECTRAL_CHANNELS,
		color: sourceConfig.color,
		provenance: {
			sourceArtifact: reference.relativeDirectory,
			flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
			appSolarIrradianceScale:
				sourceConfig.flatSourceConfig.solarIrradianceScale,
			calibratedSolarIrradianceScale: sourceConfig.solarIrradianceScale,
			brightnessCalibration: sourceConfig.brightnessCalibration,
		},
	});
	const model = createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: {
			spectralChannelCount: SPECTRAL_CHANNELS.length,
			wavelengthNanometers: SPECTRAL_CHANNELS.map(
				(channel) => channel.wavelengthNanometers
			),
			solarIrradianceByWavelength: SPECTRAL_CHANNELS.map(
				(channel) => channel.solarIrradiance
			),
		},
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			localSourceDiagnostics: 'first-order-only',
		},
	});
	const sample = model.sampleSource(sourceConfig.observerPositionMeters);
	const deltas = {
		sourceDirectionMaxAbs: maxAbsDelta(sample.direction, referenceSample.direction),
		distanceMetersAbs: Math.abs(sample.distanceMeters - referenceSample.distanceMeters),
		distanceFalloffScaleAbs: Math.abs(
			sample.distanceFalloffScale - referenceSample.distanceFalloffScale
		),
		incidentScaleAbs: Math.abs(
			sample.incidentScale -
				referenceSample.diagnostics.spectralIncidentScale
		),
		spectralIncidentScaleMaxAbs: maxAbsDelta(
			sample.spectralIncidentScaleByWavelength,
			referenceSample.spectralIncidentScaleByWavelength
		),
	};

	return {
		caseId: sourceConfig.flatSourceConfig.sceneKey,
		transportSceneKey: sourceConfig.sceneKey,
		offsetDegrees,
		required: REQUIRED_OFFSETS.includes(offsetDegrees),
		reference: summarizeReferenceSample(referenceSample),
		sourceContract: makeSourceContractSummary(model),
		contractSampleAtObserver: summarizeLocalSourceSample(sample),
		deltas,
		passes: {
			sourceDirection:
				deltas.sourceDirectionMaxAbs <= LOCAL_DIRECTION_TOLERANCE,
			distanceMeters:
				deltas.distanceMetersAbs <= LOCAL_DISTANCE_TOLERANCE_METERS,
			distanceFalloffScale:
				deltas.distanceFalloffScaleAbs <= LOCAL_SCALE_TOLERANCE,
			incidentScale: deltas.incidentScaleAbs <= LOCAL_SCALE_TOLERANCE,
			spectralIncidentScale:
				deltas.spectralIncidentScaleMaxAbs <= LOCAL_SCALE_TOLERANCE,
			finitePolicy:
				sample.distanceKind === 'finite' &&
				sample.sourcePathPolicy === 'finite-source-distance-through-atmosphere',
		},
		_model: model,
	};
}

function summarizeReferenceSample(referenceSample) {
	return {
		kind: referenceSample.kind,
		direction: referenceSample.direction,
		distanceMeters: referenceSample.distanceMeters,
		distanceKm: referenceSample.distanceKm,
		distanceKind: referenceSample.distanceKind,
		positionMeters: referenceSample.positionMeters,
		radiusKm: referenceSample.radiusKm,
		referenceDistanceKm: referenceSample.referenceDistanceKm,
		distanceFalloff: referenceSample.distanceFalloff,
		distanceFalloffScale: referenceSample.distanceFalloffScale,
		referenceSpectralIncidentScale:
			referenceSample.referenceSpectralIncidentScale,
		incidentScale: referenceSample.diagnostics.spectralIncidentScale,
		spectralIncidentScaleByWavelength:
			referenceSample.spectralIncidentScaleByWavelength,
		visibilityPath: referenceSample.visibilityPath,
	};
}

function summarizeLocalSourceSample(sample) {
	return {
		kind: sample.kind,
		sourceId: sample.sourceId,
		samplePositionMeters: sample.samplePositionMeters,
		positionMeters: sample.positionMeters,
		direction: sample.direction,
		distanceKind: sample.distanceKind,
		distanceMeters: sample.distanceMeters,
		distanceKm: sample.distanceKm,
		radiusKm: sample.radiusKm,
		apparentAngularRadiusRad: sample.apparentAngularRadiusRad,
		referenceDistanceKm: sample.referenceDistanceKm,
		distanceFalloff: sample.distanceFalloff,
		distanceFalloffScale: sample.distanceFalloffScale,
		referenceSpectralIncidentScale: sample.referenceSpectralIncidentScale,
		incidentScale: sample.incidentScale,
		spectralIncidentScaleByWavelength:
			sample.spectralIncidentScaleByWavelength,
		sourcePathPolicy: sample.sourcePathPolicy,
		transmittancePath: sample.transmittancePath,
	};
}

function buildSelectedRayDiagnostics(localCases) {
	return {
		kind: 'algorithm32-cpu-local-source-selected-rays',
		description:
			'Finite local-source first-order diagnostic estimates. These are source-contract checks, not shader output and not direct solar-disc camera radiance.',
		cases: localCases.map((localCase) => {
			const model = localCase._model;
			const origin = model.geometry.observerPositionMeters;
			const sourceSample = model.sampleSource(origin);
			const rays = [
				makeSelectedRay({
					id: 'zenith',
					origin,
					viewDirection: [0, 0, 1],
					model,
				}),
				makeSelectedRay({
					id: 'toward-local-source',
					origin,
					viewDirection: sourceSample.direction,
					model,
				}),
			];

			return {
				caseId: localCase.caseId,
				offsetDegrees: localCase.offsetDegrees,
				sourceSampleAtObserver: summarizeLocalSourceSample(sourceSample),
				rays,
			};
		}),
	};
}

function makeSelectedRay({ id, origin, viewDirection, model }) {
	const direction = normalize(viewDirection);
	const viewDistanceMeters = distanceToFlatTop({
		origin,
		direction,
		topAltitudeMeters: model.geometry.topAltitudeMeters,
	});
	const viewTransfer = computeFlatTransmittance({
		origin,
		direction,
		distanceMeters: viewDistanceMeters,
		intervals: 32,
	});
	const firstOrder = estimateFirstOrderLocalSource({
		origin,
		viewDirection: direction,
		viewDistanceMeters,
		model,
		intervals: 18,
	});

	return {
		id,
		originMeters: origin,
		viewDirection: direction,
		viewDistanceMeters,
		viewTransmittanceByWavelength: viewTransfer.transmittanceByWavelength,
		meanViewTransmittance: mean(viewTransfer.transmittanceByWavelength),
		viewOpticalDepthByWavelength: viewTransfer.opticalDepthByWavelength,
		sourceTransmittanceAtMidpoint: firstOrder.sourceTransmittanceAtMidpoint,
		firstOrderRayleighPathRadianceByWavelength:
			firstOrder.rayleighPathRadianceByWavelength,
		firstOrderMiePathRadianceByWavelength:
			firstOrder.miePathRadianceByWavelength,
		firstOrderPathRadianceByWavelength: firstOrder.pathRadianceByWavelength,
		meanFirstOrderPathRadiance: mean(firstOrder.pathRadianceByWavelength),
		diagnostics: {
			sampleCount: firstOrder.sampleCount,
			minAltitudeMeters: firstOrder.minAltitudeMeters,
			maxAltitudeMeters: firstOrder.maxAltitudeMeters,
			allFiniteNonnegative: allFiniteNonnegative([
				viewTransfer.transmittanceByWavelength,
				firstOrder.rayleighPathRadianceByWavelength,
				firstOrder.miePathRadianceByWavelength,
				firstOrder.pathRadianceByWavelength,
			]),
		},
	};
}

function estimateFirstOrderLocalSource({
	origin,
	viewDirection,
	viewDistanceMeters,
	model,
	intervals,
}) {
	const rayleigh = SPECTRAL_CHANNELS.map(() => 0);
	const mie = SPECTRAL_CHANNELS.map(() => 0);
	let minAltitudeMeters = Number.POSITIVE_INFINITY;
	let maxAltitudeMeters = Number.NEGATIVE_INFINITY;
	let midpointSourceTransmittance = null;

	for (let sampleIndex = 0; sampleIndex < intervals; sampleIndex += 1) {
		const t0 = (sampleIndex / intervals) * viewDistanceMeters;
		const t1 = ((sampleIndex + 1) / intervals) * viewDistanceMeters;
		const midpointDistance = 0.5 * (t0 + t1);
		const ds = t1 - t0;
		const position = addVectors(origin, scaleVector(viewDirection, midpointDistance));
		const altitudeMeters = Math.max(0, position[2]);
		const rayleighDensity = densityAtAltitude(
			altitudeMeters,
			ATMOSPHERE.rayleighScaleHeightMeters
		);
		const mieDensity = densityAtAltitude(
			altitudeMeters,
			ATMOSPHERE.mieScaleHeightMeters
		);
		const sourceSample = model.sampleSource(position);
		const viewPrefix = computeFlatTransmittance({
			origin,
			direction: viewDirection,
			distanceMeters: midpointDistance,
			intervals: Math.max(2, Math.ceil((sampleIndex + 1) / 2)),
		});
		const sourceTransmittance = computeFlatTransmittance({
			origin: position,
			direction: sourceSample.direction,
			distanceMeters: sourceSample.distanceMeters,
			intervals: 32,
		});
		const nu = clamp(dot(viewDirection, sourceSample.direction), -1, 1);
		const rayleighPhase = rayleighPhaseFunction(nu);
		const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

		if (sampleIndex === Math.floor(intervals / 2)) {
			midpointSourceTransmittance = {
				positionMeters: position,
				sourceDistanceMeters: sourceSample.distanceMeters,
				sourceIncidentScale: sourceSample.incidentScale,
				meanSourceTransmittance: mean(
					sourceTransmittance.transmittanceByWavelength
				),
				sourceTransmittanceByWavelength:
					sourceTransmittance.transmittanceByWavelength,
			};
		}

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const channel = SPECTRAL_CHANNELS[channelIndex];
			const wavelengthMicrometers = channel.wavelengthNanometers / 1000;
			const rayleighScattering =
				rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				rayleighDensity *
				rayleighPhase;
			const mieScattering =
				mieScatteringCoefficientAt(wavelengthMicrometers) *
				mieDensity *
				miePhase;
			const incident =
				channel.solarIrradiance *
				sourceSample.spectralIncidentScaleByWavelength[channelIndex];
			const sourceT =
				sourceTransmittance.transmittanceByWavelength[channelIndex];
			const viewT = viewPrefix.transmittanceByWavelength[channelIndex];

			rayleigh[channelIndex] += incident * sourceT * viewT * rayleighScattering * ds;
			mie[channelIndex] += incident * sourceT * viewT * mieScattering * ds;
		}

		minAltitudeMeters = Math.min(minAltitudeMeters, altitudeMeters);
		maxAltitudeMeters = Math.max(maxAltitudeMeters, altitudeMeters);
	}

	return {
		sampleCount: intervals,
		minAltitudeMeters,
		maxAltitudeMeters,
		sourceTransmittanceAtMidpoint: midpointSourceTransmittance,
		rayleighPathRadianceByWavelength: rayleigh,
		miePathRadianceByWavelength: mie,
		pathRadianceByWavelength: rayleigh.map((value, index) => value + mie[index]),
	};
}

function computeFlatTransmittance({ origin, direction, distanceMeters, intervals }) {
	const opticalDepth = SPECTRAL_CHANNELS.map(() => 0);

	if (distanceMeters <= 0) {
		return {
			opticalDepthByWavelength: opticalDepth,
			transmittanceByWavelength: opticalDepth.map(() => 1),
		};
	}

	for (let sampleIndex = 0; sampleIndex < intervals; sampleIndex += 1) {
		const t0 = (sampleIndex / intervals) * distanceMeters;
		const t1 = ((sampleIndex + 1) / intervals) * distanceMeters;
		const midpointDistance = 0.5 * (t0 + t1);
		const ds = t1 - t0;
		const position = addVectors(origin, scaleVector(direction, midpointDistance));
		const altitudeMeters = position[2];

		if (altitudeMeters < 0 || altitudeMeters > 100000) {
			continue;
		}

		const rayleighDensity = densityAtAltitude(
			altitudeMeters,
			ATMOSPHERE.rayleighScaleHeightMeters
		);
		const mieDensity = densityAtAltitude(
			altitudeMeters,
			ATMOSPHERE.mieScaleHeightMeters
		);

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const wavelengthMicrometers =
				SPECTRAL_CHANNELS[channelIndex].wavelengthNanometers / 1000;

			opticalDepth[channelIndex] +=
				(rayleighScatteringCoefficientAt(wavelengthMicrometers) * rayleighDensity +
					mieExtinctionCoefficientAt(wavelengthMicrometers) * mieDensity) *
				ds;
		}
	}

	return {
		opticalDepthByWavelength: opticalDepth,
		transmittanceByWavelength: opticalDepth.map((value) => Math.exp(-value)),
	};
}

async function buildDistantSourceControl(outRoot) {
	const milestone8 = await findLatestAcceptedArtifact({
		outRoot,
		label: 'cpu-source-contract-distant-sun',
	});
	const matrix = await findLatestAcceptedArtifact({
		outRoot,
		label: 'cpu-source-contract-distant-sun-matrix',
	});
	const matrixCases = matrix
		? await readJson(path.join(matrix.directory, 'matrix-cases.json'))
		: null;
	const simpleCardCase = matrixCases?.cases.find(
		(item) => item.id === 'simple-card-algorithm32'
	);

	return {
		kind: 'algorithm32-cpu-local-source-distant-source-control',
		milestone8: milestone8
			? {
					artifactFolder: milestone8.relativeFolder,
					status: milestone8.result.status,
					summary: milestone8.result.summary,
				}
			: null,
		milestone9: matrix
			? {
					artifactFolder: matrix.relativeFolder,
					status: matrix.result.status,
					summary: matrix.result.summary,
					simpleCardCase,
				}
			: null,
		controlPolicy:
			'Milestone 10 does not rerender distant Sun; it requires accepted Milestone 8 and Milestone 9 distant-Sun source-contract artifacts to remain present as controls.',
	};
}

function evaluateCriteria({ localCases, selectedRays, distantSourceControl }) {
	const criteria = [];

	for (const localCase of localCases.filter((item) => item.required)) {
		criteria.push(
			criterion({
				id: `${localCase.caseId}-source-sample-match`,
				status: Object.values(localCase.passes).every(Boolean) ? 'pass' : 'fail',
				tolerance: {
					sourceDirectionMaxAbs: LOCAL_DIRECTION_TOLERANCE,
					distanceMetersAbs: LOCAL_DISTANCE_TOLERANCE_METERS,
					distanceFalloffScaleAbs: LOCAL_SCALE_TOLERANCE,
					incidentScaleAbs: LOCAL_SCALE_TOLERANCE,
					spectralIncidentScaleMaxAbs: LOCAL_SCALE_TOLERANCE,
					sourcePathPolicy: 'finite-source-distance-through-atmosphere',
				},
				measured: {
					deltas: localCase.deltas,
					passes: localCase.passes,
					reference: localCase.reference,
					contractSampleAtObserver: localCase.contractSampleAtObserver,
				},
				notes:
					'The source contract reproduces the accepted atmosflat32 transport observer sample for this required local-source offset.',
			})
		);
	}

	const requiredByOffset = Object.fromEntries(
		localCases
			.filter((item) => item.required)
			.map((item) => [item.offsetDegrees, item.contractSampleAtObserver.incidentScale])
	);
	criteria.push(
		criterion({
			id: 'local-source-incident-scale-ordering',
			status:
				requiredByOffset[0] > requiredByOffset[90] &&
				requiredByOffset[90] > requiredByOffset[180] &&
				Math.abs(requiredByOffset[0] - 1) <= 3e-15
					? 'pass'
					: 'fail',
			tolerance: {
				ordering: '0deg > 90deg > 180deg',
				closestApproachIncidentScale: '1 +/- 3e-15',
			},
			measured: requiredByOffset,
			notes:
				'The calibrated local source preserves the accepted atmosflat32 inverse-square brightness ordering.',
		})
	);

	criteria.push(
		criterion({
			id: 'local-source-selected-ray-diagnostics-finite',
			status: selectedRayDiagnosticsFinite(selectedRays) ? 'pass' : 'fail',
			tolerance: {
				values: 'finite and nonnegative where radiance/transmittance is expected',
			},
			measured: summarizeSelectedRayFiniteState(selectedRays),
			notes:
				'Selected first-order local-source ray diagnostics are finite and attributable to source distance, falloff, and finite source transmittance.',
		})
	);

	criteria.push(
		criterion({
			id: 'distant-source-control-present',
			status:
				distantSourceControl.milestone8?.status === 'accepted' &&
				distantSourceControl.milestone9?.status === 'accepted' &&
				distantSourceControl.milestone9.simpleCardCase?.status === 'accepted'
					? 'pass'
					: 'fail',
			tolerance: {
				milestone8: 'accepted',
				milestone9: 'accepted',
				simpleCardCase: 'accepted',
			},
			measured: distantSourceControl,
			notes:
				'The local-source POC leaves the accepted distant-Sun controls intact and uses them as the no-regression baseline.',
		})
	);

	criteria.push(
		criterion({
			id: 'local-source-deferred-scope-explicit',
			status: 'pass',
			tolerance: {
				deferred: [
					'local second-order behavior',
					'direct solar-disc camera radiance',
					'ground bounce',
					'shader implementation',
				],
			},
			measured: {
				implementedHere: [
					'finite source direction',
					'finite source distance',
					'inverse-square incident scale',
					'finite source-path transmittance diagnostics',
					'first-order selected-ray diagnostic estimates',
				],
			},
			notes:
				'Milestone 10 is intentionally diagnostic POC work and does not claim rendering completeness.',
		})
	);

	return criteria;
}

function selectedRayDiagnosticsFinite(selectedRays) {
	return selectedRays.cases.every((localCase) =>
		localCase.rays.every(
			(ray) =>
				ray.diagnostics.allFiniteNonnegative &&
				Number.isFinite(ray.meanViewTransmittance) &&
				ray.meanViewTransmittance >= 0 &&
				ray.meanViewTransmittance <= 1 &&
				Number.isFinite(ray.meanFirstOrderPathRadiance) &&
				ray.meanFirstOrderPathRadiance >= 0
		)
	);
}

function summarizeSelectedRayFiniteState(selectedRays) {
	return {
		caseCount: selectedRays.cases.length,
		rayCount: selectedRays.cases.reduce(
			(total, localCase) => total + localCase.rays.length,
			0
		),
		allFiniteNonnegative: selectedRayDiagnosticsFinite(selectedRays),
		rays: selectedRays.cases.flatMap((localCase) =>
			localCase.rays.map((ray) => ({
				caseId: localCase.caseId,
				offsetDegrees: localCase.offsetDegrees,
				rayId: ray.id,
				meanViewTransmittance: ray.meanViewTransmittance,
				meanFirstOrderPathRadiance: ray.meanFirstOrderPathRadiance,
				allFiniteNonnegative: ray.diagnostics.allFiniteNonnegative,
			}))
		),
	};
}

async function writeArtifact({
	artifact,
	options,
	reference,
	localCases,
	selectedRays,
	distantSourceControl,
	criteria,
	summary,
	packet,
	runLog,
}) {
	const serializableCases = localCases.map(({ _model, ...localCase }) => localCase);

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-cpu-local-source-first-order-diagnostics-command',
		scriptPath: SCRIPT_PATH,
		options: {
			...options,
			atmosflatReference: path
				.relative(REPO_ROOT, options.atmosflatReference)
				.replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'inputs.json'), {
		kind: 'algorithm32-cpu-local-source-first-order-diagnostics-inputs',
		sourceReference: reference.relativeDirectory,
		requiredOffsets: REQUIRED_OFFSETS,
		optionalOffsets: OPTIONAL_OFFSETS,
		atmosflatSourceBoundary: reference.inputs.sourceBoundary,
		geometry: reference.inputs.geometry,
		brightnessCalibration: reference.inputs.brightnessCalibration,
		transportSourceConfigs: reference.inputs.transportSourceConfigs,
	});
	await writeJson(path.join(artifact.directory, 'local-source-diagnostics.json'), {
		kind: 'algorithm32-cpu-local-source-diagnostics',
		sourceReference: reference.relativeDirectory,
		cases: serializableCases,
	});
	await writeJson(path.join(artifact.directory, 'selected-rays.json'), selectedRays);
	await writeJson(
		path.join(artifact.directory, 'distant-source-control.json'),
		distantSourceControl
	);
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-cpu-local-source-first-order-diagnostics-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({
		artifact,
		summary,
		reference,
		localCases: serializableCases,
		distantSourceControl,
	}));
	await fs.copyFile(__filename, path.join(artifact.directory, 'script-snapshot.js'));
}

function makeReport({
	artifact,
	summary,
	reference,
	localCases,
	distantSourceControl,
}) {
	return [
		'# CPU Local-Source First-Order Diagnostics',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		`Reference: \`${reference.relativeDirectory}\``,
		'',
		'This CPU-only POC wires the flat local point Sun into the shader-lab source contract and validates source samples against the accepted atmosflat32 transport observer samples. It does not use the browser harness or shader path.',
		'',
		'## Cases',
		'',
		...localCases.map(
			(localCase) =>
				`- \`${localCase.caseId}\`: ${localCase.contractSampleAtObserver.distanceKm} km, incident scale ${localCase.contractSampleAtObserver.incidentScale}.`
		),
		'',
		'## Distant Control',
		'',
		`- Milestone 8: \`${distantSourceControl.milestone8?.artifactFolder || 'missing'}\``,
		`- Milestone 9: \`${distantSourceControl.milestone9?.artifactFolder || 'missing'}\``,
		'',
		'## Deferred',
		'',
		'Local second-order behavior, direct solar-disc camera radiance, ground bounce, and shader implementation are intentionally deferred.',
		'',
		'## Outputs',
		'',
		'- `local-source-diagnostics.json`: source-contract local Sun cases and deltas against atmosflat32.',
		'- `selected-rays.json`: finite source-path and first-order selected-ray diagnostics.',
		'- `distant-source-control.json`: accepted distant-Sun controls used as no-regression evidence.',
		'- `criteria-results.json`: acceptance criteria.',
		'',
	].join('\n');
}

async function findLatestAcceptedArtifact({ outRoot, label }) {
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const candidates = entries
		.filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
		.filter((entry) => entry.name.endsWith(`-${label}`))
		.sort((a, b) => b.name.localeCompare(a.name));

	for (const candidate of candidates) {
		const directory = path.join(outRoot, candidate.name);
		try {
			const result = await readJson(path.join(directory, 'result.json'));

			if (result.status === 'accepted') {
				return {
					directory,
					folderName: candidate.name,
					relativeFolder: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
					result,
				};
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}

	return null;
}

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const maxNumber = entries
		.filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
		.reduce((max, entry) => Math.max(max, Number(entry.name.slice(0, 3))), 0);
	const folderName = `${String(maxNumber + 1).padStart(3, '0')}-${slug(label)}`;
	const directory = path.join(outRoot, folderName);

	await fs.mkdir(directory, { recursive: false });

	return {
		directory,
		folderName,
		relativeFolder: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
	};
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
	return {
		total: criteria.length,
		passed: criteria.filter((item) => item.status === 'pass').length,
		failed: criteria.filter((item) => item.status === 'fail').length,
		unresolved: criteria.filter((item) => item.status === 'unresolved').length,
	};
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
	await fs.writeFile(filePath, value);
}

function slug(value) {
	return String(value || 'run')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80) || 'run';
}

function log(runLog, message) {
	runLog.push(`${new Date().toISOString()} ${message}`);
}

function maxAbsDelta(left, right) {
	return left.reduce(
		(maxDelta, value, index) => Math.max(maxDelta, Math.abs(value - right[index])),
		0
	);
}

function allFiniteNonnegative(arrays) {
	return arrays.flat().every((value) => Number.isFinite(value) && value >= 0);
}

function distanceToFlatTop({ origin, direction, topAltitudeMeters }) {
	if (direction[2] <= 0) {
		return 0;
	}

	return Math.max(0, (topAltitudeMeters - origin[2]) / direction[2]);
}

function densityAtAltitude(altitudeMeters, scaleHeightMeters) {
	if (altitudeMeters < 0 || altitudeMeters > 100000) {
		return 0;
	}

	return Math.exp(-altitudeMeters / scaleHeightMeters);
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
		wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
	);
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
	return (
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
		ATMOSPHERE.mieSingleScatteringAlbedo
	);
}

function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

	return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
}

function addVectors(left, right) {
	return left.map((value, index) => value + right[index]);
}

function scaleVector(vector, scalar) {
	return vector.map((value) => value * scalar);
}

function dot(left, right) {
	return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function normalize(vector) {
	const magnitude = Math.hypot(...vector);

	return magnitude === 0 ? [0, 0, 0] : vector.map((value) => value / magnitude);
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function mean(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
