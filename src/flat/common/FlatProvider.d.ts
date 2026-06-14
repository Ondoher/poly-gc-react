/** Props for FlatProvider. */
type FlatProviderProps = {
	/**
	 * Provide the context value to publish.
	 */
	contextValue: Partial<FlatContextValue>;

	/**
	 * Carry child React nodes.
	 */
	children?: React.ReactNode;
};
