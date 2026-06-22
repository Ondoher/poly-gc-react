/**
 * Resolve surface radiance visible through the view path.
 */
export default class ResolveSurfaceRadianceStage {
	/**
	 * Create the surface-radiance stage helper.
	 *
	 * @param {{ descriptor: AtmosphereReferenceStageDescriptor, context?: Readonly<AtmosphereReferenceIntegratorOptions> }} options - Configure the stage helper.
	 */
	constructor({ descriptor, context } = {}) {
		/**
		 * Store this stage's descriptor for history and error context.
		 *
		 * @type {AtmosphereReferenceStageDescriptor}
		 */
		this.descriptor = descriptor;

		/**
		 * Store integrator defaults for helpers that need them.
		 *
		 * @type {Readonly<AtmosphereReferenceIntegratorOptions> | undefined}
		 */
		this.context = context;
	}

	/**
	 * Resolve surface radiance and view attenuation.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide prepared surface and transmittance data.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const wavelengthsNm = this.resolveWavelengths(packet);
		const hit = packet.rayPath?.surfaceHit ?? null;

		if (!hit) {
			// Reason: without a selected visible surface hit, this component contributes zero radiance.
			// Source: Stage Contracts, resolveSurfaceRadiance no-hit output shape.
			return {
				...packet,
				surfaceRadiance: {
					hit: null,
					viewAttenuatedRadianceByWavelength: wavelengthsNm.map(() => 0),
					metadata: { hasSurfaceHit: false },
				},
				stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
			};
		}

		const model = packet.validatedRequest?.model;
		const normal = this.resolveNormal(model, hit);
		const directIrradianceByWavelength = this.resolveDirectIrradiance(
			packet.solarTransmittance?.surfacePoint,
			wavelengthsNm,
		);
		const directCosTheta = this.resolveDirectCosTheta(
			packet.solarTransmittance?.surfacePoint,
			normal,
		);
		const diffuseSkyIrradianceByWavelength = wavelengthsNm.map(() => 0);
		const surfaceLeavingRadianceByWavelength = this.resolveSurfaceLeavingRadiance(
			model,
			hit,
			wavelengthsNm,
			{
				normal,
				directIrradianceByWavelength,
				directCosTheta,
				diffuseSkyIrradianceByWavelength,
			},
		);
		const viewTransmittance = this.validateArray(
			packet.viewOpticalDepth?.pathEnd?.viewTransmittanceByWavelength,
			wavelengthsNm,
			'viewOpticalDepth.pathEnd.viewTransmittanceByWavelength',
		);
		const viewAttenuatedRadianceByWavelength = surfaceLeavingRadianceByWavelength.map((
			radiance,
			index,
		) => radiance * viewTransmittance[index]);

		return {
			...packet,
			surfaceRadiance: {
				hit,
				normal,
				directIrradianceByWavelength,
				diffuseSkyIrradianceByWavelength,
				surfaceLeavingRadianceByWavelength,
				viewAttenuatedRadianceByWavelength,
				components: {
					directByWavelength: surfaceLeavingRadianceByWavelength,
					diffuseByWavelength: diffuseSkyIrradianceByWavelength,
					emittedByWavelength: wavelengthsNm.map(() => 0),
				},
				metadata: {
					hasSurfaceHit: true,
					diffuseSkyEnabled: false,
				},
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Resolve wavelength grid.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide packet.
	 * @returns {readonly number[]}
	 */
	resolveWavelengths(packet) {
		const wavelengthsNm = packet.validatedRequest?.wavelengthsNm;

		if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
			// Reason: surface radiance is spectral and must align to validatedRequest.wavelengthsNm.
			// Source: Stage Contracts, resolveSurfaceRadiance input contract.
			throw new Error('resolveSurfaceRadiance requires validatedRequest.wavelengthsNm');
		}

