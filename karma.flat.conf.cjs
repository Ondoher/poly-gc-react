const baseConfig = require('./karma.conf.cjs');

module.exports = function(config) {
	baseConfig({
		set(options) {
			config.set({
				...options,
				files: [
					{ pattern: 'tests/flat.js', type: 'module' },
				],
			});
		},
	});
};
