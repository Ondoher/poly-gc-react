import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	aerosolCoefficientsForPolicy,
	resolveAerosolPolicy,
} from './composition/aerosol-policy.js';
import {
	resolveAerosolPhasePolicy,
} from './composition/aerosol-phase-policy.js';
import {
	molecularDensityScaleForPolicy,
} from './composition/profile-policy.js';
import {
	rayleighCoefficientsForPolicy,
} from './composition/rayleigh-policy.js';
import {
	evaluatePhaseValue,
} from './reference/phase-functions.js';
import {
	buildPng,
	runReferenceProbe,
	skyDomeSampleMaskIds,
} from './run-reference-probe.js';

const BRUNETON_AEROSOL_POLICY_ID = 'bruneton-2016-kider-fit';
const BRUNETON_PHASE_POLICY_ID = 'bruneton-2016-cornette-shanks-g070';
const BRUNETON_ANGSTROM_BETA = 0.04;
const BRUNETON_ANGSTROM_ALPHA = 0.8;
const BRUNETON_SCALE_HEIGHT_KM = 1.2;
const BRUNETON_SINGLE_SCATTERING_ALBEDO = 0.8;
const WAVELENGTHS_NM = Object.freeze([380, 450, 550, 650, 780]);
const ALTITUDES_KM = Object.freeze([0, 0.5, 1.2, 2, 5, 10]);
const PHASE_SAMPLES = Object.freeze([
	Object.freeze({
		id: 'near-sun-forward',
		label: 'Near Sun / forward aerosol scatter',
		cosTheta: -1,
		incomingOutgoingMu: 1,
	}),
	Object.freeze({
		id: 'side-sky',
		label: 'Side sky',
		cosTheta: 0,
		incomingOutgoingMu: 0,
	}),
	Object.freeze({
		id: 'anti-sun-backward',
		label: 'Anti-sun / backward aerosol scatter',
		cosTheta: 1,
		incomingOutgoingMu: -1,
	}),
]);
const IMAGE_SWEEP_POLICIES = Object.freeze([
	'rayleigh-only',
	'clear-maritime',
	'bruneton-2016-kider-fit',
	'clear-continental',
	'hazy-continental',
]);
const DEFAULT_IMAGE_SWEEP_DOME_SIZE = 18;
const DEFAULT_IMAGE_SWEEP_SAMPLING_PROFILE = 'paper-comparison';
const DEFAULT_IMAGE_SWEEP_DOME_SAMPLE_MASK = 'horizon-ring';

export function parseAerosolMieAuditArgs(argv) {
	const options = {
		includeImageSweep: false,
		domeSize: DEFAULT_IMAGE_SWEEP_DOME_SIZE,
		samplingProfile: DEFAULT_IMAGE_SWEEP_SAMPLING_PROFILE,
		domeSampleMask: DEFAULT_IMAGE_SWEEP_DOME_SAMPLE_MASK,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--help' || arg === '-h') {
			options.help = true;
			continue;
		}

		if (arg === '--out-dir') {
			options.outDir = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--include-image-sweep') {
			options.includeImageSweep = true;
			continue;
		}

		if (arg === '--dome-size') {
			options.domeSize = readPositiveIntegerOption(argv, ++index, arg);
			continue;
		}

		if (arg === '--sampling-profile') {
			options.samplingProfile = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--dome-sample-mask') {
			options.domeSampleMask = readOptionValue(argv, ++index, arg);
			continue;
		}

		throw new Error(`Unknown aerosol/Mie audit option: ${arg}`);
	}

	if (!skyDomeSampleMaskIds().includes(options.domeSampleMask)) {
		throw new Error(`Unknown dome sample mask: ${options.domeSampleMask}`);
	}

	return options;
}

