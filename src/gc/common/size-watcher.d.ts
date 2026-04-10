export interface SizeWatcher {
	/**
	 * Call this method to immediately measure the viewport and fire the
	 * current size to listeners.
	 */
	check(): void;

	/**
	 * Call this method to get the current viewport size.
	 */
	getSize(): {
		width: number;
		height: number;
	};

	ready(): void;
}
