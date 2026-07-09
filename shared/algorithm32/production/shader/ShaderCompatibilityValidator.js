/**
 * Validate shader contributions against the descriptor and symbol inventory.
 */
export class ShaderCompatibilityValidator {
	/**
	 * Validate one shader assembly request.
	 *
	 * @param {ShaderAssemblyRequest} request - Supplies the candidate shader assembly.
	 * @returns {ShaderSymbolValidationReport} Return the validation report.
	 */
	validate(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Shader assembly request is required.');
		}

		const contributions = request.contributions ?? [];
		const systemProvidedSymbols = new Set(request.systemProvidedSymbols ?? []);
		const providedBySymbol = new Map();
		const requiredSymbols = new Set(request.mainRequiredSymbols ?? []);
		const errors = [];
		const warnings = [];
		const allowedFingerprints = descriptorFingerprints(request.descriptor);

		for (const contribution of contributions) {
			if (!allowedFingerprints.has(contribution.descriptorFingerprint)) {
				errors.push(
					`Contribution ${contribution.id} is not compatible with descriptor fingerprint `
					+ contribution.descriptorFingerprint,
				);
			}

			for (const symbol of contribution.provides ?? []) {
				if (!providedBySymbol.has(symbol)) {
					providedBySymbol.set(symbol, []);
				}

				providedBySymbol.get(symbol).push(contribution.id);
			}

			for (const symbol of contribution.requires ?? []) {
				requiredSymbols.add(symbol);
			}
		}

		const duplicateProvidedSymbols = [...providedBySymbol.entries()]
			.filter(([, providers]) => providers.length > 1)
			.map(([symbol]) => symbol)
			.sort();

		duplicateProvidedSymbols.forEach((symbol) => {
			errors.push(`Symbol ${symbol} is provided by multiple contributions: ${providedBySymbol.get(symbol).join(', ')}`);
		});

		const providedSymbols = [...providedBySymbol.keys()].sort();
		const requiredSymbolList = [...requiredSymbols].sort();
		const missingRequiredSymbols = requiredSymbolList
			.filter((symbol) => !providedBySymbol.has(symbol) && !systemProvidedSymbols.has(symbol));

		missingRequiredSymbols.forEach((symbol) => {
			errors.push(`Required shader symbol is missing: ${symbol}`);
		});

		const unusedProvidedSymbols = providedSymbols
			.filter((symbol) => !requiredSymbols.has(symbol))
			.sort();

		unusedProvidedSymbols.forEach((symbol) => {
			warnings.push(`Provided shader symbol is not required by this assembly: ${symbol}`);
		});

		return Object.freeze({
			status: errors.length === 0 ? 'accepted' : 'rejected',
			providedSymbols: Object.freeze(providedSymbols),
			requiredSymbols: Object.freeze(requiredSymbolList),
			duplicateProvidedSymbols: Object.freeze(duplicateProvidedSymbols),
			missingRequiredSymbols: Object.freeze(missingRequiredSymbols),
			unusedProvidedSymbols: Object.freeze(unusedProvidedSymbols),
			warnings: Object.freeze(warnings),
			errors: Object.freeze(errors),
		});
	}
}

/**
 * Collect descriptor and section fingerprints accepted by one assembly.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the descriptor.
 * @returns {Set<string>} Return accepted fingerprints.
 */
function descriptorFingerprints(descriptor) {
	if (!descriptor || typeof descriptor !== 'object') {
		throw new TypeError('Shader descriptor is required.');
	}

	const fingerprints = new Set();

	for (const section of [
		descriptor,
		descriptor.spectralBasis,
		descriptor.geometry,
		descriptor.atmosphere,
		descriptor.lightSource,
		descriptor.cache,
		descriptor.transport,
		descriptor.color,
		descriptor.runtime,
	]) {
		if (section?.fingerprint) {
			fingerprints.add(section.fingerprint);
		}
	}

	return fingerprints;
}

export default ShaderCompatibilityValidator;
