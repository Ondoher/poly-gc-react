import { Service } from '@polylith/core';

const TAU = Math.PI * 2;
const DEFAULT_INTERVAL_MS = 16;
const DEFAULT_SOLAR_DAY_HOURS = 24;
const DEFAULT_SOLAR_DISPLAY_SECONDS = 40;
const DEFAULT_SIDEREAL_DAY_HOURS = 23.9344696;

function finiteNumber(value, fallback) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback) {
	const number = finiteNumber(value, fallback);

	return number > 0 ? number : fallback;
}

/**
 * Normalize a rotation angle into the positive `0..TAU` range.
 *
 * @param {number} angleRad - Provide a rotation angle in radians.
 * @returns {number}
 */
export function normalizeRotationAngleRad(angleRad) {
	const angle = finiteNumber(angleRad, 0);

	return ((angle % TAU) + TAU) % TAU;
}

function cycleRatioFromSimulatedSeconds(simulatedElapsedSeconds, simulatedDurationSeconds) {
	const cyclePosition = simulatedElapsedSeconds / simulatedDurationSeconds;

	return ((cyclePosition % 1) + 1) % 1;
}

function cycleStateFromSimulatedSeconds(simulatedElapsedSeconds, cycle) {
	const cycleRatio = cycleRatioFromSimulatedSeconds(
		simulatedElapsedSeconds,
		cycle.simulatedDurationSeconds,
	);

	return {
		...cycle,
		cycleRatio,
		rotationAngleRad: cycleRatio * TAU,
		completedCycles: Math.floor(simulatedElapsedSeconds / cycle.simulatedDurationSeconds),
	};
}

/**
 * Resolve solar and sidereal cycle timing from scene animation settings.
 *
 * The solar display duration defines the real-to-simulated-time scale. The
 * sidereal display duration is derived from that same scale unless the scene
 * explicitly provides one.
 *
	 * @param {FlatSimulationAnimationPeriods | FlatAnimationLoopConfiguration | null | undefined} animation - Provide animation settings.
 * @returns {FlatAnimationCycles}
 */
export function resolveAnimationCycles(animation = null) {
	const solarInput = animation?.solarDay || {};
	const siderealInput = animation?.siderealDay || {};
	const solarSimulatedDurationHours = positiveNumber(
		solarInput.simulatedDurationHours,
		DEFAULT_SOLAR_DAY_HOURS,
	);
	const solarSimulatedDurationSeconds = solarSimulatedDurationHours * 60 * 60;
	const solarDisplayDurationSeconds = positiveNumber(
		solarInput.displayDurationSeconds,
		DEFAULT_SOLAR_DISPLAY_SECONDS,
	);
	const simulatedSecondsPerRealSecond = solarSimulatedDurationSeconds / solarDisplayDurationSeconds;
	const siderealSimulatedDurationHours = positiveNumber(
		siderealInput.simulatedDurationHours,
		DEFAULT_SIDEREAL_DAY_HOURS,
	);
	const siderealSimulatedDurationSeconds = siderealSimulatedDurationHours * 60 * 60;
	const siderealDisplayDurationSeconds = positiveNumber(
		siderealInput.displayDurationSeconds,
		siderealSimulatedDurationSeconds / simulatedSecondsPerRealSecond,
	);

	return {
		simulatedSecondsPerRealSecond,
		solarDay: {
			id: 'solarDay',
			simulatedDurationHours: solarSimulatedDurationHours,
			simulatedDurationSeconds: solarSimulatedDurationSeconds,
			displayDurationSeconds: solarDisplayDurationSeconds,
		},
		siderealDay: {
			id: 'siderealDay',
			simulatedDurationHours: siderealSimulatedDurationHours,
			simulatedDurationSeconds: siderealSimulatedDurationSeconds,
			displayDurationSeconds: siderealDisplayDurationSeconds,
		},
	};
}

/**
 * Resolve fixed or live playback to a simulation elapsed time.
 *
 * @param {FlatAnimationPlayback | null | undefined} playback - Provide playback settings.
 * @param {number} currentSimulatedElapsedSeconds - Provide the current simulated elapsed time.
 * @param {FlatAnimationCycles} cycles - Provide resolved cycle timing.
 * @returns {number}
 */
