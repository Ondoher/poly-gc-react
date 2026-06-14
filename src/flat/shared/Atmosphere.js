import Sun from './Sun.js';
import {
	FLAT_ATMOSPHERE_FRAME,
	SPHERICAL_ATMOSPHERE_FRAME,
	STANDARD_EARTH_ATMOSPHERE,
} from './consts.js';
import {
	add,
	addRgb,
	clamp,
	cloneRgb,
	dot,
	length,
	multiplyRgb,
	normalize,
	rgbFrom,
	scale,
	scaleRgb,
	stepsFrom,
	subtract,
	vectorFrom,
} from './math-primitives.js';

const EPSILON = 1e-9;
const RGB_WAVELENGTH_NM = Object.freeze({
	r: 680,
	g: 550,
	b: 440,
});
const AEROSOL_REFERENCE_WAVELENGTH_NM = 550;

function finiteNumber(value, fallback) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

function aerosolOpticalDepthAtWavelength(profile, wavelengthNm) {
	const opticalDepth550 = finiteNumber(profile.aerosolOpticalDepth550nm, NaN);
	const angstromExponent = finiteNumber(profile.aerosolAngstromExponent, 0);

	if (!Number.isFinite(opticalDepth550)) {
		return null;
	}

	return opticalDepth550 * Math.pow(
		wavelengthNm / AEROSOL_REFERENCE_WAVELENGTH_NM,
		-angstromExponent,
	);
}

function deriveMieExtinctionBetaKm(profile) {
	const redOpticalDepth = aerosolOpticalDepthAtWavelength(profile, RGB_WAVELENGTH_NM.r);

	if (redOpticalDepth === null) {
		return null;
	}

	return Object.freeze({
		r: redOpticalDepth / profile.aerosolScaleHeightKm,
		g: aerosolOpticalDepthAtWavelength(profile, RGB_WAVELENGTH_NM.g) / profile.aerosolScaleHeightKm,
		b: aerosolOpticalDepthAtWavelength(profile, RGB_WAVELENGTH_NM.b) / profile.aerosolScaleHeightKm,
	});
}

/**
 * Model optical depth, transmittance, and single scattering for flat-slab and
 * spherical-shell atmosphere frames.
 */
export default class Atmosphere {
	/**
	 * Convert per-channel optical depth into per-channel transmittance.
	 *
	 * @param {FlatRgbColor} opticalDepth - Specify the optical depth to convert.
	 * @returns {Readonly<FlatRgbColor>}
	 */
	static transmittanceFromOpticalDepth(opticalDepth) {
		return Object.freeze({
			r: Math.exp(-opticalDepth.r),
			g: Math.exp(-opticalDepth.g),
			b: Math.exp(-opticalDepth.b),
		});
	}

