import fs from 'fs';

const OZONE_METADATA_PATH =
	'scripts/flat/atmosphere/data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm-metadata.json';
const OZONE_DATA_PATH =
	'scripts/flat/atmosphere/data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm.txt';

function loadMetadata() {
	return JSON.parse(fs.readFileSync(OZONE_METADATA_PATH, 'utf8'));
}

function loadRows() {
	const values = fs.readFileSync(OZONE_DATA_PATH, 'utf8').trim().split(/\s+/u).map(Number);
	const rows = [];

	for (let index = 0; index < values.length; index += 2) {
		rows.push({
			wavelengthNm: values[index],
			crossSectionCm2: values[index + 1],
		});
	}

	return rows;
}

describe('Brion ozone source data', function() {
	it('records MPI-Mainz and measurement provenance', function() {
		const metadata = loadMetadata();

		// Reason: ozone absorption is a sourced composition input, not a local display/color tweak.
		// Source: Atmosphere Composition Plan, Ozone absorption next action.
		expect(metadata.kind).toBe('flat-atmosphere-reference-ozone-source-data');
		expect(metadata.id).toBe('brion-1998-ozone-295k-visible');
		expect(metadata.source.atlasDoi).toBe('10.5194/essd-5-365-2013');
		expect(metadata.source.datasetUrl).toContain('O3_Brion%281998%29_295K_345-829nm%281nm%29.txt');
		expect(metadata.table.temperatureK).toBe(295);
		expect(metadata.table.crossSectionUnits).toBe('cm^2 molecule^-1');
	});

	it('stores the downloaded visible-band table shape', function() {
		const metadata = loadMetadata();
		const rows = loadRows();

		// Reason: the selected table should cover the sky-patch visible grids and Chappuis band directly.
		// Source: MPI-Mainz O3 data set list, Brion(1998) 295K 345-829nm(1nm).
		expect(rows.length).toBe(metadata.table.rowCount);
		expect(rows.length).toBe(485);
		expect(rows[0]).toEqual({ wavelengthNm: 345, crossSectionCm2: 6.636e-22 });
		expect(rows[rows.length - 1]).toEqual({ wavelengthNm: 829, crossSectionCm2: 1.055e-22 });
	});

	it('pins visible Chappuis rows from the raw table', function() {
		const metadata = loadMetadata();
		const rowsByNm = new Map(loadRows().map((row) => [row.wavelengthNm, row]));

		for (const pinned of metadata.pinnedRows) {
			// Reason: implementation tests need exact source-data anchors independent from interpolation code.
			// Source: local metadata extracted from MPI-Mainz Brion 1998 raw table.
			expect(rowsByNm.get(pinned.wavelengthNm).crossSectionCm2)
				.withContext(`pinned ${pinned.wavelengthNm} nm`)
				.toBe(pinned.crossSectionCm2);
		}

		expect(rowsByNm.get(603).crossSectionCm2).toBeGreaterThan(rowsByNm.get(575).crossSectionCm2);
		expect(rowsByNm.get(575).crossSectionCm2).toBeGreaterThan(rowsByNm.get(550).crossSectionCm2);
		expect(rowsByNm.get(650).crossSectionCm2).toBeGreaterThan(rowsByNm.get(450).crossSectionCm2);
	});
});
