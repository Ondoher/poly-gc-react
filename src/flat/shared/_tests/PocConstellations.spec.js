import { POC_CONSTELLATIONS } from '../projection/PocConstellations.js';
import { POC_STARS } from '../projection/PocStars.js';

describe('POC_CONSTELLATIONS', () => {
	it('defines the requested red asterism overlays', () => {
		expect(POC_CONSTELLATIONS.map((constellation) => constellation.id)).toEqual([
			'big-dipper',
			'little-dipper',
			'orion',
			'southern-cross',
		]);

		for (const constellation of POC_CONSTELLATIONS) {
			expect(constellation.color).toBe('#ff3030');
			expect(constellation.segments.length).toBeGreaterThan(0);
		}
	});

	it('only references stars that exist in the POC fixture', () => {
		const starNames = new Set(POC_STARS.map((star) => star.name));

		for (const constellation of POC_CONSTELLATIONS) {
			for (const segment of constellation.segments) {
				expect(starNames.has(segment[0])).withContext(segment[0]).toBeTrue();
				expect(starNames.has(segment[1])).withContext(segment[1]).toBeTrue();
			}
		}
	});
});
