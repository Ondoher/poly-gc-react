import React from "react";
import { act } from "react-dom/test-utils";

import { createTestHarness } from "testing/TestHarness.js";
import Selector from "../Selector.jsx";

function makeMode(isPortrait) {
	return {
		orientation: isPortrait ? "portrait" : "landscape",
		isPortrait,
		isLandscape: !isPortrait,
		isNarrowPortrait: isPortrait,
		sizeClass: "compact",
	};
}

function makeSizeWatcher(initialMode) {
	var mode = initialMode;
	var handler = null;

	return {
		getMode() {
			return mode;
		},

		listen(eventName, callback) {
			if (eventName === "mode-changed") {
				handler = callback;
			}

			return callback;
		},

		unlisten() {
			handler = null;
		},

		emitModeChanged(nextMode) {
			mode = nextMode;

			if (handler) {
				handler(nextMode);
			}
		},
	};
}

describe("Selector", function() {
	it("should use vertical orientation by default", function() {
		var harness = createTestHarness();
		var result = harness.render(Selector, {
			options: [{value: "one", label: "One"}],
			selectedValue: "one",
		});

		expect(
			result.container.querySelector(".mj-settings-dialog-selector").classList.contains("is-vertical")
		).toBe(true);
		expect(
			result.container.querySelector(".mj-scroll-pane").classList.contains("is-vertical")
		).toBe(true);

		result.unmount();
	});

	it("should resolve orientation from size-watcher mode", function() {
		var sizeWatcher = makeSizeWatcher(makeMode(true));
		var harness = createTestHarness().withService("size-watcher", sizeWatcher);
		var result = harness.render(Selector, {
			options: [{value: "one", label: "One"}],
			portraitOrientation: "horizontal",
			landscapeOrientation: "vertical",
			selectedValue: "one",
		});

		expect(
			result.container.querySelector(".mj-settings-dialog-selector").classList.contains("is-horizontal")
		).toBe(true);
		expect(
			result.container.querySelector(".mj-scroll-pane").classList.contains("is-horizontal")
		).toBe(true);

		act(() => {
			sizeWatcher.emitModeChanged(makeMode(false));
		});

		expect(
			result.container.querySelector(".mj-settings-dialog-selector").classList.contains("is-vertical")
		).toBe(true);
		expect(
			result.container.querySelector(".mj-scroll-pane").classList.contains("is-vertical")
		).toBe(true);

		result.unmount();
	});
});