	/**
	 * Normalize and validate an atmosphere profile.
	 *
	 * @param {FlatAtmosphereConfig["profile"]} profile - Specify profile overrides.
	 * @returns {Readonly<FlatAtmosphereProfile>}
	 */
	static normalizeProfile(profile = {}) {
		const nextProfile = {
			...STANDARD_EARTH_ATMOSPHERE,
			...profile,
			rayleighBetaKm: cloneRgb(rgbFrom(profile.rayleighBetaKm, STANDARD_EARTH_ATMOSPHERE.rayleighBetaKm)),
			mieBetaKm: cloneRgb(rgbFrom(profile.mieBetaKm, STANDARD_EARTH_ATMOSPHERE.mieBetaKm)),
		};

		nextProfile.topAltitudeKm = finiteNumber(nextProfile.topAltitudeKm, STANDARD_EARTH_ATMOSPHERE.topAltitudeKm);
		nextProfile.seaLevelDensityKgM3 = finiteNumber(
			nextProfile.seaLevelDensityKgM3,
			STANDARD_EARTH_ATMOSPHERE.seaLevelDensityKgM3,
		);
		nextProfile.rayleighScaleHeightKm = finiteNumber(
			nextProfile.rayleighScaleHeightKm,
			STANDARD_EARTH_ATMOSPHERE.rayleighScaleHeightKm,
		);
		nextProfile.aerosolScaleHeightKm = finiteNumber(
			nextProfile.aerosolScaleHeightKm,
			STANDARD_EARTH_ATMOSPHERE.aerosolScaleHeightKm,
		);
		nextProfile.aerosolSingleScatteringAlbedo = clamp(
			finiteNumber(nextProfile.aerosolSingleScatteringAlbedo, 1),
			0,
			1,
		);
		nextProfile.aerosolAngstromExponent = finiteNumber(nextProfile.aerosolAngstromExponent, 0);
		nextProfile.mieStrength = finiteNumber(nextProfile.mieStrength, 1);
		nextProfile.mieAnisotropy = clamp(finiteNumber(nextProfile.mieAnisotropy, 0), -0.99, 0.99);
		nextProfile.maxAirlight = clamp(Number(nextProfile.maxAirlight), 0, 1);
		nextProfile.integrationSteps = stepsFrom(nextProfile.integrationSteps);

		if (nextProfile.topAltitudeKm <= 0) {
			throw new Error('Atmosphere topAltitudeKm must be greater than zero.');
		}

		if (nextProfile.seaLevelDensityKgM3 <= 0) {
			throw new Error('Atmosphere seaLevelDensityKgM3 must be greater than zero.');
		}

		if (nextProfile.rayleighScaleHeightKm <= 0 || nextProfile.aerosolScaleHeightKm <= 0) {
			throw new Error('Atmosphere scale heights must be greater than zero.');
		}

		const derivedMieExtinctionBetaKm = deriveMieExtinctionBetaKm(nextProfile);
		const mieExtinctionBetaKm = derivedMieExtinctionBetaKm || Object.freeze({
			r: nextProfile.mieBetaKm.r * nextProfile.mieStrength,
			g: nextProfile.mieBetaKm.g * nextProfile.mieStrength,
			b: nextProfile.mieBetaKm.b * nextProfile.mieStrength,
		});

		nextProfile.mieExtinctionBetaKm = cloneRgb(mieExtinctionBetaKm);
		nextProfile.mieScatteringBetaKm = Object.freeze({
			r: nextProfile.mieExtinctionBetaKm.r * nextProfile.aerosolSingleScatteringAlbedo,
			g: nextProfile.mieExtinctionBetaKm.g * nextProfile.aerosolSingleScatteringAlbedo,
			b: nextProfile.mieExtinctionBetaKm.b * nextProfile.aerosolSingleScatteringAlbedo,
		});
		nextProfile.mieAbsorptionBetaKm = Object.freeze({
			r: nextProfile.mieExtinctionBetaKm.r - nextProfile.mieScatteringBetaKm.r,
			g: nextProfile.mieExtinctionBetaKm.g - nextProfile.mieScatteringBetaKm.g,
			b: nextProfile.mieExtinctionBetaKm.b - nextProfile.mieScatteringBetaKm.b,
		});

		return Object.freeze(nextProfile);
	}

	/**
	 * Normalize and validate an atmosphere frame.
	 *
	 * @param {Partial<FlatAtmosphereFrame>} frame - Specify frame overrides.
	 * @returns {Readonly<FlatAtmosphereFrame>}
	 */
	static normalizeFrame(frame = FLAT_ATMOSPHERE_FRAME) {
		if (frame.kind === 'spherical-shell') {
			const nextFrame = {
				kind: 'spherical-shell',
				planetCenter: vectorFrom(frame.planetCenter, SPHERICAL_ATMOSPHERE_FRAME.planetCenter),
				planetRadiusKm: Number(frame.planetRadiusKm ?? SPHERICAL_ATMOSPHERE_FRAME.planetRadiusKm),
			};

			if (nextFrame.planetRadiusKm <= 0) {
				throw new Error('Spherical atmosphere planetRadiusKm must be greater than zero.');
			}

			return Object.freeze(nextFrame);
		}

		if (frame.kind !== 'flat-slab' && frame.kind !== undefined) {
			throw new Error(`Unknown atmosphere frame "${frame.kind}".`);
		}

		return Object.freeze({
			kind: 'flat-slab',
			origin: vectorFrom(frame.origin, FLAT_ATMOSPHERE_FRAME.origin),
			up: normalize(
				vectorFrom(frame.up, FLAT_ATMOSPHERE_FRAME.up),
				'Cannot normalize a zero-length atmosphere vector.',
			),
		});
	}

	/**
	 * Clone an atmosphere profile into an immutable plain object.
	 *
	 * @param {FlatAtmosphereProfile} profile - Specify the profile to clone.
	 * @returns {Readonly<FlatAtmosphereProfile>}
	 */
	static cloneProfile(profile) {
		return Object.freeze({
			...profile,
			rayleighBetaKm: cloneRgb(profile.rayleighBetaKm),
			mieBetaKm: cloneRgb(profile.mieBetaKm),
			mieExtinctionBetaKm: cloneRgb(profile.mieExtinctionBetaKm),
			mieScatteringBetaKm: cloneRgb(profile.mieScatteringBetaKm),
			mieAbsorptionBetaKm: cloneRgb(profile.mieAbsorptionBetaKm),
		});
	}

