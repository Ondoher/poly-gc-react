import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	ATMOSPHERE,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
	SUN_CASES,
	runNodeThreeReference,
	sunDirection,
} from './node-three-reference.js';
import {
	createAlgorithm32Model,
	createDistantDirectionalSunSource,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	createSphericalAtmosphereGeometry,
	makeShaderSourcePacket,
} from './algorithm32-source-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const SCRIPT_PATH = path.relative(REPO_ROOT, __filename).replaceAll('\\', '/');
const DISTANT_CASE_ID = 'figure1-13h15-z21';

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU source-contract shader-packet dry run.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');

	await fs.mkdir(casesRoot, { recursive: true });
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const distantModel = buildDistantModel();
	const distantPacket = makeShaderSourcePacket(distantModel);
	const distantRoundtripModel = rehydrateModelFromPacket(distantPacket);
	log(runLog, 'Built and rehydrated distant directional Sun packet.');

	const localSource = await buildLocalPacket(options.outRoot);
	log(
		runLog,
		localSource
			? `Built local point Sun packet from ${localSource.sourceArtifact}.`
			: 'No accepted local-source diagnostic artifact was available for a local packet.'
	);

	const roundtripComparison = await buildRoundtripComparison({
		options,
		artifact,
		casesRoot,
		distantModel,
		distantRoundtripModel,
	});
	log(runLog, 'Completed distant packet CPU renderer round-trip run.');

	const unsupportedFeatureReport = buildUnsupportedFeatureReport({
		distantPacket,
		localPacket: localSource?.packet || null,
		localSourceArtifact: localSource?.sourceArtifact || null,
	});
	const criteria = evaluateCriteria({
		distantPacket,
		localPacket: localSource?.packet || null,
		roundtripComparison,
		unsupportedFeatureReport,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const packet = {
		kind: 'algorithm32-cpu-source-contract-shader-packet-result',
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
		distantPacket,
		localPacket: localSource?.packet || null,
		roundtripComparison,
		unsupportedFeatureReport,
		criteria,
		summary,
		packet,
		runLog,
	});

	console.log(`CPU source-contract shader packet ${packet.status}: ${artifact.directory}`);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-source-contract-shader-packet',
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = slug(argv[index + 1]);
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
	console.log(`Algorithm32 CPU source-contract shader packet dry run

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-source-contract-shader-packet.js

Options:
  --out-root <path>   Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>      Artifact folder label.
`);
}

function buildDistantModel() {
	const sunCase = SUN_CASES.find((item) => item.id === DISTANT_CASE_ID);

	if (!sunCase) {
		throw new Error(`Missing Sun case ${DISTANT_CASE_ID}.`);
	}

	return createAlgorithm32Model({
		geometry: createSphericalAtmosphereGeometry({ atmosphere: ATMOSPHERE }),
		source: createDistantDirectionalSunSource({
			sunCase,
			direction: sunDirection(sunCase),
			spectralChannels: SPECTRAL_CHANNELS,
		}),
		spectralProfile: spectralProfile(),
		numericalConfig: NUMERICAL_CONTROLS,
	});
}

async function buildLocalPacket(outRoot) {
	const localArtifact = await findLatestAcceptedArtifact({
		outRoot,
		label: 'cpu-local-source-first-order-diagnostics',
	});

	if (!localArtifact) {
		return null;
	}

	const diagnostics = await readJson(
		path.join(localArtifact.directory, 'local-source-diagnostics.json')
	);
	const localCase = diagnostics.cases.find(
		(item) => item.required && item.offsetDegrees === 0
	);

	if (!localCase) {
		throw new Error(`Missing required 0 degree local-source case in ${localArtifact.relativeFolder}.`);
	}

	const model = modelFromSourceContractSummary(localCase.sourceContract);

	return {
		sourceArtifact: localArtifact.relativeFolder,
		caseId: localCase.caseId,
		packet: makeShaderSourcePacket(model),
	};
}

