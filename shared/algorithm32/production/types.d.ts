/**
 * Identify how a production Algorithm32 reference source is allowed to support
 * code or tests.
 *
 * - **implementation** - The source supports production implementation logic.
 * - **test** - The source supports deterministic test expectations.
 * - **fixture** - The source supports checked-in or generated fixture data.
 * - **validation** - The source supports parity, comparison, or review
 *   validation.
 */
type Algorithm32ProductionReferenceUsage =
	| "implementation"
	| "test"
	| "fixture"
	| "validation";

/**
 * Point to the exact part of a production reference that supports one
 * implementation decision, fixture row, expected value, or validation claim.
 */
type Algorithm32ProductionReferencePointer = {
	/**
	 * Store the AMA-style numbered reference entry from references.md.
	 */
	referenceNumber: number;

	/**
	 * Store the stable local source id when the pointer also maps to the source
	 * registry.
	 */
	sourceId?: string;

	/**
	 * Store the section or chapter locator inside the referenced source.
	 */
	section?: string;

	/**
	 * Store the equation locator inside the referenced source.
	 */
	equation?: string;

	/**
	 * Store the figure locator inside the referenced source.
	 */
	figure?: string;

	/**
	 * Store the table locator inside the referenced source.
	 */
	table?: string;

	/**
	 * Store the row, record, wavelength, or dataset-entry locator inside the
	 * referenced source.
	 */
	row?: string;

	/**
	 * Store the page, line, or local artifact locator when that is the clearest
	 * way to find the cited fact.
	 */
	locator?: string;

	/**
	 * Store a local curated artifact path when the exact referenced data lives
	 * in a checked-in artifact.
	 */
	localArtifactPath?: string;

	/**
	 * Explain how this precise locator supports the cited decision or expected
	 * value.
	 */
	note?: string;
};

/**
 * Describe review state for a production fixture ledger.
 *
 * - **draft** - The ledger has a normalized production shape but rows may
 *   still change before implementation consumes them.
 * - **accepted** - The ledger rows are approved for production implementation
 *   and tests.
 */
type ProductionFixtureLedgerStatus =
	| "draft"
	| "accepted";

/**
 * Describe a checked-in production fixture ledger.
 */
type ProductionFixtureLedger = {
	/**
	 * Identify the JSON fixture family.
	 */
	kind: "algorithm32-production-fixture-ledger";

	/**
	 * Identify this ledger instance.
	 */
	id: string;

	/**
	 * Describe the review state of the ledger.
	 */
	status: ProductionFixtureLedgerStatus;

	/**
	 * Preserve the source fixture or artifact path used to promote these rows.
	 */
	sourcePath?: string;

	/**
	 * Describe the fixture family and promotion scope.
	 */
	description: string;

	/**
	 * Store the source-backed expectation rows.
	 */
	rows: readonly ProductionFixtureRow[];
};


/**
 * Describe one source-backed fixture expectation row.
 */
type ProductionFixtureRow = {
	/**
	 * Identify the row with a stable dotted id.
	 */
	id: string;

	/**
	 * Group the row by the transport or support area it exercises.
	 */
	area: string;

	/**
	 * Name the physical or algorithm quantity under test.
	 */
	quantity: string;

	/**
	 * Summarize the source-backed fact using bracket citations.
	 */
	citation: string;

	/**
	 * Point to precise locations in the numbered production reference list.
	 */
	references: readonly Algorithm32ProductionReferencePointer[];

	/**
	 * Store human-reviewable assumptions for the row.
	 */
	assumptions: unknown;

	/**
	 * Store the input packet or calculation factors for the row.
	 */
	input: unknown;

	/**
	 * Store the expected values for successful rows.
	 */
	expected?: Record<string, ProductionFixtureExpectedValue>;

	/**
	 * Store the expected error for loud-failure rows.
	 */
	expectedError?: ProductionFixtureError;

	/**
	 * Store the tolerance rule by expected-value name.
	 */
	tolerance?: Record<string, ProductionFixtureTolerance>;

	/**
	 * Explain why the expected value is independent of the production
	 * implementation.
	 */
	independence: string;
};

