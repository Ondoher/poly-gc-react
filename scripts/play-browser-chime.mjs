import puppeteer from 'puppeteer';

const durationMs = parseDuration(process.argv.slice(2));

const browser = await puppeteer.launch({
	headless: false,
	args: [
		'--autoplay-policy=no-user-gesture-required',
		'--window-size=420,240',
	],
	defaultViewport: {
		width: 420,
		height: 240,
	},
});

try {
	const page = await browser.newPage();

	await page.setContent(`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>Chime</title>
		<style>
			body {
				align-items: center;
				background: #101418;
				color: #f3f7fb;
				display: grid;
				font: 16px/1.4 system-ui, sans-serif;
				height: 100vh;
				margin: 0;
				place-items: center;
			}
			main {
				text-align: center;
			}
		</style>
	</head>
	<body>
		<main>
			<h1>Playing chime...</h1>
			<p>This window will close automatically.</p>
		</main>
	</body>
</html>`);

	await page.evaluate(async (duration) => {
		const audio = new AudioContext();
		const master = audio.createGain();
		const compressor = audio.createDynamicsCompressor();
		const now = audio.currentTime;
		const partials = [
			{ frequency: 1046.5, gain: 0.38, delay: 0.00, decay: 1.20 },
			{ frequency: 1318.51, gain: 0.26, delay: 0.04, decay: 1.05 },
			{ frequency: 1567.98, gain: 0.22, delay: 0.08, decay: 0.92 },
			{ frequency: 2093.0, gain: 0.13, delay: 0.13, decay: 0.68 },
		];

		master.gain.setValueAtTime(0.0, now);
		master.gain.linearRampToValueAtTime(0.85, now + 0.018);
		master.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
		master.connect(compressor);
		compressor.connect(audio.destination);

		for (const partial of partials) {
			const oscillator = audio.createOscillator();
			const gain = audio.createGain();
			const start = now + partial.delay;
			const stop = now + duration / 1000;

			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(partial.frequency, start);
			oscillator.detune.setValueAtTime(-4, start);
			oscillator.detune.linearRampToValueAtTime(2, start + 0.45);

			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.linearRampToValueAtTime(partial.gain, start + 0.016);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + partial.decay);

			oscillator.connect(gain);
			gain.connect(master);
			oscillator.start(start);
			oscillator.stop(stop);
		}

		await audio.resume();
		await new Promise((resolve) => setTimeout(resolve, duration + 250));
		await audio.close();
	}, durationMs);
} finally {
	await browser.close();
}

function parseDuration(argv) {
	const durationIndex = argv.indexOf('--duration');

	if (durationIndex === -1) {
		return 2300;
	}

	const durationSeconds = Number(argv[durationIndex + 1]);

	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
		throw new Error('--duration must be a positive number of seconds.');
	}

	return Math.round(durationSeconds * 1000);
}
