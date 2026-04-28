interface AssetPipelineProgressModelService {
	namespace(): string;
	emptyGenerationProgress(): object;
	phaseForGenerationEvent(eventName: string): string;
	mergeGenerationProgress(progress: object, phase: string, event?: object): object;
	summarizeReviewFaces(faces: object[]): object;
	applyGenerationEventToReviewFace(face: object, event?: object): object;
	markReviewFaceReady(face: object): object;
}
