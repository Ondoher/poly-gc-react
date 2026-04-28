import { boundsToTransformMatrix } from '../visual-component-alignment.js';

describe('visual component alignment', function() {
	it('maintains aspect ratio without exceeding target bounds', function() {
		const sourceBounds = box(353.622, 214.082, 369.792, 235.243);
		const targetBounds = box(22.927, 16, 42.415, 68.571);
		const transform = boundsToTransformMatrix(sourceBounds, targetBounds);
		const alignedWidth = sourceBounds.width * transform.a;
		const alignedHeight = sourceBounds.height * transform.d;

		expect(transform.a).toBeCloseTo(transform.d, 6);
		expect(alignedWidth).toBeLessThanOrEqual(targetBounds.width + 0.000001);
		expect(alignedHeight).toBeLessThanOrEqual(targetBounds.height + 0.000001);
		expect(transform.a).toBeCloseTo(targetBounds.width / sourceBounds.width, 6);
	});
});

function box(left, top, right, bottom) {
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}
