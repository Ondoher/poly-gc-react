import fs from 'fs';
import path from 'path';
import { WIKI_SOURCE_SVGS_DIR } from '../shared/asset-paths.js';

if (process.env.WIKI_INSECURE_TLS === '1') {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const DOWNLOAD_DIR = WIKI_SOURCE_SVGS_DIR;
const MANIFEST_PATH = path.resolve(DOWNLOAD_DIR, 'manifest.json');

const EN_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const PAGE_TITLE = 'Mahjong_tiles';
const FULL_SET_SECTION = '2';
const USER_AGENT = 'poly-gc-react 3d-poc asset research (local script)';
const REQUEST_DELAY_MS = 5000;
const RETRY_DELAYS_MS = Object.freeze([10000, 30000, 60000]);

const EXCLUDED_TITLE_PATTERNS = Object.freeze([
	/\bwind\b/i,
]);
const PROTECTED_LOCAL_FACE_PATTERNS = Object.freeze([
	/^flower-[1-4]\.svg$/,
	/^season-[1-4]\.svg$/,
]);

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const contentsHtml = await fetchContentsSectionHtml();
const sectionHtml = isolateFullSetSubsection(contentsHtml);
const fileTitles = extractFileTitles(sectionHtml);
const entries = [];
let stoppedEarly = false;

for (const fileTitle of fileTitles) {
	const imageInfo = await fetchCommonsImageInfo(fileTitle);

	if (!imageInfo) {
		entries.push({
			fileTitle,
			status: 'missing-image-info',
		});
		continue;
	}

	const metadataText = getSearchableMetadataText(fileTitle, imageInfo);
	const skipped = shouldSkip(metadataText);

	if (skipped) {
		entries.push({
			fileTitle,
			status: 'skipped',
			reason: skipped,
			sourcePage: getCommonsFilePageUrl(fileTitle),
		});
		continue;
	}

	if (imageInfo.mime !== 'image/svg+xml' || !imageInfo.url?.endsWith('.svg')) {
		entries.push({
			fileTitle,
			status: 'skipped',
			reason: `not-svg:${imageInfo.mime ?? 'unknown'}`,
			sourcePage: getCommonsFilePageUrl(fileTitle),
			originalUrl: imageInfo.url ?? null,
		});
		continue;
	}

	const sourceFilename = sanitizeFilename(fileTitle.replace(/^File:/i, ''));
	const localFilename = getCanonicalFaceFilename(fileTitle, imageInfo) ?? sourceFilename;
	const localPath = path.resolve(DOWNLOAD_DIR, localFilename);
	const alreadyDownloaded = fs.existsSync(localPath) && fs.statSync(localPath).size > 0;
	const protectedLocalFile = alreadyDownloaded && isProtectedLocalFaceFilename(localFilename);

	if (!alreadyDownloaded) {
		try {
			await downloadFile(imageInfo.url, localPath);
		} catch (error) {
			entries.push({
				fileTitle,
				status: 'download-failed',
				reason: error.message,
				sourcePage: getCommonsFilePageUrl(fileTitle),
				originalUrl: imageInfo.url,
				mime: imageInfo.mime,
			});
			stoppedEarly = true;
			break;
		}
	}

	entries.push({
		fileTitle,
		status: protectedLocalFile ? 'protected-local-file' : alreadyDownloaded ? 'already-downloaded' : 'downloaded',
		localFilename,
		sourceFilename,
		sourcePage: getCommonsFilePageUrl(fileTitle),
		originalUrl: imageInfo.url,
		mime: imageInfo.mime,
		size: imageInfo.size ?? null,
		width: imageInfo.width ?? null,
		height: imageInfo.height ?? null,
		description: readMetadataValue(imageInfo, 'ImageDescription'),
		author: readMetadataValue(imageInfo, 'Artist'),
		licenseShortName: readMetadataValue(imageInfo, 'LicenseShortName'),
		licenseUrl: readMetadataValue(imageInfo, 'LicenseUrl'),
		credit: readMetadataValue(imageInfo, 'Credit'),
	});

	await delay(REQUEST_DELAY_MS);
}

writeManifest({
	generatedAt: new Date().toISOString(),
	pageTitle: PAGE_TITLE,
	section: 'Full set',
	sourcePage: `https://en.wikipedia.org/wiki/${PAGE_TITLE}#Full_set`,
	downloadDir: DOWNLOAD_DIR,
	excludedTitlePatterns: EXCLUDED_TITLE_PATTERNS.map((pattern) => pattern.source),
	stoppedEarly,
	counts: {
		totalFileLinks: fileTitles.length,
		downloaded: entries.filter((entry) => entry.status === 'downloaded').length,
		alreadyDownloaded: entries.filter((entry) => entry.status === 'already-downloaded').length,
		protectedLocalFiles: entries.filter((entry) => entry.status === 'protected-local-file').length,
		skipped: entries.filter((entry) => entry.status === 'skipped').length,
		missingImageInfo: entries.filter((entry) => entry.status === 'missing-image-info').length,
		downloadFailed: entries.filter((entry) => entry.status === 'download-failed').length,
	},
	entries,
});

console.log(`Found ${fileTitles.length} file links in Full set.`);
console.log(`Downloaded ${entries.filter((entry) => entry.status === 'downloaded').length} SVG files.`);
console.log(`Already present ${entries.filter((entry) => entry.status === 'already-downloaded').length} SVG files.`);
console.log(`Protected local files ${entries.filter((entry) => entry.status === 'protected-local-file').length} SVG files.`);
if (stoppedEarly) {
	console.log('Stopped early after a download failure; rerun later to resume.');
}
console.log(`Wrote ${path.relative(process.cwd(), MANIFEST_PATH)}`);

async function fetchContentsSectionHtml() {
	const url = new URL(EN_API);
	url.searchParams.set('action', 'parse');
	url.searchParams.set('page', PAGE_TITLE);
	url.searchParams.set('section', FULL_SET_SECTION);
	url.searchParams.set('prop', 'text');
	url.searchParams.set('format', 'json');
	url.searchParams.set('origin', '*');

	const data = await fetchJson(url);
	const html = data?.parse?.text?.['*'];

	if (!html) {
		throw new Error('Could not load Full set section HTML from Wikipedia.');
	}

	return html;
}

function isolateFullSetSubsection(contentsHtml) {
	const startMatch = contentsHtml.match(/<h3\b[^>]*id="Full_set"[\s\S]*?<\/h3>/i)
		?? contentsHtml.match(/<h3\b[^>]*>\s*<span[^>]+id="Full_set"[\s\S]*?<\/h3>/i);

	if (!startMatch || startMatch.index == null) {
		throw new Error('Could not find the Full set subsection heading in Wikipedia Contents HTML.');
	}

	const start = startMatch.index + startMatch[0].length;
	const afterHeading = contentsHtml.slice(start);
	const nextHeadingMatch = afterHeading.match(/<h3\b[^>]*>/i);
	const end = nextHeadingMatch ? start + nextHeadingMatch.index : contentsHtml.length;
	return contentsHtml.slice(start, end);
}

function extractFileTitles(html) {
	const titles = [];
	const seen = new Set();
	const patterns = [
		/title="(File:[^"]+?\.svg)"/g,
		/href="\/wiki\/(File:[^"]+?\.svg)"/g,
		/href="https:\/\/commons\.wikimedia\.org\/wiki\/(File:[^"]+?\.svg)"/g,
	];

	for (const pattern of patterns) {
		for (const match of html.matchAll(pattern)) {
			const title = decodeHtml(decodeURIComponent(match[1])).replace(/_/g, ' ');
			if (!seen.has(title)) {
				seen.add(title);
				titles.push(title);
			}
		}
	}

	return titles;
}

