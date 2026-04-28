import path from "node:path";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import sharp from "sharp";

const argv = minimist(process.argv.slice(2), {
	string: ["config"],
	alias: { c: "config" },
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolveRepoPath(relativePath) {
	return path.resolve(repoRoot, relativePath);
}

async function ensureDir(dir) {
	await mkdir(dir, { recursive: true });
}

async function loadJson(filename) {
	const raw = await readFile(filename, "utf8");
	return JSON.parse(raw);
}

async function listPngBasenames(relativeDir) {
	const dir = resolveRepoPath(relativeDir);
	const entries = await readdir(dir, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
		.map((entry) => path.parse(entry.name).name)
		.filter((name) => !name.includes("@2x"))
		.sort((a, b) => a.localeCompare(b));
}

function getFaceDimensions(sizeConfig) {
	return {
		width: sizeConfig.width - sizeConfig.rpad,
		height: sizeConfig.height - sizeConfig.bpad,
	};
}

function getVariantFilename(name, scale) {
	return scale === 2 ? `${name}@2x.png` : `${name}.png`;
}

function getFaceOutputRoot(config) {
	return config.faceOutputRoot || path.join(config.outputRoot, "faces");
}

function getBodyOutputRoot(config) {
	return config.bodyOutputRoot || path.join(config.outputRoot, "bodies");
}

function getCompositeOutputRoot(config) {
	return config.compositeOutputRoot || path.join(config.outputRoot, "composite");
}

async function writeResizedPng(sourceFile, outputFile, width, height) {
	await ensureDir(path.dirname(outputFile));
	const sourceBuffer = await readFile(sourceFile);
	await sharp(sourceBuffer)
		.resize(width, height, {
			fit: "fill",
			kernel: sharp.kernel.lanczos3,
		})
		.png()
		.toFile(outputFile);
}

async function buildFaceBuffer(sourceFile, sourceKind, sourceSize, outputFaceSize) {
	let image = sharp(sourceFile);

	if (sourceKind === "full-tile") {
		image = image.extract({
			left: 0,
			top: 0,
			width: sourceSize.face.width,
			height: sourceSize.face.height,
		});
	}

	return image
		.resize(outputFaceSize.width, outputFaceSize.height, {
			fit: "fill",
			kernel: sharp.kernel.lanczos3,
		})
		.png()
		.toBuffer();
}

async function generateFaceAssets(config, tileSizes) {
	const faceSpec = config.face;
	const sourceTileSize = faceSpec.sourceSize ? tileSizes[faceSpec.sourceSize] : null;
	const sourceSize = sourceTileSize
		? {
			tile: sourceTileSize,
			face: getFaceDimensions(sourceTileSize),
		}
		: null;
	const faceNames = faceSpec.names || await listPngBasenames(faceSpec.sourceDir);

	for (const faceName of faceNames) {
		const sourceFile = faceSpec.source
			? resolveRepoPath(faceSpec.source)
			: resolveRepoPath(path.join(faceSpec.sourceDir, `${faceName}.png`));

		for (const outputSizeName of faceSpec.outputSizes) {
			const tileSize = tileSizes[outputSizeName];
			const faceSize = getFaceDimensions(tileSize);

			for (const scale of [1, 2]) {
				const outputDir = resolveRepoPath(path.join(getFaceOutputRoot(config), `${outputSizeName}-face`));
				const outputFile = path.join(outputDir, getVariantFilename(faceName, scale));
				const buffer = await buildFaceBuffer(
					sourceFile,
					faceSpec.sourceKind,
					sourceSize,
					{
						width: faceSize.width * scale,
						height: faceSize.height * scale,
					}
				);

				await ensureDir(outputDir);
				await sharp(buffer).png().toFile(outputFile);
			}
		}
	}
}

async function generateBodyAssets(config, tileSizes) {
	const bodySpec = config.body;
	const bodyNames = bodySpec.names || await listPngBasenames(bodySpec.sourceDir);

	for (const bodyName of bodyNames) {
		const sourceFile = bodySpec.source
			? resolveRepoPath(bodySpec.source)
			: resolveRepoPath(path.join(bodySpec.sourceDir, `${bodyName}.png`));

		for (const outputSizeName of bodySpec.outputSizes) {
			const tileSize = tileSizes[outputSizeName];

			for (const scale of [1, 2]) {
				const outputDir = resolveRepoPath(path.join(getBodyOutputRoot(config), outputSizeName));
				const outputFile = path.join(outputDir, getVariantFilename(bodyName, scale));

				await writeResizedPng(
					sourceFile,
					outputFile,
					tileSize.width * scale,
					tileSize.height * scale
				);
			}
		}
	}
}

async function generateCompositeAssets(config, tileSizes) {
	const compositeSpec = config.composite;
	if (!compositeSpec) {
		return;
	}

	const faceSpec = config.face;
	const bodySpec = config.body;
	const sourceSizeName = faceSpec.sourceSize;
	const sourceTile = tileSizes[sourceSizeName];
	const sourceFace = getFaceDimensions(sourceTile);

	for (const outputSizeName of compositeSpec.outputSizes) {
		const tileSize = tileSizes[outputSizeName];
		const faceSize = getFaceDimensions(tileSize);

		for (const scale of [1, 2]) {
			const bodyBuffer = await sharp(resolveRepoPath(bodySpec.source))
				.resize(tileSize.width * scale, tileSize.height * scale, {
					fit: "fill",
					kernel: sharp.kernel.lanczos3,
				})
				.png()
				.toBuffer();

			let faceImage = sharp(resolveRepoPath(faceSpec.source));
			if (faceSpec.sourceKind === "full-tile") {
				faceImage = faceImage.extract({
					left: 0,
					top: 0,
					width: sourceFace.width,
					height: sourceFace.height,
				});
			}

			const faceBuffer = await faceImage
				.resize(faceSize.width * scale, faceSize.height * scale, {
					fit: "fill",
					kernel: sharp.kernel.lanczos3,
				})
				.png()
				.toBuffer();

			const outputRoot = getCompositeOutputRoot(config);
			const outputFile = path.join(resolveRepoPath(path.join(outputRoot, outputSizeName)), getVariantFilename(compositeSpec.name, scale));
			await ensureDir(path.dirname(outputFile));
			await sharp(bodyBuffer)
				.composite([{ input: faceBuffer, left: 0, top: 0 }])
				.png()
				.toFile(outputFile);
		}
	}
}

async function main() {
	const configFile = argv.config
		? path.resolve(argv.config)
		: resolveRepoPath("scripts/tile-css/test-assets/generate-test-config.json");
	const config = await loadJson(configFile);
	const tileSizes = await loadJson(resolveRepoPath("scripts/tile-css/tile-sizes.json"));

	await generateFaceAssets(config, tileSizes);
	await generateBodyAssets(config, tileSizes);
	await generateCompositeAssets(config, tileSizes);

	console.log(`Generated test assets using ${path.relative(repoRoot, configFile)}`);
}

await main();
