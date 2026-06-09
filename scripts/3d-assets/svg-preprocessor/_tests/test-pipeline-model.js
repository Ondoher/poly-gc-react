import path from 'path';
import { BASE_OUTPUT } from '../PipelineModel.js';

export class TestPipelineModel {
	constructor({
		tilesetId = 'wiki',
		reference = { referenceSet: { referenceSetId: 'test-reference' }, faces: {} },
		referenceFile = path.resolve('test-root/reference.json'),
		pipelineFilename = path.resolve(BASE_OUTPUT, tilesetId, 'pipeline.json'),
		faces = {},
		configuration = {},
		rendering = {},
		save = async () => {},
	} = {}) {
		this.pipelineFilename = pipelineFilename;
		this.referenceFile = referenceFile;
		this.reference = reference;
		this.pipelineState = {
			schemaVersion: 3,
			tilesetId,
			referenceSetId: reference.referenceSet?.referenceSetId || 'test-reference',
			configuration,
			rendering,
			svgPipeline: { faces },
		};
		this._save = save;
	}

	getTilesetId() {
		return this.pipelineState.tilesetId;
	}

	getFaceKeys() {
		return Object.keys(this.faces()).sort((left, right) => left.localeCompare(right));
	}

	getFaceEntries() {
		return this.getFaceKeys().map((faceKey) => [faceKey, this.getFace(faceKey)]);
	}

	hasFace(faceKey) {
		return Boolean(this.faces()[faceKey]);
	}

	getFace(faceKey) {
		const face = this.faces()[faceKey];
		if (!face) {
			throw new Error(`Unknown test face: ${faceKey}`);
		}
		face.state = face.state || { parts: {}, bindings: {} };
		face.artifacts = face.artifacts || {};
		return face;
	}

	getFaceState(faceKey) {
		return this.getFace(faceKey).state;
	}

	getOptionalPartAssignmentConfig() {
		return this.pipelineState.configuration?.optionalPartAssignment || {};
	}

	getNormalizedComponentsPath(faceKey) {
		return this.getFace(faceKey).artifacts?.normalizedComponents || null;
	}

	recordNormalizationResult(faceKey, { normalizedComponentsPath }) {
		const face = this.getFace(faceKey);
		face.artifacts.normalizedComponents = normalizePath(normalizedComponentsPath);
		delete face.state.alignment;
	}

	applyOptionalPartAssignment(faceKey, { parts = {}, bindings = {} }) {
		const state = this.getFaceState(faceKey);
		state.parts = { ...(state.parts || {}), ...parts };
		state.bindings = bindings;
		delete state.alignment;
	}

	setAlignmentMatches(faceKey, matches) {
		this.getFaceState(faceKey).alignment = { matches };
	}

	clearAlignmentMatches(faceKey) {
		delete this.getFaceState(faceKey).alignment;
	}

	applyAlignmentPlacement(faceKey, placementsByPartId) {
		const state = this.getFaceState(faceKey);
		state.parts = state.parts || {};
		for (const [partId, placement] of Object.entries(placementsByPartId || {})) {
			state.parts[partId] = {
				...(state.parts[partId] || {}),
				...(placement.sourceBounds ? { alignmentSourceBounds: placement.sourceBounds } : {}),
				...(placement.targetBounds ? { alignmentTargetBounds: placement.targetBounds } : {}),
				...(placement.alignedBounds ? { alignmentAlignedBounds: placement.alignedBounds } : {}),
				...(placement.transform ? { alignmentTransform: placement.transform } : {}),
			};
		}
	}

	applySemanticAssignment(faceKey, { parts = {}, bindings = {} }) {
		const state = this.getFaceState(faceKey);
		state.parts = { ...(state.parts || {}), ...parts };
		state.bindings = bindings;
	}

	async save() {
		await this._save(this.pipelineState);
		return this.pipelineState;
	}

	faces() {
		return this.pipelineState.svgPipeline.faces;
	}
}

export function canonicalTestPipelineState({ tilesetId = 'wiki', faces = {}, configuration = {}, rendering = {} } = {}) {
	return {
		schemaVersion: 3,
		tilesetId,
		referenceSetId: 'test-reference',
		configuration,
		rendering,
		svgPipeline: { faces },
	};
}

export function testPipelineModelFromFile({ fileSystem, statePath, reference = null, referenceFile = null } = {}) {
	const state = JSON.parse(fileSystem.files.get(statePath));
	const tilesetId = state.tilesetId || 'wiki';
	const faces = state.svgPipeline?.faces || state.faces || {};
	const model = new TestPipelineModel({
		tilesetId,
		reference: reference || { referenceSet: { referenceSetId: state.referenceSetId || 'test-reference' }, faces: {} },
		referenceFile: referenceFile || path.resolve('test-root/reference.json'),
		pipelineFilename: statePath,
		faces,
		configuration: state.configuration || {},
		rendering: state.rendering || {},
		save: async (pipelineState) => {
			fileSystem.files.set(statePath, `${JSON.stringify(pipelineState, null, 2)}\n`);
			fileSystem.writes.push({ filePath: statePath, content: fileSystem.files.get(statePath), encoding: 'utf8' });
		},
	});
	model.pipelineState = {
		...model.pipelineState,
		...state,
		svgPipeline: {
			...(state.svgPipeline || {}),
			faces,
		},
	};
	delete model.pipelineState.faces;
	return model;
}

export function normalizePath(filePath) {
	return String(filePath || '').replaceAll('\\', '/');
}