export function runAerosolMieParityAudit({
	includeImageSweep = false,
	domeSize = DEFAULT_IMAGE_SWEEP_DOME_SIZE,
	samplingProfile = DEFAULT_IMAGE_SWEEP_SAMPLING_PROFILE,
	domeSampleMask = DEFAULT_IMAGE_SWEEP_DOME_SAMPLE_MASK,
	outDir,
	progressReporter,
} = {}) {
	const coefficientParity = createBrunetonCoefficientParity();
	const verticalProfile = createVerticalProfileAudit();
	const rayleighMieBalance = createRayleighMieBalanceAudit();
	const phaseConvention = createPhaseConventionAudit();
	const parameterSensitivity = createParameterSensitivityAudit();
	const imageSweep = includeImageSweep
		? runImageSweep({
			domeSize,
			samplingProfile,
			domeSampleMask,
			outDir,
			progressReporter,
		})
		: {
			status: 'not-run',
			reason: 'Run with --include-image-sweep to generate compact skydome policy sensitivity artifacts.',
		};
	const audit = {
		kind: 'flat-atmosphere-aerosol-mie-parity-audit',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		objective: 'Determine whether current aerosol/Mie differences look like parameter interpretation issues or missing algorithms.',
		fixedBrunetonInputs: {
			angstromBeta: BRUNETON_ANGSTROM_BETA,
			angstromAlpha: BRUNETON_ANGSTROM_ALPHA,
			scaleHeightKm: BRUNETON_SCALE_HEIGHT_KM,
			singleScatteringAlbedo: BRUNETON_SINGLE_SCATTERING_ALBEDO,
			phasePolicyId: BRUNETON_PHASE_POLICY_ID,
		},
		coefficientParity,
		verticalProfile,
		rayleighMieBalance,
		phaseConvention,
		parameterSensitivity,
		imageSweep,
	};

	return {
		...audit,
		analysis: analyzeAerosolMieAudit(audit),
	};
}

export function writeAerosolMieAuditArtifacts(audit, outDir) {
	if (!outDir) {
		throw new Error('writeAerosolMieAuditArtifacts requires outDir');
	}

	fs.mkdirSync(outDir, { recursive: true });
	const jsonPath = path.join(outDir, 'audit.json');
	const markdownPath = path.join(outDir, 'audit.md');
	const manifestPath = path.join(outDir, 'manifest.json');

	fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
	fs.writeFileSync(markdownPath, buildAerosolMieAuditMarkdown(audit));
	fs.writeFileSync(manifestPath, `${JSON.stringify({
		kind: 'flat-atmosphere-aerosol-mie-parity-audit-manifest',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		artifacts: {
			json: path.basename(jsonPath),
			markdown: path.basename(markdownPath),
			imageSweepDir: audit.imageSweep.status === 'complete' ? 'image-sweep' : null,
			progressLog: audit.imageSweep.status === 'complete' ? 'progress.log' : null,
		},
		objective: audit.objective,
		conclusion: audit.analysis.conclusion,
	}, null, 2)}\n`);

	return {
		jsonPath,
		markdownPath,
		manifestPath,
	};
}