function modelFromSourceContractSummary(summary) {
	const sourceSummary = summary.source;
	const geometry = sourceSummary.kind === 'flat-local-point-sun'
		? createFlatZUpAtmosphereGeometry({
				topAltitudeMeters: summary.geometry.topAltitudeMeters,
				observerPositionMeters: summary.geometry.observerPositionMeters,
			})
		: summary.geometry;
	const source =
		sourceSummary.kind === 'flat-local-point-sun'
			? createFlatLocalPointSunSource({
					id: sourceSummary.id,
					positionMeters: sourceSummary.positionMeters,
					radiusKm: sourceSummary.radiusKm,
					referenceDistanceKm: sourceSummary.referenceDistanceKm,
					referenceSpectralIncidentScale:
						sourceSummary.referenceSpectralIncidentScale,
					distanceFalloff: sourceSummary.distanceFalloff,
					spectralChannels: SPECTRAL_CHANNELS,
					color: sourceSummary.color,
					provenance: sourceSummary.provenance,
				})
			: createDistantDirectionalSunSource({
					sunCase: { id: sourceSummary.id },
					direction: sourceSummary.direction,
					spectralChannels: SPECTRAL_CHANNELS,
				});

	return createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: spectralProfile(),
		numericalConfig: summary.numericalConfig,
	});
}

function rehydrateModelFromPacket(packet) {
	const source =
		packet.sourceKind === 'flat-local-point-sun'
			? createFlatLocalPointSunSource({
					id: packet.source.id,
					positionMeters: packet.source.positionMeters,
					radiusKm: packet.source.radiusKm,
					referenceDistanceKm: packet.source.referenceDistanceKm,
					referenceSpectralIncidentScale:
						packet.source.referenceSpectralIncidentScale,
					distanceFalloff: packet.source.distanceFalloff,
					spectralChannels: spectralChannelsFromPacket(packet),
					color: packet.source.color,
					provenance: packet.source.provenance,
				})
			: createDistantDirectionalSunSource({
					sunCase: { id: packet.source.id },
					direction: packet.source.direction,
					spectralChannels: spectralChannelsFromPacket(packet),
				});
	const geometry =
		packet.geometryKind === 'flat-z-up-atmosphere'
			? createFlatZUpAtmosphereGeometry({
					topAltitudeMeters: packet.geometry.topAltitudeMeters,
					observerPositionMeters: packet.geometry.observerPositionMeters,
				})
			: packet.geometry;

	return createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: packet.spectralProfile,
		numericalConfig: packet.numericalConfig,
	});
}

async function buildRoundtripComparison({
	options,
	artifact,
	casesRoot,
	distantModel,
	distantRoundtripModel,
}) {
	const milestone8 = await findLatestAcceptedArtifact({
		outRoot: options.outRoot,
		label: 'cpu-source-contract-distant-sun',
	});

	if (!milestone8) {
		throw new Error('Missing accepted Milestone 8 distant-Sun artifact.');
	}

	const reference037 = path.join(
		options.outRoot,
		'037-algorithm32-simple-card-reference'
	);
	const run = await runNodeThreeReference(
		[
			'--out-root',
			casesRoot,
			'--label',
			'distant-directional-sun-packet-roundtrip',
			'--width',
			'240',
			'--height',
			'120',
			'--compare-reference',
			reference037,
		],
		{ algorithm32Model: distantRoundtripModel }
	);
	const runDir = run.artifact.directory;
	const sourceContractComparison = await readJson(
		path.join(runDir, 'source-contract-comparison.json')
	);
	const result = await readJson(path.join(runDir, 'result.json'));
	const sourceTraceComparison = await compareJsonFiles({
		referencePath: path.join(milestone8.directory, 'source-sample-traces.json'),
		currentPath: path.join(runDir, 'source-sample-traces.json'),
	});
	const selectedComparison = await compareJsonFiles({
		referencePath: path.join(milestone8.directory, 'selected-pixels.json'),
		currentPath: path.join(runDir, 'selected-pixels.json'),
	});
	const imageComparison = await compareReferenceImage({
		referenceImagePath: path.join(milestone8.directory, 'reference-image.png'),
		currentImagePath: path.join(runDir, 'reference-image.png'),
	});
	const sourceSampleComparison = compareSourceSamples({
		originalModel: distantModel,
		roundtripModel: distantRoundtripModel,
	});

	return {
		kind: 'algorithm32-cpu-source-contract-shader-packet-roundtrip-comparison',
		artifactFolder: artifact.relativeFolder,
		roundtripRunDir: path.relative(REPO_ROOT, runDir).replaceAll('\\', '/'),
		milestone8Reference: milestone8.relativeFolder,
		rendererRoundtrip: {
			status: result.status,
			summary: result.summary,
			sourceContractComparisonSummary: comparisonSummary(sourceContractComparison),
		},
		milestone8Comparisons: {
			imageComparison,
			selectedComparison,
			sourceTraceComparison,
		},
		sourceSampleComparison,
	};
}

