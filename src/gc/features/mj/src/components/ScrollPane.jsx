import React from "react";

export default class ScrollPane extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			thumbSize: 0,
			thumbOffset: 0,
			showThumb: false,
			isDraggingThumb: false,
		};

		this.scrollRef = React.createRef();
		this.trackRef = React.createRef();
		this.dragStartPoint = 0;
		this.dragStartThumbOffset = 0;
		this.updateScrollbar = this.updateScrollbar.bind(this);
		this.onScroll = this.onScroll.bind(this);
		this.onWheel = this.onWheel.bind(this);
		this.onThumbPointerDown = this.onThumbPointerDown.bind(this);
		this.onThumbPointerMove = this.onThumbPointerMove.bind(this);
		this.onThumbPointerUp = this.onThumbPointerUp.bind(this);
	}

	componentDidMount() {
		window.addEventListener("resize", this.updateScrollbar);
		this.updateScrollbar();
	}

	componentDidUpdate() {
		this.updateScrollbar();
	}

	componentWillUnmount() {
		window.removeEventListener("resize", this.updateScrollbar);
		this.teardownDragListeners();
	}

	getOrientation() {
		return this.props.orientation === "horizontal" ? "horizontal" : "vertical";
	}

	getAxis() {
		if (this.getOrientation() === "horizontal") {
			return {
				clientSize: "clientWidth",
				scrollSize: "scrollWidth",
				scrollOffset: "scrollLeft",
				clientPoint: "clientX",
				trackSize: "clientWidth",
				sizeStyle: "width",
				transform: "translateX",
			};
		}

		return {
			clientSize: "clientHeight",
			scrollSize: "scrollHeight",
			scrollOffset: "scrollTop",
			clientPoint: "clientY",
			trackSize: "clientHeight",
			sizeStyle: "height",
			transform: "translateY",
		};
	}

	updateScrollbar() {
		window.requestAnimationFrame(function() {
			var scrollEl = this.scrollRef.current;
			var trackEl = this.trackRef.current;
			var axis = this.getAxis();
			var minThumbSize = this.props.minThumbSize || 24;

			if (!scrollEl || !trackEl) {
				return;
			}

			var clientSize = scrollEl[axis.clientSize];
			var scrollSize = scrollEl[axis.scrollSize];
			var scrollOffset = scrollEl[axis.scrollOffset];
			var trackSize = trackEl[axis.trackSize];

			if (scrollSize <= clientSize || clientSize <= 0 || trackSize <= 0) {
				if (
					this.state.thumbSize !== 0 ||
					this.state.thumbOffset !== 0 ||
					this.state.showThumb !== false
				) {
					this.setState({
						thumbSize: 0,
						thumbOffset: 0,
						showThumb: false,
					});
				}
				return;
			}

			var ratio = clientSize / scrollSize;
			var thumbSize = Math.max(minThumbSize, Math.round(trackSize * ratio));
			thumbSize = Math.min(trackSize, thumbSize);
			var trackTravel = trackSize - thumbSize;
			var maxScroll = scrollSize - clientSize;
			var thumbOffset = maxScroll > 0
				? Math.round((scrollOffset / maxScroll) * trackTravel)
				: 0;

			if (
				this.state.thumbSize !== thumbSize ||
				this.state.thumbOffset !== thumbOffset ||
				this.state.showThumb !== true
			) {
				this.setState({
					thumbSize,
					thumbOffset,
					showThumb: true,
				});
			}
		}.bind(this));
	}

	onScroll(evt) {
		this.updateScrollbar();

		if (this.props.onScroll) {
			this.props.onScroll(evt);
		}
	}

	onWheel(evt) {
		var scrollEl = this.scrollRef.current;
		var axis = this.getAxis();

		if (this.getOrientation() !== "horizontal" || !scrollEl) {
			return;
		}

		var maxScroll = scrollEl[axis.scrollSize] - scrollEl[axis.clientSize];
		var delta = evt.deltaX + evt.deltaY;

		if (maxScroll <= 0 || delta === 0) {
			return;
		}

		var nextScrollOffset = Math.max(
			0,
			Math.min(maxScroll, scrollEl[axis.scrollOffset] + delta)
		);

		if (nextScrollOffset !== scrollEl[axis.scrollOffset]) {
			scrollEl[axis.scrollOffset] = nextScrollOffset;
			this.updateScrollbar();
			evt.preventDefault();
		}
	}

	teardownDragListeners() {
		window.removeEventListener("pointermove", this.onThumbPointerMove);
		window.removeEventListener("pointerup", this.onThumbPointerUp);
		window.removeEventListener("pointercancel", this.onThumbPointerUp);
	}

	onThumbPointerDown(evt) {
		if (!this.state.showThumb) {
			return;
		}

		var axis = this.getAxis();

		this.dragStartPoint = evt[axis.clientPoint];
		this.dragStartThumbOffset = this.state.thumbOffset;
		window.addEventListener("pointermove", this.onThumbPointerMove);
		window.addEventListener("pointerup", this.onThumbPointerUp);
		window.addEventListener("pointercancel", this.onThumbPointerUp);

		this.setState({
			isDraggingThumb: true,
		});

		evt.preventDefault();
	}

	onThumbPointerMove(evt) {
		var scrollEl = this.scrollRef.current;
		var trackEl = this.trackRef.current;
		var axis = this.getAxis();

		if (!scrollEl || !trackEl) {
			return;
		}

		var trackSize = trackEl[axis.trackSize];
		var thumbSize = this.state.thumbSize;
		var maxThumbOffset = Math.max(0, trackSize - thumbSize);
		var delta = evt[axis.clientPoint] - this.dragStartPoint;
		var nextThumbOffset = Math.max(
			0,
			Math.min(maxThumbOffset, this.dragStartThumbOffset + delta)
		);
		var maxScroll = scrollEl[axis.scrollSize] - scrollEl[axis.clientSize];
		var nextScrollOffset = maxThumbOffset > 0
			? (nextThumbOffset / maxThumbOffset) * maxScroll
			: 0;

		scrollEl[axis.scrollOffset] = nextScrollOffset;
		this.updateScrollbar();
		evt.preventDefault();
	}

	onThumbPointerUp() {
		this.teardownDragListeners();
		this.setState({
			isDraggingThumb: false,
		});
	}

	render() {
		var orientation = this.getOrientation();
		var axis = this.getAxis();
		var className = `mj-scroll-pane is-${orientation}`;
		var viewportClassName = "mj-scroll-pane-viewport";
		var scrollClassName = "mj-scroll-pane-scroll";
		var railClassName = "mj-scroll-pane-rail";
		var trackClassName = "mj-scroll-pane-track";
		var thumbClassName = "mj-scroll-pane-thumb";

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		if (this.props.viewportClassName) {
			viewportClassName += ` ${this.props.viewportClassName}`;
		}

		if (this.props.scrollClassName) {
			scrollClassName += ` ${this.props.scrollClassName}`;
		}

		if (this.props.railClassName) {
			railClassName += ` ${this.props.railClassName}`;
		}

		if (this.props.trackClassName) {
			trackClassName += ` ${this.props.trackClassName}`;
		}

		if (this.props.thumbClassName) {
			thumbClassName += ` ${this.props.thumbClassName}`;
		}

		if (this.state.showThumb) {
			thumbClassName += " is-visible";
		}

		if (this.state.isDraggingThumb) {
			className += " is-dragging-thumb";
			thumbClassName += " is-dragging";
		}

		var thumbStyle = {
			[axis.sizeStyle]: `${this.state.thumbSize}px`,
			transform: `${axis.transform}(${this.state.thumbOffset}px)`,
		};

		return (
			<div className={className}>
				<div className={viewportClassName}>
					<div
						ref={this.scrollRef}
						className={scrollClassName}
						onScroll={this.onScroll}
						onWheel={this.onWheel}
					>
						{this.props.children}
					</div>
				</div>
				<div className={railClassName} aria-hidden="true">
					<div
						className={trackClassName}
						ref={this.trackRef}
					>
						<div
							className={thumbClassName}
							style={thumbStyle}
							onPointerDown={this.onThumbPointerDown}
						></div>
					</div>
				</div>
			</div>
		);
	}
}
