import React from 'react';
import {
	BoundsBox,
	Button,
	Pill,
	ViewSelector,
	componentSelectorSelection,
} from '../../../components/index.js';
import OptionalPartsComponentsSelector from './OptionalPartsComponentsSelector.jsx';
import OptionalComponentAssignments from '../models/OptionalComponentAssignments.js';
import OptionalFaceOptionsModel from '../models/OptionalFaceOptionsModel.js';

const FAMILY_LABELS = {
	b: 'Bamboos',
	c: 'Characters',
	d: 'Dots',
	wind: 'Winds',
	flower: 'Flowers',
	season: 'Seasons',
	dragon: 'Dragons',
	other: 'Other',
};

const HINT_REGION_OPTIONS = [
	{ value: 'default', label: 'Default' },
	{ value: 'either-corner', label: 'Either top corner' },
	{ value: 'no-preference', label: 'No location preference' },
	{ value: 'top-left', label: 'Top left' },
	{ value: 'top-center', label: 'Top center' },
	{ value: 'top-right', label: 'Top right' },
	{ value: 'middle-left', label: 'Middle left' },
	{ value: 'center', label: 'Center' },
	{ value: 'middle-right', label: 'Middle right' },
	{ value: 'bottom-left', label: 'Bottom left' },
	{ value: 'bottom-right', label: 'Bottom right' },
];

export default class OptionalPartAssignmentPage extends React.Component {
	constructor(props) {
		super(props);

		const pageState = props.pageView.getState();
		this.state = {
			...pageState,
			...OptionalPartAssignmentPage.localStateFromPageState(pageState),
			viewMode: 'all',
			resetDialog: false,
		};
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen('updated', (pageState) => {
			this.setState({
				...pageState,
				...OptionalPartAssignmentPage.localStateFromPageState(pageState),
				viewMode: 'all',
			});
		});
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten('updated', this.updateListener);
	}

	updateBulkOption(family, partKey, fieldName, value) {
		this.setState((state) => ({
			viewMode: 'all',
			bulkOptions: {
				...state.bulkOptions,
				families: {
					...(state.bulkOptions.families || {}),
					[family]: {
						...(state.bulkOptions.families?.[family] || {}),
						...(partKey === 'layout'
							? { layout: value }
							: {
								[partKey]: {
									...OptionalPartAssignmentPage.updatedOption(
										state.bulkOptions.families?.[family]?.[partKey],
										fieldName,
										value,
									),
									[`${fieldName}Mixed`]: false,
									...(fieldName === 'region' ? { searchSource: true, searchSourceMixed: false } : {}),
								},
							}),
					},
				},
			},
		}));
	}

	updateFaceOption(faceKey, partKey, fieldName, value) {
		this.setState((state) => ({
			viewMode: 'all',
			bulkOptions: {
				...state.bulkOptions,
				faces: {
					...(state.bulkOptions.faces || {}),
					[faceKey]: {
						...(state.bulkOptions.faces?.[faceKey] || {}),
						[partKey]: {
							...OptionalPartAssignmentPage.updatedOption(
								state.bulkOptions.faces?.[faceKey]?.[partKey],
								fieldName,
								value,
							),
							...(fieldName === 'region' ? { searchSource: true } : {}),
						},
					},
				},
			},
		}));
	}

	updateManualAssignment(faceKey, assignments) {
		this.setState((state) => ({
			viewMode: 'all',
			manualAssignments: {
				...state.manualAssignments,
				[faceKey]: assignments,
			},
			bindingActionsByFace: {
				...state.bindingActionsByFace,
				[faceKey]: OptionalPartAssignmentPage.bindingActionsForFace(
					state.optionalPartAssignment?.faces?.[faceKey],
					assignments,
				),
			},
		}));
	}

	pendingBindingActions() {
		return Object.fromEntries(Object.entries(this.state.bindingActionsByFace || {})
			.map(([faceKey, actions]) => [faceKey, Object.fromEntries(Object.entries(actions || {})
				.filter(([, action]) => action.action && action.action !== 'none'))])
			.filter(([, actions]) => Object.keys(actions).length > 0));
	}

	hasPendingBindingActions() {
		return Object.keys(this.pendingBindingActions()).length > 0;
	}

