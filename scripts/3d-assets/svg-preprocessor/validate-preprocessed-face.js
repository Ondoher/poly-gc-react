import path from 'path';
import {
	getFacePaths,
	normalizePath,
	validatePreprocessedFace,
	writeJson,
} from './preprocessed-face-validation-utils.js';

const faceKey = process.argv[2];

if (!faceKey) {
	console.error('Usage: node scripts/3d-assets/svg-preprocessor/validate-preprocessed-face.js <face-key>');
	process.exit(1);
}

const paths = getFacePaths(faceKey);
const report = validatePreprocessedFace(faceKey);
report.outputs.validationReport = normalizePath(paths.report);

writeJson(paths.report, report);
console.log(`Wrote ${path.relative(process.cwd(), paths.report)}`);

if (report.static.errors.length > 0) {
	console.error(`Validation failed for ${faceKey}:`);
	for (const error of report.static.errors) {
		console.error(`- ${error.code}: ${error.message}`);
	}
	process.exit(1);
}

console.log(`Validation passed for ${faceKey}; status=${report.status}`);