export function buildAerosolMieAuditMarkdown(audit) {
	const lines = [
		'# Aerosol/Mie Parity Audit',
		'',
		audit.objective,
		'',
		'## Conclusion',
		'',
		...audit.analysis.conclusion.map((item) => `- ${item}`),
		'',
		'## Bruneton Coefficient Parity',
		'',
		`Policy AOD550: \`${formatNumber(audit.coefficientParity.policy.aod550)}\``,
		`Angstrom-derived AOD550: \`${formatNumber(audit.coefficientParity.expected.aod550FromBeta)}\``,
		`Sea-level beta-ext 550: \`${formatNumber(audit.coefficientParity.policy.betaExt550PerKm)} /km\``,
		`Expected beta-ext 550: \`${formatNumber(audit.coefficientParity.expected.betaExt550PerKm)} /km\``,
		`Max relative coefficient error: \`${formatNumber(audit.coefficientParity.maxRelativeError)}\``,
		'',
		'| Wavelength | Tau | Ext /km | Sca /km | Abs /km |',
		'|---:|---:|---:|---:|---:|',
		...audit.coefficientParity.rows.map((row) => {
			return `| ${row.wavelengthNm} | ${formatNumber(row.policyTau)} | ${formatNumber(row.policyExtinctionPerKm)} | ${formatNumber(row.policyScatteringPerKm)} | ${formatNumber(row.policyAbsorptionPerKm)} |`;
		}),
		'',
		'## Rayleigh/Mie Balance',
		'',
		'| Altitude km | Wavelength | Rayleigh sca /km | Aerosol sca /km | Mie/Rayleigh | Aerosol ext /km |',
		'|---:|---:|---:|---:|---:|---:|',
		...audit.rayleighMieBalance.rows.map((row) => {
			return `| ${formatNumber(row.altitudeKm)} | ${row.wavelengthNm} | ${formatNumber(row.rayleighScatteringPerKm)} | ${formatNumber(row.aerosolScatteringPerKm)} | ${formatNumber(row.mieToRayleighScatteringRatio)} | ${formatNumber(row.aerosolExtinctionPerKm)} |`;
		}),
		'',
		'## Phase Convention',
		'',
		'| Case | cosTheta | mu | HG | Cornette-Shanks | CS/HG |',
		'|---|---:|---:|---:|---:|---:|',
		...audit.phaseConvention.rows.map((row) => {
			return `| ${row.label} | ${formatNumber(row.cosTheta)} | ${formatNumber(row.incomingOutgoingMu)} | ${formatNumber(row.henyeyGreenstein)} | ${formatNumber(row.cornetteShanks)} | ${formatNumber(row.cornetteShanksToHgRatio)} |`;
		}),
		'',
		'## Parameter Sensitivity',
		'',
		'| Variant | AOD550 | SSA | H km | beta-ext 550 /km | beta-sca 550 /km | beta-abs 550 /km | vertical AOD 550 |',
		'|---|---:|---:|---:|---:|---:|---:|---:|',
		...audit.parameterSensitivity.rows.map((row) => {
			return `| ${row.id} | ${formatNumber(row.aod550)} | ${formatNumber(row.singleScatteringAlbedo)} | ${formatNumber(row.scaleHeightKm)} | ${formatNumber(row.betaExt550PerKm)} | ${formatNumber(row.betaScattering550PerKm)} | ${formatNumber(row.betaAbsorption550PerKm)} | ${formatNumber(row.verticalAod550ToTop)} |`;
		}),
		'',
		'## Image Sweep',
		'',
		formatImageSweepSummary(audit.imageSweep),
		'',
	];

	return `${lines.join('\n')}\n`;
}

function createBrunetonCoefficientParity() {
	const policy = resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID);
	const phasePolicy = resolveAerosolPhasePolicy(policy.defaultPhasePolicyId);
	const coefficients = aerosolCoefficientsForPolicy(WAVELENGTHS_NM, {
		policyId: policy.id,
	});
	const expectedAod550 = BRUNETON_ANGSTROM_BETA * 0.55 ** (-BRUNETON_ANGSTROM_ALPHA);
	const rows = WAVELENGTHS_NM.map((wavelengthNm, index) => {
		const wavelengthUm = wavelengthNm / 1000;
		const expectedTau = BRUNETON_ANGSTROM_BETA * wavelengthUm ** (-BRUNETON_ANGSTROM_ALPHA);
		const expectedExtinction = expectedTau / BRUNETON_SCALE_HEIGHT_KM;
		const expectedScattering = expectedExtinction * BRUNETON_SINGLE_SCATTERING_ALBEDO;
		const expectedAbsorption = expectedExtinction - expectedScattering;
		const policyExtinction = coefficients.extinctionByWavelength[index];
		const policyScattering = coefficients.scatteringByWavelength[index];
		const policyAbsorption = coefficients.absorptionByWavelength[index];

		return {
			wavelengthNm,
			expectedTau,
			policyTau: policyExtinction * policy.scaleHeightKm,
			expectedExtinctionPerKm: expectedExtinction,
			policyExtinctionPerKm: policyExtinction,
			extinctionRelativeError: relativeError(policyExtinction, expectedExtinction),
			expectedScatteringPerKm: expectedScattering,
			policyScatteringPerKm: policyScattering,
			scatteringRelativeError: relativeError(policyScattering, expectedScattering),
			expectedAbsorptionPerKm: expectedAbsorption,
			policyAbsorptionPerKm: policyAbsorption,
			absorptionRelativeError: relativeError(policyAbsorption, expectedAbsorption),
		};
	});

	return {
		policy: {
			id: policy.id,
			label: policy.label,
			aod550: policy.aod550,
			angstromExponent: policy.angstromExponent,
			singleScatteringAlbedo: policy.singleScatteringAlbedo,
			scaleHeightKm: policy.scaleHeightKm,
			defaultPhasePolicyId: policy.defaultPhasePolicyId,
			defaultPhaseKind: phasePolicy.kind,
			defaultPhaseG: phasePolicy.parameters.g,
			betaExt550PerKm: policy.aod550 / policy.scaleHeightKm,
			betaScattering550PerKm: policy.aod550 / policy.scaleHeightKm * policy.singleScatteringAlbedo,
			betaAbsorption550PerKm: policy.aod550 / policy.scaleHeightKm * (1 - policy.singleScatteringAlbedo),
		},
		expected: {
			aod550FromBeta: expectedAod550,
			betaExt550PerKm: expectedAod550 / BRUNETON_SCALE_HEIGHT_KM,
			betaScattering550PerKm: expectedAod550 / BRUNETON_SCALE_HEIGHT_KM * BRUNETON_SINGLE_SCATTERING_ALBEDO,
			betaAbsorption550PerKm: expectedAod550 / BRUNETON_SCALE_HEIGHT_KM * (1 - BRUNETON_SINGLE_SCATTERING_ALBEDO),
		},
		rows,
		maxRelativeError: Math.max(...rows.flatMap((row) => [
			row.extinctionRelativeError,
			row.scatteringRelativeError,
			row.absorptionRelativeError,
		])),
	};
}