/**
 * Describe one expected fixture value.
 */
type ProductionFixtureExpectedValue = {
	/**
	 * Store the expected scalar, array, object, or literal value.
	 */
	value: unknown;

	/**
	 * Store the physical or fixture unit label for the expected value.
	 */
	units: string;

	/**
	 * Explain the hand calculation, source row, or external-tool result behind
	 * the expected value.
	 */
	derivation: string;
};

/**
 * Describe one expected fixture error.
 */
type ProductionFixtureError = {
	/**
	 * Store the expected JavaScript error class or Algorithm32 error code.
	 */
	type: string;

	/**
	 * Store required message fragments or structured error details.
	 */
	messageIncludes?: readonly string[];

	/**
	 * Explain why the source-backed row should fail loudly.
	 */
	derivation: string;
};

/**
 * Describe how a production fixture expected value should be compared.
 */
type ProductionFixtureTolerance = {
	/**
	 * Store the tolerance comparison mode.
	 *
	 * - **exact** - The expected value must match exactly.
	 * - **absolute** - The expected value may differ by an absolute numeric
	 *   threshold.
	 * - **relative** - The expected value may differ by a relative numeric
	 *   threshold.
	 */
	mode: "exact" | "absolute" | "relative";

	/**
	 * Store the numeric tolerance threshold for approximate comparisons.
	 */
	value?: number;
};

/**
 * Describe one external algorithm, paper, dataset, fixture source, or
 * source-backed data artifact used by production Algorithm32.
 */
type Algorithm32ProductionExternalReferenceSource = {
	/**
	 * Identify the source with a stable local id.
	 */
	id: string;

	/**
	 * List the production surfaces allowed to cite this source.
	 */
	usage: readonly Algorithm32ProductionReferenceUsage[];

	/**
	 * Provide the human-readable source title.
	 */
	title: string;

	/**
	 * Store the formal citation or dataset attribution.
	 */
	citation: string;

	/**
	 * Store the DOI when the source has one.
	 */
	doi?: string;

	/**
	 * Store a public source URL when one is available.
	 */
	url?: string;

	/**
	 * Store the local curated artifact path when the source is vendored.
	 */
	localArtifactPath?: string;

	/**
	 * Record the source access date as an ISO calendar date.
	 */
	accessedOn?: string;

	/**
	 * Explain the exact algorithm, quantity, fixture, or decision supported by
	 * this source.
	 */
	supports: string;

	/**
	 * Name the production modules, tests, or fixture files allowed to depend on
	 * this source.
	 */
	consumers: readonly string[];

	/**
	 * Preserve focused notes about derivation, units, scope, or limitations.
	 */
	notes?: string;
}

/**
 * Describe the production Algorithm32 source registry fixture.
 */
type Algorithm32ProductionReferenceRegistry = {
	/**
	 * Identify the JSON fixture family.
	 */
	kind: "algorithm32-production-source-registry";

	/**
	 * Identify this registry instance.
	 */
	id: string;

	/**
	 * Describe whether this registry is a scaffold, draft, or accepted contract.
	 *
	 * - **scaffold** - The registry exists as a starting contract with no
	 *   accepted source entries yet.
	 * - **draft** - The registry contains provisional entries still under
	 *   review.
	 * - **accepted** - The registry contains accepted entries used by
	 *   implementation, tests, fixtures, or validation.
	 */
	status: "scaffold" | "draft" | "accepted";

	/**
	 * Explain the registry's current scope.
	 */
	notes: string;

	/**
	 * Store the external source entries currently available to cite.
	 */
	sources: readonly Algorithm32ProductionExternalReferenceSource[];
}
