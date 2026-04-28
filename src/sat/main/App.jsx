import React from 'react';
import citiesDatabase from 'cities.json';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

const WGS84_A = 6378.137;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = (WGS84_A ** 2 - WGS84_B ** 2) / (WGS84_A ** 2);
const DEFAULT_GEO_ALTITUDE = 35786;
const ASTRA_NEIGHBORHOODS = Object.freeze([
	{
		id: 'astra-4a-5e',
		name: 'ASTRA 4A',
		description: 'Nordic, Eastern Europe, and regional coverage neighborhood',
		longitude: 5,
		altitude: DEFAULT_GEO_ALTITUDE,
		spacecraft: ['ASTRA 4A'],
	},
	{
		id: 'astra-19-2e',
		name: 'ASTRA 19.2E',
		description: 'SES Astra television neighborhood at 19.2 degrees East',
		longitude: 19.2,
		altitude: DEFAULT_GEO_ALTITUDE,
		spacecraft: ['ASTRA 1KR', 'ASTRA 1L', 'ASTRA 1M', 'ASTRA 1N', 'ASTRA 1P'],
	},
	{
		id: 'astra-23-5e',
		name: 'ASTRA 23.5E',
		description: 'Benelux and Central/Eastern Europe neighborhood',
		longitude: 23.5,
		altitude: DEFAULT_GEO_ALTITUDE,
		spacecraft: ['ASTRA 3B', 'ASTRA 3C'],
	},
	{
		id: 'astra-28-2e',
		name: 'ASTRA 28.2E',
		description: 'UK and Ireland direct-to-home television neighborhood',
		longitude: 28.2,
		altitude: DEFAULT_GEO_ALTITUDE,
		spacecraft: ['ASTRA 2E', 'ASTRA 2F', 'ASTRA 2G'],
	},
]);
const ASTRA_SPACECRAFT_COUNT = ASTRA_NEIGHBORHOODS
	.reduce((count, neighborhood) => count + neighborhood.spacecraft.length, 0);

const CITY_RECORDS = citiesDatabase
	.map((record, index) => {
		const lat = Number(record.lat);
		const lon = Number(record.lng);
		const country = String(record.country || '').toUpperCase();
		const name = String(record.name || '').trim();
		const admin1 = String(record.admin1 || '').trim();
		const admin2 = String(record.admin2 || '').trim();

		return {
			id: `${name.toLowerCase()}|${country}|${admin1}|${admin2}|${index}`,
			label: [name, admin1, country].filter(Boolean).join(', '),
			name,
			country,
			admin1,
			admin2,
			lat,
			lon,
			searchText: [name, admin1, admin2, country].join(' ').toLowerCase(),
		};
	})
	.filter((record) => record.name && record.country && Number.isFinite(record.lat) && Number.isFinite(record.lon));
const CITY_RECORDS_BY_ID = new Map(CITY_RECORDS.map((record) => [record.id, record]));
function degreesToRadians(value) {
	return value * Math.PI / 180;
}

function radiansToDegrees(value) {
	return value * 180 / Math.PI;
}