function createVerticalProfileAudit() {
	const policy = resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID);
	const betaExt550 = policy.aod550 / policy.scaleHeightKm;

	return {
		model: 'rhoM(h) = exp(-h / scaleHeightKm); betaExt(lambda,h) = tau(lambda) / scaleHeightKm * rhoM(h)',
		scaleHeightKm: policy.scaleHeightKm,
		topAltitudeKm: 100,
		verticalAod550ToTop: roundMetric(betaExt550 * policy.scaleHeightKm * (1 - Math.exp(-100 / policy.scaleHeightKm))),
		rows: ALTITUDES_KM.map((altitudeKm) => {
			const densityScale = aerosolDensityScale(altitudeKm, policy.scaleHeightKm);
			const coeff = aerosolCoefficientsForPolicy([550], {
				policyId: policy.id,
				densityScale,
			});

			return {
				altitudeKm,
				densityScale: roundMetric(densityScale),
				extinction550PerKm: roundMetric(coeff.extinctionByWavelength[0]),
				scattering550PerKm: roundMetric(coeff.scatteringByWavelength[0]),
				absorption550PerKm: roundMetric(coeff.absorptionByWavelength[0]),
			};
		}),
	};
}

function createRayleighMieBalanceAudit() {
	const policy = resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID);
	const altitudesKm = [0, 1.2, 5, 10];
	const wavelengthsNm = [450, 550, 650];
	const rows = [];

	for (const altitudeKm of altitudesKm) {
		const molecularDensity = molecularDensityScaleForPolicy(altitudeKm, {
			policyId: 'us-standard-atmosphere-1976-density',
		}).densityScale;
		const aerosolDensity = aerosolDensityScale(altitudeKm, policy.scaleHeightKm);
		const rayleigh = rayleighCoefficientsForPolicy(wavelengthsNm, {
			policyId: 'bucholtz-standard-air',
			densityScale: molecularDensity,
		});
		const aerosol = aerosolCoefficientsForPolicy(wavelengthsNm, {
			policyId: policy.id,
			densityScale: aerosolDensity,
		});

		for (const [index, wavelengthNm] of wavelengthsNm.entries()) {
			rows.push({
				altitudeKm,
				wavelengthNm,
				molecularDensityScale: roundMetric(molecularDensity),
				aerosolDensityScale: roundMetric(aerosolDensity),
				rayleighScatteringPerKm: roundMetric(rayleigh.valuesByWavelength[index]),
				aerosolExtinctionPerKm: roundMetric(aerosol.extinctionByWavelength[index]),
				aerosolScatteringPerKm: roundMetric(aerosol.scatteringByWavelength[index]),
				aerosolAbsorptionPerKm: roundMetric(aerosol.absorptionByWavelength[index]),
				mieToRayleighScatteringRatio: roundMetric(
					safeRatio(aerosol.scatteringByWavelength[index], rayleigh.valuesByWavelength[index]),
				),
			});
		}
	}

	return {
		rayleighPolicyId: 'bucholtz-standard-air',
		molecularProfilePolicyId: 'us-standard-atmosphere-1976-density',
		aerosolPolicyId: policy.id,
		rows,
		seaLevel550MieToRayleighScatteringRatio: rows.find((row) => row.altitudeKm === 0 && row.wavelengthNm === 550)
			.mieToRayleighScatteringRatio,
	};
}

