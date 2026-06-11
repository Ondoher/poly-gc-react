const baseConfig = require('./karma.conf.cjs');

module.exports = function(config) {
	baseConfig({
		set(options) {
			config.set({
				...options,
				files: [
					{ pattern: 'tests/pipeline/**/*.css', included: false },
					{ pattern: 'tests/pipeline/**/*.js', type: 'module' },
				],
			});
		},
	});
};
