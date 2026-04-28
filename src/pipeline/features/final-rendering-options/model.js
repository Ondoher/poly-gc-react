import { Service } from '@polylith/core';
import RenderingOptionsModel from './models/RenderingOptionsModel.js';

export default class FinalRenderingOptionsModel extends Service {
	constructor(registry) {
		super('final-rendering-options-model', registry);
		this.implement([
			'faces',
			'initialOptions',
			'summary',
		]);
	}

	faces(finalRenderingOptions) {
		return RenderingOptionsModel.faces(finalRenderingOptions);
	}

	initialOptions(finalRenderingOptions) {
		return RenderingOptionsModel.initialOptions(finalRenderingOptions);
	}

	summary(finalRenderingOptions) {
		return finalRenderingOptions?.summary || null;
	}
}

new FinalRenderingOptionsModel();
