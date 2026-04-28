import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { LARGE_FACES_DIR, PREPARED_SVGS_DIR } from '../shared/asset-paths.js';

const SOURCE_PNG = path.resolve(LARGE_FACES_DIR, 'd-7.png');
const FACE_SVG = path.resolve(PREPARED_SVGS_DIR, 'd-7.svg');

const WIDTH = 164;
const HEIGHT = 238;

const pngDataUrl = `data:image/png;base64,${fs.readFileSync(SOURCE_PNG).toString('base64')}`;
const svgDataUrl = `data:image/svg+xml;base64,${fs.readFileSync(FACE_SVG).toString('base64')}`;

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const analysis = await page.evaluate(async ({ pngDataUrl, svgDataUrl, width, height }) => {
	const pngPixels = await drawImageToPixels(pngDataUrl, width, height);
	const svgPixels = await drawImageToPixels(svgDataUrl, width, height);

	return {
		png: analyzePixels(pngPixels, width, height),
		svg: analyzePixels(svgPixels, width, height),
	};

	async function drawImageToPixels(src, canvasWidth, canvasHeight) {
		const image = await loadImage(src);
		const canvas = document.createElement('canvas');
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		const context = canvas.getContext('2d');
		context.clearRect(0, 0, canvasWidth, canvasHeight);
		context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
		return context.getImageData(0, 0, canvasWidth, canvasHeight).data;
	}

	function loadImage(src) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = reject;
			image.src = src;
		});
	}

	function analyzePixels(pixels, width, height) {
		return {
			red: findComponents(pixels, width, height, isRedPixel),
			green: findComponents(pixels, width, height, isGreenPixel),
		};
	}

	function isRedPixel(r, g, b, a) {
		return a > 24 && r > 120 && r > g * 1.55 && r > b * 1.55;
	}

	function isGreenPixel(r, g, b, a) {
		return a > 24 && g > 85 && g > r * 1.22 && g > b * 1.22;
	}

	function findComponents(pixels, width, height, predicate) {
		const visited = new Uint8Array(width * height);
		const components = [];

		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const index = y * width + x;

				if (visited[index] || !matches(index)) {
					continue;
				}

				const component = flood(index);

				if (component.area >= 28) {
					components.push(component);
				}
			}
		}

		return components.sort((a, b) => a.cy - b.cy || a.cx - b.cx);

		function matches(index) {
			const offset = index * 4;
			return predicate(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]);
		}

		function flood(startIndex) {
			const stack = [startIndex];
			let area = 0;
			let sumX = 0;
			let sumY = 0;
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			visited[startIndex] = 1;

			while (stack.length) {
				const index = stack.pop();
				const x = index % width;
				const y = Math.floor(index / width);

				area += 1;
				sumX += x;
				sumY += y;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);

				visit(stack, x - 1, y);
				visit(stack, x + 1, y);
				visit(stack, x, y - 1);
				visit(stack, x, y + 1);
			}

			return {
				area,
				cx: Number((sumX / area).toFixed(2)),
				cy: Number((sumY / area).toFixed(2)),
				bounds: [minX, minY, maxX, maxY],
			};
		}

		function visit(stack, x, y) {
			if (x < 0 || y < 0 || x >= width || y >= height) {
				return;
			}

			const index = y * width + x;

			if (visited[index] || !matches(index)) {
				return;
			}

			visited[index] = 1;
			stack.push(index);
		}
	}
}, { pngDataUrl, svgDataUrl, width: WIDTH, height: HEIGHT });

await browser.close();

console.log(JSON.stringify(analysis, null, 2));

