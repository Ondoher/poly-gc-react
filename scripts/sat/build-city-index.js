import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.join('node_modules', 'cities.json', 'cities.json');
const destinationPath = path.join('src', 'sat', 'assets', 'data', 'cities.json');

function normalizeString(value) {
	return String(value || '').trim();
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const records = source
	.map((record) => {
		const name = normalizeString(record.name);
		const country = normalizeString(record.country).toUpperCase();
		const admin1 = normalizeString(record.admin1);
		const lat = Number(record.lat);
		const lon = Number(record.lng);

		if (!name || !country || !Number.isFinite(lat) || !Number.isFinite(lon)) {
			return null;
		}

		return {
			n: name,
			c: country,
			a: admin1,
			lat: Number(lat.toFixed(5)),
			lon: Number(lon.toFixed(5)),
		};
	})
	.filter(Boolean);

await mkdir(path.dirname(destinationPath), { recursive: true });
await writeFile(destinationPath, `${JSON.stringify(records)}\n`, 'utf8');

console.log(`Wrote ${records.length.toLocaleString()} city records to ${destinationPath}`);
