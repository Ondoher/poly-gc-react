import React from "react";

export default class Toast extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			visible: false,
			displayedMessage: '',
		};
		this.dismissHandle = null;
	}

	componentDidMount() {
		this.syncToProps({}, this.props);
	}

	componentDidUpdate(prevProps) {
		this.syncToProps(prevProps, this.props);
	}

	componentWillUnmount() {
		this.clearDismissHandle();
	}

	clearDismissHandle() {
		if (!this.dismissHandle) return;

		clearTimeout(this.dismissHandle);
		this.dismissHandle = null;
	}

	syncToProps(prevProps, nextProps) {
		var message = nextProps.message || '';
		var prevMessage = prevProps.message || '';
		var duration = nextProps.duration || 2000;
		var messageKeyChanged = prevProps.messageKey !== nextProps.messageKey;
		var modal = Boolean(nextProps.modal);

		if (!message) {
			if (!this.state.visible && !this.state.displayedMessage) return;

			this.clearDismissHandle();
			this.setState({
				visible: false,
				displayedMessage: '',
			});
			return;
		}

		if (message === prevMessage && !messageKeyChanged) return;

		this.clearDismissHandle();
		this.setState({
			visible: true,
			displayedMessage: message,
		});

		if (modal || nextProps.visible !== undefined) return;

		this.dismissHandle = setTimeout(function () {
			this.dismissHandle = null;
			this.setState({
				visible: false,
				displayedMessage: '',
			});
		}.bind(this), duration);
	}

	onClose() {
		this.clearDismissHandle();
		this.setState({
			visible: false,
			displayedMessage: '',
		});

		if (this.props.onClose) {
			this.props.onClose();
		}
	}

	render() {
		var className = 'mj-toast';
		var message = this.state.displayedMessage;
		var visible = this.props.visible !== undefined ? this.props.visible : this.state.visible;
		var modal = Boolean(this.props.modal);
		var role = modal ? 'alertdialog' : 'status';

		if (!visible && !message) {
			return null;
		}

		if (visible) {
			className += ' is-visible';
		}

		if (modal) {
			className += ' is-modal';
		}

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		return (
			<div
				className={className}
				role={role}
				aria-live={modal ? 'assertive' : 'polite'}
				aria-atomic="true"
				aria-modal={modal ? 'true' : undefined}
			>
				{modal && <div className="mj-toast-overlay"></div>}
				<div className="mj-toast-panel">
					<div className="mj-toast-body">
						<div className="mj-toast-message">{message}</div>
						{modal && (
							<button
								type="button"
								className="mj-toast-close"
								onClick={this.onClose.bind(this)}
							>
								Close
							</button>
						)}
					</div>
				</div>
			</div>
		);
	}
}
