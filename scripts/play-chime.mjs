import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SAMPLE_RATE = 44100;
const DEFAULT_DURATION_SECONDS = 2.4;
const DEFAULT_OUTPUT = 'tmp/chime.wav';

const CHIME_PARTIALS = [
	{ frequency: 1046.5, gain: 0.54, delay: 0.00, decay: 1.25 },
	{ frequency: 1318.51, gain: 0.36, delay: 0.035, decay: 1.05 },
	{ frequency: 1567.98, gain: 0.30, delay: 0.075, decay: 0.92 },
	{ frequency: 2093.0, gain: 0.16, delay: 0.12, decay: 0.72 },
	{ frequency: 2637.02, gain: 0.10, delay: 0.16, decay: 0.55 },
];

const args = parseArgs(process.argv.slice(2));

if (args.help) {
	printHelp();
	process.exit(0);
}

const outputPath = resolve(args.output || DEFAULT_OUTPUT);
const durationSeconds = args.duration || DEFAULT_DURATION_SECONDS;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, createChimeWav({ durationSeconds }));

console.log(`Wrote ${outputPath}`);

if (!args.writeOnly) {
	playAudioFile(outputPath);
}

function parseArgs(argv) {
	const parsed = {
		duration: DEFAULT_DURATION_SECONDS,
		help: false,
		output: DEFAULT_OUTPUT,
		writeOnly: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--help' || arg === '-h') {
			parsed.help = true;
			continue;
		}

		if (arg === '--write-only') {
			parsed.writeOnly = true;
			continue;
		}

		if (arg === '--out') {
			parsed.output = requireValue(argv, index, arg);
			index += 1;
			continue;
		}

		if (arg === '--duration') {
			const value = Number(requireValue(argv, index, arg));

			if (!Number.isFinite(value) || value <= 0) {
				throw new Error(`Invalid --duration value: ${argv[index + 1]}`);
			}

			parsed.duration = value;
			index += 1;
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return parsed;
}

function requireValue(argv, index, arg) {
	const value = argv[index + 1];

	if (!value || value.startsWith('--')) {
		throw new Error(`${arg} requires a value.`);
	}

	return value;
}

function printHelp() {
	console.log(`Usage: node scripts/play-chime.mjs [options]

Options:
  --out <path>       WAV file to create. Defaults to tmp/chime.wav.
  --duration <sec>   Chime duration in seconds. Defaults to 2.4.
  --write-only       Create the WAV file without playing it.
  -h, --help         Show this help.
`);
}

function createChimeWav({ durationSeconds }) {
	const frameCount = Math.ceil(durationSeconds * SAMPLE_RATE);
	const samples = new Float32Array(frameCount);

	for (let frame = 0; frame < frameCount; frame += 1) {
		const time = frame / SAMPLE_RATE;
		let sample = 0;

		for (const partial of CHIME_PARTIALS) {
			const localTime = time - partial.delay;

			if (localTime < 0) {
				continue;
			}

			const attack = Math.min(localTime / 0.012, 1);
			const decay = Math.exp(-localTime / partial.decay);
			const shimmer = 1 + 0.006 * Math.sin(2 * Math.PI * 5.1 * localTime);
			const phase = 2 * Math.PI * partial.frequency * shimmer * localTime;

			sample += partial.gain * attack * decay * Math.sin(phase);
		}

		const softLimit = Math.tanh(sample * 0.74);
		samples[frame] = softLimit * (1 - Math.min(time / durationSeconds, 1) ** 4);
	}

	return encodePcm16Wav(samples, SAMPLE_RATE);
}

function encodePcm16Wav(samples, sampleRate) {
	const channelCount = 1;
	const bytesPerSample = 2;
	const dataSize = samples.length * bytesPerSample;
	const buffer = Buffer.alloc(44 + dataSize);

	buffer.write('RIFF', 0);
	buffer.writeUInt32LE(36 + dataSize, 4);
	buffer.write('WAVE', 8);
	buffer.write('fmt ', 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20);
	buffer.writeUInt16LE(channelCount, 22);
	buffer.writeUInt32LE(sampleRate, 24);
	buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
	buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
	buffer.writeUInt16LE(bytesPerSample * 8, 34);
	buffer.write('data', 36);
	buffer.writeUInt32LE(dataSize, 40);

	for (let index = 0; index < samples.length; index += 1) {
		const clamped = Math.max(-1, Math.min(1, samples[index]));
		const intSample = Math.round(clamped * 32767);
		buffer.writeInt16LE(intSample, 44 + index * bytesPerSample);
	}

	return buffer;
}

function playAudioFile(filePath) {
	if (process.platform === 'win32') {
		playTerminalBell();
		console.log(`Windows-safe mode: played terminal bell and left the WAV at ${filePath}`);
		return;
	}

	const candidates = process.platform === 'darwin'
		? [['afplay', [filePath]]]
		: [
			['paplay', [filePath]],
			['aplay', [filePath]],
			['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath]],
			['play', [filePath]],
		];

	for (const [command, commandArgs] of candidates) {
		const result = spawnSync(command, commandArgs, { stdio: 'ignore' });

		if (result.status === 0) {
			return;
		}
	}

	throw new Error(`Could not find an audio player for ${process.platform}. The WAV was still written to ${filePath}.`);
}

function playTerminalBell() {
	process.stdout.write('\u0007');
}