function compareSourceSamples({ originalModel, roundtripModel }) {
	const positions = [
		{
			id: 'observer',
			positionMeters: [0, 0, ATMOSPHERE.bottomRadiusMeters + 2],
		},
		{
			id: 'ten-km-altitude',
			positionMeters: [0, 0, ATMOSPHERE.bottomRadiusMeters + 10000],
		},
	];

	return {
		samples: positions.map((position) => {
			const original = originalModel.sampleSource(position.positionMeters);
			const roundtrip = roundtripModel.sampleSource(position.positionMeters);

			return {
				id: position.id,
				positionMeters: position.positionMeters,
				sourceKind: roundtrip.kind,
				directionMaxAbsDelta: maxAbsDelta(
					original.direction,
					roundtrip.direction
				),
				incidentScaleAbsDelta: Math.abs(
					original.incidentScale - roundtrip.incidentScale
				),
				spectralIncidentScaleMaxAbsDelta: maxAbsDelta(
					original.spectralIncidentScaleByWavelength,
					roundtrip.spectralIncidentScaleByWavelength
				),
				distanceKindMatches:
					original.distanceKind === roundtrip.distanceKind,
				sourcePathPolicyMatches:
					original.sourcePathPolicy === roundtrip.sourcePathPolicy,
			};
		}),
	};
}

function buildUnsupportedFeatureReport({
	distantPacket,
	localPacket,
	localSourceArtifact,
}) {
	return {
		kind: 'algorithm32-cpu-source-contract-shader-packet-unsupported-feature-report',
		distantDirectionalSun: {
			sourceKind: distantPacket.sourceKind,
			secondOrderCacheCompatibility: 'compatible-with-current-distant-directional-cache',
			unsupportedFeatures: distantPacket.unsupportedFeatures,
		},
		flatLocalPointSun: localPacket
			? {
					sourceKind: localPacket.sourceKind,
					sourceArtifact: localSourceArtifact,
					secondOrderCacheCompatibility: 'unsupported',
					unsupportedFeatures: localPacket.unsupportedFeatures,
				}
			: null,
		futureShaderMilestone:
			'packed distant-Sun source contract parity in the browser shader',
	};
}