async function fetchCommonsImageInfo(fileTitle) {
	const url = new URL(COMMONS_API);
	url.searchParams.set('action', 'query');
	url.searchParams.set('titles', fileTitle);
	url.searchParams.set('prop', 'imageinfo');
	url.searchParams.set('iiprop', 'url|mime|size|extmetadata');
	url.searchParams.set('format', 'json');
	url.searchParams.set('origin', '*');

	const data = await fetchJson(url);
	const page = Object.values(data?.query?.pages ?? {})[0];
	return page?.imageinfo?.[0] ?? null;
}

async function downloadFile(url, outputPath) {
	let lastError = null;

	for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
		const response = await fetch(url, {
			headers: {
				'User-Agent': USER_AGENT,
			},
		});

		if (response.ok) {
			const buffer = Buffer.from(await response.arrayBuffer());
			fs.writeFileSync(outputPath, buffer);
			return;
		}

		lastError = new Error(`Download failed ${response.status} ${response.statusText}: ${url}`);

		if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= RETRY_DELAYS_MS.length) {
			break;
		}

		await delay(getRetryDelayMs(response, attempt));
	}

	throw lastError;
}

function getRetryDelayMs(response, attempt) {
	const retryAfter = response.headers.get('retry-after');

	if (!retryAfter) {
		return RETRY_DELAYS_MS[attempt];
	}

	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds)) {
		return Math.max(seconds * 1000, RETRY_DELAYS_MS[attempt]);
	}

	const retryDate = Date.parse(retryAfter);
	if (!Number.isNaN(retryDate)) {
		return Math.max(retryDate - Date.now(), RETRY_DELAYS_MS[attempt], 0);
	}

	return RETRY_DELAYS_MS[attempt];
}

async function fetchJson(url) {
	let lastError = null;

	for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
		const response = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': USER_AGENT,
			},
		});

		if (response.ok) {
			return response.json();
		}

		lastError = new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);

		if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= RETRY_DELAYS_MS.length) {
			break;
		}

		await delay(getRetryDelayMs(response, attempt));
	}

	throw lastError;
}

