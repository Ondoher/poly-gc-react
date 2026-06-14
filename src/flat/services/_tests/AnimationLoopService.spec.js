import AnimationLoopService, {
	resolveAnimationCycles,
	resolvePlaybackSimulatedElapsedSeconds,
} from '../animation-loop.js';

function createService() {
	const service = new AnimationLoopService({
		register: () => {},
	});

	service.start({
		autoStart: false,
		initialTimestampMs: 0,
	});

	return service;
}

describe('AnimationLoopService', () => {
	it('waits until ready before starting the service-owned interval', () => {
		const service = new AnimationLoopService({
			register: () => {},
		});

		service.start({
			initialTimestampMs: 0,
		});

		expect(service.timerId).toBeNull();

		service.ready();

		expect(service.timerId).not.toBeNull();

		service.stop();

		expect(service.timerId).toBeNull();
	});

	it('resolves solar-driven cycle timing with sidereal control', () => {
		const cycles = resolveAnimationCycles({
			solarDay: {
				simulatedDurationHours: 24,
				displayDurationSeconds: 40,
			},
			siderealDay: {
				simulatedDurationHours: 23.9344696,
			},
		});

		expect(cycles.simulatedSecondsPerRealSecond).toBe(2160);
		expect(cycles.solarDay.displayDurationSeconds).toBe(40);
		expect(cycles.siderealDay.displayDurationSeconds).toBeCloseTo(39.89078266666667, 8);
		expect(cycles.siderealDay.displayDurationSeconds).toBeLessThan(cycles.solarDay.displayDurationSeconds);
	});

	it('resolves fixed playback in simulated time and solar angle terms', () => {
		const cycles = resolveAnimationCycles();

		expect(resolvePlaybackSimulatedElapsedSeconds({
			mode: 'live',
		}, 12.5, cycles)).toBe(12.5);
		expect(resolvePlaybackSimulatedElapsedSeconds({
			mode: 'fixed',
			fixedSimulatedElapsedSeconds: 7,
		}, 12.5, cycles)).toBe(7);
		expect(resolvePlaybackSimulatedElapsedSeconds({
			mode: 'fixed',
			fixedSolarRotationAngleRad: Math.PI,
		}, 12.5, cycles)).toBe(cycles.solarDay.simulatedDurationSeconds / 2);
	});

	it('emits framework-neutral simulation frames from the service clock', () => {
		const service = createService();
		const frames = [];
		const listenerId = service.listenFrame((frame) => frames.push(frame));

		const firstFrame = service.advance(1000);
		const secondFrame = service.advance(2000);

		service.unlistenFrame(listenerId);
		service.advance(3000);

		expect(firstFrame.simulatedElapsedSeconds).toBe(2160);
		expect(firstFrame.previousSimulatedElapsedSeconds).toBe(0);
		expect(firstFrame.deltaSimulatedSeconds).toBe(2160);
		expect(firstFrame.deltaRealSeconds).toBe(1);
		expect(firstFrame.frameIndex).toBe(1);
		expect(firstFrame.rotationAngles.solarDayRad).toBeCloseTo(Math.PI / 20, 8);
		expect(firstFrame.rotationAngles.siderealDayRad).toBeGreaterThan(firstFrame.rotationAngles.solarDayRad);
		expect(secondFrame.simulatedElapsedSeconds).toBe(4320);
		expect(secondFrame.deltaSimulatedSeconds).toBe(2160);
		expect(frames.length).toBe(2);
	});

	it('keeps emitted simulation time fixed when playback is fixed', () => {
		const service = createService();

		service.configure({
			playback: {
				mode: 'fixed',
				fixedSolarRotationAngleRad: Math.PI,
				reason: 'test-fixed-frame',
			},
			solarDay: {
				simulatedDurationHours: 24,
				displayDurationSeconds: 40,
			},
			siderealDay: {
				simulatedDurationHours: 23.9344696,
			},
		});

		const frame = service.advance(40000);

		expect(service.getSimulatedElapsedSeconds()).toBe(43200);
		expect(frame.simulatedElapsedSeconds).toBe(43200);
		expect(frame.deltaSimulatedSeconds).toBe(0);
		expect(frame.rotationAngles.solarDayRad).toBeCloseTo(Math.PI, 8);
		expect(frame.playback.reason).toBe('test-fixed-frame');
	});
});