	async savePendingBindingActions({ reload = true } = {}) {
		const actionsByFace = this.pendingBindingActions();

		if (Object.keys(actionsByFace).length === 0) {
			return null;
		}

		const result = reload
			? await this.props.pageView.saveBindingActionsAndReload(actionsByFace)
			: await this.props.pageView.saveBindingActions(actionsByFace);

		this.setState({ bindingActionsByFace: {} });
		return result;
	}

	async rebuildWithCurrentOptions() {
		this.exitViewMode();
		await this.savePendingBindingActions({ reload: false });
		this.props.pageView.rebuild(this.state.bulkOptions, this.state.manualAssignments);
	}

	async acceptWithCurrentBindings() {
		this.exitViewMode();
		await this.savePendingBindingActions({ reload: false });
		this.props.pageView.accept();
	}

	showResetDialog() {
		this.exitViewMode();
		this.setState({ resetDialog: true });
	}

	dismissResetDialog() {
		this.setState({ resetDialog: false });
	}

	confirmReset() {
		this.setState({ resetDialog: false });
		this.props.pageView.reset();
	}

	enterViewMode() {
		this.setState({ viewMode: 'parts' });
	}

	exitViewMode() {
		if (this.state.viewMode !== 'all') {
			this.setState({ viewMode: 'all' });
		}
	}

	setViewMode(viewMode) {
		this.setState({ viewMode });
	}

	renderHeader() {
		const {
			optionalPartAssignment,
			summary,
			processing,
			viewMode,
		} = this.state;

		return (
			<header className="optional-part-assignment-header">
				<div className="optional-part-assignment-title">
					<h1>Optional Part Assignment</h1>
					<ViewSelector
						ariaLabel="Optional assignment view"
						value={viewMode}
						options={[
							{ value: 'all', label: 'All' },
							{ value: 'parts', label: 'Parts' },
						]}
						onChange={(nextViewMode) => this.setViewMode(nextViewMode)}
					/>
					<OptionalPartAssignmentHeaderSummary
						summary={summary}
						onShowReview={() => this.props.pageView.showFirstReviewFace()}
					/>
				</div>
				<div className="optional-part-assignment-actions">
					<Button onClick={() => this.showResetDialog()} disabled={processing}>Reset</Button>
					<Button onClick={() => this.props.pageView.load({ force: true })} disabled={processing}>Reload</Button>
					<Button variant="primary" onClick={() => this.rebuildWithCurrentOptions()} disabled={processing || !optionalPartAssignment}>Save</Button>
					<Button variant="accept" onClick={() => this.acceptWithCurrentBindings()} disabled={processing || !optionalPartAssignment}>Accept</Button>
				</div>
			</header>
		);
	}

	renderBulkPresets(faces, bulkPresets) {
		return (
			<OptionalBulkPresets
				presets={bulkPresets}
				faces={faces}
				bulkOptions={this.state.bulkOptions}
				onOptionChange={(family, partKey, fieldName, value) => this.updateBulkOption(family, partKey, fieldName, value)}
				onExitViewMode={() => this.exitViewMode()}
			/>
		);
	}

	renderFaceGrid(faces) {
		return (
			<section className="optional-face-grid">
				{faces.map((face) => (
					<OptionalFaceCard
						key={face.faceKey}
						face={face}
						pageView={this.props.pageView}
						bulkOptions={this.state.bulkOptions}
						viewMode={this.state.viewMode}
						onExitViewMode={() => this.exitViewMode()}
						onFaceOptionChange={(faceKey, partKey, fieldName, value) => this.updateFaceOption(faceKey, partKey, fieldName, value)}
						onManualAssignmentChange={(assignments) => this.updateManualAssignment(face.faceKey, assignments)}
					/>
				))}
			</section>
		);
	}

	renderEmptyState() {
		return (
			<div className="empty-state">
				No optional part assignment data is available. Run Stage 1 optional assignment before reviewing this page.
			</div>
		);
	}

	renderContent() {
		const { optionalPartAssignment } = this.state;

		if (!optionalPartAssignment?.faces) {
			return this.renderEmptyState();
		}

		const faces = OptionalFaceOptionsModel.assignmentFaces(optionalPartAssignment);
		const bulkPresets = optionalPartAssignment.bulkPresets || [];

		return (
			<React.Fragment>
				{this.renderBulkPresets(faces, bulkPresets)}
				{this.renderFaceGrid(faces)}
			</React.Fragment>
		);
	}