function evaluateCriteria({
	distantPacket,
	localPacket,
	roundtripComparison,
	unsupportedFeatureReport,
}) {
	const criteria = [];

	criteria.push(
		criterion({
			id: 'distant-packet-pure-data',
			status: isPureData(distantPacket) ? 'pass' : 'fail',
			tolerance: {
				forbidden: [
					'functions',
					'closures',
					'WebGL handles',
					'Three private texture ids',
					'renderer-owned state',
				],
			},
			measured: pureDataSummary(distantPacket),
			notes:
				'The distant-Sun packet is plain JSON-compatible source, geometry, spectral, and numerical data.',
		})
	);

	criteria.push(
		criterion({
			id: 'distant-packet-source-sample-roundtrip',
			status: sourceSampleRoundtripPasses(roundtripComparison) ? 'pass' : 'fail',
			tolerance: {
				directionMaxAbsDelta: 0,
				incidentScaleAbsDelta: 0,
				spectralIncidentScaleMaxAbsDelta: 0,
				distanceKind: 'matches',
				sourcePathPolicy: 'matches',
			},
			measured: roundtripComparison.sourceSampleComparison,
			notes:
				'The packet rehydrates into the same distant-directional source samples used by the CPU renderer.',
		})
	);

	criteria.push(
		criterion({
			id: 'distant-packet-cpu-renderer-roundtrip',
			status: rendererRoundtripPasses(roundtripComparison) ? 'pass' : 'fail',
			tolerance: {
				rendererStatus: 'accepted',
				imageRawRgba: 'exact against Milestone 8',
				selectedDiagnosticsJson: 'exact against Milestone 8',
				sourceSampleTraceJson: 'exact against Milestone 8',
				reference037Comparison: 'all source-contract comparison criteria pass',
			},
			measured: roundtripComparison,
			notes:
				'The rehydrated distant-Sun packet drives the CPU renderer with no output change.',
		})
	);

	criteria.push(
		criterion({
			id: 'distant-packet-second-order-compatible',
			status:
				distantPacket.sourceKind === 'distant-directional-sun' &&
				distantPacket.unsupportedFeatures.length === 0 &&
				distantPacket.numericalConfig.secondOrderIncomingDirections > 0
					? 'pass'
					: 'fail',
			tolerance: {
				sourceKind: 'distant-directional-sun',
				unsupportedFeatures: [],
				secondOrderIncomingDirections: 'positive',
			},
			measured: {
				sourceKind: distantPacket.sourceKind,
				unsupportedFeatures: distantPacket.unsupportedFeatures,
				numericalConfig: distantPacket.numericalConfig,
			},
			notes:
				'The current second-order cache remains compatible with the distant directional Sun packet.',
		})
	);

	criteria.push(
		criterion({
			id: 'local-packet-unsupported-features-explicit',
			status: localPacketUnsupportedFeaturesPass(localPacket) ? 'pass' : 'fail',
			tolerance: {
				localPacket: 'present after Milestone 10',
				requiredUnsupportedFeature: 'local-source-second-order-cache',
				noSilentDistantSunFallback: true,
			},
			measured: unsupportedFeatureReport.flatLocalPointSun,
			notes:
				'Unsupported local-source shader behavior is explicit in packet metadata.',
		})
	);

	criteria.push(
		criterion({
			id: 'local-packet-pure-data',
			status: localPacket && isPureData(localPacket) ? 'pass' : 'fail',
			tolerance: {
				forbidden: [
					'functions',
					'closures',
					'WebGL handles',
					'Three private texture ids',
					'renderer-owned state',
				],
			},
			measured: localPacket ? pureDataSummary(localPacket) : { present: false },
			notes:
				'The local-source packet is also plain JSON-compatible data.',
		})
	);

	criteria.push(
		criterion({
			id: 'future-browser-shader-milestone-named',
			status:
				unsupportedFeatureReport.futureShaderMilestone ===
				'packed distant-Sun source contract parity in the browser shader'
					? 'pass'
					: 'fail',
			tolerance: {
				futureShaderMilestone:
					'packed distant-Sun source contract parity in the browser shader',
			},
			measured: {
				futureShaderMilestone: unsupportedFeatureReport.futureShaderMilestone,
			},
			notes:
				'This dry run stops before GLSL uniform layout, texture upload, or browser shader implementation.',
		})
	);

	return criteria;
}

function sourceSampleRoundtripPasses(roundtripComparison) {
	return roundtripComparison.sourceSampleComparison.samples.every(
		(sample) =>
			sample.directionMaxAbsDelta === 0 &&
			sample.incidentScaleAbsDelta === 0 &&
			sample.spectralIncidentScaleMaxAbsDelta === 0 &&
			sample.distanceKindMatches &&
			sample.sourcePathPolicyMatches
	);
}

function rendererRoundtripPasses(roundtripComparison) {
	return (
		roundtripComparison.rendererRoundtrip.status === 'accepted' &&
		roundtripComparison.milestone8Comparisons.imageComparison.matches &&
		roundtripComparison.milestone8Comparisons.selectedComparison.matches &&
		roundtripComparison.milestone8Comparisons.sourceTraceComparison.matches &&
		Object.values(roundtripComparison.rendererRoundtrip.sourceContractComparisonSummary)
			.every((value) => value === true || value === 0)
	);
}

