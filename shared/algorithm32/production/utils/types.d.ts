/**
 * Supplies call-local tolerance behavior.
 */
type ToleranceOptions = {
	/**
	 * Store the accepted absolute tolerance.
	 */
	readonly epsilon?: number;
};

/**
 * Supplies call-local range behavior.
 */
type RangeOptions = {
	/**
	 * Store whether range endpoints are included.
	 */
	readonly inclusive?: boolean;
};

/**
 * Supplies call-local number formatting behavior.
 */
type NumberFormatOptions = {
	/**
	 * Store the number of fixed decimal places to emit before trimming.
	 */
	readonly precision?: number;

	/**
	 * Store whether trailing fractional zeroes should be removed.
	 */
	readonly trim?: boolean;
};

/**
 * Supplies call-local angle wrapping bounds.
 */
type AngleWrapOptions = {
	/**
	 * Store the inclusive lower wrap bound.
	 */
	readonly min?: number;

	/**
	 * Store the exclusive upper wrap bound.
	 */
	readonly max?: number;
};

/**
 * Maps one numeric array value to another numeric value.
 */
type NumericArrayMapper = (
	/**
	 * Store the current numeric value.
	 */
	value: number,

	/**
	 * Store the current numeric index.
	 */
	index: number,

	/**
	 * Store the source numeric array.
	 */
	values: readonly number[],
) => number;

/**
 * Supplies call-local nearest-sample lookup behavior.
 */
type NearestSampleIndexOptions = {
	/**
	 * Store whether out-of-range targets clamp to the nearest endpoint.
	 */
	readonly clamp?: boolean;
};

/**
 * Supplies call-local sample padding behavior.
 */
type SamplePaddingOptions = {
	/**
	 * Store the number of samples to add before the source samples.
	 */
	readonly before?: number;

	/**
	 * Store the number of samples to add after the source samples.
	 */
	readonly after?: number;

	/**
	 * Store the value used for padded samples.
	 */
	readonly value?: number;
};

/**
 * Supplies call-local monotonic check behavior.
 */
type MonotonicOptions = {
	/**
	 * Select the expected monotonic direction.
	 *
	 * - **ascending** - Each sample must be greater than or equal to the
	 *   previous sample unless strict mode is enabled.
	 * - **descending** - Each sample must be less than or equal to the previous
	 *   sample unless strict mode is enabled.
	 */
	readonly direction?: "ascending" | "descending";

	/**
	 * Store whether equal adjacent samples are rejected.
	 */
	readonly strict?: boolean;
};

/**
 * Supplies call-local sample traversal behavior.
 */
type SampleWalkOptions = {
	/**
	 * Select the traversal direction.
	 *
	 * - **ascending** - Traverse from first sample to last sample.
	 * - **descending** - Traverse from last sample to first sample.
	 */
	readonly direction?: "ascending" | "descending";
};

/**
 * Describes one sample traversal entry.
 */
type SampleWalkEntry = {
	/**
	 * Store the source sample index.
	 */
	readonly index: number;

	/**
	 * Store the source sample value.
	 */
	readonly value: number;
};

/**
 * Supplies call-local sample signature behavior.
 */
type SampleSignatureOptions = {
	/**
	 * Store the number of fixed decimal places to emit before trimming.
	 */
	readonly precision?: number;

	/**
	 * Store the separator placed between formatted sample values.
	 */
	readonly separator?: string;
};