	/**
	 * Clone an atmosphere frame into an immutable plain object.
	 *
	 * @param {FlatAtmosphereFrame} frame - Specify the frame to clone.
	 * @returns {Readonly<FlatAtmosphereFrame>}
	 */
	static cloneFrame(frame) {
		if (frame.kind === 'spherical-shell') {
			return Object.freeze({
				kind: frame.kind,
				planetCenter: Object.freeze({ ...frame.planetCenter }),
				planetRadiusKm: frame.planetRadiusKm,
			});
		}

		return Object.freeze({
			kind: frame.kind,
			origin: Object.freeze({ ...frame.origin }),
			up: Object.freeze({ ...frame.up }),
		});
	}

	/**
	 * Create an empty atmosphere sample for zero or out-of-atmosphere paths.
	 *
	 * @param {number} totalDistanceKm - Specify the total path distance.
	 * @returns {Readonly<FlatAtmosphereSample>}
	 */
	static emptySample(totalDistanceKm = 0) {
		return Object.freeze({
			distanceKm: totalDistanceKm,
			atmosphereDistanceKm: 0,
			rayleighColumnDensityKgM3Km: 0,
			aerosolColumnDensityKgM3Km: 0,
			averageRayleighDensityKgM3: 0,
			averageAerosolDensityKgM3: 0,
			opticalDepth: Object.freeze({ r: 0, g: 0, b: 0 }),
			transmittance: Object.freeze({ r: 1, g: 1, b: 1 }),
			airlight: 0,
		});
	}

	/**
	 * Solve the positive distance where a ray exits a sphere.
	 *
	 * @param {FlatVector3} origin - Specify ray origin relative to sphere center.
	 * @param {FlatVector3} direction - Specify normalized ray direction.
	 * @param {number} radiusKm - Specify sphere radius in kilometers.
	 * @returns {number | null}
	 */
	static solveSphericalExitDistance(origin, direction, radiusKm) {
		const b = dot(origin, direction);
		const c = dot(origin, origin) - radiusKm * radiusKm;
		const discriminant = b * b - c;

		if (discriminant < 0) {
			return null;
		}

		const root = Math.sqrt(discriminant);
		const near = -b - root;
		const far = -b + root;

		if (far > 0) {
			return far;
		}

		if (near > 0) {
			return near;
		}

		return null;
	}

	/**
	 * Solve the nearest positive ray/sphere intersection distance.
	 *
	 * @param {FlatVector3} origin - Specify ray origin relative to sphere center.
	 * @param {FlatVector3} direction - Specify normalized ray direction.
	 * @param {number} radiusKm - Specify sphere radius in kilometers.
	 * @returns {number | null}
	 */
	static solveSphericalNearestIntersectionDistance(origin, direction, radiusKm) {
		const b = dot(origin, direction);
		const c = dot(origin, origin) - radiusKm * radiusKm;
		const discriminant = b * b - c;

		if (discriminant < 0) {
			return null;
		}

		const root = Math.sqrt(discriminant);
		const near = -b - root;
		const far = -b + root;

		if (near > EPSILON) {
			return near;
		}

		if (far > EPSILON) {
			return far;
		}

		return null;
	}

	/**
	 * Create an atmosphere model for sampling optical depth and scattering.
	 *
	 * @param {FlatAtmosphereConfig} config - Configure atmosphere profile, frame, and default sun.
	 */
	constructor(config = {}) {
		/**
		 * Store the normalized atmosphere profile.
		 *
		 * @type {Readonly<FlatAtmosphereProfile>}
		 */
		this.profile = Atmosphere.normalizeProfile(config.profile);
		/**
		 * Store the normalized atmosphere frame.
		 *
		 * @type {Readonly<FlatAtmosphereFrame>}
		 */
		this.frame = Atmosphere.normalizeFrame(config.frame);
		/**
		 * Store the default light source for scattering calculations.
		 *
		 * @type {Sun | null}
		 */
		this.sun = config.sun === null ? null : Sun.from(config.sun);
	}

	/**
	 * Get a clone of the active atmosphere profile.
	 *
	 * @returns {Readonly<FlatAtmosphereProfile>}
	 */
	getProfile() {
		return Atmosphere.cloneProfile(this.profile);
	}

	/**
	 * Get a clone of the active atmosphere frame.
	 *
	 * @returns {Readonly<FlatAtmosphereFrame>}
	 */
	getFrame() {
		return Atmosphere.cloneFrame(this.frame);
	}

	/**
	 * Set the default sun used by scattering methods.
	 *
	 * @param {Sun | FlatSunConfig | null} sun - Specify the sun instance, config, or `null`.
	 * @returns {Atmosphere}
	 */
	setSun(sun) {
		this.sun = sun === null ? null : Sun.from(sun);
		return this;
	}

