import { POC_STARS } from '../projection/PocStars.js';

describe('POC_STARS', () => {
	it('provides a non-empty bright-star fixture for Phase 1 rendering', () => {
		expect(POC_STARS.length).toBeGreaterThan(120);
	});

	it('provides the fields needed by ProjectionModel.projectStar', () => {
		for (const star of POC_STARS) {
			expect(star.id).toEqual(jasmine.any(String));
			expect(star.name).toEqual(jasmine.any(String));
			expect(Number.isFinite(star.raDeg)).toBeTrue();
			expect(Number.isFinite(star.decDeg)).toBeTrue();
			expect(Number.isFinite(star.magnitude)).toBeTrue();
			expect(['iau-bright-named-j2000', 'poc-asterism-j2000']).toContain(star.source);
		}
	});

	it('uses stable unique identifiers', () => {
		const ids = new Set(POC_STARS.map((star) => star.id));

		expect(ids.size).toBe(POC_STARS.length);
	});
});