	renderBusy() {
		return (
			<div className="pipeline-busy-overlay">
				<div>{this.state.processingLabel || 'Working...'}</div>
			</div>
		);
	}

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="optional-part-message-title">
					<header>
						<h2 id="optional-part-message-title">{messageDialog.title}</h2>
					</header>
					<p>{messageDialog.message}</p>
					<footer>
						<Button onClick={() => this.props.pageView.dismissMessageDialog()}>OK</Button>
					</footer>
				</section>
			</div>
		);
	}

	renderResetDialog() {
		const tilesetId = this.state.optionalPartAssignment?.tilesetId || this.state.tilesetId || 'current tileset';

		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="optional-part-reset-title">
					<header>
						<h2 id="optional-part-reset-title">Reset Optional Parts</h2>
					</header>
					<p>
						This will reset {tilesetId} to its intake JSON, then rerun source normalization
						and optional part assignment. Current optional review edits for this tileset will be replaced.
					</p>
					<footer>
						<Button onClick={() => this.dismissResetDialog()}>Cancel</Button>
						<Button variant="accept" onClick={() => this.confirmReset()}>Reset</Button>
					</footer>
				</section>
			</div>
		);
	}

	render() {
		const { processing, messageDialog, resetDialog } = this.state;

		return (
			<section className="optional-part-assignment-page">
				{this.renderHeader()}
				<div className="optional-part-assignment-content">
					{this.renderContent()}
				</div>
				{processing ? this.renderBusy() : null}
				{resetDialog ? this.renderResetDialog() : null}
				{messageDialog ? this.renderMessageDialog(messageDialog) : null}
			</section>
		);
	}

	static localStateFromPageState(pageState) {
		const optionalPartAssignment = pageState.optionalPartAssignment || {};
		const faces = OptionalFaceOptionsModel.assignmentFaces(optionalPartAssignment);
		const bulkPresets = optionalPartAssignment.bulkPresets || [];

		return {
			bulkOptions: OptionalFaceOptionsModel.initialBulkOptions(faces, bulkPresets, optionalPartAssignment.bulkOptions),
			manualAssignments: OptionalFaceOptionsModel.initialManualAssignments(optionalPartAssignment.manualAssignments),
			bindingActionsByFace: {},
		};
	}

	static bindingActionsForFace(face, assignments) {
		if (!face) {
			return {};
		}

		const seedByComponentId = Object.fromEntries(Object.entries(face.bindingActions || {})
			.map(([componentId, action]) => [componentId, action.partId || '']));
		const nextByComponentId = componentAssignmentsByComponentId(assignments);
		const componentIds = uniqueValues([
			...Object.keys(seedByComponentId),
			...Object.keys(nextByComponentId),
		]);

		return Object.fromEntries(componentIds.map((componentId) => {
			const seedPartId = seedByComponentId[componentId] || '';
			const nextPartId = nextByComponentId[componentId] || '';

			if (nextPartId && nextPartId !== seedPartId) {
				return [componentId, {
					componentId,
					partId: nextPartId,
					action: 'bind',
				}];
			}

			if (!nextPartId && seedPartId) {
				return [componentId, {
					componentId,
					partId: seedPartId,
					action: 'unbind',
				}];
			}

			return [componentId, {
				componentId,
				...(nextPartId || seedPartId ? { partId: nextPartId || seedPartId } : {}),
				action: 'none',
			}];
		}));
	}

	static updatedOption(option, fieldName, value) {
		const nextOption = { ...(option || {}) };

		if (fieldName === 'region' && value === 'default') {
			delete nextOption.region;
			delete nextOption.regionMixed;
			nextOption.regionDefault = true;
			return nextOption;
		}

		nextOption[fieldName] = value;
		if (fieldName === 'region') {
			delete nextOption.regionDefault;
		}

		return nextOption;
	}
}

class OptionalPartAssignmentHeaderSummary extends React.Component {
	render() {
		const { summary, onShowReview } = this.props;

		if (!summary) {
			return (
				<div className="structure-header-summary optional-header-summary">
					<Pill>no assignment data</Pill>
				</div>
			);
		}

		return (
			<div className="structure-header-summary optional-header-summary">
				<Pill>{summary.faceCount || 0} faces</Pill>
				<Pill>{summary.optionalPartCount || 0} expected</Pill>
				<Pill>{summary.candidateCount || 0} found</Pill>
				<Pill
					reportLevel={(summary.needsReviewCount || 0) > 0 ? 'warning' : 'info'}
					onClick={(summary.needsReviewCount || 0) > 0 ? onShowReview : null}
				>
					{summary.needsReviewCount || 0} review
				</Pill>
			</div>
		);
	}
}