	/**
	 * Get serializable state for the default sun.
	 *
	 * @returns {Readonly<FlatSunState> | null}
	 */
	getSun() {
		return this.sun ? this.sun.getState() : null;
	}

	/**
	 * Resolve a method-level light override against the default sun.
	 *
	 * @param {Sun | FlatSunConfig | null | undefined} light - Specify a light override.
	 * @returns {Sun | null}
	 */
	resolveSun(light = undefined) {
		if (light === null) {
			return null;
		}

		if (light !== undefined) {
			return Sun.from(light);
		}

		return this.sun;
	}

	/**
	 * Calculate altitude above the active atmosphere frame.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the scene position.
	 * @returns {number}
	 */
	altitudeKm(position) {
		const point = vectorFrom(position);

		if (this.frame.kind === 'spherical-shell') {
			return length(subtract(point, this.frame.planetCenter)) - this.frame.planetRadiusKm;
		}

		return dot(subtract(point, this.frame.origin), this.frame.up);
	}

	/**
	 * Calculate unitless relative density for an atmosphere layer.
	 *
	 * @param {number} altitudeKm - Specify altitude above the frame in kilometers.
	 * @param {FlatAtmosphereLayer} layer - Select Rayleigh or aerosol density.
	 * @returns {number}
	 */
	relativeDensityAtAltitudeKm(altitudeKm, layer = 'rayleigh') {
		if (altitudeKm < 0 || altitudeKm > this.profile.topAltitudeKm) {
			return 0;
		}

		const scaleHeightKm = layer === 'aerosol'
			? this.profile.aerosolScaleHeightKm
			: this.profile.rayleighScaleHeightKm;

		return Math.exp(-altitudeKm / scaleHeightKm);
	}

	/**
	 * Calculate layer density in kilograms per cubic meter.
	 *
	 * @param {number} altitudeKm - Specify altitude above the frame in kilometers.
	 * @param {FlatAtmosphereLayer} layer - Select Rayleigh or aerosol density.
	 * @returns {number}
	 */
	densityKgM3AtAltitudeKm(altitudeKm, layer = 'rayleigh') {
		return this.profile.seaLevelDensityKgM3 * this.relativeDensityAtAltitudeKm(altitudeKm, layer);
	}

	/**
	 * Calculate extinction coefficients at an altitude.
	 *
	 * @param {number} altitudeKm - Specify altitude above the frame in kilometers.
	 * @returns {Readonly<FlatRgbColor>}
	 */
	extinctionCoefficientKmAtAltitudeKm(altitudeKm) {
		const rayleighDensity = this.relativeDensityAtAltitudeKm(altitudeKm, 'rayleigh');
		const aerosolDensity = this.relativeDensityAtAltitudeKm(altitudeKm, 'aerosol');

		return Object.freeze({
			r: this.profile.rayleighBetaKm.r * rayleighDensity + this.profile.mieExtinctionBetaKm.r * aerosolDensity,
			g: this.profile.rayleighBetaKm.g * rayleighDensity + this.profile.mieExtinctionBetaKm.g * aerosolDensity,
			b: this.profile.rayleighBetaKm.b * rayleighDensity + this.profile.mieExtinctionBetaKm.b * aerosolDensity,
		});
	}

	/**
	 * Calculate per-layer scattering coefficients at an altitude.
	 *
	 * @param {number} altitudeKm - Specify altitude above the frame in kilometers.
	 * @returns {Readonly<FlatAtmosphereScatteringCoefficients>}
	 */
	scatteringCoefficientKmAtAltitudeKm(altitudeKm) {
		const rayleighDensity = this.relativeDensityAtAltitudeKm(altitudeKm, 'rayleigh');
		const aerosolDensity = this.relativeDensityAtAltitudeKm(altitudeKm, 'aerosol');
		const rayleigh = {
			r: this.profile.rayleighBetaKm.r * rayleighDensity,
			g: this.profile.rayleighBetaKm.g * rayleighDensity,
			b: this.profile.rayleighBetaKm.b * rayleighDensity,
		};
		const mie = {
			r: this.profile.mieScatteringBetaKm.r * aerosolDensity,
			g: this.profile.mieScatteringBetaKm.g * aerosolDensity,
			b: this.profile.mieScatteringBetaKm.b * aerosolDensity,
		};

		return Object.freeze({
			rayleigh: Object.freeze(rayleigh),
			mie: Object.freeze(mie),
			combined: Object.freeze(addRgb(rayleigh, mie)),
		});
	}

