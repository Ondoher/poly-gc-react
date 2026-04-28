import { autoAssignComponentsToSemanticParts } from '../component-auto-assignment.js';

describe('component auto assignment', function() {
	it('binds labels before assigning remaining artwork', function() {
		const face = {
			family: 'flowers',
			parts: {
				label: part({ role: 'flower-label', contentKind: 'label' }),
				mainArtwork: part({ role: 'main-artwork', contentKind: 'artwork' }),
			},
		};
		const components = [
			component('body-art', box(20, 30, 80, 120), { dominantColor: '#111111' }),
			component('number-label', box(6, 6, 16, 22), { dominantColor: '#FC1D05' }),
		];

		const assignment = autoAssignComponentsToSemanticParts({
			faceKey: 'flower-1',
			face,
			parts: face.parts,
			components,
		});

		expect(assignment.parts.label.componentIds).toEqual(['number-label']);
		expect(assignment.parts.mainArtwork.componentIds).toEqual(['body-art']);
		expect(assignment.components.find((item) => item.componentId === 'number-label').partIds)
			.toEqual(['label']);
		expect(assignment.status).toBe('needs-review-inferred');
		expect(assignment.autoAssignment.status).toBe('complete-inferred');
	});

	it('binds wind labels first and assigns remaining components to the wind glyph', function() {
		const face = {
			family: 'winds',
			parts: {
				label: part({ role: 'wind-label', contentKind: 'label' }),
				glyph: part({ role: 'wind-character', contentKind: 'glyph' }),
			},
		};
		const components = [
			component('wind-character-left', box(25, 30, 45, 110), { dominantColor: '#111111' }),
			component('wind-character-right', box(48, 30, 70, 110), { dominantColor: '#111111' }),
			component('wind-label', box(6, 6, 16, 22), { dominantColor: '#FC1D05' }),
		];

		const assignment = autoAssignComponentsToSemanticParts({
			faceKey: 'wind-n',
			face,
			parts: face.parts,
			components,
		});

		expect(assignment.parts.label.componentIds).toEqual(['wind-label']);
		expect(assignment.parts.glyph.componentIds).toEqual(['wind-character-left', 'wind-character-right']);
		expect(assignment.bindings.map((binding) => binding.partId)).toEqual(['glyph', 'label']);
		expect(assignment.autoAssignment.status).toBe('complete-inferred');
	});

	it('splits character suit body and overhead glyph components', function() {
		const face = {
			family: 'characters',
			parts: {
				label: part({ role: 'suit-label', contentKind: 'label' }),
				body: part({ role: 'character-body', contentKind: 'artwork' }),
				glyph: part({ role: 'character-number-glyph', contentKind: 'glyph' }),
			},
		};
		const components = [
			component('character-body', box(25, 45, 80, 125), { dominantColor: '#111111' }),
			component('overhead-glyph', box(40, 14, 62, 32), { dominantColor: '#0000ff' }),
			component('corner-label', box(6, 6, 16, 22), { dominantColor: '#FC1D05' }),
		];

		const assignment = autoAssignComponentsToSemanticParts({
			faceKey: 'c-1',
			face,
			parts: face.parts,
			components,
			assignmentHints: {
				role: {
					'character-body': { region: 'body', position: 'center' },
					'character-number-glyph': { region: 'top' },
				},
			},
		});

		expect(assignment.parts.label.componentIds).toEqual(['corner-label']);
		expect(assignment.parts.body.componentIds).toEqual(['character-body']);
		expect(assignment.parts.glyph.componentIds).toEqual(['overhead-glyph']);
		expect(assignment.status).toBe('needs-review-inferred');
	});

	it('binds repeated artwork by position when part and component counts match', function() {
		const face = {
			family: 'dots',
			parts: {
				'dot.1': part({ role: 'dot', contentKind: 'artwork' }),
				'dot.2': part({ role: 'dot', contentKind: 'artwork' }),
				'dot.3': part({ role: 'dot', contentKind: 'artwork' }),
			},
		};
		const components = [
			component('bottom-dot', box(40, 70, 50, 80)),
			component('top-left-dot', box(10, 10, 20, 20)),
			component('top-right-dot', box(70, 10, 80, 20)),
		];

		const assignment = autoAssignComponentsToSemanticParts({
			faceKey: 'd-3',
			face,
			parts: face.parts,
			components,
		});

		expect(assignment.parts['dot.1'].componentIds).toEqual(['top-left-dot']);
		expect(assignment.parts['dot.2'].componentIds).toEqual(['top-right-dot']);
		expect(assignment.parts['dot.3'].componentIds).toEqual(['bottom-dot']);
		expect(assignment.bindings.every((binding) => binding.strategy === 'auto-repeated-position-order'))
			.toBe(true);
		expect(assignment.autoAssignment.status).toBe('complete-inferred');
	});

	it('does not invent repeated artwork bindings when counts mismatch', function() {
		const face = {
			family: 'dots',
			parts: {
				'dot.1': part({ role: 'dot', contentKind: 'artwork' }),
				'dot.2': part({ role: 'dot', contentKind: 'artwork' }),
				'dot.3': part({ role: 'dot', contentKind: 'artwork' }),
			},
		};
		const components = [
			component('top-left-dot', box(10, 10, 20, 20)),
			component('top-right-dot', box(70, 10, 80, 20)),
		];

		const assignment = autoAssignComponentsToSemanticParts({
			faceKey: 'd-3',
			face,
			parts: face.parts,
			components,
		});

		expect(assignment.bindings).toEqual([]);
		expect(Object.values(assignment.parts).every((item) => item.bindingStatus === 'unbound')).toBe(true);
		expect(assignment.status).toBe('needs-review');
		expect(assignment.autoAssignment.status).toBe('partial-inferred');
		expect(assignment.autoAssignment.diagnostics).toEqual([jasmine.objectContaining({
			code: 'auto-assignment-repeated-count-mismatch',
		})]);
	});

	it('marks partial inferred assignments when some parts remain unbound', function() {
		const face = {
			family: 'flowers',
			parts: {
				label: part({ role: 'flower-label', contentKind: 'label' }),
				glyph: part({ role: 'flower-character', contentKind: 'glyph' }),
				mainArtwork: part({ role: 'main-artwork', contentKind: 'artwork' }),
			},
		};
		const components = [
			component('main-art', box(25, 45, 80, 125), { dominantColor: '#111111' }),
			component('number-label', box(6, 6, 16, 22), { dominantColor: '#FC1D05' }),
		];

		const assignment = autoAssignComponentsToSemanticParts({
			faceKey: 'flower-1',
			face,
			parts: face.parts,
			components,
		});

		expect(assignment.parts.label.bindingStatus).toBe('bound');
		expect(assignment.parts.glyph.bindingStatus).toBe('unbound');
		expect(assignment.parts.mainArtwork.bindingStatus).toBe('bound');
		expect(assignment.status).toBe('needs-review');
		expect(assignment.autoAssignment.status).toBe('partial-inferred');
	});
});

function part(overrides = {}) {
	return {
		role: 'main-artwork',
		contentKind: 'artwork',
		...overrides,
	};
}

function component(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: bounds.width * bounds.height,
		dominantColor: '#111111',
		...overrides,
	};
}

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
