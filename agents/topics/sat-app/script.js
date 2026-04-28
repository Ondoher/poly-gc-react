
/**
 * WGS84 Automated Multi-Station Satellite Triangulation Engine
 * Automatically resolves city locations using the local 'cities.json' package
 * and applies the WGS84 ellipsoid framework to compute satellite altitude.
 */

// --- 1. IMPORT DEPENDENCIES & INITIALIZE DATABASE ---
let citiesDatabase;
try {
    citiesDatabase = require('cities.json');
} catch (e) {
    console.error("Error: Please run 'npm install cities.json' before executing this script.");
    process.exit(1);
}

// --- 2. CONFIGURATION & INPUT BATCH LIST ---
const WGS84_A = 6378.137;           // Semi-major axis (equatorial radius) in km
const WGS84_F = 1.0 / 298.257223563; // Flattening factor
const WGS84_B = WGS84_A * (1.0 - WGS84_F);
const WGS84_E2 = (WGS84_A**2 - WGS84_B**2) / (WGS84_A**2);

// Your automated batch list. Input raw city names, country codes, and your measured look-angles.
// Country codes are standard ISO 2-letter blocks (GB = United Kingdom, ES = Spain, FR = France)
const targetInputs = [
    { cityName: "London",  country: "GB", az: 144.7, el: 24.9 },
    { cityName: "Bristol", country: "GB", az: 142.1, el: 24.1 },
    { cityName: "Paris",   country: "FR", az: 148.9, el: 27.9 },
    { cityName: "Madrid",  country: "ES", az: 136.2, el: 36.4 }
];

// --- 3. GEODETIC & MATH HELPER FUNCTIONS ---

/**
 * Parses the cities.json database to safely extract precise coordinates.
 */
function lookupCityCoordinates(cityName, countryCode) {
    const record = citiesDatabase.find(c =>
        c.name.toLowerCase() === cityName.toLowerCase() &&
        c.country.toUpperCase() === countryCode.toUpperCase()
    );

    if (!record) {
        throw new Error(`Location mapping failed: "${cityName} (${countryCode})" not found in local database.`);
    }

    // Explicitly parse coordinates to floats as databases can store them as strings
    return {
        lat: parseFloat(record.lat),
        lon: parseFloat(record.lng)
    };
}

function geodeticToECEF(lat, lon) {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * Math.sin(latRad)**2);

    return {
        X: N * Math.cos(latRad) * Math.cos(lonRad),
        Y: N * Math.cos(latRad) * Math.sin(lonRad),
        Z: N * (1.0 - WGS84_E2) * Math.sin(latRad)
    };
}

function getWGS84UnitVector(lat, lon, azimuth, elevation) {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const azRad = (azimuth * Math.PI) / 180;
    const elRad = (elevation * Math.PI) / 180;

    const e = Math.cos(elRad) * Math.sin(azRad);
    const n = Math.cos(elRad) * Math.cos(azRad);
    const u = Math.sin(elRad);

    const X = -Math.sin(lonRad) * e - Math.sin(latRad) * Math.cos(lonRad) * n + Math.cos(latRad) * Math.cos(lonRad) * u;
    const Y =  Math.cos(lonRad) * e - Math.sin(latRad) * Math.sin(lonRad) * n + Math.cos(latRad) * Math.sin(lonRad) * u;
    const Z =  Math.cos(latRad) * n + Math.sin(latRad) * u;

    return { X, Y, Z };
}

// --- 4. MULTI-LINE N-DIMENSIONAL LEAST SQUARES SOLVER ---