function shouldSkip(text) {
	const match = EXCLUDED_TITLE_PATTERNS.find((pattern) => pattern.test(text));
	return match ? `matched:${match.source}` : null;
}

function isProtectedLocalFaceFilename(filename) {
	return PROTECTED_LOCAL_FACE_PATTERNS.some((pattern) => pattern.test(filename));
}

function getCanonicalFaceFilename(fileTitle, imageInfo) {
	const description = readMetadataValue(imageInfo, 'ImageDescription') ?? '';
	const searchableText = `${fileTitle} ${description}`.toLowerCase();
	const numberMatch = searchableText.match(/\b([1-9])\b/);

	if (numberMatch) {
		const number = numberMatch[1];

		if (/\bdots?\b/.test(searchableText) || /^file:mjt[1-9]-\.svg$/i.test(fileTitle)) {
			return `d-${number}.svg`;
		}

		if (/\bbamboos?\b/.test(searchableText) || /\bsticks?\b/.test(searchableText) || /^file:mjs[1-9]-\.svg$/i.test(fileTitle)) {
			return `b-${number}.svg`;
		}

		if (/\bcharacters?\b/.test(searchableText)) {
			return `c-${number}.svg`;
		}
	}

	if (/\bgreen dragon\b/.test(searchableText)) {
		return 'dragon-g.svg';
	}

	if (/\bred dragon\b/.test(searchableText)) {
		return 'dragon-r.svg';
	}

	if (/\bwhite dragon\b/.test(searchableText)) {
		return 'dragon-w.svg';
	}

	if (/\beast\b/.test(searchableText) || /^file:mjf1-\.svg$/i.test(fileTitle)) {
		return 'wind-e.svg';
	}

	if (/\bsouth\b/.test(searchableText) || /^file:mjf2-\.svg$/i.test(fileTitle)) {
		return 'wind-s.svg';
	}

	if (/\bwest\b/.test(searchableText) || /^file:mjf3-\.svg$/i.test(fileTitle)) {
		return 'wind-w.svg';
	}

	if (/\bnorth\b/.test(searchableText) || /^file:mjf4-\.svg$/i.test(fileTitle)) {
		return 'wind-n.svg';
	}

	const flowerSeasonFilename = getFlowerSeasonFilename(fileTitle, searchableText);
	if (flowerSeasonFilename) {
		return flowerSeasonFilename;
	}

	return null;
}

function getFlowerSeasonFilename(fileTitle, searchableText) {
	const exactMappings = [
		[/^file:mjh1-\.svg$/i, 'season-1.svg'],
		[/^file:mjh2-\.svg$/i, 'season-2.svg'],
		[/^file:mjh3-\.svg$/i, 'season-3.svg'],
		[/^file:mjh4-\.svg$/i, 'season-4.svg'],
		[/^file:mjh5-\.svg$/i, 'flower-1.svg'],
		[/^file:mjh6-\.svg$/i, 'flower-2.svg'],
		[/^file:mjh7-\.svg$/i, 'flower-3.svg'],
		[/^file:mjh8-\.svg$/i, 'flower-4.svg'],
		[/\bspring\b/, 'season-1.svg'],
		[/\bsummer\b/, 'season-2.svg'],
		[/\bautumn\b/, 'season-3.svg'],
		[/\bwinter\b/, 'season-4.svg'],
		[/\bplum\b/, 'flower-1.svg'],
		[/\borchid\b/, 'flower-2.svg'],
		[/\bchrysanthemum\b/, 'flower-3.svg'],
		[/\bbamboo\b/, 'flower-4.svg'],
	];

	const mapping = exactMappings.find(([pattern]) => pattern.test(fileTitle) || pattern.test(searchableText));
	return mapping?.[1] ?? null;
}

function getSearchableMetadataText(fileTitle, imageInfo) {
	return [
		fileTitle,
		readMetadataValue(imageInfo, 'ObjectName'),
		readMetadataValue(imageInfo, 'ImageDescription'),
		readMetadataValue(imageInfo, 'Categories'),
	].filter(Boolean).join('\n');
}

function readMetadataValue(imageInfo, key) {
	const value = imageInfo?.extmetadata?.[key]?.value;

	if (value == null) {
		return null;
	}

	return stripHtml(String(value)).trim();
}

function getCommonsFilePageUrl(fileTitle) {
	return `https://commons.wikimedia.org/wiki/${encodeURIComponent(fileTitle.replace(/ /g, '_')).replace(/%3A/i, ':')}`;
}

function sanitizeFilename(filename) {
	return filename.replace(/[<>:"/\\|?*]/g, '_');
}

function decodeHtml(value) {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function stripHtml(value) {
	return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
}

function writeManifest(manifest) {
	fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

