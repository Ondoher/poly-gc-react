import React from "react";
import { act } from "react-dom/test-utils";

import { createTestHarness } from "testing/TestHarness.js";
import ScrollPane from "../ScrollPane.jsx";

function stubHorizontalScrollMetrics(scrollEl) {
	Object.defineProperty(scrollEl, "clientWidth", {
		value: 100,
		configurable: true,
	});
	Object.defineProperty(scrollEl, "scrollWidth", {
		value: 300,
		configurable: true,
	});
	Object.defineProperty(scrollEl, "scrollLeft", {
		value: 0,
		writable: true,
		configurable: true,
	});
}

describe("ScrollPane", function() {
	it("should translate mouse wheel movement into horizontal scrolling", function() {
		var harness = createTestHarness();
		var result = harness.render(ScrollPane, {
			orientation: "horizontal",
			children: <div style={{width: "300px"}}>Scrollable</div>,
		});
		var scrollEl = result.container.querySelector(".mj-scroll-pane-scroll");
		var wheelEvent = new WheelEvent("wheel", {
			deltaY: 25,
			bubbles: true,
			cancelable: true,
		});

		stubHorizontalScrollMetrics(scrollEl);

		act(() => {
			scrollEl.dispatchEvent(wheelEvent);
		});

		expect(scrollEl.scrollLeft).toBe(25);

		result.unmount();
	});

	it("should leave wheel movement alone for vertical scrolling", function() {
		var harness = createTestHarness();
		var result = harness.render(ScrollPane, {
			children: <div>Scrollable</div>,
		});
		var scrollEl = result.container.querySelector(".mj-scroll-pane-scroll");
		var wheelEvent = new WheelEvent("wheel", {
			deltaY: 25,
			bubbles: true,
			cancelable: true,
		});

		stubHorizontalScrollMetrics(scrollEl);

		act(() => {
			scrollEl.dispatchEvent(wheelEvent);
		});

		expect(scrollEl.scrollLeft).toBe(0);

		result.unmount();
	});
});
