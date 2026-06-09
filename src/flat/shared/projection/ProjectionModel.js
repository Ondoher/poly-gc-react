const PROJECTION_ROLES = Object.freeze({
	earth: 'earth',
	celestial: 'celestial',
	skySurface: 'sky-surface',
});

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

function cloneRoot(root = {}) {
	return {
		...root,
		lat: finiteNumber(root.lat),
		lon: finiteNumber(root.lon),
		elevationMeters: finiteNumber(root.elevationMeters),
	};
}

export default class ProjectionModel {
	static earthProjections = new Map();
	static celestialProjections = new Map();
	static skySurfaceProjections = new Map();

	static registerEarthProjection(projection) {
		this.registerProjection(PROJECTION_ROLES.earth, projection, this.earthProjections);
	}

	static registerCelestialProjection(projection) {
		this.registerProjection(PROJECTION_ROLES.celestial, projection, this.celestialProjections);
	}

	static registerSkySurfaceProjection(projection) {
		this.registerProjection(PROJECTION_ROLES.skySurface, projection, this.skySurfaceProjections);
	}

	static registerProjection(role, projection, registry) {
		if (!projection?.id) {
			throw new Error(`Cannot register ${role} projection without an id.`);
		}

		if (projection.role !== role) {
			throw new Error(`Projection "${projection.id}" has role "${projection.role}" but must register as "${role}".`);
		}

		registry.set(projection.id, projection);
	}

	static projectionIds(role) {
		return [...this.registryForRole(role).keys()].sort();
	}

	static registryForRole(role) {
		if (role === PROJECTION_ROLES.earth) {
			return this.earthProjections;
		}

		if (role === PROJECTION_ROLES.celestial) {
			return this.celestialProjections;
		}

		if (role === PROJECTION_ROLES.skySurface) {
			return this.skySurfaceProjections;
		}

		throw new Error(`Unknown projection role "${role}".`);
	}

	constructor(config = {}) {
		this.id = config.id || 'projection-model';
		this.options = { ...(config.options || {}) };
		this.earthProjectionId = config.earthProjection || '';
		this.celestialProjectionId = config.celestialProjection || '';
		this.skySurfaceProjectionId = config.skySurfaceProjection || '';
		this.earthProjection = this.resolveProjection(PROJECTION_ROLES.earth, this.earthProjectionId);
		this.celestialProjection = this.resolveProjection(PROJECTION_ROLES.celestial, this.celestialProjectionId);
		this.skySurfaceProjection = this.resolveProjection(PROJECTION_ROLES.skySurface, this.skySurfaceProjectionId);
		this.setRoot(config.root || {});
		this.setTime(config.time || this.options.referenceTime || null);
	}

	resolveProjection(role, id) {
		const registry = this.constructor.registryForRole(role);
		const projection = registry.get(id);

		if (!projection) {
			throw new Error(`Unknown ${role} projection "${id || '(missing)'}".`);
		}

		return projection;
	}

	context() {
		return {
			root: this.getRoot(),
			time: this.getTime(),
			options: this.getOptions(),
			model: this,
		};
	}

	getOptions() {
		return { ...this.options };
	}

	setRoot(root = {}) {
		this.root = cloneRoot(root);
		return this;
	}

	getRoot() {
		return { ...this.root };
	}

	setObserver(observer = {}) {
		return this.setRoot(observer);
	}

	setTime(time) {
		this.time = time instanceof Date ? new Date(time.getTime()) : time;
		return this;
	}

	getTime() {
		return this.time instanceof Date ? new Date(this.time.getTime()) : this.time;
	}

	projectEarthPoint(point = {}) {
		const source = cloneRoot(point);
		const result = this.earthProjection.projectGeo(source, this.context());

		return {
			kind: 'earth-point',
			position: result.position || null,
			projected: result.projected || null,
			visible: result.visible !== false,
			source,
			metadata: result.metadata || {},
		};
	}

	projectObserver(observer = null) {
		return {
			...this.projectEarthPoint(observer || this.getRoot()),
			kind: 'observer',
		};
	}

	projectCelestialPoint(point = {}) {
		const source = {
			...point,
			raDeg: finiteNumber(point.raDeg),
			decDeg: finiteNumber(point.decDeg),
		};
		const result = this.celestialProjection.projectCelestial(source, this.context());

		return {
			kind: 'celestial-point',
			projected: result.projected || null,
			horizontal: result.horizontal || null,
			visible: result.visible !== false,
			source,
			metadata: result.metadata || {},
		};
	}

	projectSkyToSurface(projectedPoint = {}) {
		const result = this.skySurfaceProjection.projectSurface(projectedPoint, this.context());

		return {
			kind: 'sky-surface-point',
			position: result.position || null,
			normal: result.normal || null,
			visible: result.visible !== false,
			metadata: result.metadata || {},
		};
	}

	projectStar(star = {}) {
		const celestial = this.projectCelestialPoint(star);
		const surface = this.projectSkyToSurface(celestial.projected || {});

		return {
			kind: 'star',
			id: star.id || '',
			name: star.name || '',
			position: surface.position,
			projected: celestial.projected,
			horizontal: celestial.horizontal,
			visible: celestial.visible && surface.visible,
			style: this.starStyle(star),
			source: {
				raDeg: celestial.source.raDeg,
				decDeg: celestial.source.decDeg,
				magnitude: finiteNumber(star.magnitude),
				source: star.source || '',
			},
			metadata: {
				...celestial.metadata,
				surface: surface.metadata,
			},
		};
	}

	projectStars(stars = []) {
		return stars.map((star) => this.projectStar(star));
	}

	starStyle(star = {}) {
		const magnitude = finiteNumber(star.magnitude);
		const brightness = clamp(1 - ((magnitude + 1.5) / 8), 0.15, 1);

		return {
			size: clamp(3.5 - magnitude * 0.35, 0.75, 5),
			brightness,
			color: star.color || '#ffffff',
		};
	}

	describe() {
		return {
			id: this.id,
			root: this.getRoot(),
			time: this.getTime(),
			earthProjection: this.earthProjectionId,
			celestialProjection: this.celestialProjectionId,
			skySurfaceProjection: this.skySurfaceProjectionId,
			options: this.getOptions(),
		};
	}
}