function solveMultiLineIntersection(resolvedStations) {
    let A = [[0,0,0], [0,0,0], [0,0,0]];
    let B = [0, 0, 0];

    resolvedStations.forEach(st => {
        const u = [st.vector.X, st.vector.Y, st.vector.Z];
        const p = [st.ecef.X, st.ecef.Y, st.ecef.Z];

        let I_minus_uuT = [[0,0,0], [0,0,0], [0,0,0]];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                I_minus_uuT[i][j] = (i === j ? 1.0 : 0.0) - (u[i] * u[j]);
            }
        }

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                A[i][j] += I_minus_uuT[i][j];
            }
        }

        for (let i = 0; i < 3; i++) {
            let sum = 0;
            for (let j = 0; j < 3; j++) {
                sum += I_minus_uuT[i][j] * p[j];
            }
            B[i] += sum;
        }
    });

    const det = A[0][0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1]) -
                A[0][1]*(A[1][0]*A[2][2] - A[1][2]*A[2][0]) +
                A[0][2]*(A[1][0]*A[2][1] - A[1][1]*A[2][0]);

    if (Math.abs(det) < 1e-5) throw new Error("Matrix singular; data sets lack geometry convergence.");

    const detX = B[0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1]) - A[0][1]*(B[1]*A[2][2] - A[1][2]*B[2]) + A[0][2]*(B[1]*A[2][1] - A[1][1]*B[2]);
    const detY = A[0][0]*(B[1]*A[2][2] - A[1][2]*B[2]) - B[0]*(A[1][0]*A[2][2] - A[1][2]*A[2][0]) + A[0][2]*(A[1][0]*B[2] - B[1]*A[2][0]);
    const detZ = A[0][0]*(A[1][1]*B[2] - B[1]*A[2][1]) - A[0][1]*(A[1][0]*B[2] - B[1]*A[2][0]) + B[0]*(A[1][0]*A[2][1] - A[1][1]*A[2][0]);

    return { X: detX / det, Y: detY / det, Z: detZ / det };
}

// --- 5. DATA PIPELINE EXECUTION ---

try {
    console.log("=====================================================================");
    console.log("    WGS84 AUTOMATED GEOLOCATION BATCH ENGINE ACTIVE                  ");
    console.log("=====================================================================");

    // Process input text strings against local database
    const activePipelineData = targetInputs.map(input => {
        const coords = lookupCityCoordinates(input.cityName, input.country);
        const ecef = geodeticToECEF(coords.lat, coords.lon);
        const vector = getWGS84UnitVector(coords.lat, coords.lon, input.az, input.el);

        console.log(` -> Synced: ${input.cityName.padEnd(8)} (${input.country}) | Lat: ${coords.lat.toFixed(4)} | Lon: ${coords.lon.toFixed(4)}`);

        return { name: input.cityName, ecef, vector };
    });

    // Run geometric solution
    const satPos = solveMultiLineIntersection(activePipelineData);
    const totalOrbitalRadius = Math.sqrt(satPos.X**2 + satPos.Y**2 + satPos.Z**2);
    const satLonDegrees = (Math.atan2(satPos.Y, satPos.X) * 180) / Math.PI;
    const finalAltitudeWGS84 = totalOrbitalRadius - WGS84_A;

    console.log("\n========================= RESOLVED POSITION ========================");
    console.log(`Optimal Satellite Coordinates (ECEF Grid Point):`);
    console.log(`  -> X Coordinate:         ${satPos.X.toFixed(3)} km`);
    console.log(`  -> Y Coordinate:         ${satPos.Y.toFixed(3)} km`);
    console.log(`  -> Z Coordinate:         ${satPos.Z.toFixed(3)} km`);
    console.log(`  -> Calculated Longitude: ${satLonDegrees.toFixed(2)}° East`);
    console.log("--------------------------------------------------------------------");
    console.log(`  -> Calculated Orbit Radius:      ${totalOrbitalRadius.toFixed(3)} km`);
    console.log(`  -> WGS84 Equatorial Baseline:    ${WGS84_A.toFixed(3)} km`);
    console.log(`  => TRUE ATMOSPHERIC ALTITUDE:    ${finalAltitudeWGS84.toFixed(3)} km`);
    console.log("=====================================================================");

} catch (error) {
    console.error("\nExecution Pipeline Failed:", error.message);
}
