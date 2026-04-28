import { Service } from '@polylith/core';
import OptionalFaceOptionsModel from './models/OptionalFaceOptionsModel.js';

export default class OptionalPartAssignmentModel extends Service {
	constructor(registry) {
		super('optional-part-assignment-model', registry);
		this.implement([
			'assignmentFaces',
			'initialBulkOptions',
			'initialManualAssignments',
			'summary',
		]);
	}

	assignmentFaces(optionalPartAssignment) {
		return OptionalFaceOptionsModel.assignmentFaces(optionalPartAssignment);
	}

	initialBulkOptions(optionalPartAssignment) {
		const faces = this.assignmentFaces(optionalPartAssignment);
		const bulkPresets = optionalPartAssignment?.bulkPresets || [];

		return OptionalFaceOptionsModel.initialBulkOptions(faces, bulkPresets, optionalPartAssignment?.bulkOptions);
	}

	initialManualAssignments(optionalPartAssignment) {
		return OptionalFaceOptionsModel.initialManualAssignments(optionalPartAssignment?.manualAssignments);
	}

	summary(optionalPartAssignment) {
		const faces = this.assignmentFaces(optionalPartAssignment);

		return faces.length
			? OptionalFaceOptionsModel.summarizeFaces(faces)
			: optionalPartAssignment?.summary || null;
	}
}

new OptionalPartAssignmentModel();
