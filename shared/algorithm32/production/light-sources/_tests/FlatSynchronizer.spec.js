import { readFileSync } from 'node:fs';

import FlatSynchronizer, { FlatSynchronizer as NamedFlatSynchronizer } from '../FlatSynchronizer.js';

/**
 * Read the FlatSynchronizer source.
 *
 * @returns {string} The FlatSynchronizer source text.
 */
function readFlatSynchronizerSource() {
	return readFileSync(new URL('../FlatSynchronizer.js', import.meta.url), 'utf8');
}

describe('FlatSynchronizer', () => {
	it('exports the production class by name and default', () => {
		const source = readFlatSynchronizerSource();

		expect(source).toContain('export class FlatSynchronizer');
		expect(NamedFlatSynchronizer).toBe(FlatSynchronizer);
	});

	it('requires world calibration before resolving a position', () => {
		const synchronizer = new FlatSynchronizer();

		expect(() => synchronizer.getPosition('2026-06-21T12:00:00.000Z'))
			.toThrowError(/calibrateToWorld/);
	});

	it('anchors world mode at solar noon on longitude zero', () => {
		const synchronizer = new FlatSynchronizer().calibrateToWorld();
		const firstPosition = synchronizer.getPosition('2026-06-21T12:00:00.000Z');
		const anchorPosition = synchronizer.getPosition(firstPosition.startTime);

		expect(firstPosition.mode).toBe('world');
		expect(firstPosition.startLongitude).toBe(0);
		expect(firstPosition.startLatitude).toBeCloseTo(23.45, 1);
		expect(anchorPosition.latitude).toBeCloseTo(firstPosition.startLatitude, 12);
		expect(anchorPosition.longitude).toBeCloseTo(0, 12);
		expect(anchorPosition.orbitAngleDegrees).toBeCloseTo(0, 12);
	});

	it('moves longitude through one clockwise 24 hour orbit from the solar-noon anchor', () => {
		const synchronizer = new FlatSynchronizer().calibrateToWorld();
		const anchorPosition = synchronizer.getPosition('2026-03-20T12:00:00.000Z');
		const sixHoursAfterAnchor = new Date(new Date(anchorPosition.startTime).getTime() + 6 * 60 * 60 * 1000);
		const position = synchronizer.getPosition(sixHoursAfterAnchor);

		expect(position.latitude).toBeCloseTo(anchorPosition.startLatitude, 12);
		expect(position.orbitAngleDegrees).toBeCloseTo(90, 12);
		expect(position.longitude).toBeCloseTo(-90, 12);
	});

	it('uses the requested date to resolve the overhead latitude', () => {
		const synchronizer = new FlatSynchronizer().calibrateToWorld();
		const june = synchronizer.getPosition('2026-06-21T12:00:00.000Z');
		const december = synchronizer.getPosition('2026-12-21T12:00:00.000Z');

		expect(june.latitude).toBeGreaterThan(23);
		expect(december.latitude).toBeLessThan(-23);
	});

	it('resolves a position from a closest point and clockwise orbit angle', () => {
		const synchronizer = new FlatSynchronizer();
		const position = synchronizer.getPositionFromClosest(
			'2026-06-21T12:00:00.000Z',
			{ latitude: 37, longitude: -122 },
			90,
		);

		expect(position.mode).toBe('closest');
		expect(position.latitude).toBe(37);
		expect(position.longitude).toBe(148);
		expect(position.startLatitude).toBe(37);
		expect(position.startLongitude).toBe(-122);
		expect(position.startTime).toBe('2026-06-21T12:00:00.000Z');
		expect(position.orbitAngleDegrees).toBe(90);
		expect(position.elapsedMilliseconds).toBe(6 * 60 * 60 * 1000);
	});

	it('accepts compact lat/lon forms for closest-point resolution', () => {
		const synchronizer = new FlatSynchronizer();
		const fromObject = synchronizer.getPositionFromClosest(
			'2026-06-21T12:00:00.000Z',
			{ lat: 10, lon: 20 },
			45,
		);
		const fromArray = synchronizer.getPositionFromClosest(
			'2026-06-21T12:00:00.000Z',
			[10, 20],
			45,
		);

		expect(fromObject).toEqual(fromArray);
		expect(fromObject.longitude).toBe(-25);
	});

	it('normalizes closest-point longitude and orbit angle', () => {
		const synchronizer = new FlatSynchronizer();
		const position = synchronizer.getPositionFromClosest(
			'2026-06-21T12:00:00.000Z',
			{ latitude: 0, longitude: 190 },
			450,
		);

		expect(position.startLongitude).toBe(-170);
		expect(position.orbitAngleDegrees).toBe(90);
		expect(position.longitude).toBe(100);
	});

	it('fails loudly for invalid closest-point inputs', () => {
		const synchronizer = new FlatSynchronizer();

		expect(() => synchronizer.getPositionFromClosest('not-a-date', [0, 0], 0))
			.toThrowError(/valid time/);
		expect(() => synchronizer.getPositionFromClosest('2026-06-21T12:00:00.000Z', [NaN, 0], 0))
			.toThrowError(/finite latitude/);
		expect(() => synchronizer.getPositionFromClosest('2026-06-21T12:00:00.000Z', [0, 0], Infinity))
			.toThrowError(/finite angle/);
	});

	it('resolves time from a date basis, closest point, and orbit angle', () => {
		const synchronizer = new FlatSynchronizer().calibrateToWorld();
		const anchorPosition = synchronizer.getPosition('2026-06-21T12:00:00.000Z');
		const expectedTime = new Date(new Date(anchorPosition.startTime).getTime() + 6 * 60 * 60 * 1000);

		expect(synchronizer.getTimeFromClosest('2026-06-21T12:00:00.000Z', [0, 0], 90))
			.toBe(expectedTime.toISOString());
	});

	it('uses closest longitude so different places resolve different times', () => {
		const synchronizer = new FlatSynchronizer();
		const sanJose = synchronizer.getTimeFromClosest(
			'2026-06-21T12:00:00.000Z',
			{ latitude: 37.3382, longitude: -121.8863 },
			180,
		);
		const boston = synchronizer.getTimeFromClosest(
			'2026-06-21T12:00:00.000Z',
			{ latitude: 42.3601, longitude: -71.0589 },
			180,
		);
		const differenceHours = (new Date(sanJose).getTime() - new Date(boston).getTime()) / (60 * 60 * 1000);

		expect(sanJose).not.toBe(boston);
		expect(differenceHours).toBeCloseTo((121.8863 - 71.0589) / 15, 12);
	});

	it('accepts compact lat/lon forms for closest-time resolution', () => {
		const synchronizer = new FlatSynchronizer();

		expect(synchronizer.getTimeFromClosest(
			'2026-06-21T12:00:00.000Z',
			{ lat: 37, lon: -122 },
			45,
		)).toBe(synchronizer.getTimeFromClosest(
			'2026-06-21T12:00:00.000Z',
			[37, -122],
			45,
		));
	});

	it('normalizes getTimeFromClosest angle', () => {
		const synchronizer = new FlatSynchronizer();

		expect(synchronizer.getTimeFromClosest('2026-06-21T12:00:00.000Z', [0, 0], 450))
			.toBe(synchronizer.getTimeFromClosest('2026-06-21T12:00:00.000Z', [0, 0], 90));
	});

	it('fails loudly for invalid closest-time inputs', () => {
		const synchronizer = new FlatSynchronizer();

		expect(() => synchronizer.getTimeFromClosest('not-a-date', [0, 0], 90))
			.toThrowError(/valid time/);
		expect(() => synchronizer.getTimeFromClosest('2026-06-21T12:00:00.000Z', [NaN, 0], 90))
			.toThrowError(/finite latitude/);
		expect(() => synchronizer.getTimeFromClosest('2026-06-21T12:00:00.000Z', [0, 0], Infinity))
			.toThrowError(/finite angle/);
	});

	it('returns the calibrated surface solar-noon brightness', () => {
		expect(new FlatSynchronizer().getBrightness()).toBe(1000);
		expect(new FlatSynchronizer({ worldSurfaceSolarNoonBrightness: 876 }).getBrightness()).toBe(876);
	});
});