class OptionalBulkPresets extends React.Component {
	renderPreset(preset) {
		const parts = OptionalFaceOptionsModel.visibleBulkPresetParts(preset);

		if (!parts.length) {
			return null;
		}

		return (
			<OptionalBulkPresetCard
				key={preset.family}
				preset={preset}
				parts={parts}
				faces={this.props.faces}
				options={this.props.bulkOptions?.families?.[preset.family]}
				onOptionChange={this.props.onOptionChange}
			/>
		);
	}

	render() {
		const { presets, onExitViewMode } = this.props;

		if (!presets.length) {
			return null;
		}

		return (
			<section
				className="optional-bulk-presets"
				aria-label="Bulk optional part presets"
				onPointerDownCapture={() => onExitViewMode?.()}
			>
				{presets.map((preset) => this.renderPreset(preset))}
			</section>
		);
	}
}

class OptionalBulkPresetCard extends React.Component {
	activeOptions() {
		const { preset, faces, options } = this.props;

		return options || OptionalFaceOptionsModel.bulkOptions(faces.filter((face) => OptionalFaceOptionsModel.faceFamily(face.faceKey) === preset.family));
	}

	renderCounts() {
		return (
			<div className="optional-preset-counts">
				{this.props.parts.map((part) => (
					<span key={part.partId}>
						<strong>{OptionalComponentAssignments.partLabel(part.partId)}</strong>
						<em>{part.presetRegion || 'mixed'} / {part.foundCount}/{part.expectedCount} found</em>
					</span>
				))}
			</div>
		);
	}

	renderOptions(activeOptions, showCharacterGlyph, showPairLayout) {
		const { preset, onOptionChange } = this.props;

		return (
			<div className="optional-bulk-options">
				<OptionalFaceOption
					label="Label"
					options={activeOptions.label}
					onChange={(fieldName, value) => onOptionChange?.(preset.family, 'label', fieldName, value)}
				/>
				{showCharacterGlyph ? (
					<OptionalFaceOption
						label="Character Glyph"
						options={activeOptions.character}
						onChange={(fieldName, value) => onOptionChange?.(preset.family, 'character', fieldName, value)}
					/>
				) : null}
				{showPairLayout ? (
					<label className="optional-pair-layout-control">
						<span>Layout</span>
						<select
							value={activeOptions.layout || OptionalFaceOptionsModel.defaultPairLayoutForFamily(preset.family)}
							onChange={(event) => onOptionChange?.(preset.family, 'layout', 'value', event.target.value)}
						>
							<option value="label-left-character-right">Label left / Character right</option>
							<option value="label-right-character-left">Label right / Character left</option>
						</select>
					</label>
				) : null}
			</div>
		);
	}

	render() {
		const { preset } = this.props;
		const showCharacterGlyph = preset.family === 'flower' || preset.family === 'season';
		const activeOptions = this.activeOptions();
		const showPairLayout = showCharacterGlyph && activeOptions.label?.searchSource && activeOptions.character?.searchSource;

		return (
			<article className="optional-preset-card">
				<div className="optional-preset-title">
					<strong>{FAMILY_LABELS[preset.family] || preset.family}</strong>
					<span>{preset.faceCount} faces</span>
				</div>
				{this.renderCounts()}
				{this.renderOptions(activeOptions, showCharacterGlyph, showPairLayout)}
			</article>
		);
	}
}

class OptionalFaceCard extends React.Component {
	constructor(props) {
		super(props);

		this.state = this.initialStateFromProps(props);
	}

	componentDidUpdate(prevProps) {
		if (prevProps.face !== this.props.face) {
			this.props.onExitViewMode?.();
			this.setState(this.initialStateFromProps(this.props));
			return;
		}

		if (prevProps.bulkOptions !== this.props.bulkOptions) {
			this.props.onExitViewMode?.();
			this.resetBulkOptionAssignments();
			return;
		}

		this.resetChangedAssignmentSeed();
	}

