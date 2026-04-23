import SizeWatcher from "../size-watcher.js";

describe("SizeWatcher", function() {
	it("should derive semantic viewport modes from size", function() {
		var service = new SizeWatcher();

		expect(service.calculateMode({width: 500, height: 800})).toEqual({
			orientation: "portrait",
			isPortrait: true,
			isLandscape: false,
			isNarrowPortrait: true,
			sizeClass: "compact",
		});

		expect(service.calculateMode({width: 1200, height: 800})).toEqual({
			orientation: "landscape",
			isPortrait: false,
			isLandscape: true,
			isNarrowPortrait: false,
			sizeClass: "wide",
		});

		expect(service.calculateMode({width: 844, height: 844})).toEqual({
			orientation: "landscape",
			isPortrait: false,
			isLandscape: true,
			isNarrowPortrait: false,
			sizeClass: "regular",
		});

		expect(service.calculateMode({width: 839, height: 840})).toEqual({
			orientation: "landscape",
			isPortrait: false,
			isLandscape: true,
			isNarrowPortrait: false,
			sizeClass: "regular",
		});

		expect(service.calculateMode({width: 800, height: 850})).toEqual({
			orientation: "portrait",
			isPortrait: true,
			isLandscape: false,
			isNarrowPortrait: true,
			sizeClass: "regular",
		});
	});

	it("should fire mode-changed only when the semantic mode changes", function() {
		var service = new SizeWatcher();
		var sizes = [
			{width: 500, height: 800},
			{width: 520, height: 820},
			{width: 1200, height: 800},
		];
		var firedEvents = [];

		service.updateSize = function() {
			this.size = sizes.shift();
		};
		service.fire = function(eventName, payload) {
			firedEvents.push({
				eventName,
				payload,
			});
		};

		service.check();
		service.check();
		service.check();

		expect(firedEvents.map(function(event) {
			return event.eventName;
		})).toEqual([
			"changed",
			"mode-changed",
			"changed",
			"changed",
			"mode-changed",
		]);
		expect(firedEvents[1].payload.orientation).toBe("portrait");
		expect(firedEvents[4].payload.orientation).toBe("landscape");
	});

	it("should return defensive copies of the current mode", function() {
		var service = new SizeWatcher();
		var mode = service.getMode();

		mode.orientation = "portrait";

		expect(service.getMode().orientation).toBe("landscape");
	});

	it("should query the current semantic mode", function() {
		var service = new SizeWatcher();

		service.mode = service.calculateMode({width: 500, height: 800});

		expect(service.matchesMode("isNarrowPortrait")).toBe(true);
		expect(service.matchesMode("isLandscape")).toBe(false);
		expect(service.matchesMode("orientation")).toBe(false);
		expect(service.matchesMode({
			orientation: "portrait",
			sizeClass: "compact",
		})).toBe(true);
		expect(service.matchesMode({
			orientation: "portrait",
			sizeClass: "wide",
		})).toBe(false);
		expect(service.matchesMode(null)).toBe(false);
	});
});
