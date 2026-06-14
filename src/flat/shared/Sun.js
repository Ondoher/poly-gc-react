import {
	STANDARD_SUN,
} from './consts.js';
import {
	cloneRgb,
	cloneVector,
	finiteNumber,
	length,
	normalize,
	rgbFrom,
	subtract,
	vectorFrom,
} from './math-primitives.js';

/**
 * Resolve directional or point sun state for atmosphere and scene-lighting
 * calculations.
 */
export default class Sun {
	/**
	 * Calculate apparent angular radius from physical radius and distance.
	 *
	 * @param {number} radiusKm - Specify the physical radius in kilometers.
	 * @param {number} distanceKm - Specify the observer/sample distance in kilometers.
	 * @returns {number}
	 */
	static apparentAngularRadiusRad(radiusKm, distanceKm) {
		if (radiusKm <= 0) {
			return 0;
		}

		if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
			return distanceKm === Infinity ? 0 : Math.PI / 2;
		}

		return Math.asin(Math.min(1, radiusKm / distanceKm));
	}

	/**
	 * Resolve a `Sun` instance from an existing instance or configuration.
	 *
	 * @param {Sun | FlatSunConfig | undefined} value - Specify the sun instance or config.
	 * @returns {Sun}
	 */
	static from(value) {
		return value instanceof Sun ? value : new Sun(value);
	}

	/**
	 * Clone the sun anchor into an immutable plain object.
	 *
	 * @param {Partial<FlatSunAnchor> | undefined} anchor - Specify the anchor to clone.
	 * @returns {Readonly<FlatSunAnchor>}
	 */
	static cloneAnchor(anchor) {
		return Object.freeze({
			...(anchor || STANDARD_SUN.anchor),
		});
	}

	/**
	 * Create a sun/light source.
	 *
	 * Directional suns use a normalized direction. Point suns use a scene
	 * position and physical radius so apparent size can be derived from a
	 * sample or observer position.
	 *
	 * @param {FlatSunConfig} config - Configure the sun/light source.
	 */
	constructor(config = {}) {
		const kind = config.kind || STANDARD_SUN.kind;

		if (kind !== 'directional' && kind !== 'point') {
			throw new Error(`Unknown sun kind "${kind}".`);
		}

		/**
		 * Store directional or point-light behavior.
		 *
		 * @type {FlatSunKind}
		 */
		this.kind = kind;
		/**
		 * Store immutable light color.
		 *
		 * @type {Readonly<FlatRgbColor>}
		 */
		this.color = cloneRgb(rgbFrom(config.color, STANDARD_SUN.color));
		this.intensity = Math.max(0, finiteNumber(config.intensity, STANDARD_SUN.intensity));
		this.solarIrradianceScale = Math.max(
			0,
			finiteNumber(config.solarIrradianceScale, STANDARD_SUN.solarIrradianceScale),
		);
		this.angularRadiusRad = Math.max(0, finiteNumber(config.angularRadiusRad, STANDARD_SUN.angularRadiusRad));
		this.radiusKm = Math.max(0, finiteNumber(config.radiusKm, STANDARD_SUN.radiusKm));
		/**
		 * Store the assumption or source that positioned this light.
		 *
		 * @type {Readonly<FlatSunAnchor>}
		 */
		this.anchor = Sun.cloneAnchor(config.anchor);

		if (kind === 'point') {
			/**
			 * Store immutable scene position for point suns.
			 *
			 * @type {Readonly<FlatVector3> | null}
			 */
			this.position = cloneVector(vectorFrom(config.position, { x: 0, y: 1, z: 0 }));
			/**
			 * Store immutable direction for directional suns.
			 *
			 * @type {Readonly<FlatVector3> | null}
			 */
			this.direction = null;
			return;
		}

		/**
		 * Store immutable direction for directional suns.
		 *
		 * @type {Readonly<FlatVector3> | null}
		 */
		this.direction = cloneVector(normalize(
			vectorFrom(config.direction, STANDARD_SUN.direction),
			'Cannot normalize a zero-length sun vector.',
		));
		/**
		 * Store immutable scene position for point suns.
		 *
		 * @type {Readonly<FlatVector3> | null}
		 */
		this.position = null;
	}

	/**
	 * Get serializable sun state.
	 *
	 * @returns {Readonly<FlatSunState>}
	 */
	getState() {
		return Object.freeze({
			kind: this.kind,
			direction: this.direction ? cloneVector(this.direction) : null,
			position: this.position ? cloneVector(this.position) : null,
			color: cloneRgb(this.color),
			intensity: this.intensity,
			solarIrradianceScale: this.solarIrradianceScale,
			angularRadiusRad: this.angularRadiusRad,
			radiusKm: this.radiusKm,
			anchor: Sun.cloneAnchor(this.anchor),
		});
	}

	/**
	 * Resolve direction from a scene/sample position toward this sun.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the sample position.
	 * @returns {Readonly<FlatVector3>}
	 */
	directionFrom(position) {
		if (this.kind === 'directional') {
			return cloneVector(this.direction);
		}

		return cloneVector(normalize(
			subtract(this.position, vectorFrom(position)),
			'Cannot normalize a zero-length sun vector.',
		));
	}

	/**
	 * Resolve distance from a scene/sample position to this sun.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the sample position.
	 * @returns {number}
	 */
	distanceFrom(position) {
		if (this.kind === 'directional') {
			return Infinity;
		}

		return length(subtract(this.position, vectorFrom(position)));
	}

	/**
	 * Resolve apparent angular radius from a scene/sample position.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the sample position.
	 * @returns {number}
	 */
	apparentAngularRadiusFrom(position) {
		if (this.kind === 'directional') {
			return this.angularRadiusRad;
		}

		return Sun.apparentAngularRadiusRad(this.radiusKm, this.distanceFrom(position));
	}

	/**
	 * Resolve apparent angular diameter from a scene/sample position.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the sample position.
	 * @returns {number}
	 */
	apparentAngularDiameterFrom(position) {
		return this.apparentAngularRadiusFrom(position) * 2;
	}

	/**
	 * Resolve full light state from a scene/sample position.
	 *
	 * This includes direction, distance, and apparent angular size relative to
	 * that position.
	 *
	 * @param {Partial<FlatVector3>} position - Specify the sample position.
	 * @returns {Readonly<FlatSunLightState>}
	 */
	lightFrom(position) {
		const apparentAngularRadiusRad = this.apparentAngularRadiusFrom(position);

		return Object.freeze({
			...this.getState(),
			direction: this.directionFrom(position),
			distanceKm: this.distanceFrom(position),
			apparentAngularRadiusRad,
			apparentAngularDiameterRad: apparentAngularRadiusRad * 2,
		});
	}

	/**
	 * Create plain shader uniform values for this sun.
	 *
	 * @param {string} prefix - Specify the uniform name prefix.
	 * @returns {Readonly<FlatSunShaderUniforms>}
	 */
	createShaderUniforms(prefix = 'sun') {
		return Object.freeze({
			[`${prefix}Kind`]: this.kind,
			[`${prefix}Direction`]: this.direction ? Object.freeze([
				this.direction.x,
				this.direction.y,
				this.direction.z,
			]) : null,
			[`${prefix}Position`]: this.position ? Object.freeze([
				this.position.x,
				this.position.y,
				this.position.z,
			]) : null,
			[`${prefix}Color`]: Object.freeze([
				this.color.r,
				this.color.g,
				this.color.b,
			]),
			[`${prefix}Intensity`]: this.intensity,
			[`${prefix}SolarIrradianceScale`]: this.solarIrradianceScale,
			[`${prefix}AngularRadiusRad`]: this.angularRadiusRad,
			[`${prefix}RadiusKm`]: this.radiusKm,
			[`${prefix}Anchor`]: Sun.cloneAnchor(this.anchor),
		});
	}
}