export function resolvePlaybackSimulatedElapsedSeconds(
	playback,
	currentSimulatedElapsedSeconds = 0,
	cycles = resolveAnimationCycles(),
) {
	if (playback?.mode !== 'fixed') {
		return finiteNumber(currentSimulatedElapsedSeconds, 0);
	}

	const fixedSimulatedElapsedSeconds = Number(playback.fixedSimulatedElapsedSeconds);

	if (Number.isFinite(fixedSimulatedElapsedSeconds)) {
		return fixedSimulatedElapsedSeconds;
	}

	const fixedSolarRotationAngleRad = Number(playback.fixedSolarRotationAngleRad);

	if (Number.isFinite(fixedSolarRotationAngleRad)) {
		const cycleRatio = normalizeRotationAngleRad(fixedSolarRotationAngleRad) / TAU;

		return cycleRatio * cycles.solarDay.simulatedDurationSeconds;
	}

	return 0;
}

/**
 * Provide framework-neutral simulation time and rotation angles for Flat.
 */
export default class AnimationLoopService extends Service {
	constructor(registry) {
		super('animation-loop', registry);
		this.implement([
			'start',
			'ready',
			'stop',
			'configure',
			'setPlayback',
			'getPlayback',
			'getCycles',
			'getFrame',
			'getSimulatedElapsedSeconds',
			'getRotationAngles',
			'advance',
			'listenFrame',
			'unlistenFrame',
		]);
		this.timerId = null;
		this.intervalMs = DEFAULT_INTERVAL_MS;
		this.cycles = resolveAnimationCycles();
		this.playback = { mode: 'live' };
		this.simulatedElapsedSeconds = 0;
		this.previousSimulatedElapsedSeconds = 0;
		this.realElapsedSeconds = 0;
		this.frameIndex = 0;
		this.lastTimestampMs = Date.now();
		this.frame = this.createFrame(0);
	}

	/**
	 * Initialize local clock state before services are guaranteed ready.
	 *
	 * @param {FlatAnimationLoopStartOptions} options - Configure clock startup.
	 * @returns {void}
	 */
	start(options = {}) {
		this.intervalMs = positiveNumber(options.intervalMs, DEFAULT_INTERVAL_MS);
		this.autoStart = options.autoStart !== false;
		this.cycles = resolveAnimationCycles();
		this.playback = { mode: 'live' };
		this.simulatedElapsedSeconds = 0;
		this.previousSimulatedElapsedSeconds = 0;
		this.realElapsedSeconds = 0;
		this.frameIndex = 0;
		this.lastTimestampMs = finiteNumber(options.initialTimestampMs, Date.now());
		this.frame = this.createFrame(0);

		this.stop();
	}

	/**
	 * Start the service-owned interval after the registry is ready.
	 *
	 * @returns {void}
	 */
	ready() {
		if (!this.autoStart) {
			return;
		}

		this.startInterval();
	}

	/**
	 * Start the internal interval.
	 *
	 * @returns {void}
	 */
	startInterval() {
		this.stop();
		this.lastTimestampMs = Date.now();
		this.timerId = setInterval(() => {
			this.advance();
		}, this.intervalMs);
	}

	/**
	 * Stop the service-owned interval.
	 *
	 * @returns {void}
	 */
	stop() {
		if (!this.timerId) {
			return;
		}

		clearInterval(this.timerId);
		this.timerId = null;
	}

	/**
	 * Configure cycle timing and playback from a scene animation model.
	 *
	 * @param {FlatAnimationLoopConfiguration | null | undefined} animation - Provide animation settings.
	 * @returns {FlatAnimationFrame}
	 */
	configure(animation = null) {
		this.cycles = resolveAnimationCycles(animation);
		this.playback = {
			mode: 'live',
			...(animation?.playback || {}),
		};
		this.simulatedElapsedSeconds = resolvePlaybackSimulatedElapsedSeconds(
			this.playback,
			this.simulatedElapsedSeconds,
			this.cycles,
		);
		this.previousSimulatedElapsedSeconds = this.simulatedElapsedSeconds;
		this.frame = this.createFrame(0);
		this.fire('configuration-updated', this.getCycles());
		this.fire('frame', this.frame);

		return this.getFrame();
	}

	/**
	 * Set playback behavior without changing cycle timing.
	 *
	 * @param {FlatAnimationPlayback | null | undefined} playback - Provide playback settings.
	 * @returns {FlatAnimationPlayback}
	 */
	setPlayback(playback = null) {
		this.playback = {
			mode: 'live',
			...(playback || {}),
		};
		this.simulatedElapsedSeconds = resolvePlaybackSimulatedElapsedSeconds(
			this.playback,
			this.simulatedElapsedSeconds,
			this.cycles,
		);
		this.previousSimulatedElapsedSeconds = this.simulatedElapsedSeconds;
		this.frame = this.createFrame(0);
		this.fire('playback-updated', this.getPlayback());
		this.fire('frame', this.frame);

		return this.getPlayback();
	}

