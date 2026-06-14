export interface FlatAnimationPlayback {
	/**
	 * Select live interval-driven playback or a fixed simulation pose.
	 */
	mode: "live" | "fixed";

	/**
	 * Store the fixed simulated elapsed time in seconds.
	 */
	fixedSimulatedElapsedSeconds?: number;

	/**
	 * Store the fixed solar-day rotation angle in radians.
	 */
	fixedSolarRotationAngleRad?: number;

	/**
	 * Explain why a fixed playback pose was selected.
	 */
	reason?: string;
}

export interface FlatAnimationCycleTiming {
	/**
	 * Identify the cycle.
	 */
	id: "solarDay" | "siderealDay";

	/**
	 * Store simulated duration in hours.
	 */
	simulatedDurationHours: number;

	/**
	 * Store simulated duration in seconds.
	 */
	simulatedDurationSeconds: number;

	/**
	 * Store real display seconds per full cycle.
	 */
	displayDurationSeconds: number;
}

export interface FlatAnimationCycleState extends FlatAnimationCycleTiming {
	/**
	 * Store normalized position within the current cycle.
	 */
	cycleRatio: number;

	/**
	 * Store rotation angle for this cycle.
	 */
	rotationAngleRad: number;

	/**
	 * Count completed cycles.
	 */
	completedCycles: number;
}

export interface FlatAnimationCycles {
	/**
	 * Store simulated seconds advanced per real second.
	 */
	simulatedSecondsPerRealSecond: number;

	/**
	 * Store solar-day cycle timing.
	 */
	solarDay: FlatAnimationCycleTiming;

	/**
	 * Store sidereal-day cycle timing.
	 */
	siderealDay: FlatAnimationCycleTiming;
}

export interface FlatAnimationLoopConfiguration {
	/**
	 * Store animation playback behavior.
	 */
	playback?: FlatAnimationPlayback;

	/**
	 * Store the solar-day loop.
	 */
	solarDay?: {
		simulatedDurationHours?: number;
		displayDurationSeconds?: number;
	};

	/**
	 * Store the sidereal-day loop.
	 */
	siderealDay?: {
		simulatedDurationHours?: number;
		displayDurationSeconds?: number;
	};
}

export interface FlatAnimationFrame {
	/**
	 * Store the resolved simulated elapsed time.
	 */
	simulatedElapsedSeconds: number;

	/**
	 * Store the previously resolved simulated elapsed time.
	 */
	previousSimulatedElapsedSeconds: number;

	/**
	 * Store the simulated-time delta since the previous frame.
	 */
	deltaSimulatedSeconds: number;

	/**
	 * Store elapsed real service time in seconds.
	 */
	realElapsedSeconds: number;

	/**
	 * Store elapsed real time for this frame.
	 */
	deltaRealSeconds: number;

	/**
	 * Count frames emitted by the animation loop.
	 */
	frameIndex: number;

	/**
	 * Store the playback settings used to resolve this frame.
	 */
	playback: FlatAnimationPlayback;

	/**
	 * Store resolved cycle timing.
	 */
	cycles: FlatAnimationCycles;

	/**
	 * Store solar-day cycle state.
	 */
	solarDay: FlatAnimationCycleState;

	/**
	 * Store sidereal-day cycle state.
	 */
	siderealDay: FlatAnimationCycleState;

	/**
	 * Store named rotation angles for consumers.
	 */
	rotationAngles: {
		solarDayRad: number;
		siderealDayRad: number;
	};
}

export interface FlatAnimationLoopStartOptions {
	/**
	 * Store milliseconds between service-owned interval ticks after ready.
	 */
	intervalMs?: number;

	/**
	 * Disable the ready-time internal interval, usually for deterministic tests.
	 */
	autoStart?: boolean;

	/**
	 * Store the initial service timestamp in milliseconds.
	 */
	initialTimestampMs?: number;
}

export interface AnimationLoopService {
	/**
	 * Initialize local clock state before services are guaranteed ready.
	 */
	start(options?: FlatAnimationLoopStartOptions): void;

	/**
	 * Start the service-owned interval after the registry is ready.
	 */
	ready(): void;

	/**
	 * Stop the service-owned interval.
	 */
	stop(): void;

	/**
	 * Configure cycle timing and playback from a scene animation model.
	 */
	configure(animation?: FlatAnimationLoopConfiguration | null): FlatAnimationFrame;

	/**
	 * Set playback behavior without changing cycle timing.
	 */
	setPlayback(playback?: FlatAnimationPlayback | null): FlatAnimationPlayback;

	/**
	 * Return the current playback settings.
	 */
	getPlayback(): FlatAnimationPlayback;

	/**
	 * Return resolved solar and sidereal cycle timing.
	 */
	getCycles(): FlatAnimationCycles;

	/**
	 * Return the latest simulation frame.
	 */
	getFrame(): FlatAnimationFrame;

	/**
	 * Return the current simulated elapsed time.
	 */
	getSimulatedElapsedSeconds(): number;

	/**
	 * Return the current solar and sidereal rotation angles.
	 */
	getRotationAngles(): { solarDayRad: number, siderealDayRad: number };

	/**
	 * Advance the simulation from the service clock and notify subscribers.
	 */
	advance(timestampMs?: number | null): FlatAnimationFrame;

	/**
	 * Listen for animation frames.
	 */
	listenFrame(callback: (frame: FlatAnimationFrame) => void): string;

	/**
	 * Stop listening for animation frames.
	 */
	unlistenFrame(listenerId: string): void;
}
