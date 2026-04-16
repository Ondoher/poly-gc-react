import React from "react";

export default class ScrollPane extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			thumbHeight: 0,
			thumbTop: 0,
			showThumb: false,
			isDraggingThumb: false,
		};

		this.scrollRef = React.createRef();
		this.trackRef = React.createRef();
		this.dragStartY = 0;
		this.dragStartThumbTop = 0;
		this.updateScrollbar = this.updateScrollbar.bind(this);
		this.onScroll = this.onScroll.bind(this);
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

	updateScrollbar() {
		window.requestAnimationFrame(function() {
			var scrollEl = this.scrollRef.current;
			var trackEl = this.trackRef.current;
			var minThumbSize = this.props.minThumbSize || 24;

			if (!scrollEl || !trackEl) {
				return;
			}

			var clientHeight = scrollEl.clientHeight;
			var scrollHeight = scrollEl.scrollHeight;
			var scrollTop = scrollEl.scrollTop;
			var trackHeight = trackEl.clientHeight;

			if (scrollHeight <= clientHeight || clientHeight <= 0 || trackHeight <= 0) {
				if (
					this.state.thumbHeight !== 0 ||
					this.state.thumbTop !== 0 ||
					this.state.showThumb !== false
				) {
					this.setState({
						thumbHeight: 0,
						thumbTop: 0,
						showThumb: false,
					});
				}
				return;
			}

			var ratio = clientHeight / scrollHeight;
			var thumbHeight = Math.max(minThumbSize, Math.round(trackHeight * ratio));
			thumbHeight = Math.min(trackHeight, thumbHeight);
			var trackTravel = trackHeight - thumbHeight;
			var maxScroll = scrollHeight - clientHeight;
			var thumbTop = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * trackTravel) : 0;

			if (
				this.state.thumbHeight !== thumbHeight ||
				this.state.thumbTop !== thumbTop ||
				this.state.showThumb !== true
			) {
				this.setState({
					thumbHeight,
					thumbTop,
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

	teardownDragListeners() {
		window.removeEventListener("pointermove", this.onThumbPointerMove);
		window.removeEventListener("pointerup", this.onThumbPointerUp);
		window.removeEventListener("pointercancel", this.onThumbPointerUp);
	}

	onThumbPointerDown(evt) {
		if (!this.state.showThumb) {
			return;
		}

		this.dragStartY = evt.clientY;
		this.dragStartThumbTop = this.state.thumbTop;
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

		if (!scrollEl || !trackEl) {
			return;
		}

		var trackHeight = trackEl.clientHeight;
		var thumbHeight = this.state.thumbHeight;
		var maxThumbTop = Math.max(0, trackHeight - thumbHeight);
		var deltaY = evt.clientY - this.dragStartY;
		var nextThumbTop = Math.max(0, Math.min(maxThumbTop, this.dragStartThumbTop + deltaY));
		var maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
		var nextScrollTop = maxThumbTop > 0 ? (nextThumbTop / maxThumbTop) * maxScroll : 0;

		scrollEl.scrollTop = nextScrollTop;
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
		var className = "mj-scroll-pane";
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
			height: `${this.state.thumbHeight}px`,
			transform: `translateY(${this.state.thumbTop}px)`,
		};

		return (
			<div className={className}>
				<div className={viewportClassName}>
					<div
						ref={this.scrollRef}
						className={scrollClassName}
						onScroll={this.onScroll}
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
