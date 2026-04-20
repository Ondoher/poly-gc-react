import CssVarsService from '../css-vars.js';

describe('CssVarsService', function() {
	it('should prove the service test folder is wired into the browser lane', function() {
		expect(1).toBe(1);
	});

	it('should normalize CSS variable names to the --name form', function() {
		var service = new CssVarsService();

		expect(service.normalizeCssVarName('mj-layout-scale')).toBe('--mj-layout-scale');
		expect(service.normalizeCssVarName('--mj-layout-scale')).toBe('--mj-layout-scale');
		expect(service.normalizeCssVarName('')).toBe('');
	});

	it('should read element-scoped values without caching them in the root cache', function() {
		var service = new CssVarsService();
		var element = {id: 'preview'};

		service.readCssVarFromElement = function(target, name) {
			if (target === element && name === '--mj-layout-scale') {
				return '1.125';
			}

			return '';
		};

		expect(service.getFromElement(element, 'mj-layout-scale')).toBe('1.125');
		expect(service.vars['--mj-layout-scale']).toBeUndefined();
	});

	it('should cache root-scoped values when they are read', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function(_target, name) {
			if (name === '--mj-layout-scale') {
				return '1.25';
			}

			return '';
		};

		expect(service.get('mj-layout-scale')).toBe('1.25');
		expect(service.vars['--mj-layout-scale']).toBe('1.25');
	});

	it('should build an object from root-scoped CSS variables', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function(_target, name) {
			let values = {
				'--tiny-size-width': '32',
				'--tiny-size-height': '44',
				'--tiny-face-width': '26',
				'--tiny-face-height': '38',
				'--tiny-padding-right': '6',
				'--tiny-padding-bottom': '6',
			};

			return values[name] || '';
		};

		let result = service.buildObject({
			prefix: 'tiny',
			names: [
				'size-width',
				'size-height',
				'face-width',
				'face-height',
				'padding-right',
				'padding-bottom',
			],
		});

		expect(result).toEqual({
			size: {
				width: 32,
				height: 44,
			},
			face: {
				width: 26,
				height: 38,
			},
			padding: {
				right: 6,
				bottom: 6,
			},
		});
	});

	it('should build an object from element-scoped CSS variables', function() {
		var service = new CssVarsService();
		var element = {id: 'preview'};

		service.readCssVarFromElement = function(target, name) {
			if (target !== element) {
				return '';
			}

			let values = {
				'--mj-layout-scale': '1.125',
				'--mj-layout-offset-x': '12',
				'--mj-layout-offset-y': '8.5',
			};

			return values[name] || '';
		};

		let result = service.buildObject(
			{
				prefix: '--mj-layout-',
				names: [
					'scale',
					'offset-x',
					'offset-y',
				],
			},
			{element}
		);

		expect(result).toEqual({
			scale: 1.125,
			offset: {
				x: 12,
				y: 8.5,
			},
		});
		expect(service.vars['--mj-layout-scale']).toBeUndefined();
	});

	it('should preserve raw string values when number coercion is disabled', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function(_target, name) {
			let values = {
				'--mj-layout-scale': '1.125',
				'--mj-layout-mode': 'portrait',
			};

			return values[name] || '';
		};

		let result = service.buildObject(
			{
				prefix: '--mj-layout-',
				names: [
					'scale',
					'mode',
				],
			},
			{coerceNumbers: false}
		);

		expect(result).toEqual({
			scale: '1.125',
			mode: 'portrait',
		});
	});

	it('should ignore blank or invalid variable names', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function() {
			throw new Error('buildObject should not read CSS vars for blank names');
		};

		let result = service.buildObject({
			prefix: '--mj-layout-',
			names: ['', '   ', null],
		});

		expect(result).toEqual({});
	});

	it('should use defaults when CSS variables are missing', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function(_target, name) {
			let values = {
				'--mj-layout-scale': '',
				'--mj-layout-mode': '',
			};

			return values[name] || '';
		};

		let result = service.buildObject(
			{
				prefix: '--mj-layout-',
				names: [
					'scale',
					'mode',
					'offset-x',
				],
			},
			{
				defaults: {
					scale: 1,
					mode: 'landscape',
					offset: {
						x: 0,
					},
				},
			}
		);

		expect(result).toEqual({
			scale: 1,
			mode: 'landscape',
			offset: {
				x: 0,
			},
		});
	});

	it('should prefer CSS variable values over defaults when both are present', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function(_target, name) {
			let values = {
				'--mj-layout-scale': '1.125',
				'--mj-layout-mode': 'portrait',
			};

			return values[name] || '';
		};

		let result = service.buildObject(
			{
				prefix: '--mj-layout-',
				names: [
					'scale',
					'mode',
				],
			},
			{
				defaults: {
					scale: 1,
					mode: 'landscape',
				},
			}
		);

		expect(result).toEqual({
			scale: 1.125,
			mode: 'portrait',
		});
	});

	it('should derive object shape directly from typed variable names', function() {
		var service = new CssVarsService();

		service.readCssVarFromElement = function(_target, name) {
			let values = {
				'--tiny-number-size-width': '32',
				'--tiny-number-size-height': '44',
				'--tiny-string-name': 'ivory',
				'--tiny-boolean-enabled': 'true',
			};

			return values[name] || '';
		};

		let result = service.buildObject({
			prefix: 'tiny',
			names: [
				'number-size-width',
				'number-size-height',
				'string-name',
				'boolean-enabled',
			],
		});

		expect(result).toEqual({
			size: {
				width: 32,
				height: 44,
			},
			name: 'ivory',
			enabled: true,
		});
	});
});