function localPacketUnsupportedFeaturesPass(localPacket) {
	if (!localPacket) {
		return false;
	}

	const unsupportedIds = localPacket.unsupportedFeatures.map((item) => item.id);

	return (
		localPacket.sourceKind === 'flat-local-point-sun' &&
		unsupportedIds.includes('local-source-second-order-cache') &&
		unsupportedIds.includes('local-source-direct-solar-disc-camera-radiance') &&
		unsupportedIds.includes('local-source-ground-bounce')
	);
}

async function writeArtifact({
	artifact,
	options,
	distantPacket,
	localPacket,
	roundtripComparison,
	unsupportedFeatureReport,
	criteria,
	summary,
	packet,
	runLog,
}) {
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-cpu-source-contract-shader-packet-command',
		scriptPath: SCRIPT_PATH,
		options,
	});
	await writeJson(
		path.join(
			artifact.directory,
			'source-contract-shader-packet.distant-directional-sun.json'
		),
		distantPacket
	);

	if (localPacket) {
		await writeJson(
			path.join(
				artifact.directory,
				'source-contract-shader-packet.flat-local-point-sun.json'
			),
			localPacket
		);
	}

	await writeJson(
		path.join(artifact.directory, 'roundtrip-comparison.json'),
		roundtripComparison
	);
	await writeJson(
		path.join(artifact.directory, 'unsupported-feature-report.json'),
		unsupportedFeatureReport
	);
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-cpu-source-contract-shader-packet-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({
		artifact,
		summary,
		roundtripComparison,
		unsupportedFeatureReport,
		localPacket,
	}));
	await fs.copyFile(__filename, path.join(artifact.directory, 'script-snapshot.js'));
}

function makeReport({
	artifact,
	summary,
	roundtripComparison,
	unsupportedFeatureReport,
	localPacket,
}) {
	return [
		'# CPU Source Contract Shader Packet',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This CPU-only dry run serializes the source/geometry/spectral/numerical contract into JSON packets. It does not define a GLSL uniform layout, upload textures, or run the browser shader path.',
		'',
		'## Round Trip',
		'',
		`- Rehydrated distant-Sun run: \`${roundtripComparison.roundtripRunDir}\``,
		`- Milestone 8 reference: \`${roundtripComparison.milestone8Reference}\``,
		`- Renderer status: ${roundtripComparison.rendererRoundtrip.status}`,
		'',
		'## Packets',
		'',
		'- `source-contract-shader-packet.distant-directional-sun.json`',
		localPacket
			? '- `source-contract-shader-packet.flat-local-point-sun.json`'
			: '- Local packet missing because no accepted Milestone 10 artifact was found.',
		'',
		'## Unsupported Features',
		'',
		`- Local second-order cache: ${unsupportedFeatureReport.flatLocalPointSun?.secondOrderCacheCompatibility || 'not available'}`,
		'- Direct local solar-disc camera radiance and local ground bounce remain deferred.',
		'',
		'## Next Shader Milestone',
		'',
		`Future work: ${unsupportedFeatureReport.futureShaderMilestone}.`,
		'',
	].join('\n');
}

function spectralProfile() {
	return {
		spectralChannelCount: SPECTRAL_CHANNELS.length,
		wavelengthNanometers: SPECTRAL_CHANNELS.map(
			(channel) => channel.wavelengthNanometers
		),
		solarIrradianceByWavelength: SPECTRAL_CHANNELS.map(
			(channel) => channel.solarIrradiance
		),
	};
}

function spectralChannelsFromPacket(packet) {
	return SPECTRAL_CHANNELS.map((channel, index) => ({
		...channel,
		wavelengthNanometers: packet.spectralProfile.wavelengthNanometers[index],
		solarIrradiance:
			packet.spectralProfile.solarIrradianceByWavelength[index],
	}));
}

