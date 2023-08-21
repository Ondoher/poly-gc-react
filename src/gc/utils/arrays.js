export function makeSequentialArray(start, count) {
	return Array.from({length: count}, function(val, index) {
		return index + start
	});
}

export function make2DArray(rows, cols, value)
{
	var result = [];

	for (var row = 0; row < rows; row++)
	{
		result.push(Array.from({length: cols}, function() {
			return value;
		}));
	}

	return result;
}

export function makeArray(len, value)
{
	return Array.from({length: len}, function() {
		return value;
	});
}