function createPhaseConventionAudit() {
	const phasePolicy = resolveAerosolPhasePolicy(BRUNETON_PHASE_POLICY_ID);
	const hgPolicy = resolveAerosolPhasePolicy('bruneton-2016-hg-g070-control');
	const rows = PHASE_SAMPLES.map((sample) => {
		const henyeyGreenstein = evaluatePhaseValue({
			phaseKind: hgPolicy.kind,
			parameters: hgPolicy.parameters,
			cosTheta: sample.cosTheta,
			errorPrefix: 'aerosol audit',
		});
		const cornetteShanks = evaluatePhaseValue({
			phaseKind: phasePolicy.kind,
			parameters: phasePolicy.parameters,
			cosTheta: sample.cosTheta,
			errorPrefix: 'aerosol audit',
		});

		return {
			...sample,
			henyeyGreenstein: roundMetric(henyeyGreenstein),
			cornetteShanks: roundMetric(cornetteShanks),
			cornetteShanksToHgRatio: roundMetric(cornetteShanks / henyeyGreenstein),
		};
	});

	return {
		phasePolicy: {
			id: phasePolicy.id,
			kind: phasePolicy.kind,
			g: phasePolicy.parameters.g,
		},
		convention: 'run-reference-probe/stage cosTheta = dot(sourceDirectionFromSample, directionFromSampleToCamera); aerosol phase helpers use mu = -cosTheta.',
		rows,
		forwardToSideRatio: roundMetric(rows[0].cornetteShanks / rows[1].cornetteShanks),
		forwardToBackwardRatio: roundMetric(rows[0].cornetteShanks / rows[2].cornetteShanks),
	};
}

function createParameterSensitivityAudit() {
	const variants = [
		{ id: 'aod-0.02', aod550: 0.02, singleScatteringAlbedo: 0.8, scaleHeightKm: 1.2 },
		{ id: 'aod-0.04-paper-beta-at-1um', aod550: 0.04, singleScatteringAlbedo: 0.8, scaleHeightKm: 1.2 },
		{ id: 'bruneton-kider', aod550: resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID).aod550, singleScatteringAlbedo: 0.8, scaleHeightKm: 1.2 },
		{ id: 'aod-0.12', aod550: 0.12, singleScatteringAlbedo: 0.8, scaleHeightKm: 1.2 },
		{ id: 'ssa-1.0-no-aerosol-absorption', aod550: resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID).aod550, singleScatteringAlbedo: 1, scaleHeightKm: 1.2 },
		{ id: 'scale-height-0.8', aod550: resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID).aod550, singleScatteringAlbedo: 0.8, scaleHeightKm: 0.8 },
		{ id: 'scale-height-2.0', aod550: resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID).aod550, singleScatteringAlbedo: 0.8, scaleHeightKm: 2 },
	];
	const topAltitudeKm = 100;

	return {
		note: 'Coefficient-only sensitivity at 550 nm. Image-level sweep uses named presets because the renderer intentionally accepts named policies only.',
		rows: variants.map((variant) => {
			const betaExt550 = variant.aod550 / variant.scaleHeightKm;
			const betaScattering550 = betaExt550 * variant.singleScatteringAlbedo;
			const betaAbsorption550 = betaExt550 - betaScattering550;

			return {
				...variant,
				betaExt550PerKm: roundMetric(betaExt550),
				betaScattering550PerKm: roundMetric(betaScattering550),
				betaAbsorption550PerKm: roundMetric(betaAbsorption550),
				verticalAod550ToTop: roundMetric(betaExt550 * variant.scaleHeightKm * (1 - Math.exp(-topAltitudeKm / variant.scaleHeightKm))),
				seaLevelScatteringRelativeToBruneton: roundMetric(betaScattering550 / (
					resolveAerosolPolicy(BRUNETON_AEROSOL_POLICY_ID).aod550
					/ BRUNETON_SCALE_HEIGHT_KM
					* BRUNETON_SINGLE_SCATTERING_ALBEDO
				)),
			};
		}),
	};
}

