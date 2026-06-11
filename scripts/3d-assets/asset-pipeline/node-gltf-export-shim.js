import sharp from 'sharp';

const objectUrlBlobs = new Map();
let objectUrlIndex = 0;
let nativeFetch = null;

class NodeFileReader {
	constructor() {
		this.result = null;
		this.onloadend = null;
	}

	readAsArrayBuffer(blob) {
		blob.arrayBuffer().then((buffer) => {
			this.result = buffer;
			if (typeof this.onloadend === 'function') {
				this.onloadend();
			}
		});
	}

	readAsDataURL(blob) {
		blob.arrayBuffer().then((buffer) => {
			const base64 = Buffer.from(buffer).toString('base64');
			const mimeType = blob.type || 'application/octet-stream';
			this.result = `data:${mimeType};base64,${base64}`;
			if (typeof this.onloadend === 'function') {
				this.onloadend();
			}
		});
	}
}

class NodeImageData {
	constructor(data, width, height) {
		this.data = data;
		this.width = width;
		this.height = height;
	}
}

class NodeCanvas {
	constructor() {
		this.width = 1;
		this.height = 1;
		this.pixels = null;
	}

	getContext(type) {
		if (type !== '2d') {
			return null;
		}

		const canvas = this;
		return {
			fillStyle: '#000000',
			fillRect(x, y, width, height) {
				const color = parseCanvasColor(this.fillStyle);
				const pixels = canvas.ensurePixels();
				const startX = Math.max(0, Math.floor(x));
				const startY = Math.max(0, Math.floor(y));
				const endX = Math.min(canvas.width, Math.ceil(x + width));
				const endY = Math.min(canvas.height, Math.ceil(y + height));

				for (let py = startY; py < endY; py += 1) {
					for (let px = startX; px < endX; px += 1) {
						const offset = ((py * canvas.width) + px) * 4;
						pixels[offset] = color[0];
						pixels[offset + 1] = color[1];
						pixels[offset + 2] = color[2];
						pixels[offset + 3] = color[3];
					}
				}
			},
			drawImage(image, x, y, width = image.width, height = image.height) {
				const source = image?.data || image?.pixels;
				if (!source || !image.width || !image.height) {
					return;
				}

				const pixels = canvas.ensurePixels();
				const startX = Math.floor(x);
				const startY = Math.floor(y);
				const targetWidth = Math.floor(width);
				const targetHeight = Math.floor(height);

				for (let ty = 0; ty < targetHeight; ty += 1) {
					const py = startY + ty;
					if (py < 0 || py >= canvas.height) {
						continue;
					}
					const sourceY = Math.min(image.height - 1, Math.max(0, Math.floor((ty / targetHeight) * image.height)));

					for (let tx = 0; tx < targetWidth; tx += 1) {
						const px = startX + tx;
						if (px < 0 || px >= canvas.width) {
							continue;
						}
						const sourceX = Math.min(image.width - 1, Math.max(0, Math.floor((tx / targetWidth) * image.width)));
						const sourceOffset = ((sourceY * image.width) + sourceX) * 4;
						const targetOffset = ((py * canvas.width) + px) * 4;
						pixels[targetOffset] = source[sourceOffset];
						pixels[targetOffset + 1] = source[sourceOffset + 1];
						pixels[targetOffset + 2] = source[sourceOffset + 2];
						pixels[targetOffset + 3] = source[sourceOffset + 3];
					}
				}
			},
			getImageData(x, y, width, height) {
				const pixels = canvas.ensurePixels();
				const data = new Uint8ClampedArray(width * height * 4);

				for (let ty = 0; ty < height; ty += 1) {
					for (let tx = 0; tx < width; tx += 1) {
						const px = x + tx;
						const py = y + ty;
						const targetOffset = ((ty * width) + tx) * 4;
						if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
							continue;
						}
						const sourceOffset = ((py * canvas.width) + px) * 4;
						data[targetOffset] = pixels[sourceOffset];
						data[targetOffset + 1] = pixels[sourceOffset + 1];
						data[targetOffset + 2] = pixels[sourceOffset + 2];
						data[targetOffset + 3] = pixels[sourceOffset + 3];
					}
				}

				return new NodeImageData(data, width, height);
			},
			putImageData: (imageData) => {
				canvas.width = imageData.width;
				canvas.height = imageData.height;
				canvas.pixels = new Uint8ClampedArray(imageData.data);
			},
			translate: () => {},
			scale: () => {},
		};
	}

	ensurePixels() {
		const length = this.width * this.height * 4;
		if (!this.pixels || this.pixels.length !== length) {
			this.pixels = new Uint8ClampedArray(length);
		}
		return this.pixels;
	}

	async toBlob(callback, mimeType = 'image/png') {
		if (!this.pixels) {
			throw new Error('Node GLTF export canvas has no image data.');
		}

		const buffer = await sharp(Buffer.from(this.pixels), {
			raw: {
				width: this.width,
				height: this.height,
				channels: 4,
			},
		})
			.png()
			.toBuffer();

		callback(new Blob([buffer], { type: mimeType }));
	}
}

