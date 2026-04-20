module.exports = function(config) {
	process.env.CHROME_BIN = process.env.CHROME_BIN ||
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

	config.set({
		basePath: '',
		frameworks: ['jasmine'],
		files: [
			{pattern: 'tests/**/*.css', included: false},
			{pattern: 'tests/**/*.js', type: 'module'}
		],
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-spec-reporter'),
			require('karma-jasmine-html-reporter')
		],
		reporters: ['spec'],
		port: 9876,
		colors: true,
		autoWatch: false,
		client: {
			captureConsole: true
		},
		customLaunchers: {
			ChromeHeadlessLocal: {
				base: 'ChromeHeadless',
				flags: [
					'--disable-gpu',
					'--no-first-run',
					'--no-default-browser-check'
				]
			}
		},
		browsers: ['ChromeHeadlessLocal'],
		singleRun: true,
		concurrency: Infinity
	});
};