	/**
	 * Calculate the Rayleigh phase term for a scattering angle cosine.
	 *
	 * @param {number} cosTheta - Specify the cosine between view and light directions.
	 * @returns {number}
	 */
	rayleighPhase(cosTheta) {
		const mu = clamp(Number(cosTheta), -1, 1);

		return (3 / (16 * Math.PI)) * (1 + mu * mu);
	}

	/**
	 * Calculate the Mie phase term for a scattering angle cosine.
	 *
	 * @param {number} cosTheta - Specify the cosine between view and light directions.
	 * @param {number} anisotropy - Specify the Henyey-Greenstein anisotropy value.
	 * @returns {number}
	 */
	miePhase(cosTheta, anisotropy = this.profile.mieAnisotropy) {
		const mu = clamp(Number(cosTheta), -1, 1);
		const g = clamp(Number(anisotropy), -0.99, 0.99);
		const denominator = Math.pow(Math.max(1 + g * g - 2 * g * mu, EPSILON), 1.5);

		return (1 - g * g) / (4 * Math.PI * denominator);
	}

	/**
	 * Find where a ray exits the active atmosphere frame.
	 *
	 * @param {Partial<FlatVector3>} origin - Specify ray origin.
	 * @param {Partial<FlatVector3>} direction - Specify ray direction.
	 * @returns {number | null}
	 */
	atmosphereExitDistanceKm(origin, direction) {
		const start = vectorFrom(origin);
		const rayDirection = normalize(vectorFrom(direction));

		if (this.frame.kind === 'spherical-shell') {
			const localOrigin = subtract(start, this.frame.planetCenter);
			const outerRadiusKm = this.frame.planetRadiusKm + this.profile.topAltitudeKm;

			return Atmosphere.solveSphericalExitDistance(localOrigin, rayDirection, outerRadiusKm);
		}

		const startAltitudeKm = this.altitudeKm(start);
		const vertical = dot(rayDirection, this.frame.up);

		if (Math.abs(vertical) < 1e-9) {
			return null;
		}

		const boundaryAltitudeKm = vertical > 0 ? this.profile.topAltitudeKm : 0;
		const distanceKm = (boundaryAltitudeKm - startAltitudeKm) / vertical;

		return distanceKm > 0 ? distanceKm : null;
	}

	/**
	 * Find where a ray intersects the ground or planet.
	 *
	 * @param {Partial<FlatVector3>} origin - Specify ray origin.
	 * @param {Partial<FlatVector3>} direction - Specify ray direction.
	 * @returns {number | null}
	 */
	groundIntersectionDistanceKm(origin, direction) {
		const start = vectorFrom(origin);
		const rayDirection = normalize(vectorFrom(direction));

		if (this.frame.kind === 'spherical-shell') {
			const localOrigin = subtract(start, this.frame.planetCenter);

			return Atmosphere.solveSphericalNearestIntersectionDistance(
				localOrigin,
				rayDirection,
				this.frame.planetRadiusKm,
			);
		}

		const startAltitudeKm = this.altitudeKm(start);
		const vertical = dot(rayDirection, this.frame.up);

		if (vertical >= -EPSILON) {
			return null;
		}

		const distanceKm = -startAltitudeKm / vertical;

		return distanceKm > EPSILON ? distanceKm : null;
	}

	/**
	 * Check whether the active ground/planet frame blocks light from a sample.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the atmospheric sample position.
	 * @param {Sun | FlatSunConfig | null | undefined} light - Specify a light override.
	 * @returns {boolean}
	 */
	isShadowedFromLight(position, light = undefined) {
		const sun = this.resolveSun(light);

		if (!sun) {
			return false;
		}

		const samplePosition = vectorFrom(position);
		const lightDirection = sun.directionFrom(samplePosition);
		const lightDistanceKm = sun.distanceFrom(samplePosition);
		const groundDistanceKm = this.groundIntersectionDistanceKm(samplePosition, lightDirection);

		return groundDistanceKm !== null && groundDistanceKm < lightDistanceKm;
	}