	assignmentsFromProps(props, parts) {
		const partIds = new Set(parts.map((part) => part.partId));
		let assignments = OptionalComponentAssignments.initial(parts);

		for (const component of props.face.components || []) {
			const partId = component.assignedOptionalPartId;

			if (!partIds.has(partId)) {
				continue;
			}

			assignments = new OptionalComponentAssignments(assignments)
				.assign(partId, uniqueValues([...(assignments[partId] || []), component.componentId]))
				.value();
		}

		return assignments;
	}

	initialStateFromProps(props) {
		const parts = this.partsFromProps(props);
		const componentAssignments = this.assignmentsFromProps(props, parts);

		return {
			selectedPartId: '',
			selectedComponentIds: [],
			componentAssignments,
			assignmentSeedSignature: OptionalFaceCard.assignmentSeedSignature(componentAssignments),
		};
	}

	partsFromProps(props) {
		const { face, bulkOptions } = props;

		return OptionalFaceOptionsModel.forFace(face, bulkOptions).visibleParts();
	}

	currentOptions() {
		const { face, bulkOptions } = this.props;

		return OptionalFaceOptionsModel.forFace(face, bulkOptions).partOptions();
	}

	currentParts() {
		return OptionalFaceOptionsModel.forFace(this.props.face, this.props.bulkOptions).visibleParts();
	}

	assignedPartForComponent(componentId, state = this.state) {
		return new OptionalComponentAssignments(state.componentAssignments).assignedPartFor(componentId);
	}

	highlightedComponentIds() {
		const assignedComponentIds = new Set(Object.values(this.state.componentAssignments).flat());

		return new Set([
			...assignedComponentIds,
			...this.state.selectedComponentIds,
		]);
	}

	canAssign() {
		return Boolean(this.state.selectedPartId && this.state.selectedComponentIds.length > 0);
	}

	setSelection(selection) {
		this.props.onExitViewMode?.();
		this.setState({
			selectedPartId: selection.partId || '',
			selectedComponentIds: [...(selection.componentIds || [])],
		});
	}

	selectComponent(component) {
		const assignedPartId = this.assignedPartForComponent(component.componentId);
		this.setSelection(componentSelectorSelection({
			partId: this.state.selectedPartId,
			componentIds: this.state.selectedComponentIds,
		}, {
			id: component.componentId,
			partIds: assignedPartId ? [assignedPartId] : [],
		}));
	}

	assignSelection() {
		this.props.onExitViewMode?.();

		if (this.currentParts().length === 0 || !this.canAssign()) {
			return;
		}

		this.setState((state) => {
			const nextAssignments = new OptionalComponentAssignments(state.componentAssignments)
				.assign(state.selectedPartId, state.selectedComponentIds)
				.value();
			this.props.onManualAssignmentChange?.(nextAssignments);

			return {
				componentAssignments: nextAssignments,
				selectedComponentIds: [],
			};
		});
	}

	clearAssignment(partId, componentIds = null) {
		this.props.onExitViewMode?.();

		if (this.currentParts().length === 0) {
			return;
		}

		this.setState((state) => {
			const nextAssignments = new OptionalComponentAssignments(state.componentAssignments)
				.unassign(partId, componentIds)
				.value();
			this.props.onManualAssignmentChange?.(nextAssignments);

			return {
				componentAssignments: nextAssignments,
				selectedPartId: partId,
				selectedComponentIds: [],
			};
		});
	}

	resetBulkOptionAssignments() {
		const parts = this.currentParts();
		const seedAssignments = this.assignmentsFromProps(this.props, parts);
		const assignmentSeedSignature = OptionalFaceCard.assignmentSeedSignature(seedAssignments);

		this.setState((state) => ({
			selectedPartId: parts.some((part) => part.partId === state.selectedPartId) ? state.selectedPartId : '',
			selectedComponentIds: [],
			componentAssignments: {
				...seedAssignments,
				...new OptionalComponentAssignments(state.componentAssignments).prune(parts).value(),
			},
			assignmentSeedSignature,
		}));
	}

	resetChangedAssignmentSeed() {
		const parts = this.currentParts();
		const seedAssignments = this.assignmentsFromProps(this.props, parts);
		const assignmentSeedSignature = OptionalFaceCard.assignmentSeedSignature(seedAssignments);

		if (assignmentSeedSignature !== this.state.assignmentSeedSignature) {
			this.props.onExitViewMode?.();
			this.setState({
				selectedPartId: '',
				selectedComponentIds: [],
				componentAssignments: seedAssignments,
				assignmentSeedSignature,
			});
		}
	}

