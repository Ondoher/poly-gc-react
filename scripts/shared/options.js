const booleanValues = {
	true: true,
	false: false,
	on: true,
	off: false,
	set: true,
	clear: false,
};

export function checkBoolean(value) {
	if (value === true) return true;
	if (value === false) return false;

	return booleanValues[value] !== undefined ? booleanValues[value] : value;
}

/**
 * Gets the value of an option from CLI args, converting known boolean values.
 *
 * @param {Object} argv parsed CLI arguments
 * @param {String} name the full option name
 * @param {String} short the short option name
 * @returns {*} the option value
 */
export function getOption(argv, name, short) {
	if (argv[name] !== undefined) return checkBoolean(argv[name]);
	if (argv[short] !== undefined) return checkBoolean(argv[short]);
	return undefined;
}

export function getOptions(defaults, argv, definition) {
	const longNames = Object.keys(definition);
	const options = longNames.reduce(function reduceOptions(result, long) {
		const short = definition[long];
		const option = getOption(argv, long, short);
		result[long] = option;

		return result;
	}, {});

	Object.keys(defaults).forEach(function applyDefault(key) {
		options[key] = options[key] === undefined ? defaults[key] : options[key];
	});

	return options;
}