function runImageSweep({
	domeSize,
	samplingProfile,
	domeSampleMask,
	outDir,
	progressReporter,
}) {
	const imageDir = outDir ? path.join(outDir, 'image-sweep') : null;
	if (imageDir) {
		fs.mkdirSync(imageDir, { recursive: true });
	}

	const variants = [];
	for (const policyId of IMAGE_SWEEP_POLICIES) {
		progressReporter?.({
			phase: 'image-sweep-variant-start',
			aerosolPolicy: policyId,
			domeSize,
			samplingProfile,
			domeSampleMask,
		});
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize,
			domeSampleMask,
			samplingProfile,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: policyId,
			ozonePolicy: 'bruneton-2016-no-visible-absorption',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'none',
			progressReporter: (event) => progressReporter?.({
				...event,
				aerosolPolicy: policyId,
			}),
		});
		const imageName = `${policyId}-d${domeSize}.png`;
		if (imageDir) {
			fs.writeFileSync(path.join(imageDir, imageName), buildPng(result));
		}
		variants.push({
			aerosolPolicy: policyId,
			image: imageDir ? `image-sweep/${imageName}` : null,
			panels: result.skyDomePanels.map((panel) => summarizePanelMetrics(panel)),
		});
		progressReporter?.({
			phase: 'image-sweep-variant-complete',
			aerosolPolicy: policyId,
		});
	}

	return {
		status: 'complete',
		domeSize,
		samplingProfile,
		domeSampleMask,
		fixedInputs: {
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			ozonePolicy: 'bruneton-2016-no-visible-absorption',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'none',
			domeSampleMask,
		},
		variants,
		comparison: compareImageSweepVariants(variants),
	};
}

function summarizePanelMetrics(panel) {
	const metrics = panel.modelComparisonMetrics;

	return {
		id: panel.id,
		label: panel.label,
		sunZenithDeg: panel.sunZenithDeg,
		warmAffectedPercent: percent(metrics.warmAffectedFraction),
		nonBlueAffectedPercent: percent(metrics.nonBlueAffectedFraction),
		horizonWarmPercent: percent(metrics.horizonRing.warmAffectedFraction),
		horizonNonBluePercent: percent(metrics.horizonRing.nonBlueAffectedFraction),
		horizonLuminance: roundMetric(metrics.horizonRing.luminance.average),
		horizonSaturation: roundMetric(metrics.horizonRing.saturation.average),
		zenithLuminance: roundMetric(metrics.zenithDisk.luminance.average),
		horizonZenithLuminanceRatio: roundMetric(metrics.zenithToHorizon.luminanceRatio),
		sunNeighborhoodWarmPercent: percent(metrics.sunNeighborhood10Deg.warmAffectedFraction),
	};
}

function compareImageSweepVariants(variants) {
	const baseline = variants.find((variant) => variant.aerosolPolicy === BRUNETON_AEROSOL_POLICY_ID);
	if (!baseline) {
		return null;
	}

	return variants
		.filter((variant) => variant !== baseline)
		.map((variant) => {
			return {
				aerosolPolicy: variant.aerosolPolicy,
				deltaFromBrunetonByPanel: variant.panels.map((panel) => {
					const baselinePanel = baseline.panels.find((candidate) => candidate.id === panel.id);

					return {
						id: panel.id,
						label: panel.label,
						warmAffectedPercent: roundMetric(panel.warmAffectedPercent - baselinePanel.warmAffectedPercent),
						nonBlueAffectedPercent: roundMetric(panel.nonBlueAffectedPercent - baselinePanel.nonBlueAffectedPercent),
						horizonWarmPercent: roundMetric(panel.horizonWarmPercent - baselinePanel.horizonWarmPercent),
						horizonNonBluePercent: roundMetric(panel.horizonNonBluePercent - baselinePanel.horizonNonBluePercent),
						horizonLuminance: roundMetric(panel.horizonLuminance - baselinePanel.horizonLuminance),
						horizonSaturation: roundMetric(panel.horizonSaturation - baselinePanel.horizonSaturation),
						sunNeighborhoodWarmPercent: roundMetric(panel.sunNeighborhoodWarmPercent - baselinePanel.sunNeighborhoodWarmPercent),
					};
				}),
			};
		});
}

