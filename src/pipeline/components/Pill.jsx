import React from 'react';

const REPORT_LEVELS = new Set(['info', 'warning', 'error']);

export default class Pill extends React.Component {
	reportLevel() {
		return REPORT_LEVELS.has(this.props.reportLevel) ? this.props.reportLevel : 'info';
	}

	renderExtraContent() {
		const { extraContent = null } = this.props;

		if (!extraContent) {
			return null;
		}

		return (
			<span className="pipeline-pill-extra">
				{extraContent}
			</span>
		);
	}

	className() {
		const {
			className = '',
			onClick = null,
		} = this.props;

		return [
			'pipeline-pill',
			`pipeline-pill-${this.reportLevel()}`,
			onClick ? 'pipeline-pill-clickable' : '',
			className,
		].filter(Boolean).join(' ');
	}

	render() {
		const {
			children,
			disabled = false,
			extraContent: _extraContent,
			onClick = null,
			reportLevel: _reportLevel,
			className: _className,
			...pillProps
		} = this.props;

		if (onClick) {
			return (
				<button
					{...pillProps}
					type="button"
					className={this.className()}
					onClick={onClick}
					disabled={disabled}
				>
					{children}
					{this.renderExtraContent()}
				</button>
			);
		}

		return (
			<span
				{...pillProps}
				className={this.className()}
			>
				{children}
				{this.renderExtraContent()}
			</span>
		);
	}
}
