/** Props for the Flat root app component. */
type FlatAppProps = {
	/**
	 * Provide the Polylith service registry.
	 */
	registry: {
		/**
		 * Locate a registered service by name.
		 */
		subscribe(serviceName: string): unknown;
	};

	/**
	 * Carry child React nodes.
	 */
	children?: React.ReactNode;
};
