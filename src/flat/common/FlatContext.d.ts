/** Application metadata made available through FlatContext. */
type FlatAppContext = {
	/**
	 * Identify the app.
	 */
	id?: string;
};

/** Service registry contract available through FlatContext. */
type FlatRegistryService = {
	/**
	 * Locate a registered service by name.
	 */
	subscribe: (serviceName: string) => any;
};

/** React context value shared across Flat presentation components. */
type FlatContextValue = {
	/**
	 * Describe the active Flat app.
	 */
	app: FlatAppContext;

	/**
	 * Provide the shared animation-loop service.
	 */
	animationLoop: AnimationLoopService | null;

	/**
	 * Provide the Polylith service registry.
	 */
	registry: FlatRegistryService | null;
};