function comparisonSummary(comparison) {
	return {
		imageMatches: comparison.imageComparison.matches,
		imageMaxAbsByteDelta: comparison.imageComparison.maxAbsByteDelta,
		selectedMatches: comparison.selectedComparison.matches,
		geometryMatches: comparison.geometryComparison.matches,
		transportMatches: comparison.transportComparison.matches,
		criteriaMatches: comparison.criteriaComparison.matches,
	};
}

async function compareReferenceImage({ referenceImagePath, currentImagePath }) {
	const reference = await sharp(referenceImagePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const current = await sharp(currentImagePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const sameShape =
		reference.info.width === current.info.width &&
		reference.info.height === current.info.height &&
		reference.info.channels === current.info.channels &&
		reference.data.length === current.data.length;
	let differentBytes = 0;
	let maxAbsByteDelta = 0;

	if (sameShape) {
		for (let index = 0; index < reference.data.length; index += 1) {
			const delta = Math.abs(reference.data[index] - current.data[index]);

			if (delta !== 0) {
				differentBytes += 1;
				maxAbsByteDelta = Math.max(maxAbsByteDelta, delta);
			}
		}
	}

	return {
		referenceImagePath: path.relative(REPO_ROOT, referenceImagePath).replaceAll('\\', '/'),
		currentImagePath: path.relative(REPO_ROOT, currentImagePath).replaceAll('\\', '/'),
		width: current.info.width,
		height: current.info.height,
		referenceWidth: reference.info.width,
		referenceHeight: reference.info.height,
		sameShape,
		differentBytes: sameShape ? differentBytes : null,
		maxAbsByteDelta: sameShape ? maxAbsByteDelta : null,
		matches: sameShape && differentBytes === 0,
	};
}

async function compareJsonFiles({ referencePath, currentPath }) {
	const reference = await readJson(referencePath);
	const current = await readJson(currentPath);
	const referenceCanonical = stableJson(reference);
	const currentCanonical = stableJson(current);

	return {
		referencePath: path.relative(REPO_ROOT, referencePath).replaceAll('\\', '/'),
		currentPath: path.relative(REPO_ROOT, currentPath).replaceAll('\\', '/'),
		matches: referenceCanonical === currentCanonical,
		summary: {
			referenceBytes: referenceCanonical.length,
			currentBytes: currentCanonical.length,
			sameCanonicalJson: referenceCanonical === currentCanonical,
		},
	};
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

function rendererOwnedState(value) {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const keys = Object.keys(value);

	return keys.some(
		(key) =>
			key.startsWith('__') ||
			key === 'uuid' ||
			key === 'texture' ||
			key === 'webglTexture' ||
			key === 'renderer'
	);
}

function isPureData(value, seen = new Set()) {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return Number.isNaN(value) ? false : true;
	}
	if (
		typeof value === 'undefined' ||
		typeof value === 'function' ||
		typeof value === 'symbol' ||
		typeof value === 'bigint'
	) {
		return false;
	}
	if (seen.has(value) || rendererOwnedState(value)) {
		return false;
	}

	seen.add(value);

	if (Array.isArray(value)) {
		return value.every((item) => isPureData(item, seen));
	}

	if (Object.getPrototypeOf(value) !== Object.prototype) {
		return false;
	}

	return Object.values(value).every((item) => isPureData(item, seen));
}

function pureDataSummary(value) {
	return {
		present: Boolean(value),
		jsonSerializable: JSON.parse(JSON.stringify(value)) !== null,
		pureData: isPureData(value),
		topLevelKeys: value && typeof value === 'object' ? Object.keys(value) : [],
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

function stableJson(value) {
	return JSON.stringify(sortJson(value));
}

function sortJson(value) {
	if (Array.isArray(value)) {
		return value.map(sortJson);
	}
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, sortJson(value[key])])
		);
	}

	return value;
}

function maxAbsDelta(left, right) {
	return left.reduce(
		(maxDelta, value, index) => Math.max(maxDelta, Math.abs(value - right[index])),
		0
	);
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

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
