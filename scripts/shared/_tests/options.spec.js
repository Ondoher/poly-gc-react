import { checkBoolean, getOption, getOptions } from '../options.js';

describe('script shared options', function() {
	it('converts supported boolean option values', function() {
		expect(checkBoolean(true)).toBe(true);
		expect(checkBoolean(false)).toBe(false);
		expect(checkBoolean('true')).toBe(true);
		expect(checkBoolean('false')).toBe(false);
		expect(checkBoolean('on')).toBe(true);
		expect(checkBoolean('off')).toBe(false);
		expect(checkBoolean('set')).toBe(true);
		expect(checkBoolean('clear')).toBe(false);
	});

	it('leaves unsupported values unchanged', function() {
		expect(checkBoolean('yes')).toBe('yes');
		expect(checkBoolean('TRUE')).toBe('TRUE');
		expect(checkBoolean(1)).toBe(1);
	});

	it('prefers the long option name over the short option name', function() {
		const argv = {
			include: 'false',
			i: 'true',
		};

		expect(getOption(argv, 'include', 'i')).toBe(false);
	});

	it('reads the short option name when the long option is absent', function() {
		const argv = {
			i: 'on',
		};

		expect(getOption(argv, 'include', 'i')).toBe(true);
	});

	it('applies defaults for undefined options', function() {
		const defaults = {
			include: true,
			output: false,
			label: 'normal',
		};
		const argv = {
			output: 'true',
		};
		const definition = {
			include: 'i',
			output: 'o',
		};

		expect(getOptions(defaults, argv, definition)).toEqual({
			include: true,
			output: true,
			label: 'normal',
		});
	});

	it('keeps explicit false values instead of replacing them with defaults', function() {
		const defaults = {
			include: true,
		};
		const argv = {
			include: 'false',
		};
		const definition = {
			include: 'i',
		};

		expect(getOptions(defaults, argv, definition)).toEqual({
			include: false,
		});
	});
});