	/**
	 * Sample transmittance from an atmospheric point toward a light source.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the atmospheric sample position.
	 * @param {Sun | FlatSunConfig | null | undefined} light - Specify a light override.
	 * @param {FlatAtmosphereLightSampleOptions} options - Configure light-path sampling.
	 * @returns {Readonly<FlatAtmosphereLightTransmittanceSample>}
	 */
	sampleLightTransmittance(position, light = undefined, options = {}) {
		const sun = this.resolveSun(light);

		if (!sun || this.isShadowedFromLight(position, sun)) {
			return Object.freeze({
				shadowed: true,
				distanceKm: 0,
				transmittance: Object.freeze({ r: 0, g: 0, b: 0 }),
			});
		}

		const samplePosition = vectorFrom(position);
		const lightDirection = sun.directionFrom(samplePosition);
		const lightDistanceKm = sun.distanceFrom(samplePosition);
		const atmosphereExitDistanceKm = this.atmosphereExitDistanceKm(samplePosition, lightDirection);
		const defaultMaxDistanceKm = this.profile.topAltitudeKm * 20;
		const maxLightDistanceKm = Number(options.maxLightDistanceKm ?? defaultMaxDistanceKm);
		const resolvedDistanceKm = Math.min(
			Number.isFinite(lightDistanceKm) ? lightDistanceKm : Infinity,
			atmosphereExitDistanceKm ?? maxLightDistanceKm,
			Number.isFinite(maxLightDistanceKm) ? maxLightDistanceKm : defaultMaxDistanceKm,
		);

		if (!Number.isFinite(resolvedDistanceKm) || resolvedDistanceKm <= 0) {
			return Object.freeze({
				shadowed: false,
				distanceKm: 0,
				transmittance: Object.freeze({ r: 1, g: 1, b: 1 }),
			});
		}

		const sample = this.sampleRay(samplePosition, lightDirection, resolvedDistanceKm, {
			steps: options.steps,
		});

		return Object.freeze({
			shadowed: false,
			distanceKm: resolvedDistanceKm,
			transmittance: sample.transmittance,
			opticalDepth: sample.opticalDepth,
		});
	}

	/**
	 * Sample optical depth along a ray with a finite distance.
	 *
	 * @param {Partial<FlatVector3>} origin - Specify ray origin.
	 * @param {Partial<FlatVector3>} direction - Specify ray direction.
	 * @param {number} distanceKm - Specify ray distance in kilometers.
	 * @param {FlatAtmosphereSampleOptions} options - Configure integration.
	 * @returns {Readonly<FlatAtmosphereSample>}
	 */
	sampleRay(origin, direction, distanceKm, options = {}) {
		const start = vectorFrom(origin);
		const rayDirection = normalize(vectorFrom(direction));
		const end = add(start, scale(rayDirection, Number(distanceKm)));

		return this.sampleSegment(start, end, options);
	}

	/**
	 * Sample optical depth between two scene positions.
	 *
	 * @param {Partial<FlatVector3>} from - Specify the segment start.
	 * @param {Partial<FlatVector3>} to - Specify the segment end.
	 * @param {FlatAtmosphereSampleOptions} options - Configure integration.
	 * @returns {Readonly<FlatAtmosphereSample>}
	 */
	sampleSegment(from, to, options = {}) {
		const start = vectorFrom(from);
		const end = vectorFrom(to);
		const segment = subtract(end, start);
		const totalDistanceKm = length(segment);

		if (totalDistanceKm === 0) {
			return Atmosphere.emptySample();
		}

		const steps = stepsFrom(options.steps ?? this.profile.integrationSteps);
		const stepDistanceKm = totalDistanceKm / steps;
		let atmosphereDistanceKm = 0;
		let rayleighColumnDensityKgM3Km = 0;
		let aerosolColumnDensityKgM3Km = 0;
		let opticalDepthR = 0;
		let opticalDepthG = 0;
		let opticalDepthB = 0;

		for (let index = 0; index < steps; index += 1) {
			const ratio = (index + 0.5) / steps;
			const samplePosition = add(start, scale(segment, ratio));
			const altitudeKm = this.altitudeKm(samplePosition);

			if (altitudeKm < 0 || altitudeKm > this.profile.topAltitudeKm) {
				continue;
			}

			const rayleighDensityKgM3 = this.densityKgM3AtAltitudeKm(altitudeKm, 'rayleigh');
			const aerosolDensityKgM3 = this.densityKgM3AtAltitudeKm(altitudeKm, 'aerosol');
			const extinction = this.extinctionCoefficientKmAtAltitudeKm(altitudeKm);

			atmosphereDistanceKm += stepDistanceKm;
			rayleighColumnDensityKgM3Km += rayleighDensityKgM3 * stepDistanceKm;
			aerosolColumnDensityKgM3Km += aerosolDensityKgM3 * stepDistanceKm;
			opticalDepthR += extinction.r * stepDistanceKm;
			opticalDepthG += extinction.g * stepDistanceKm;
			opticalDepthB += extinction.b * stepDistanceKm;
		}

		const transmittance = {
			r: Math.exp(-opticalDepthR),
			g: Math.exp(-opticalDepthG),
			b: Math.exp(-opticalDepthB),
		};
		const averageTransmittance = (transmittance.r + transmittance.g + transmittance.b) / 3;

		return Object.freeze({
			distanceKm: totalDistanceKm,
			atmosphereDistanceKm,
			rayleighColumnDensityKgM3Km,
			aerosolColumnDensityKgM3Km,
			averageRayleighDensityKgM3: atmosphereDistanceKm > 0
				? rayleighColumnDensityKgM3Km / atmosphereDistanceKm
				: 0,
			averageAerosolDensityKgM3: atmosphereDistanceKm > 0
				? aerosolColumnDensityKgM3Km / atmosphereDistanceKm
				: 0,
			opticalDepth: Object.freeze({
				r: opticalDepthR,
				g: opticalDepthG,
				b: opticalDepthB,
			}),
			transmittance: Object.freeze(transmittance),
			airlight: clamp((1 - averageTransmittance) * this.profile.maxAirlight, 0, this.profile.maxAirlight),
		});
	}