		return wavelengthsNm;
	}

	/**
	 * Resolve direct source irradiance at the surface point.
	 *
	 * @param {AtmosphereReferenceSolarTransmittanceSurfacePoint | undefined} surfacePoint - Provide source handoff.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @returns {number[]}
	 */
	resolveDirectIrradiance(surfacePoint, wavelengthsNm) {
		const direct = wavelengthsNm.map(() => 0);

		for (const sourceSample of surfacePoint?.sourceSamples ?? []) {
			const spectrum = this.validateArray(
				sourceSample.sourceSpectrum?.valuesByWavelength,
				wavelengthsNm,
				'sourceSpectrum',
			);
			const transmittance = this.validateArray(
				sourceSample.sourceTransmittanceByWavelength,
				wavelengthsNm,
				'sourceTransmittanceByWavelength',
			);
			const weight = sourceSample.weight ?? 1;

			for (const [index, value] of spectrum.entries()) {
				// Algorithm source: direct irradiance at the selected surface point
				// is source energy multiplied by model-owned source visibility/
				// transmittance and quadrature weight.
				// See Stage Contracts, resolveSurfaceRadiance ownership.
				direct[index] += value * transmittance[index] * weight;
			}
		}

		return direct;
	}

	/**
	 * Resolve direct-light cosine against surface normal.
	 *
	 * @param {AtmosphereReferenceSolarTransmittanceSurfacePoint | undefined} surfacePoint - Provide source handoff.
	 * @param {readonly number[]} normal - Provide surface normal.
	 * @returns {number}
	 */
	resolveDirectCosTheta(surfacePoint, normal) {
		const direction = surfacePoint?.sourceSamples?.[0]?.direction;

		if (!Array.isArray(direction)) {
			return 0;
		}

		// Reason: direct Lambertian tests use max(cosTheta, 0) for incident light.
		// Source: PBRT Diffuse Reflection; analytic-invariants Lambertian rows.
		return Math.max(0, this.dot(normal, direction));
	}

	/**
	 * Resolve or query the model-owned surface normal.
	 *
	 * @param {AtmosphereReferenceModel | undefined} model - Provide model bundle.
	 * @param {AtmosphereReferenceSurfaceHit} hit - Provide surface hit.
	 * @returns {number[]}
	 */
	resolveNormal(model, hit) {
		const normal = Array.isArray(hit.normal)
			? hit.normal
			: model?.world?.surfaceNormalAt?.(hit);

		return this.validateVector3(normal, 'surface normal');
	}

	/**
	 * Query model-owned surface radiance.
	 *
	 * @param {AtmosphereReferenceModel | undefined} model - Provide model bundle.
	 * @param {AtmosphereReferenceSurfaceHit} hit - Provide surface hit.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @param {unknown} lighting - Provide lighting context.
	 * @returns {number[]}
	 */
	resolveSurfaceLeavingRadiance(model, hit, wavelengthsNm, lighting) {
		if (typeof model?.surface?.radianceAt !== 'function') {
			// Reason: material/BRDF response is model-owned by the surface adapter.
			// Source: Stage Contracts, resolveSurfaceRadiance ownership.
			throw new Error('resolveSurfaceRadiance requires model.surface.radianceAt');
		}

		return this.validateArray(
			model.surface.radianceAt(hit, undefined, lighting),
			wavelengthsNm,
			'surfaceLeavingRadianceByWavelength',
		);
	}

	/**
	 * Validate wavelength-aligned nonnegative values.
	 *
	 * @param {unknown} values - Provide candidate values.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @param {string} label - Identify values.
	 * @returns {number[]}
	 */
	validateArray(values, wavelengthsNm, label) {
		if (!Array.isArray(values) || values.length !== wavelengthsNm.length) {
			throw new RangeError(`resolveSurfaceRadiance ${label} must align to wavelengthsNm`);
		}

		return values.map((value) => {
			if (!Number.isFinite(value) || value < 0) {
				// Reason: radiance, irradiance, and transmittance factors are nonnegative physical terms.
				// Source: PBRT radiometry/diffuse reflection and Stage Contracts, resolveSurfaceRadiance.
				throw new RangeError(`resolveSurfaceRadiance ${label} must be nonnegative finite`);
			}

			return value;
		});
	}

	/**
	 * Validate finite vector.
	 *
	 * @param {unknown} value - Provide vector.
	 * @param {string} label - Identify vector.
	 * @returns {number[]}
	 */
	validateVector3(value, label) {
		if (
			!Array.isArray(value)
			|| value.length !== 3
			|| value.some((component) => !Number.isFinite(component))
		) {
			throw new RangeError(`resolveSurfaceRadiance ${label} must be a finite 3-vector`);
		}

		return value;
	}

	/**
	 * Dot two 3D vectors.
	 *
	 * @param {readonly number[]} a - Provide first vector.
	 * @param {readonly number[]} b - Provide second vector.
	 * @returns {number}
	 */
	dot(a, b) {
		return a.reduce((sum, component, index) => sum + component * b[index], 0);
	}
}