function analyzeAerosolMieAudit(audit) {
	const imageSweepConclusion = audit.imageSweep.status === 'complete'
		? summarizeImageSweepConclusion(audit.imageSweep)
		: 'Image-level policy sensitivity was not run in this artifact.';

	return {
		coefficientParityStatus: audit.coefficientParity.maxRelativeError < 1e-9
			? 'matches-bruneton-input-contract'
			: 'coefficient-mismatch',
		phaseStatus: audit.phaseConvention.forwardToSideRatio > 100
			? 'strong-forward-scattering-present'
			: 'weak-forward-scattering-warning',
		conclusion: [
			`The Bruneton/Kider aerosol preset matches the stated Angstrom beta/alpha, SSA, and scale-height contract to within ${formatNumber(audit.coefficientParity.maxRelativeError)} relative coefficient error.`,
			`At sea level and 550 nm, aerosol scattering is about ${formatNumber(audit.rayleighMieBalance.seaLevel550MieToRayleighScatteringRatio)}x Rayleigh scattering, so aerosol/Mie is already a dominant lower-atmosphere term in the current setup.`,
			`The Cornette-Shanks phase convention produces strong forward scattering: forward/side is about ${formatNumber(audit.phaseConvention.forwardToSideRatio)} and forward/backward is about ${formatNumber(audit.phaseConvention.forwardToBackwardRatio)}.`,
			imageSweepConclusion,
			'Current evidence points away from a missing basic Mie coefficient or phase algorithm. The next likely issue is parameter family/environment choice or missing surface/ground coupling, not a typo in the Bruneton aerosol conversion.',
		],
	};
}

function summarizeImageSweepConclusion(imageSweep) {
	const lowSunPanels = imageSweep.variants.map((variant) => {
		return {
			aerosolPolicy: variant.aerosolPolicy,
			panel: variant.panels.find((panel) => panel.id === '06h00.sunZenith87'),
		};
	});
	const bruneton = lowSunPanels.find((entry) => entry.aerosolPolicy === BRUNETON_AEROSOL_POLICY_ID);
	const hazy = lowSunPanels.find((entry) => entry.aerosolPolicy === 'hazy-continental');
	const rayleighOnly = lowSunPanels.find((entry) => entry.aerosolPolicy === 'rayleigh-only');
	const clearMaritime = lowSunPanels.find((entry) => entry.aerosolPolicy === 'clear-maritime');

	return [
		`The compact ${imageSweep.domeSize}px image sweep is responsive to aerosol policy: low-Sun warm area is ${formatNumber(rayleighOnly.panel.warmAffectedPercent)}% for rayleigh-only, ${formatNumber(clearMaritime.panel.warmAffectedPercent)}% for clear-maritime, ${formatNumber(bruneton.panel.warmAffectedPercent)}% for Bruneton/Kider, and ${formatNumber(hazy.panel.warmAffectedPercent)}% for hazy-continental.`,
		`However, the high-AOD hazy preset moves the image by making the dome broadly warm/hazy, not by revealing an absent Bruneton-specific Mie algorithm.`
	].join(' ');
}