	componentClipStyle(bounds, canvas) {
		if (!bounds || !canvas?.width || !canvas?.height) {
			return {};
		}

		const left = ((bounds.left - canvas.left) / canvas.width) * 100;
		const top = ((bounds.top - canvas.top) / canvas.height) * 100;
		const right = (((Number.isFinite(bounds.right) ? bounds.right : bounds.left + bounds.width) - canvas.left) / canvas.width) * 100;
		const bottom = (((Number.isFinite(bounds.bottom) ? bounds.bottom : bounds.top + bounds.height) - canvas.top) / canvas.height) * 100;

		return {
			clipPath: `inset(${top}% ${100 - right}% ${100 - bottom}% ${left}%)`,
		};
	}

	renderPreview(parts, canvas) {
		const { face, viewMode, pageView } = this.props;
		const { componentAssignments, selectedComponentIds } = this.state;
		const highlightedComponentIds = this.highlightedComponentIds(parts);
		const hasEnabledParts = parts.length > 0;
		const previewPath = face.sourceFile;

		return (
			<div className="structure-card-preview">
				<div
					className={[
						'face-preview',
						'optional-face-preview',
						viewMode === 'parts' ? 'optional-face-parts-mode' : '',
					].filter(Boolean).join(' ')}
					style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
				>
					{previewPath ? <img className="optional-face-source-image" src={pageView.assetUrl(previewPath)} alt={face.faceKey} /> : null}
					{(face.components || []).map((component) => {
						const assignedPartId = new OptionalComponentAssignments(componentAssignments).assignedPartFor(component.componentId);
						const isSelected = selectedComponentIds.includes(component.componentId);
						const isSuggested = highlightedComponentIds.has(component.componentId);
						const optionalPartId = assignedPartId || '';
						const isOptionalPartComponent = Boolean(optionalPartId || isSuggested);

						return (
							<React.Fragment key={component.componentId}>
								{viewMode === 'parts' && isOptionalPartComponent && previewPath ? (
									<img
										className="optional-view-part-image"
										src={pageView.assetUrl(previewPath)}
										alt=""
										aria-hidden="true"
										style={this.componentClipStyle(component.bounds, canvas)}
									/>
								) : null}
								<BoundsBox
									bounds={component.bounds}
									canvas={canvas}
									className={[
										'optional-component',
										hasEnabledParts ? 'pickable' : '',
										optionalPartId ? `optional-component-${optionalPartId}` : '',
										isSelected ? 'selected-optional-component' : '',
										isSuggested ? 'suggested-optional-component' : '',
										viewMode === 'parts' && !isOptionalPartComponent ? 'optional-non-part-component' : '',
										viewMode === 'parts' && isOptionalPartComponent ? 'optional-view-part-component' : '',
									].filter(Boolean).join(' ')}
									title={[
										component.componentId,
										optionalPartId ? OptionalComponentAssignments.partLabel(optionalPartId) : '',
										component.className || component.fill || component.stroke || 'paint',
									].filter(Boolean).join(' / ')}
									onClick={hasEnabledParts ? () => this.selectComponent(component) : null}
								/>
							</React.Fragment>
						);
					})}
					{parts.map((part) => part.suggestedBounds ? (
						<BoundsBox
							key={`${part.partId}-suggested`}
							bounds={part.suggestedBounds}
							canvas={canvas}
							className={`optional-suggested optional-suggested-${part.partId}`}
							title={`${OptionalComponentAssignments.partLabel(part.partId)} suggested bounds`}
						/>
					) : null)}
				</div>
			</div>
		);
	}

	renderSelector(parts, activeOptions) {
		const { face, onFaceOptionChange } = this.props;

		return (
			<div
				className="optional-selector-shell"
				onPointerDownCapture={() => this.props.onExitViewMode?.()}
			>
				<OptionalPartsComponentsSelector
					face={face}
					parts={parts}
					selectedPartId={this.state.selectedPartId}
					selectedComponentIds={this.state.selectedComponentIds}
					componentAssignments={this.state.componentAssignments}
					highlightedComponentIds={this.highlightedComponentIds(parts)}
					canAssign={this.canAssign()}
					bodyExtra={(
						<OptionalFaceSourceOptions
							face={face}
							options={activeOptions}
							onOptionChange={(partKey, fieldName, value) => onFaceOptionChange?.(face.faceKey, partKey, fieldName, value)}
						/>
					)}
					onAssignSelection={() => this.assignSelection()}
					onClearAssignment={(partId, componentIds) => this.clearAssignment(partId, componentIds)}
					onSelectionChange={(selection) => this.setSelection(selection)}
				/>
			</div>
		);
	}