class NodeImageBitmap {
	constructor(data, width, height) {
		this.data = data;
		this.width = width;
		this.height = height;
	}

	close() {}
}

function parseCanvasColor(value) {
	const color = String(value || '').trim().toLowerCase();
	const hex = /^#([0-9a-f]{6})$/i.exec(color);
	if (hex) {
		return [
			parseInt(hex[1].slice(0, 2), 16),
			parseInt(hex[1].slice(2, 4), 16),
			parseInt(hex[1].slice(4, 6), 16),
			255,
		];
	}
	return [0, 0, 0, 255];
}

class NodeObjectUrl {
	createObjectURL(blob) {
		const url = `blob:node-gltf-shim-${objectUrlIndex += 1}`;
		objectUrlBlobs.set(url, blob);
		return url;
	}

	revokeObjectURL(url) {
		objectUrlBlobs.delete(url);
	}
}

async function nodeFetch(url) {
	if (!objectUrlBlobs.has(url)) {
		if (!nativeFetch) {
			throw new Error(`Node GLTF shim cannot fetch ${url}; no native fetch is available.`);
		}
		return nativeFetch(url);
	}

	const blob = objectUrlBlobs.get(url);
	return {
		blob: async () => blob,
	};
}

async function nodeCreateImageBitmap(blob) {
	const buffer = Buffer.from(await blob.arrayBuffer());
	const image = await sharp(buffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return new NodeImageBitmap(
		new Uint8ClampedArray(image.data),
		image.info.width,
		image.info.height,
	);
}

export function installNodeGltfExportShim() {
	if (typeof globalThis.FileReader === 'undefined') {
		globalThis.FileReader = NodeFileReader;
	}

	if (typeof globalThis.ImageData === 'undefined') {
		globalThis.ImageData = NodeImageData;
	}

	if (typeof globalThis.ImageBitmap === 'undefined') {
		globalThis.ImageBitmap = NodeImageBitmap;
	}

	if (typeof globalThis.HTMLCanvasElement === 'undefined') {
		globalThis.HTMLCanvasElement = NodeCanvas;
	}

	if (typeof globalThis.document === 'undefined') {
		globalThis.document = {
			createElement(name) {
				if (name !== 'canvas') {
					throw new Error(`Node GLTF export shim only supports canvas elements, not "${name}".`);
				}
				return new NodeCanvas();
			},
		};
	}

	if (typeof globalThis.self === 'undefined') {
		globalThis.self = globalThis;
	}

	if (typeof globalThis.URL === 'undefined' || typeof globalThis.URL.createObjectURL !== 'function') {
		globalThis.URL = new NodeObjectUrl();
	}

	if (typeof globalThis.fetch === 'undefined' || !globalThis.fetch.__nodeGltfShim) {
		if (typeof globalThis.fetch === 'function') {
			nativeFetch = globalThis.fetch.bind(globalThis);
		}
		const fetchShim = nodeFetch;
		fetchShim.__nodeGltfShim = true;
		globalThis.fetch = fetchShim;
	}

	if (typeof globalThis.createImageBitmap === 'undefined') {
		globalThis.createImageBitmap = nodeCreateImageBitmap;
	}
}
