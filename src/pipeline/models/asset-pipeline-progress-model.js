import { Service } from '@polylith/core';

const ASSET_PIPELINE_NAMESPACE = '/asset-pipeline';

export default class AssetPipelineProgressModel extends Service {
	constructor(registry) {
		super('asset-pipeline-progress-model', registry);
		this.implement([
			'namespace',
			'emptyGenerationProgress',
			'phaseForGenerationEvent',
			'mergeGenerationProgress',
			'summarizeReviewFaces',
			'applyGenerationEventToReviewFace',
			'markReviewFaceReady',
		]);
	}

	namespace() {
		return ASSET_PIPELINE_NAMESPACE;
	}

	emptyGenerationProgress() {
		return {
			phase: 'idle',
			percent: 0,
			completed: 0,
			total: 0,
			faceKey: '',
			stageLabel: '',
			message: 'Ready to plan generated assets.',
		};
	}

	phaseForGenerationEvent(eventName) {
		if (eventName === 'assetGenerationComplete') {
			return 'complete';
		}
		if (eventName === 'assetGenerationFailed') {
			return 'failed';
		}
		return 'running';
	}

	mergeGenerationProgress(progress, phase, event = {}) {
		return {
			phase,
			percent: Number.isFinite(event.percent) ? event.percent : progress.percent,
			completed: Number.isFinite(event.completed) ? event.completed : progress.completed,
			total: Number.isFinite(event.total) ? event.total : progress.total,
			faceKey: event.faceKey || progress.faceKey,
			stageLabel: event.stageLabel || progress.stageLabel,
			message: event.message || progress.message,
		};
	}

	summarizeReviewFaces(faces) {
		const counts = (faces || []).reduce((summary, face) => {
			summary[face.state] = (summary[face.state] || 0) + 1;
			return summary;
		}, {});

		return {
			faceCount: faces?.length || 0,
			readyCount: counts.ready || 0,
			buildingCount: counts.building || 0,
			queuedCount: counts.queued || 0,
			staleCount: counts.stale || 0,
			failedCount: counts.failed || 0,
			unavailableCount: counts.unavailable || 0,
		};
	}

	applyGenerationEventToReviewFace(face, event = {}) {
		const state = reviewStateForGenerationStatus(event.status, face);

		if (state === 'ready') {
			return readyReviewFace(face);
		}

		return {
			...face,
			state,
			building: state === 'building',
			queued: state === 'queued',
			failed: state === 'failed',
			ready: state === 'ready',
			stale: state === 'stale',
			unavailable: state === 'unavailable',
			queue: {
				...(face.queue || {}),
				status: state,
				currentStep: event.stageLabel || event.stage || face.queue?.currentStep || '',
				stageProgress: event.stageProgress || face.queue?.stageProgress || null,
			},
			build: {
				...(face.build || {}),
				currentStep: event.stageLabel || event.stage || face.build?.currentStep || '',
				stageProgress: event.stageProgress || face.build?.stageProgress || null,
			},
		};
	}

	markReviewFaceReady(face) {
		return readyReviewFace(face);
	}
}

new AssetPipelineProgressModel();

function readyReviewFace(face = {}) {
	const next = {
		...face,
		state: 'ready',
		ready: true,
		building: false,
		queued: false,
		stale: false,
		failed: false,
		unavailable: false,
	};
	delete next.queue;
	delete next.build;
	return next;
}

function reviewStateForGenerationStatus(status, face = {}) {
	if (status === 'building') {
		return 'building';
	}
	if (status === 'queued') {
		return 'queued';
	}
	if (status === 'failed') {
		return 'failed';
	}
	if (status === 'ready' || status === 'skipped') {
		return 'ready';
	}
	return face.state || 'unavailable';
}