	/**
	 * Sample single scattering along a view ray.
	 *
	 * The method integrates camera-to-sample transmittance, sample-to-light
	 * transmittance, Rayleigh/Mie phase functions, and direct-light shadowing.
	 *
	 * @param {Partial<FlatVector3>} origin - Specify view ray origin.
	 * @param {Partial<FlatVector3>} direction - Specify view ray direction.
	 * @param {number} distanceKm - Specify view ray distance in kilometers.
	 * @param {FlatAtmosphereSingleScatteringOptions} options - Configure view and light sampling.
	 * @returns {Readonly<FlatAtmosphereSingleScatteringSample>}
	 */
	sampleSingleScatteringRay(origin, direction, distanceKm, options = {}) {
		const start = vectorFrom(origin);
		const rayDirection = normalize(vectorFrom(direction));
		const totalDistanceKm = Number(distanceKm);

		if (!Number.isFinite(totalDistanceKm) || totalDistanceKm < 0) {
			throw new Error('Atmosphere single-scattering distanceKm must be a finite non-negative number.');
		}

		const sun = this.resolveSun(options.light ?? options.sun);
		const steps = stepsFrom(options.steps ?? this.profile.integrationSteps);
		const lightSteps = stepsFrom(options.lightSteps ?? Math.max(1, Math.ceil(steps / 2)));
		const stepDistanceKm = totalDistanceKm / steps;
		const opticalDepth = { r: 0, g: 0, b: 0 };
		let atmosphereDistanceKm = 0;
		let shadowedSamples = 0;
		let inScatteredLight = { r: 0, g: 0, b: 0 };

		if (totalDistanceKm === 0) {
			return Object.freeze({
				distanceKm: 0,
				atmosphereDistanceKm: 0,
				shadowedSamples: 0,
				light: sun ? sun.getState() : null,
				opticalDepth: Object.freeze({ ...opticalDepth }),
				transmittance: Object.freeze({ r: 1, g: 1, b: 1 }),
				inScatteredLight: Object.freeze(inScatteredLight),
				airlight: 0,
			});
		}

		for (let index = 0; index < steps; index += 1) {
			const sampleDistanceKm = (index + 0.5) * stepDistanceKm;
			const samplePosition = add(start, scale(rayDirection, sampleDistanceKm));
			const altitudeKm = this.altitudeKm(samplePosition);

			if (altitudeKm < 0 || altitudeKm > this.profile.topAltitudeKm) {
				continue;
			}

			const extinction = this.extinctionCoefficientKmAtAltitudeKm(altitudeKm);
			const viewOpticalDepth = {
				r: opticalDepth.r + extinction.r * stepDistanceKm * 0.5,
				g: opticalDepth.g + extinction.g * stepDistanceKm * 0.5,
				b: opticalDepth.b + extinction.b * stepDistanceKm * 0.5,
			};
			const viewTransmittance = Atmosphere.transmittanceFromOpticalDepth(viewOpticalDepth);

			if (sun) {
				const lightSample = this.sampleLightTransmittance(samplePosition, sun, {
					steps: lightSteps,
					maxLightDistanceKm: options.maxLightDistanceKm,
				});

				if (lightSample.shadowed) {
					shadowedSamples += 1;
				} else {
					const light = sun.lightFrom(samplePosition);
					const cosTheta = clamp(dot(rayDirection, light.direction), -1, 1);
					const coefficients = this.scatteringCoefficientKmAtAltitudeKm(altitudeKm);
					const rayleighScattering = scaleRgb(coefficients.rayleigh, this.rayleighPhase(cosTheta));
					const mieScattering = scaleRgb(coefficients.mie, this.miePhase(cosTheta));
					const scattering = addRgb(rayleighScattering, mieScattering);
					const lightColor = scaleRgb(light.color, light.solarIrradianceScale);
					const transmittedLight = multiplyRgb(
						multiplyRgb(viewTransmittance, lightSample.transmittance),
						multiplyRgb(scattering, lightColor),
					);

					inScatteredLight = addRgb(inScatteredLight, scaleRgb(transmittedLight, stepDistanceKm));
				}
			}

			atmosphereDistanceKm += stepDistanceKm;
			opticalDepth.r += extinction.r * stepDistanceKm;
			opticalDepth.g += extinction.g * stepDistanceKm;
			opticalDepth.b += extinction.b * stepDistanceKm;
		}

		const transmittance = Atmosphere.transmittanceFromOpticalDepth(opticalDepth);
		const averageInScatteredLight = (
			inScatteredLight.r
			+ inScatteredLight.g
			+ inScatteredLight.b
		) / 3;

		return Object.freeze({
			distanceKm: totalDistanceKm,
			atmosphereDistanceKm,
			shadowedSamples,
			light: sun ? sun.getState() : null,
			opticalDepth: Object.freeze(opticalDepth),
			transmittance,
			inScatteredLight: Object.freeze(inScatteredLight),
			airlight: clamp(averageInScatteredLight, 0, this.profile.maxAirlight),
		});
	}

