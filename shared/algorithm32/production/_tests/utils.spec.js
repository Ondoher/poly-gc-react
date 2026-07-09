import ArrayMath from '../utils/ArrayMath.js';
import AngleMath from '../utils/AngleMath.js';
import DistanceMath from '../utils/DistanceMath.js';
import SampleMath from '../utils/SampleMath.js';
import ScalarMath from '../utils/ScalarMath.js';
import VectorMath from '../utils/VectorMath.js';
import WavelengthMath from '../utils/WavelengthMath.js';
import {
	AngleMath as NamedAngleMath,
	ArrayMath as NamedArrayMath,
	DistanceMath as NamedDistanceMath,
	SampleMath as NamedSampleMath,
	ScalarMath as NamedScalarMath,
	VectorMath as NamedVectorMath,
	WavelengthMath as NamedWavelengthMath,
} from '../utils/MathUtils.js';

describe('Algorithm32 production generic utilities', () => {
	it('exports utility objects by name from MathUtils', () => {
		expect(NamedAngleMath).toBe(AngleMath);
		expect(NamedArrayMath).toBe(ArrayMath);
		expect(NamedDistanceMath).toBe(DistanceMath);
		expect(NamedSampleMath).toBe(SampleMath);
		expect(NamedScalarMath).toBe(ScalarMath);
		expect(NamedVectorMath).toBe(VectorMath);
		expect(NamedWavelengthMath).toBe(WavelengthMath);
	});

	it('provides pure scalar helpers with call-local options', () => {
		expect(ScalarMath.clamp(12, 0, 10)).toBe(10);
		expect(ScalarMath.isFiniteNumber(4)).toBe(true);
		expect(ScalarMath.isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
		expect(ScalarMath.inRange(3, 1, 3)).toBe(true);
		expect(ScalarMath.inRange(3, 1, 3, { inclusive: false })).toBe(false);
		expect(ScalarMath.nearlyEqual(1, 1.01, { epsilon: 0.02 })).toBe(true);
		expect(ScalarMath.lerp(10, 20, 0.25)).toBe(12.5);
		expect(ScalarMath.formatNumber(1000, { precision: 2 })).toBe('1000');
		expect(ScalarMath.formatNumber(1.5, { precision: 3, trim: false })).toBe('1.500');
	});

	it('provides pure angle helpers', () => {
		const { add, inDegrees, inRadians, scale, subtract, toDegrees, toRadians } = AngleMath;

		expect(inDegrees(90)).toEqual({ value: 90, units: 'degrees' });
		expect(inRadians(Math.PI)).toEqual({ value: Math.PI, units: 'radians' });
		expect(toRadians(inDegrees(180))).toBeCloseTo(Math.PI, 12);
		expect(toDegrees(inRadians(Math.PI))).toBeCloseTo(180, 12);
		expect(add(inDegrees(90), inRadians(Math.PI / 2))).toEqual({ value: 180, units: 'degrees' });
		expect(subtract(inRadians(Math.PI), inDegrees(90))).toEqual({ value: Math.PI / 2, units: 'radians' });
		expect(scale(inDegrees(30), 2)).toEqual({ value: 60, units: 'degrees' });
		expect(AngleMath.wrapDegrees(370)).toBe(10);
		expect(AngleMath.wrapRadians(Math.PI * 3)).toBeCloseTo(Math.PI, 12);
	});

	it('provides pure distance helpers', () => {
		const { add, inKilometers, inMeters, scale, subtract, toKilometers, toMeters } = DistanceMath;

		expect(inMeters(1500)).toEqual({ value: 1500, units: 'meters' });
		expect(inKilometers(1.5)).toEqual({ value: 1.5, units: 'kilometers' });
		expect(toMeters(inKilometers(1.5))).toBe(1500);
		expect(toKilometers(inMeters(1500))).toBe(1.5);
		expect(add(inMeters(500), inKilometers(1))).toEqual({ value: 1500, units: 'meters' });
		expect(subtract(inKilometers(2), inMeters(500))).toEqual({ value: 1.5, units: 'kilometers' });
		expect(scale(inKilometers(2), 3)).toEqual({ value: 6, units: 'kilometers' });
	});

	it('provides pure wavelength helpers', () => {
		const { add, inMicrometers, inNanometers, scale, subtract, toMicrometers, toNanometers } = WavelengthMath;

		expect(inNanometers(550)).toEqual({ value: 550, units: 'nanometers' });
		expect(inMicrometers(0.55)).toEqual({ value: 0.55, units: 'micrometers' });
		expect(toNanometers(inMicrometers(0.55))).toBe(550);
		expect(toMicrometers(inNanometers(550))).toBe(0.55);
		expect(add(inNanometers(500), inMicrometers(0.05))).toEqual({ value: 550, units: 'nanometers' });
		expect(subtract(inMicrometers(0.7), inNanometers(100))).toEqual({ value: 0.6, units: 'micrometers' });
		expect(scale(inNanometers(250), 2)).toEqual({ value: 500, units: 'nanometers' });
		expect(() => toNanometers({ value: 550, units: 'nanometer' })).toThrowError(/nanometers/);
	});

	it('provides pure vector-space helpers without mutating inputs', () => {
		const left = [1, 2, 3];
		const right = [4, 5, 6];

		expect(VectorMath.zero(3)).toEqual([0, 0, 0]);
		expect(VectorMath.ones(3)).toEqual([1, 1, 1]);
		expect(VectorMath.filled(3, 7)).toEqual([7, 7, 7]);
		expect(VectorMath.add(left, right)).toEqual([5, 7, 9]);
		expect(VectorMath.subtract(right, left)).toEqual([3, 3, 3]);
		expect(VectorMath.scale(left, 2)).toEqual([2, 4, 6]);
		expect(VectorMath.addScaled(left, right, 0.5)).toEqual([3, 4.5, 6]);
		expect(VectorMath.dot(left, right)).toBe(32);
		expect(VectorMath.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
		expect(VectorMath.length([3, 4])).toBe(5);
		expect(VectorMath.distance([0, 0], [3, 4])).toBe(5);
		expect(VectorMath.normalize([0, 2])).toEqual([0, 1]);
		expect(VectorMath.isFiniteVector([0, 1, 2])).toBe(true);
		expect(VectorMath.isNormalized([0, 1], { epsilon: 0 })).toBe(true);
		expect(left).toEqual([1, 2, 3]);
		expect(right).toEqual([4, 5, 6]);
	});

	it('provides pure numeric array helpers without mutating inputs', () => {
		const left = [1, 2, 3];
		const right = [4, 5, 6];

		expect(ArrayMath.zeros(3)).toEqual([0, 0, 0]);
		expect(ArrayMath.fill(3, 7)).toEqual([7, 7, 7]);
		expect(ArrayMath.add(left, right)).toEqual([5, 7, 9]);
		expect(ArrayMath.multiply(left, right)).toEqual([4, 10, 18]);
		expect(ArrayMath.mean(left)).toBe(2);
		expect(ArrayMath.mean([])).toBe(0);
		expect(ArrayMath.weightedSum(left, [0.5, 1, 2])).toBe(8.5);
		expect(ArrayMath.map(left, (value) => value * 10)).toEqual([10, 20, 30]);
		expect(left).toEqual([1, 2, 3]);
		expect(right).toEqual([4, 5, 6]);
	});

	it('provides pure ordered sample helpers with call-local options', () => {
		const samples = [10, 20, 30];

		expect(SampleMath.nearestSampleIndex(samples, 24)).toBe(1);
		expect(SampleMath.nearestSampleIndex(samples, 4, { clamp: false })).toBe(-1);
		expect(SampleMath.padSamples(samples, { before: 1, after: 2, value: -1 })).toEqual([-1, 10, 20, 30, -1, -1]);
		expect(SampleMath.isMonotonic(samples)).toBe(true);
		expect(SampleMath.isMonotonic([3, 2, 1], { direction: 'descending', strict: true })).toBe(true);
		expect(SampleMath.walkSamples(samples, { direction: 'descending' })).toEqual([
			{ index: 2, value: 30 },
			{ index: 1, value: 20 },
			{ index: 0, value: 10 },
		]);
		expect(SampleMath.sampleSignature([1, 2.5, 1000], { precision: 3, separator: '|' })).toBe('1|2.5|1000');
		expect(samples).toEqual([10, 20, 30]);
	});
});