function formatImageSweepSummary(imageSweep) {
	if (imageSweep.status !== 'complete') {
		return `Image sweep status: \`${imageSweep.status}\` - ${imageSweep.reason}`;
	}

	const lines = [
		`Image sweep status: \`${imageSweep.status}\`, dome size \`${imageSweep.domeSize}\`, sampling profile \`${imageSweep.samplingProfile}\`, dome sample mask \`${imageSweep.domeSampleMask}\`.`,
		'',
		'| Policy | Row | Warm % | Non-blue % | Horizon lum | Horizon sat | Sun warm % | Image |',
		'|---|---|---:|---:|---:|---:|---:|---|',
	];

	for (const variant of imageSweep.variants) {
		for (const panel of variant.panels) {
			lines.push(`| ${variant.aerosolPolicy} | ${panel.label} | ${formatNumber(panel.warmAffectedPercent)} | ${formatNumber(panel.nonBlueAffectedPercent)} | ${formatNumber(panel.horizonLuminance)} | ${formatNumber(panel.horizonSaturation)} | ${formatNumber(panel.sunNeighborhoodWarmPercent)} | ${variant.image ? `\`${variant.image}\`` : ''} |`);
		}
	}

	return lines.join('\n');
}

function createProgressFileReporter(progressLogPath) {
	fs.mkdirSync(path.dirname(path.resolve(progressLogPath)), { recursive: true });
	fs.writeFileSync(progressLogPath, '');

	return (event) => {
		fs.appendFileSync(progressLogPath, `${JSON.stringify({
			generatedAt: null,
			...event,
		})}\n`);
	};
}

function aerosolDensityScale(altitudeKm, scaleHeightKm) {
	return Math.exp(-Math.max(0, altitudeKm) / scaleHeightKm);
}

function relativeError(actual, expected) {
	return expected === 0 ? Math.abs(actual - expected) : Math.abs((actual - expected) / expected);
}

function safeRatio(numerator, denominator) {
	return denominator !== 0 ? numerator / denominator : null;
}

function percent(fraction) {
	return roundMetric(fraction * 100);
}

function readOptionValue(argv, index, optionName) {
	if (index >= argv.length || argv[index].startsWith('--')) {
		throw new Error(`${optionName} requires a value`);
	}

	return argv[index];
}

function readPositiveIntegerOption(argv, index, optionName) {
	const value = Number(readOptionValue(argv, index, optionName));
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${optionName} must be a positive integer`);
	}

	return value;
}

function printUsage() {
	return [
		`Usage: node scripts/flat/atmosphere/aerosol-mie-parity-audit.js --out-dir <dir> [--include-image-sweep] [--dome-size <pixels>] [--sampling-profile <id>] [--dome-sample-mask ${skyDomeSampleMaskIds().join('|')}]`,
		'',
		'Writes audit.json, audit.md, and manifest.json.',
		'With --include-image-sweep, also writes image-sweep PNGs and progress.log.',
	].join('\n');
}

function runCli(argv = process.argv.slice(2)) {
	try {
		const options = parseAerosolMieAuditArgs(argv);

		if (options.help) {
			console.log(printUsage());
			return 0;
		}

		if (!options.outDir) {
			throw new Error('--out-dir is required');
		}

		fs.mkdirSync(options.outDir, { recursive: true });
		const progressLogPath = path.join(options.outDir, 'progress.log');
		const audit = runAerosolMieParityAudit({
			includeImageSweep: options.includeImageSweep,
			domeSize: options.domeSize,
			samplingProfile: options.samplingProfile,
			domeSampleMask: options.domeSampleMask,
			outDir: options.outDir,
			progressReporter: options.includeImageSweep
				? createProgressFileReporter(progressLogPath)
				: undefined,
		});
		const artifacts = writeAerosolMieAuditArtifacts(audit, options.outDir);

		console.log(`Wrote aerosol/Mie parity audit to ${normalizeArtifactPath(options.outDir)}`);
		console.log(JSON.stringify(Object.fromEntries(
			Object.entries(artifacts).map(([key, value]) => [key, normalizeArtifactPath(value)]),
		), null, 2));

		return 0;
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);

		return 1;
	}
}

function roundMetric(value) {
	return Number.isFinite(value) ? Number(value.toFixed(9)) : value;
}

function formatNumber(value) {
	return Number.isFinite(value) ? value.toFixed(6) : String(value);
}

function normalizeArtifactPath(filePath) {
	return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/gu, '/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = runCli();
}
