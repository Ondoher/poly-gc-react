import OptionalComponentAssignments from './OptionalComponentAssignments.js';

export default class OptionalFaceOptionsModel {
	constructor(face, familyOptions = {}, faceOptions = {}) {
		this.face = face || {};
		this.familyOptions = familyOptions || {};
		this.faceOverrides = faceOptions || {};
	}

	faceOptions() {
		return {
			label: this.glyphOptions('label', 'label'),
			character: this.glyphOptions('character', 'glyph'),
		};
	}

	partOptions() {
		const baseOptions = this.faceOptions();

		return {
			label: {
				...baseOptions.label,
				...OptionalFaceOptionsModel.usableOptionOverride(this.familyOptions.label),
				...OptionalFaceOptionsModel.usableOptionOverride(this.faceOverrides.label),
			},
			character: {
				...baseOptions.character,
				...OptionalFaceOptionsModel.usableOptionOverride(this.familyOptions.character),
				...OptionalFaceOptionsModel.usableOptionOverride(this.faceOverrides.character),
			},
		};
	}

	optionKeys() {
		return Object.values(this.face.optionalParts || {})
			.map((part) => ({
				partKey: part.partId === 'glyph' ? 'character' : 'label',
				label: part.partId === 'glyph' ? 'Character Glyph' : OptionalComponentAssignments.partLabel(part.partId),
			}));
	}

	visibleParts() {
		return Object.values(this.face.optionalParts || {});
	}

	glyphOptions(metadataKey, partId) {
		const seedOption = this.face.metadataSeed?.glyphLayout?.[metadataKey] || null;
		const part = this.face.optionalParts?.[partId] || null;
		const sourcePresent = OptionalFaceOptionsModel.firstBoolean(
			seedOption?.sourcePresent,
			part?.sourceState === 'candidate-found' ? true : null,
			false,
		);

		return {
			searchSource: sourcePresent,
			region: part?.hint?.region
				|| seedOption?.sourceRegion
				|| OptionalFaceOptionsModel.sourceCornerToRegion(seedOption?.sourceCorner)
				|| 'center',
		};
	}

	static forFace(face, bulkOptions = {}) {
		return new OptionalFaceOptionsModel(
			face,
			bulkOptions?.families?.[OptionalFaceOptionsModel.faceFamily(face?.faceKey)] || {},
			bulkOptions?.faces?.[face?.faceKey] || {},
		);
	}

	static assignmentFaces(optionalPartAssignment) {
		return Object.values(optionalPartAssignment?.faces || {})
			.sort((left, right) => left.faceKey.localeCompare(right.faceKey));
	}

	static summarizeFaces(faces) {
		const parts = faces.flatMap((face) => Object.values(face.optionalParts || {}));

		return {
			faceCount: faces.length,
			optionalPartCount: parts.length,
			candidateCount: parts.filter((part) => part.sourceState === 'candidate-found').length,
			needsReviewCount: faces.filter((face) => face.status === 'needs-review').length,
		};
	}

	static visibleBulkPresetParts(preset) {
		return Object.values(preset.parts || {});
	}

	static bulkOptions(faces) {
		const family = faces.length > 0 ? OptionalFaceOptionsModel.faceFamily(faces[0].faceKey) : '';

		return {
			label: OptionalFaceOptionsModel.defaultedCommonOptions(faces.map((face) => new OptionalFaceOptionsModel(face).faceOptions().label)),
			character: OptionalFaceOptionsModel.defaultedCommonOptions(faces.map((face) => new OptionalFaceOptionsModel(face).faceOptions().character)),
			layout: OptionalFaceOptionsModel.defaultPairLayoutForFamily(family),
		};
	}

	static initialBulkOptions(faces, presets, savedOptions = null) {
		const families = OptionalFaceOptionsModel.defaultedOptionGroups(savedOptions?.families || {});

		for (const preset of presets || []) {
			if (families[preset.family]) {
				continue;
			}

			const familyFaces = faces.filter((face) => OptionalFaceOptionsModel.faceFamily(face.faceKey) === preset.family);
			families[preset.family] = OptionalFaceOptionsModel.bulkOptions(familyFaces);
		}

		return {
			...(savedOptions || {}),
			families,
			faces: OptionalFaceOptionsModel.defaultedOptionGroups(savedOptions?.faces || {}),
		};
	}

	static initialManualAssignments(savedAssignments = null) {
		return savedAssignments?.faces || {};
	}

	static defaultedCommonOptions(options) {
		const common = OptionalFaceOptionsModel.commonOptions(options);
		delete common.region;
		delete common.regionMixed;

		return {
			...common,
			regionDefault: true,
		};
	}

	static commonOptions(options) {
		return {
			...OptionalFaceOptionsModel.commonOptionBoolean(options, 'searchSource'),
			...OptionalFaceOptionsModel.commonOptionString(options, 'region', 'center'),
		};
	}

	static defaultedOptionGroups(groups) {
		return Object.fromEntries(Object.entries(groups || {}).map(([groupKey, options]) => [
			groupKey,
			OptionalFaceOptionsModel.defaultedOptionGroup(options),
		]));
	}

	static defaultedOptionGroup(options) {
		return Object.fromEntries(Object.entries(options || {}).map(([key, option]) => {
			if (key === 'layout' || !option || typeof option !== 'object' || Array.isArray(option)) {
				return [key, option];
			}

			if (option.region || option.regionMixed || option.regionDefault) {
				return [key, option];
			}

			return [key, {
				...option,
				regionDefault: true,
			}];
		}));
	}

	static commonOptionBoolean(options, fieldName) {
		const values = [...new Set(options.map((option) => Boolean(option?.[fieldName])))];

		if (values.length === 1) {
			return {
				[fieldName]: values[0],
				[`${fieldName}Mixed`]: false,
			};
		}

		return {
			[fieldName]: false,
			[`${fieldName}Mixed`]: true,
		};
	}

	static commonOptionString(options, fieldName, defaultValue) {
		const values = [...new Set(options.map((option) => option?.[fieldName] || defaultValue))];

		if (values.length === 1) {
			return {
				[fieldName]: values[0],
				[`${fieldName}Mixed`]: false,
			};
		}

		return {
			[fieldName]: defaultValue,
			[`${fieldName}Mixed`]: true,
		};
	}

	static usableOptionOverride(option) {
		if (!option) {
			return {};
		}

		return {
			...(option.searchSourceMixed || !Object.hasOwn(option, 'searchSource') ? {} : { searchSource: Boolean(option.searchSource) }),
			...(option.regionDefault ? { regionDefault: true } : {}),
			...(option.regionMixed ? {} : option.region ? { region: option.region } : {}),
		};
	}

	static sourceCornerToRegion(sourceCorner) {
		return {
			topLeft: 'top-left',
			topRight: 'top-right',
			bottomLeft: 'bottom-left',
			bottomRight: 'bottom-right',
		}[sourceCorner] || null;
	}

	static firstBoolean(...values) {
		const value = values.find((candidate) => candidate != null);

		return Boolean(value);
	}

	static faceFamily(faceKey) {
		const match = /^([a-z]+)-/.exec(faceKey || '');
		return match ? match[1] : 'other';
	}

	static defaultPairLayoutForFamily(family) {
		return family === 'season'
			? 'label-left-character-right'
			: 'label-right-character-left';
	}
}
