import React from 'react';
import Button from './Button.jsx';

export default class ViewSelector extends React.Component {
	render() {
		const {
			ariaLabel = 'View mode',
			options = [],
			value = '',
			onChange,
		} = this.props;

		return (
			<div className="pipeline-view-selector" role="group" aria-label={ariaLabel}>
				{options.map((option) => (
					<Button
						key={option.value}
						active={value === option.value}
						aria-pressed={value === option.value}
						onClick={() => onChange?.(option.value)}
					>
						{option.label}
					</Button>
				))}
			</div>
		);
	}
}