function formatNumber(value, digits = 2) {
	if (!Number.isFinite(value)) {
		return 'n/a';
	}

	return value.toLocaleString(undefined, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

function formatVector(vector) {
	return `X ${formatNumber(vector.x, 3)}, Y ${formatNumber(vector.y, 3)}, Z ${formatNumber(vector.z, 3)} km`;
}

function cityLabel(city) {
	return city.country ? `${city.name}, ${city.country}` : city.name;
}

function findCityRecord(name, country) {
	const lowerName = name.toLowerCase();
	const upperCountry = country.toUpperCase();

	return CITY_RECORDS.find((record) =>
		record.name.toLowerCase() === lowerName &&
		record.country === upperCountry
	);
}

function cityMatches(query) {
	const normalizedQuery = String(query || '').trim().toLowerCase();
	if (!normalizedQuery) {
		return [];
	}

	const terms = normalizedQuery.split(/\s+/).filter(Boolean);
	const exactMatches = [];
	const prefixMatches = [];
	const looseMatches = [];

	for (const record of CITY_RECORDS) {
		if (!terms.every((term) => record.searchText.includes(term))) {
			continue;
		}

		if (record.name.toLowerCase() === normalizedQuery) {
			exactMatches.push(record);
		} else if (record.name.toLowerCase().startsWith(normalizedQuery)) {
			prefixMatches.push(record);
		} else {
			looseMatches.push(record);
		}

		if (exactMatches.length + prefixMatches.length + looseMatches.length >= 80) {
			break;
		}
	}

	return [...exactMatches, ...prefixMatches, ...looseMatches].slice(0, 18);
}

function makeEmptyCitySelection() {
	return {
		cityId: '',
		query: '',
		name: '',
		country: '',
		lat: '',
		lon: '',
	};
}

function geodeticToEcef(lat, lon, height = 0) {
	const latRad = degreesToRadians(lat);
	const lonRad = degreesToRadians(lon);
	const sinLat = Math.sin(latRad);
	const cosLat = Math.cos(latRad);
	const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat ** 2);

	return {
		x: (n + height) * cosLat * Math.cos(lonRad),
		y: (n + height) * cosLat * Math.sin(lonRad),
		z: (n * (1 - WGS84_E2) + height) * sinLat,
		n,
	};
}

function satelliteEcef(longitude, altitude) {
	const lonRad = degreesToRadians(longitude);
	const radius = WGS84_A + altitude;

	return {
		x: radius * Math.cos(lonRad),
		y: radius * Math.sin(lonRad),
		z: 0,
		radius,
	};
}

function topocentricFromEcef(lat, lon, delta) {
	const latRad = degreesToRadians(lat);
	const lonRad = degreesToRadians(lon);
	const sinLat = Math.sin(latRad);
	const cosLat = Math.cos(latRad);
	const sinLon = Math.sin(lonRad);
	const cosLon = Math.cos(lonRad);

	const east = -sinLon * delta.x + cosLon * delta.y;
	const north = -sinLat * cosLon * delta.x - sinLat * sinLon * delta.y + cosLat * delta.z;
	const up = cosLat * cosLon * delta.x + cosLat * sinLon * delta.y + sinLat * delta.z;
	const range = Math.sqrt(east ** 2 + north ** 2 + up ** 2);
	const azimuth = (radiansToDegrees(Math.atan2(east, north)) + 360) % 360;
	const elevation = radiansToDegrees(Math.asin(up / range));

	return { east, north, up, range, azimuth, elevation };
}

function calculateCityResult(city, satellite) {
	if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon)) {
		return null;
	}

	const stationEcef = geodeticToEcef(city.lat, city.lon);
	const delta = {
		x: satellite.x - stationEcef.x,
		y: satellite.y - stationEcef.y,
		z: satellite.z - stationEcef.z,
	};
	const topo = topocentricFromEcef(city.lat, city.lon, delta);

	return {
		...city,
		label: cityLabel(city),
		stationEcef,
		delta,
		...topo,
		visible: topo.elevation > 0,
	};
}

function bestAstraForCity(city) {
	const candidates = ASTRA_NEIGHBORHOODS.map((neighborhood) => {
		const satellite = satelliteEcef(neighborhood.longitude, neighborhood.altitude);
		const result = calculateCityResult(city, satellite);

		return result ? {
			neighborhood,
			satellite,
			result: {
				...result,
				neighborhood,
			},
		} : null;
	}).filter(Boolean);

	if (candidates.length === 0) {
		return null;
	}

	const visibleCandidates = candidates.filter((candidate) => candidate.result.visible);

	if (visibleCandidates.length === 0) {
		return {
			neighborhood: null,
			satellite: null,
			result: candidates.sort((left, right) => right.result.elevation - left.result.elevation)[0].result,
			noVisibleAstra: true,
		};
	}

	return visibleCandidates.sort((left, right) => right.result.elevation - left.result.elevation)[0];
}

function MathMarkdown({ children, className = '' }) {
	return (
		<ReactMarkdown
			className={className}
			remarkPlugins={[remarkMath]}
			rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
		>
			{children}
		</ReactMarkdown>
	);
}