	render() {
		const { face } = this.props;
		const canvas = canvasFromFace(face);
		const activeOptions = this.currentOptions();
		const parts = OptionalFaceOptionsModel.forFace(face, this.props.bulkOptions).visibleParts();

		return (
			<article className={[
				'structure-card',
				'optional-face-card',
				face.status === 'needs-review' ? 'needs-review-optional-face' : '',
			].filter(Boolean).join(' ')} data-review-face={face.faceKey}>
				{this.renderPreview(parts, canvas)}
				{this.renderSelector(parts, activeOptions)}
			</article>
		);
	}

	static assignmentSeedSignature(assignments) {
		return JSON.stringify(Object.fromEntries(Object.entries(assignments || {})
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([partId, componentIds]) => [partId, [...(componentIds || [])].sort((left, right) => left.localeCompare(right))])));
	}
}

class OptionalFaceSourceOptions extends React.Component {
	render() {
		const { face, options, onOptionChange } = this.props;
		const partKeys = new OptionalFaceOptionsModel(face).optionKeys();

		if (!partKeys.length) {
			return null;
		}

		return (
			<div className="optional-face-source-options">
				{partKeys.map(({ partKey, label }) => (
					<OptionalFaceOption
						key={partKey}
						label={label}
						options={options[partKey]}
						onChange={(fieldName, value) => onOptionChange?.(partKey, fieldName, value)}
					/>
				))}
			</div>
		);
	}
}

class OptionalFaceOption extends React.Component {
	render() {
		const { label, options, onChange } = this.props;

		return (
			<div className="optional-face-option-row">
				<strong>{label}</strong>
				<label>
					<OptionalCheckbox
						checked={Boolean(options?.searchSource)}
						indeterminate={Boolean(options?.searchSourceMixed)}
						onChange={(value) => onChange('searchSource', value)}
					/>
					<span>Search Source</span>
				</label>
				<label>
					<span>Hint</span>
					<select
						value={options?.regionMixed ? 'mixed' : options?.regionDefault ? 'default' : (options?.region || 'center')}
						onChange={(event) => {
							if (event.target.value !== 'mixed') {
								onChange('region', event.target.value);
							}
						}}
						disabled={!options?.searchSource}
					>
						{options?.regionMixed ? <option value="mixed">Mixed</option> : null}
						{HINT_REGION_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>{option.label}</option>
						))}
					</select>
				</label>
			</div>
		);
	}
}

class OptionalCheckbox extends React.Component {
	constructor(props) {
		super(props);
		this.inputRef = React.createRef();
	}

	componentDidMount() {
		this.updateIndeterminate();
	}

	componentDidUpdate() {
		this.updateIndeterminate();
	}

	updateIndeterminate() {
		if (this.inputRef.current) {
			this.inputRef.current.indeterminate = this.props.indeterminate;
		}
	}

	render() {
		return (
			<input
				ref={this.inputRef}
				type="checkbox"
				checked={this.props.checked}
				onChange={(event) => this.props.onChange(event.target.checked)}
			/>
		);
	}
}

function canvasFromFace(face) {
	const viewBox = face?.viewBox || {};
	const bounds = face?.sourceBounds || face?.alignmentBounds || {};
	const left = viewBox.left ?? viewBox.minX ?? bounds.left ?? 0;
	const top = viewBox.top ?? viewBox.minY ?? bounds.top ?? 0;
	const width = viewBox.width || bounds.width || 164;
	const height = viewBox.height || bounds.height || 238;

	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
	};
}

function uniqueValues(values) {
	return [...new Set((values || []).filter(Boolean))];
}

function componentAssignmentsByComponentId(assignments) {
	const byComponentId = {};

	for (const [partId, componentIds] of Object.entries(assignments || {})) {
		for (const componentId of componentIds || []) {
			byComponentId[componentId] = partId;
		}
	}

	return byComponentId;
}