	/**
	 * Sample optical depth from a position until the ray exits the atmosphere.
	 *
	 * @param {Partial<FlatVector3>} origin - Specify ray origin.
	 * @param {Partial<FlatVector3>} direction - Specify ray direction.
	 * @param {FlatAtmosphereSampleOptions} options - Configure integration.
	 * @returns {Readonly<FlatAtmosphereSample>}
	 */
	sampleToAtmosphereExit(origin, direction, options = {}) {
		const distanceKm = this.atmosphereExitDistanceKm(origin, direction);

		if (distanceKm === null) {
			return Atmosphere.emptySample();
		}

		return this.sampleRay(origin, direction, distanceKm, options);
	}

	/**
	 * Sample single scattering until the ray exits the atmosphere.
	 *
	 * @param {Partial<FlatVector3>} origin - Specify view ray origin.
	 * @param {Partial<FlatVector3>} direction - Specify view ray direction.
	 * @param {FlatAtmosphereSingleScatteringOptions} options - Configure view and light sampling.
	 * @returns {Readonly<FlatAtmosphereSingleScatteringSample>}
	 */
	sampleSingleScatteringToAtmosphereExit(origin, direction, options = {}) {
		const distanceKm = this.atmosphereExitDistanceKm(origin, direction);

		if (distanceKm === null) {
			return this.sampleSingleScatteringRay(origin, direction, 0, options);
		}

		return this.sampleSingleScatteringRay(origin, direction, distanceKm, options);
	}

	/**
	 * Create plain shader uniform values for the active atmosphere and sun.
	 *
	 * @returns {Readonly<FlatAtmosphereShaderUniforms>}
	 */
	createShaderUniforms() {
		const sunUniforms = this.sun ? this.sun.createShaderUniforms() : {};

		return Object.freeze({
			atmosphereFrameKind: this.frame.kind,
			atmosphereTopAltitudeKm: this.profile.topAltitudeKm,
			atmosphereSeaLevelDensityKgM3: this.profile.seaLevelDensityKgM3,
			atmosphereRayleighScaleHeightKm: this.profile.rayleighScaleHeightKm,
			atmosphereAerosolScaleHeightKm: this.profile.aerosolScaleHeightKm,
			atmosphereRayleighBetaKm: Object.freeze([
				this.profile.rayleighBetaKm.r,
				this.profile.rayleighBetaKm.g,
				this.profile.rayleighBetaKm.b,
			]),
			atmosphereMieBetaKm: Object.freeze([
				this.profile.mieScatteringBetaKm.r,
				this.profile.mieScatteringBetaKm.g,
				this.profile.mieScatteringBetaKm.b,
			]),
			atmosphereMieExtinctionBetaKm: Object.freeze([
				this.profile.mieExtinctionBetaKm.r,
				this.profile.mieExtinctionBetaKm.g,
				this.profile.mieExtinctionBetaKm.b,
			]),
			atmosphereMieScatteringBetaKm: Object.freeze([
				this.profile.mieScatteringBetaKm.r,
				this.profile.mieScatteringBetaKm.g,
				this.profile.mieScatteringBetaKm.b,
			]),
			atmosphereMieAnisotropy: this.profile.mieAnisotropy,
			atmosphereAirlightColor: this.profile.airlightColor,
			atmosphereMaxAirlight: this.profile.maxAirlight,
			atmosphereIntegrationSteps: this.profile.integrationSteps,
			atmosphereFrame: this.getFrame(),
			...sunUniforms,
		});
	}
}