class MarkdownReference extends React.Component {
	constructor(props) {
		super(props);
		this.state = { markdown: '', error: '' };
	}

	componentDidMount() {
		this.loadMarkdown();
	}

	async loadMarkdown() {
		try {
			const response = await fetch(this.props.source);
			if (!response.ok) {
				throw new Error(`Unable to load ${this.props.source}.`);
			}
			this.setState({ markdown: await response.text(), error: '' });
		} catch (error) {
			this.setState({ error: error.message });
		}
	}

	render() {
		if (this.state.error) {
			return <p className="sat-note">{this.state.error}</p>;
		}

		if (!this.state.markdown) {
			return <p className="sat-note">Loading reference notes...</p>;
		}

		return (
			<MathMarkdown className="sat-markdown">
				{this.state.markdown}
			</MathMarkdown>
		);
	}
}

export default class App extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			city: makeEmptyCitySelection(),
			typeaheadOpen: false,
			history: [],
			activeHistoryId: '',
		};
	}

	getSatellite() {
		return this.getRecommendation()?.satellite ||
			satelliteEcef(ASTRA_NEIGHBORHOODS[0].longitude, ASTRA_NEIGHBORHOODS[0].altitude);
	}

	getCityForCalculation() {
		return {
			...this.state.city,
			lat: Number(this.state.city.lat),
			lon: Number(this.state.city.lon),
		};
	}

	getRecommendation() {
		return bestAstraForCity(this.getCityForCalculation());
	}

	getResult() {
		const recommendation = this.getRecommendation();
		return recommendation?.noVisibleAstra ? null : recommendation?.result || null;
	}

	componentDidUpdate(previousProps, previousState) {
		if (!CITY_RECORDS_BY_ID.has(this.state.city.cityId)) {
			return;
		}

		const recommendation = this.getRecommendation();
		if (!recommendation || recommendation.noVisibleAstra || !recommendation.result) {
			return;
		}

		const result = recommendation.result;
		const signature = [
			result.name,
			result.country,
			Number(result.lat).toFixed(5),
			Number(result.lon).toFixed(5),
			recommendation.neighborhood.id,
		].join('|');

		if (previousState.activeHistoryId === signature) {
			return;
		}

		this.setState((state) => {
			if (state.activeHistoryId === signature) {
				return null;
			}

			const entry = {
				id: signature,
				city: { ...state.city },
				neighborhoodName: recommendation.neighborhood.name,
				longitude: recommendation.neighborhood.longitude,
				elevation: result.elevation,
				azimuth: result.azimuth,
				range: result.range,
			};
			const history = [
				entry,
				...state.history.filter((item) => item.id !== signature),
			].slice(0, 8);

			return {
				history,
				activeHistoryId: signature,
			};
		});
	}

	updateCity(patch) {
		this.setState((state) => ({
			city: { ...state.city, ...patch },
		}));
	}

	updateCityQuery(query) {
		this.setState((state) => ({
			city: {
				...state.city,
				query,
				cityId: 'manual',
				name: query || 'Manual',
				country: '',
			},
			typeaheadOpen: true,
		}));
	}

	selectCity(cityId) {
		const city = CITY_RECORDS_BY_ID.get(cityId);
		if (!city) {
			return;
		}

		this.setState({
			city: {
				...this.state.city,
				cityId,
				query: city.label,
				name: city.name,
				country: city.country,
				lat: city.lat,
				lon: city.lon,
			},
			typeaheadOpen: false,
		});
	}

	selectHistory(entry) {
		this.setState({
			city: { ...entry.city },
			activeHistoryId: entry.id,
			typeaheadOpen: false,
		});
	}

	handleTypeaheadKeyDown(event, matches) {
		if (event.key === 'Enter' && matches[0]) {
			event.preventDefault();
			this.selectCity(matches[0].id);
		}

		if (event.key === 'Escape') {
			this.setState({ typeaheadOpen: false });
		}
	}

	renderHeader(result, recommendation) {
		return (
			<header className="sat-header">
				<div className="sat-title-block">
					<h1>ASTRA Satellite Pointing Calculator</h1>
					<p>Pick a city and the app selects the best ASTRA orbital neighborhood by elevation, then calculates WGS84 station coordinates, look vector, azimuth, elevation, and slant range.</p>
				</div>
				<div className="sat-summary">
					<div className="sat-metric">
						<span>ASTRA spacecraft</span>
						<strong>{ASTRA_SPACECRAFT_COUNT}</strong>
					</div>
					<div className="sat-metric">
						<span>Selected slot</span>
						<strong>{recommendation?.neighborhood ? `${formatNumber(recommendation.neighborhood.longitude, 1)} deg E` : recommendation?.noVisibleAstra ? 'None visible' : 'Pick a city'}</strong>
					</div>
					<div className="sat-metric">
						<span>Elevation</span>
						<strong>{result ? `${formatNumber(result.elevation)} deg` : recommendation?.noVisibleAstra ? 'Below horizon' : 'Pick a city'}</strong>
					</div>
				</div>
			</header>
		);
	}

	renderSatellitePanel(satellite, recommendation) {
		const neighborhood = recommendation?.neighborhood;

		return (
			<section className="sat-panel">
				<h2>Recommended ASTRA Neighborhood</h2>
				<div className="sat-fixed-satellite">
					<div>
						<span>Name</span>
						<strong>{neighborhood?.name || 'Pick a city'}</strong>
					</div>
					<div>
						<span>Position</span>
						<strong>{neighborhood ? `${formatNumber(neighborhood.longitude, 1)} deg East` : 'n/a'}</strong>
					</div>
					<div>
						<span>Assumed altitude</span>
						<strong>{neighborhood ? `${formatNumber(neighborhood.altitude, 0)} km` : 'n/a'}</strong>
					</div>
				</div>
				{neighborhood ? (
					<React.Fragment>
						<p className="sat-note">{neighborhood.description}. Selection is based on the highest elevation angle from the observer city.</p>
						<p className="sat-note">Spacecraft at this slot: {neighborhood.spacecraft.join(', ')}.</p>
						<p className="sat-note">Satellite ECEF: {formatVector(satellite)}</p>
					</React.Fragment>
				) : recommendation?.noVisibleAstra ? (
					<p className="sat-note">No modeled ASTRA neighborhood is above the local horizon for this city. The best geometric candidate still points below the horizon, so a dish would point through the Earth.</p>
				) : (
					<p className="sat-note">Enter a city to choose the visible ASTRA orbital neighborhood with the highest elevation.</p>
				)}
			</section>
		);
	}

	renderCityPanel() {
		const city = this.state.city;
		const matches = cityMatches(city.query);
		const showMatches = this.state.typeaheadOpen && matches.length > 0;

		return (
			<section className="sat-panel">
				<h2>Observer City</h2>
				<div className="sat-single-city">
					<div className="sat-typeahead">
						<label htmlFor="city-query">City</label>
						<input
							id="city-query"
							value={city.query}
							placeholder="Start typing a city..."
							autoComplete="off"
							onFocus={() => this.setState({ typeaheadOpen: true })}
							onBlur={() => window.setTimeout(() => this.setState({ typeaheadOpen: false }), 120)}
							onChange={(event) => this.updateCityQuery(event.target.value)}
							onKeyDown={(event) => this.handleTypeaheadKeyDown(event, matches)}
						/>
						{showMatches && (
							<div className="sat-typeahead-menu">
								{matches.map((match) => (
									<button
										key={match.id}
										type="button"
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => this.selectCity(match.id)}
									>
										<span>{match.name}</span>
										<strong>{[match.admin1, match.country].filter(Boolean).join(', ')}</strong>
									</button>
								))}
							</div>
						)}
					</div>
					<div className="sat-field-grid">
						<div className="sat-field">
							<label htmlFor="city-lat">Latitude</label>
							<input
								id="city-lat"
								type="number"
								step="0.0001"
								value={city.lat}
								onChange={(event) => this.updateCity({ cityId: 'manual', lat: event.target.value })}
							/>
						</div>
						<div className="sat-field">
							<label htmlFor="city-lon">Longitude</label>
							<input
								id="city-lon"
								type="number"
								step="0.0001"
								value={city.lon}
								onChange={(event) => this.updateCity({ cityId: 'manual', lon: event.target.value })}
							/>
						</div>
					</div>
				</div>
				<p className="sat-note">City search uses the npm `cities.json` dataset. Type a city name to see matches, or enter latitude and longitude manually.</p>
			</section>
		);
	}

	renderHistoryPanel() {
		return (
			<section className="sat-panel sat-history">
				<h2>Previous Results</h2>
				{this.state.history.length === 0 ? (
					<div className="sat-empty-state">
						<strong>No previous results</strong>
						<p>Pick a city to save its calculated ASTRA recommendation here.</p>
					</div>
				) : (
					<div className="sat-history-list">
						{this.state.history.map((entry) => (
							<button
								key={entry.id}
								type="button"
								className={`sat-history-item ${entry.id === this.state.activeHistoryId ? 'is-selected' : ''}`}
								onClick={() => this.selectHistory(entry)}
							>
								<span>{cityLabel(entry.city)}</span>
								<strong>{entry.neighborhoodName} | {formatNumber(entry.elevation)} deg</strong>
							</button>
						))}
					</div>
				)}
			</section>
		);
	}

	renderResultCard(result) {
		if (!result) {
			return (
				<section className="sat-panel sat-results">
					<h2>Calculated View</h2>
					<div className="sat-empty-state">
						<strong>No visible ASTRA pointing solution</strong>
						<p>Search for a city or enter latitude and longitude. If every modeled ASTRA slot is below the local horizon, no dish angle is recommended.</p>
					</div>
				</section>
			);
		}

		return (
			<section className="sat-panel sat-results">
				<h2>Calculated View</h2>
				<div className="sat-result-card sat-result-card-static">
					<h3>{result.label}</h3>
					<div className="sat-result-values">
						<div><span>Azimuth</span><strong>{formatNumber(result.azimuth)} deg</strong></div>
						<div><span>Elevation</span><strong>{formatNumber(result.elevation)} deg</strong></div>
						<div><span>Slant range</span><strong>{formatNumber(result.range, 1)} km</strong></div>
						<div><span>Status</span><strong>{result.visible ? 'Visible' : 'Below horizon'}</strong></div>
					</div>
				</div>
			</section>
		);
	}

	renderSteps(result, satellite) {
		if (!result) {
			return (
				<section className="sat-panel sat-steps">
					<h2>Step Through</h2>
					<div className="sat-empty-state">
						<strong>Waiting for city coordinates</strong>
						<p>The calculation steps will appear after the app has a valid latitude and longitude.</p>
					</div>
				</section>
			);
		}

		const steps = [
			{
				title: '1. Convert city geodetic coordinates to WGS84 ECEF',
				formula: [
					'$$',
					'N(\\phi)=\\frac{a}{\\sqrt{1-e^2\\sin^2(\\phi)}}',
					'$$',
					'$$',
					'\\begin{aligned}',
					'X&=(N+h)\\cos(\\phi)\\cos(\\lambda)\\\\',
					'Y&=(N+h)\\cos(\\phi)\\sin(\\lambda)\\\\',
					'Z&=(N(1-e^2)+h)\\sin(\\phi)',
					'\\end{aligned}',
					'$$',
				].join('\n'),
				results: [
					['Observer', result.label],
					['Latitude', `${formatNumber(result.lat, 4)} deg`],
					['Longitude', `${formatNumber(result.lon, 4)} deg`],
					['Prime-vertical radius', `${formatNumber(result.stationEcef.n, 3)} km`],
					['Station ECEF', formatVector(result.stationEcef)],
				],
			},
			{
				title: '2. Place the selected ASTRA slot on the equatorial GEO ring',
				formula: [
					'$$',
					'r_{sat}=a+h_{GEO}',
					'$$',
					'$$',
					'\\begin{aligned}',
					'X_{sat}&=r_{sat}\\cos(\\lambda_{sat})\\\\',
					'Y_{sat}&=r_{sat}\\sin(\\lambda_{sat})\\\\',
					'Z_{sat}&=0',
					'\\end{aligned}',
					'$$',
				].join('\n'),
				results: [
					['ASTRA neighborhood', result.neighborhood.name],
					['Longitude', `${formatNumber(result.neighborhood.longitude, 2)} deg east`],
					['Orbital radius', `${formatNumber(satellite.radius, 3)} km`],
					['Satellite ECEF', formatVector(satellite)],
				],
			},
			{
				title: '3. Build the station-to-satellite vector',
				formula: [
					'$$',
					'\\Delta\\mathbf{r}=\\mathbf{r}_{sat}-\\mathbf{r}_{station}',
					'$$',
				].join('\n'),
				results: [
					['Line-of-sight delta', formatVector(result.delta)],
				],
			},
			{
				title: '4. Rotate ECEF delta into local east, north, up axes',
				formula: [
					'$$',
					'\\begin{bmatrix}E\\\\N\\\\U\\end{bmatrix}=',
					'\\begin{bmatrix}',
					'-\\sin\\lambda & \\cos\\lambda & 0\\\\',
					'-\\sin\\phi\\cos\\lambda & -\\sin\\phi\\sin\\lambda & \\cos\\phi\\\\',
					'\\cos\\phi\\cos\\lambda & \\cos\\phi\\sin\\lambda & \\sin\\phi',
					'\\end{bmatrix}',
					'\\Delta\\mathbf{r}',
					'$$',
				].join('\n'),
				results: [
					['East', `${formatNumber(result.east, 3)} km`],
					['North', `${formatNumber(result.north, 3)} km`],
					['Up', `${formatNumber(result.up, 3)} km`],
				],
			},
			{
				title: '5. Derive pointing angles and range',
				formula: [
					'$$',
					'\\rho=\\sqrt{E^2+N^2+U^2}',
					'$$',
					'$$',
					'\\begin{aligned}',
					'A&=\\operatorname{atan2}(E,N)\\\\',
					'e&=\\sin^{-1}\\left(\\frac{U}{\\rho}\\right)',
					'\\end{aligned}',
					'$$',
				].join('\n'),
				results: [
					['Slant range', `${formatNumber(result.range, 3)} km`],
					['Azimuth', `${formatNumber(result.azimuth, 2)} deg`],
					['Elevation', `${formatNumber(result.elevation, 2)} deg`],
				],
			},
		];

		return (
			<section className="sat-panel sat-steps">
				<h2>Step Through: {result.label}</h2>
				<div className="sat-step-list">
					{steps.map((step) => (
						<article className="sat-step" key={step.title}>
							<h3>{step.title}</h3>
							<MathMarkdown className="sat-step-formula">{step.formula}</MathMarkdown>
							<div className="sat-step-results">
								{step.results.map(([label, value]) => (
									<div key={label}>
										<strong>{label}</strong>
										<span>{value}</span>
									</div>
								))}
							</div>
						</article>
					))}
				</div>
			</section>
		);
	}

	renderReference() {
		return (
			<aside className="sat-reference">
				<h2>Math Reference</h2>
				<MarkdownReference source="docs/notes.md" />
			</aside>
		);
	}

	render() {
		const recommendation = this.getRecommendation();
		const satellite = recommendation?.satellite || this.getSatellite();
		const result = recommendation?.noVisibleAstra ? null : recommendation?.result || null;

		return (
			<div className="sat-app">
				<main className="sat-workspace">
					{this.renderHeader(result, recommendation)}
					<div className="sat-controls">
						{this.renderCityPanel()}
						{this.renderSatellitePanel(satellite, recommendation)}
					</div>
					<div className="sat-main-grid">
						{this.renderResultCard(result)}
						{this.renderSteps(result, satellite)}
					</div>
					{this.renderHistoryPanel()}
				</main>
				{this.renderReference()}
			</div>
		);
	}
}