	/**
	 * Return the current playback settings.
	 *
	 * @returns {FlatAnimationPlayback}
	 */
	getPlayback() {
		return { ...this.playback };
	}

	/**
	 * Return resolved solar and sidereal cycle timing.
	 *
	 * @returns {FlatAnimationCycles}
	 */
	getCycles() {
		return {
			simulatedSecondsPerRealSecond: this.cycles.simulatedSecondsPerRealSecond,
			solarDay: { ...this.cycles.solarDay },
			siderealDay: { ...this.cycles.siderealDay },
		};
	}

	/**
	 * Return the latest simulation frame.
	 *
	 * @returns {FlatAnimationFrame}
	 */
	getFrame() {
		return {
			...this.frame,
			playback: this.getPlayback(),
			cycles: this.getCycles(),
			rotationAngles: { ...this.frame.rotationAngles },
		};
	}

	/**
	 * Return the current simulated elapsed time.
	 *
	 * @returns {number}
	 */
	getSimulatedElapsedSeconds() {
		return this.simulatedElapsedSeconds;
	}

	/**
	 * Return the current solar and sidereal rotation angles.
	 *
	 * @returns {{ solarDayRad: number, siderealDayRad: number }}
	 */
	getRotationAngles() {
		return { ...this.frame.rotationAngles };
	}

	/**
	 * Advance the simulation from the service clock and notify subscribers.
	 *
	 * The app normally calls this from the internal interval. Tests can pass a
	 * timestamp to make frame advancement deterministic.
	 *
	 * @param {number | null | undefined} timestampMs - Provide an absolute timestamp in milliseconds.
	 * @returns {FlatAnimationFrame}
	 */
	advance(timestampMs = null) {
		const currentTimestampMs = finiteNumber(timestampMs, Date.now());
		const previousTimestampMs = this.lastTimestampMs ?? currentTimestampMs;
		const deltaRealSeconds = Math.max(
			(currentTimestampMs - previousTimestampMs) / 1000,
			0,
		);

		this.lastTimestampMs = currentTimestampMs;
		this.realElapsedSeconds += deltaRealSeconds;

		if (this.playback.mode === 'fixed') {
			this.simulatedElapsedSeconds = resolvePlaybackSimulatedElapsedSeconds(
				this.playback,
				this.simulatedElapsedSeconds,
				this.cycles,
			);
		} else {
			this.simulatedElapsedSeconds += deltaRealSeconds
				* this.cycles.simulatedSecondsPerRealSecond;
		}

		this.frameIndex += 1;
		this.frame = this.createFrame(deltaRealSeconds);
		this.previousSimulatedElapsedSeconds = this.simulatedElapsedSeconds;
		this.fire('frame', this.frame);

		return this.getFrame();
	}

	/**
	 * Create the current frame value.
	 *
	 * @param {number} deltaRealSeconds - Provide elapsed real time for this frame.
	 * @returns {FlatAnimationFrame}
	 */
	createFrame(deltaRealSeconds) {
		const solarDay = cycleStateFromSimulatedSeconds(
			this.simulatedElapsedSeconds,
			this.cycles.solarDay,
		);
		const siderealDay = cycleStateFromSimulatedSeconds(
			this.simulatedElapsedSeconds,
			this.cycles.siderealDay,
		);

		return {
			simulatedElapsedSeconds: this.simulatedElapsedSeconds,
			previousSimulatedElapsedSeconds: this.previousSimulatedElapsedSeconds,
			deltaSimulatedSeconds: this.simulatedElapsedSeconds
				- this.previousSimulatedElapsedSeconds,
			realElapsedSeconds: this.realElapsedSeconds,
			deltaRealSeconds,
			frameIndex: this.frameIndex,
			playback: this.getPlayback(),
			cycles: this.getCycles(),
			solarDay,
			siderealDay,
			rotationAngles: {
				solarDayRad: solarDay.rotationAngleRad,
				siderealDayRad: siderealDay.rotationAngleRad,
			},
		};
	}

	/**
	 * Listen for animation frames.
	 *
	 * @param {(frame: FlatAnimationFrame) => void} callback - Handle each frame.
	 * @returns {string}
	 */
	listenFrame(callback) {
		return this.listen('frame', callback);
	}

	/**
	 * Stop listening for animation frames.
	 *
	 * @param {string} listenerId - Identify the listener to remove.
	 * @returns {void}
	 */
	unlistenFrame(listenerId) {
		this.unlisten('frame', listenerId);
	}
}

new AnimationLoopService();
