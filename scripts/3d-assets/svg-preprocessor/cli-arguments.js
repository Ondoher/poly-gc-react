export function readArgument(name) {
	const index = process.argv.indexOf(name);

	return index >= 0 ? process.argv[index + 1] : null;
}

export function requireArgument(name) {
	const value = readArgument(name);

	if (!value) {
		throw new Error(`Missing required argument: ${name}`);
	}

	return value;
}
