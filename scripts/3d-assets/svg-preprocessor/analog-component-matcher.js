export function groupAnalogComponents(components, options = {}) {
	const expandedGap = options.expandedGap ?? 10;
	const groupByColor = options.groupByColor ?? false;
	const canJoinComponents = typeof options.canJoinComponents === 'function'
		? options.canJoinComponents
		: () => true;
	const sorted = [...components].sort(compareByPosition);

	if (expandedGap <= 0) {
		return sorted.map((component) => makeGroup([component]));
	}

	const groups = [];

	for (const component of sorted) {
		const matchingGroups = groups.filter((group) => (
			(!groupByColor || group.dominantColor === componentColor(component))
			&& canJoinGroupComponent(group, component, canJoinComponents)
			&& boundsOverlap(expandBounds(group.bounds, expandedGap), component.bounds || component)
		));

		if (matchingGroups.length === 0) {
			groups.push(makeGroup([component]));
			continue;
		}

		const firstGroup = matchingGroups[0];
		firstGroup.components.push(component);
		refreshGroup(firstGroup);

		for (const otherGroup of matchingGroups.slice(1)) {
			if (!canJoinGroups(firstGroup, otherGroup, canJoinComponents)) {
				continue;
			}
			firstGroup.components.push(...otherGroup.components);
			groups.splice(groups.indexOf(otherGroup), 1);
			refreshGroup(firstGroup);
		}
	}

	return groups.sort(compareByPosition);
}

function canJoinGroupComponent(group, component, canJoinComponents) {
	return (group.components || []).every((groupComponent) => canJoinComponents(groupComponent, component));
}

function canJoinGroups(leftGroup, rightGroup, canJoinComponents) {
	return (leftGroup.components || []).every((leftComponent) => (
		(rightGroup.components || []).every((rightComponent) => canJoinComponents(leftComponent, rightComponent))
	));
}

function makeConstrainedGroups(components, canJoinComponents) {
	const groups = [];

	for (const component of components) {
		const group = groups.find((candidate) => canJoinGroupComponent(candidate, component, canJoinComponents));
		if (group) {
			group.components.push(component);
			refreshGroup(group);
		} else {
			groups.push(makeGroup([component]));
		}
	}

	return groups;
}

export function selectAnalogComponentGrouping(sourceComponents, referenceComponents, options = {}) {
	const gapCandidates = options.gapCandidates || [0, 1, 2, 3, 4, 5];
	const ignoredSourceComponents = makeComponentSet(options.ignoredSourceComponents);
	const ignoredReferenceComponents = makeComponentSet(options.ignoredReferenceComponents);
	const matchOptions = {
		allowReferenceRegroup: options.allowReferenceRegroup !== false,
		allowSameColorMerge: options.allowSameColorMerge !== false,
	};
	const unjoinedCandidate = makeGroupingCandidate({
		expandedGap: 0,
		sourceGroups: groupAnalogComponents(sourceComponents, {
			expandedGap: 0,
			groupByColor: options.groupByColor ?? true,
			canJoinComponents: options.canJoinSourceComponents,
		}),
		referenceGroups: groupAnalogComponents(referenceComponents, {
			expandedGap: 0,
			groupByColor: options.groupByColor ?? true,
		}),
		strategy: 'gap',
		ignoredSourceComponents,
		ignoredReferenceComponents,
		matchOptions,
	});

	if (countedGroupCount(unjoinedCandidate.sourceGroups, ignoredSourceComponents) === countedGroupCount(unjoinedCandidate.referenceGroups, ignoredReferenceComponents)) {
		return unjoinedCandidate;
	}

	const broadLayeredOverlapCandidate = makeGroupingCandidate({
		expandedGap: 0,
		sourceGroups: groupAnalogComponents(sourceComponents, {
			expandedGap: 0.001,
			groupByColor: false,
			canJoinComponents: options.canJoinSourceComponents,
		}),
		referenceGroups: groupAnalogComponents(referenceComponents, {
			expandedGap: 0.001,
			groupByColor: false,
		}),
		strategy: 'layered-overlap',
		ignoredSourceComponents,
		ignoredReferenceComponents,
		matchOptions,
	});
	const partCompletionSplitCandidate = makePartCompletionSplitCandidate({
		sourceComponents,
		referenceComponents,
		ignoredSourceComponents,
		ignoredReferenceComponents,
		matchOptions,
		canJoinSourceComponents: options.canJoinSourceComponents,
	});
	const colorHuePartCompletionCandidates = options.groupByColor === false || !options.colorHuePartCompletion
		? []
		: makeColorHuePartCompletionCandidates({
			sourceComponents,
			referenceComponents,
			ignoredSourceComponents,
			ignoredReferenceComponents,
			matchOptions,
			canJoinSourceComponents: options.canJoinSourceComponents,
		});
	const bestLayeredOverlapCandidate = [
		broadLayeredOverlapCandidate,
		partCompletionSplitCandidate,
		...colorHuePartCompletionCandidates,
	].sort((left, right) => left.score - right.score || left.sourceGroups.length - right.sourceGroups.length)[0];

	if (
		countedGroupCount(bestLayeredOverlapCandidate.sourceGroups, ignoredSourceComponents) === countedGroupCount(bestLayeredOverlapCandidate.referenceGroups, ignoredReferenceComponents)
		&& bestLayeredOverlapCandidate.score <= unjoinedCandidate.score
	) {
		return bestLayeredOverlapCandidate;
	}

	const candidates = [
		broadLayeredOverlapCandidate,
		partCompletionSplitCandidate,
		...colorHuePartCompletionCandidates,
		...gapCandidates.flatMap((expandedGap) => {
		const sourceGroups = groupAnalogComponents(sourceComponents, {
			expandedGap,
			groupByColor: options.groupByColor ?? true,
			canJoinComponents: options.canJoinSourceComponents,
		});
		const referenceGroups = groupAnalogComponents(referenceComponents, {
			expandedGap,
			groupByColor: options.groupByColor ?? true,
		});

		const baseCandidate = makeGroupingCandidate({
			expandedGap,
			sourceGroups,
			referenceGroups,
			strategy: 'gap',
			ignoredSourceComponents,
			ignoredReferenceComponents,
			matchOptions,
		});
		const alignedCandidate = optimizeSameColorGrouping(baseCandidate);

		return alignedCandidate.score < baseCandidate.score
			? [baseCandidate, alignedCandidate]
			: [baseCandidate];
	})];

	return candidates
		.sort((left, right) => left.score - right.score || left.expandedGap - right.expandedGap)[0];
}

function makeColorHuePartCompletionCandidates({
	sourceComponents,
	referenceComponents,
	ignoredSourceComponents,
	ignoredReferenceComponents,
	matchOptions,
	canJoinSourceComponents,
}) {
	const referenceGroups = groupAnalogComponents(referenceComponents, {
		expandedGap: 0,
		groupByColor: false,
	});

	const referenceColorGroups = groupAnalogComponents(referenceComponents, {
		expandedGap: 0,
		groupByColor: true,
	});
	const referenceColorHues = uniqueValues(referenceColorGroups.map((group) => colorHueKey(group.dominantColor)));

	if (referenceColorHues.length !== 1 || referenceColorHues[0] === 'unknown') {
		return [];
	}

	const sourceFragments = groupedSourceFragments(sourceComponents, { canJoinSourceComponents });
	const fragmentsByColorHue = groupSourceGroupsByColorHue(sourceFragments)
		.filter((groups) => groups.length > 0);

	if (fragmentsByColorHue.length <= 1) {
		return [];
	}

	return fragmentsByColorHue
		.map((hueSourceGroups) => {
			const sourceGroups = completeSourceGroupsForReferenceParts(hueSourceGroups, referenceGroups);
			const candidate = makeGroupingCandidate({
				expandedGap: 0,
				sourceGroups,
				referenceGroups,
				strategy: 'color-hue-part-completion',
				ignoredSourceComponents,
				ignoredReferenceComponents,
				matchOptions,
			});

			return {
				...candidate,
				score: candidate.score - colorHueSubsetScore(hueSourceGroups),
			};
		});
}

function colorHueSubsetScore(sourceGroups) {
	const componentCount = sourceGroups.reduce((total, group) => total + group.components.length, 0);
	const totalArea = sourceGroups.reduce((total, group) => total + boundsArea(group.bounds), 0);

	return (sourceGroups.length * 120) + (componentCount * 20) + Math.min(totalArea / 20, 80);
}

function makePartCompletionSplitCandidate({
	sourceComponents,
	referenceComponents,
	ignoredSourceComponents,
	ignoredReferenceComponents,
	matchOptions,
	canJoinSourceComponents,
}) {
	const referenceGroups = groupAnalogComponents(referenceComponents, {
		expandedGap: 0,
		groupByColor: false,
	});
	const sourceFragments = groupedSourceFragments(sourceComponents, { canJoinSourceComponents });
	const sourceGroups = completeSourceGroupsForReferenceParts(sourceFragments, referenceGroups);

	return makeGroupingCandidate({
		expandedGap: 0,
		sourceGroups,
		referenceGroups,
		strategy: 'part-completion-split',
		ignoredSourceComponents,
		ignoredReferenceComponents,
		matchOptions,
	});
}

function groupedSourceFragments(sourceComponents, options = {}) {
	const canJoinSourceComponents = typeof options.canJoinSourceComponents === 'function'
		? options.canJoinSourceComponents
		: () => true;
	const parentGroups = groupByLeafParent(sourceComponents, { canJoinSourceComponents });

	if (parentGroups.length > 0 && parentGroups.length < sourceComponents.length) {
		return parentGroups;
	}

	const centerOverlapGroups = groupByCenterOverlap(sourceComponents, { canJoinSourceComponents });

	if (centerOverlapGroups.length > 0 && centerOverlapGroups.length < sourceComponents.length) {
		return centerOverlapGroups;
	}

	const transformGroups = groupByTransformSignature(sourceComponents, { canJoinSourceComponents });

	if (transformGroups.length > 0 && transformGroups.length < sourceComponents.length) {
		return transformGroups;
	}

	return groupAnalogComponents(sourceComponents, {
		expandedGap: 0,
		groupByColor: false,
		canJoinComponents: canJoinSourceComponents,
	});
}

function groupSourceGroupsByColorHue(sourceGroups) {
	const byColorHue = new Map();

	for (const sourceGroup of sourceGroups) {
		const hue = colorHueKey(sourceGroup.dominantColor);

		if (!byColorHue.has(hue)) {
			byColorHue.set(hue, []);
		}

		byColorHue.get(hue).push(sourceGroup);
	}

	return [...byColorHue.values()];
}

function groupByLeafParent(sourceComponents, options = {}) {
	const canJoinSourceComponents = typeof options.canJoinSourceComponents === 'function'
		? options.canJoinSourceComponents
		: () => true;
	const byLeafParent = new Map();
	const ungrouped = [];

	for (const component of sourceComponents) {
		const parentGroupIds = component.parentGroupIds || [];
		const leafParentId = parentGroupIds[parentGroupIds.length - 1] || null;

		if (!leafParentId) {
			ungrouped.push(component);
			continue;
		}

		if (!byLeafParent.has(leafParentId)) {
			byLeafParent.set(leafParentId, []);
		}

		byLeafParent.get(leafParentId).push(component);
	}

	const groupedComponents = [...byLeafParent.values()]
		.filter((components) => components.length > 1)
		.flat();

	if (groupedComponents.length === 0 || (groupedComponents.length === sourceComponents.length && byLeafParent.size === 1)) {
		return [];
	}

	const groupedIds = new Set(groupedComponents.map((component) => component.componentId));
	const groups = [
		...[...byLeafParent.values()]
			.filter((components) => components.length > 1)
			.flatMap((components) => makeConstrainedGroups(components, canJoinSourceComponents)),
		...sourceComponents
			.filter((component) => !groupedIds.has(component.componentId) && (component.parentGroupIds || []).length > 0)
			.map((component) => makeGroup([component])),
		...ungrouped.map((component) => makeGroup([component])),
	];

	return groups.sort(compareByPosition);
}

function groupByTransformSignature(sourceComponents, options = {}) {
	const canJoinSourceComponents = typeof options.canJoinSourceComponents === 'function'
		? options.canJoinSourceComponents
		: () => true;
	const byTransform = new Map();
	const ungrouped = [];

	for (const component of sourceComponents) {
		const signature = transformSignature(component.transform);

		if (!signature) {
			ungrouped.push(component);
			continue;
		}

		if (!byTransform.has(signature)) {
			byTransform.set(signature, []);
		}

		byTransform.get(signature).push(component);
	}

	const groupedComponents = [...byTransform.values()]
		.filter((components) => components.length > 1)
		.flat();

	if (groupedComponents.length === 0 || (groupedComponents.length === sourceComponents.length && byTransform.size === 1)) {
		return [];
	}

	const groupedIds = new Set(groupedComponents.map((component) => component.componentId));
	const groups = [
		...[...byTransform.values()]
			.filter((components) => components.length > 1)
			.flatMap((components) => makeConstrainedGroups(components, canJoinSourceComponents)),
		...sourceComponents
			.filter((component) => !groupedIds.has(component.componentId) && transformSignature(component.transform))
			.map((component) => makeGroup([component])),
		...ungrouped.map((component) => makeGroup([component])),
	];

	return groups.sort(compareByPosition);
}

function groupByCenterOverlap(sourceComponents, options = {}) {
	const canJoinSourceComponents = typeof options.canJoinSourceComponents === 'function'
		? options.canJoinSourceComponents
		: () => true;
	const groups = [];

	for (const component of sourceComponents) {
		const componentBounds = component.bounds || component;
		const matchingGroups = groups.filter((group) => group.components.some((groupComponent) => (
			canJoinGroupComponent(group, component, canJoinSourceComponents)
			&&
			centersMutuallyOverlap(componentBounds, groupComponent.bounds || groupComponent)
		)));

		if (matchingGroups.length === 0) {
			groups.push(makeGroup([component]));
			continue;
		}

		const firstGroup = matchingGroups[0];
		firstGroup.components.push(component);
		refreshGroup(firstGroup);

		for (const otherGroup of matchingGroups.slice(1)) {
			if (!canJoinGroups(firstGroup, otherGroup, canJoinSourceComponents)) {
				continue;
			}
			firstGroup.components.push(...otherGroup.components);
			groups.splice(groups.indexOf(otherGroup), 1);
			refreshGroup(firstGroup);
		}
	}

	const groupedComponents = groups
		.filter((group) => group.components.length > 1)
		.flatMap((group) => group.components);

	if (groupedComponents.length === 0 || (groups.length === 1 && groupedComponents.length === sourceComponents.length)) {
		return [];
	}

	return groups.sort(compareByPosition);
}

function transformSignature(transform) {
	if (!transform) {
		return null;
	}

	return ['a', 'b', 'c', 'd', 'e', 'f']
		.map((key) => roundTransformValue(transform[key] ?? (key === 'a' || key === 'd' ? 1 : 0)))
		.join(',');
}

function roundTransformValue(value) {
	return Number.parseFloat(Number(value || 0).toFixed(4));
}

function completeSourceGroupsForReferenceParts(sourceGroups, referenceGroups) {
	if (sourceGroups.length <= referenceGroups.length || referenceGroups.length === 0) {
		return sourceGroups;
	}

	const sourceBounds = unionBounds(sourceGroups.map((group) => group.bounds));
	const referenceBounds = unionBounds(referenceGroups.map((group) => group.bounds));
	const positionBands = splitSourceGroupsByReferencePositionBands({
		sourceGroups,
		referenceGroups,
		sourceBounds,
		referenceBounds,
	});

	if (positionBands) {
		return positionBands;
	}

	const unassigned = [...sourceGroups];
	const assigned = referenceGroups.map(() => []);

	for (const [referenceIndex, referenceGroup] of referenceGroups.entries()) {
		const bestSeed = unassigned
			.map((sourceGroup) => ({
				sourceGroup,
				score: normalizedPositionDistance(sourceGroup, sourceBounds, referenceGroup, referenceBounds)
					+ (scoreMatchTransform(sourceGroup, referenceGroup) / 120),
			}))
			.sort((left, right) => left.score - right.score)[0];

		if (!bestSeed) {
			return sourceGroups;
		}

		assigned[referenceIndex].push(bestSeed.sourceGroup);
		unassigned.splice(unassigned.indexOf(bestSeed.sourceGroup), 1);
	}

	for (const sourceGroup of unassigned) {
		const bestTarget = referenceGroups
			.map((referenceGroup, referenceIndex) => {
				const currentGroup = makeGroup(assigned[referenceIndex].flatMap((group) => group.components));
				const mergedGroup = makeGroup([
					...currentGroup.components,
					...sourceGroup.components,
				]);

				return {
					referenceIndex,
					score: scoreMatchTransform(mergedGroup, referenceGroup)
						- scoreMatchTransform(currentGroup, referenceGroup)
						+ sourceJoinPenalty(currentGroup, sourceGroup)
						+ normalizedPositionDistance(sourceGroup, sourceBounds, referenceGroup, referenceBounds),
				};
			})
			.sort((left, right) => left.score - right.score)[0];

		assigned[bestTarget.referenceIndex].push(sourceGroup);
	}

	return assigned.map((groups) => makeGroup(groups.flatMap((group) => group.components)));
}

function splitSourceGroupsByReferencePositionBands({
	sourceGroups,
	referenceGroups,
	sourceBounds,
	referenceBounds,
}) {
	if (!sourceBounds || !referenceBounds || referenceGroups.length < 2) {
		return null;
	}

	const axis = dominantReferenceSeparationAxis(referenceGroups, referenceBounds);

	if (!axis) {
		return null;
	}

	const sortedReferenceGroups = [...referenceGroups].sort((left, right) => (
		normalizedCenterOnAxis(left.bounds, referenceBounds, axis)
		- normalizedCenterOnAxis(right.bounds, referenceBounds, axis)
	));
	const sortedSourceGroups = [...sourceGroups].sort((left, right) => (
		normalizedCenterOnAxis(left.bounds, sourceBounds, axis)
		- normalizedCenterOnAxis(right.bounds, sourceBounds, axis)
	));
	const thresholds = [];

	for (let index = 0; index < sortedReferenceGroups.length - 1; index += 1) {
		const leftCenter = normalizedCenterOnAxis(sortedReferenceGroups[index].bounds, referenceBounds, axis);
		const rightCenter = normalizedCenterOnAxis(sortedReferenceGroups[index + 1].bounds, referenceBounds, axis);

		thresholds.push((leftCenter + rightCenter) / 2);
	}

	const bySortedReferenceIndex = sortedReferenceGroups.map(() => []);

	for (const sourceGroup of sortedSourceGroups) {
		const sourceCenter = normalizedCenterOnAxis(sourceGroup.bounds, sourceBounds, axis);
		const sortedReferenceIndex = thresholds.findIndex((threshold) => sourceCenter < threshold);

		bySortedReferenceIndex[sortedReferenceIndex === -1 ? thresholds.length : sortedReferenceIndex].push(sourceGroup);
	}

	if (bySortedReferenceIndex.some((groups) => groups.length === 0)) {
		return null;
	}

	const originalIndexByReferenceGroup = new Map(referenceGroups.map((group, index) => [group, index]));
	const assigned = referenceGroups.map(() => null);

	for (const [sortedIndex, referenceGroup] of sortedReferenceGroups.entries()) {
		assigned[originalIndexByReferenceGroup.get(referenceGroup)] = makeGroup(bySortedReferenceIndex[sortedIndex]
			.flatMap((group) => group.components));
	}

	return assigned;
}

function dominantReferenceSeparationAxis(referenceGroups, referenceBounds) {
	const centers = referenceGroups.map((group) => ({
		x: normalizedCenterOnAxis(group.bounds, referenceBounds, 'x'),
		y: normalizedCenterOnAxis(group.bounds, referenceBounds, 'y'),
	}));
	const xSpread = spread(centers.map((center) => center.x));
	const ySpread = spread(centers.map((center) => center.y));

	if (ySpread >= xSpread * 1.5 && ySpread >= 0.25) {
		return 'y';
	}

	if (xSpread >= ySpread * 1.5 && xSpread >= 0.25) {
		return 'x';
	}

	return null;
}

function normalizedCenterOnAxis(bounds, containingBounds, axis) {
	const size = axis === 'x' ? containingBounds.width : containingBounds.height;
	const start = axis === 'x' ? containingBounds.left : containingBounds.top;
	const center = axis === 'x'
		? bounds.left + (bounds.width / 2)
		: bounds.top + (bounds.height / 2);

	return size > 0 ? (center - start) / size : 0.5;
}

function spread(values) {
	return Math.max(...values) - Math.min(...values);
}

function sourceJoinPenalty(currentGroup, sourceGroup) {
	if (!currentGroup?.components?.length || !sourceGroup?.components?.length) {
		return 0;
	}

	return currentGroup.components.reduce((bestPenalty, component) => (
		Math.min(bestPenalty, componentJoinPenalty(component, sourceGroup))
	), 0);
}

function componentJoinPenalty(component, sourceGroup) {
	const componentBounds = component.bounds || component;

	if (sourceGroup.components.some((otherComponent) => centersMutuallyOverlap(componentBounds, otherComponent.bounds || otherComponent))) {
		return -100;
	}

	if (boundsOverlap(componentBounds, sourceGroup.bounds)) {
		return -1;
	}

	return 0;
}

function centersMutuallyOverlap(left, right) {
	return pointInBounds(centerOfBounds(left), right)
		&& pointInBounds(centerOfBounds(right), left);
}

function centerOfBounds(bounds) {
	return {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};
}

function pointInBounds(point, bounds) {
	return point.x >= bounds.left
		&& point.x <= bounds.right
		&& point.y >= bounds.top
		&& point.y <= bounds.bottom;
}

function makeGroupingCandidate({
	expandedGap,
	sourceGroups,
	referenceGroups,
	strategy,
	ignoredSourceComponents = new Set(),
	ignoredReferenceComponents = new Set(),
	matchOptions = {},
}) {
	const countedSourceGroups = countedGroups(sourceGroups, ignoredSourceComponents);
	const countedReferenceGroups = countedGroups(referenceGroups, ignoredReferenceComponents);
	const matchResult = matchAnalogComponentGroups(countedSourceGroups, countedReferenceGroups, matchOptions);

	return {
		expandedGap,
		sourceGroups,
		referenceGroups,
		matchResult,
		score: scoreAnalogGrouping(countedSourceGroups, countedReferenceGroups, matchResult),
		strategy,
		ignoredSourceComponents,
		ignoredReferenceComponents,
		matchOptions,
	};
}

function optimizeSameColorGrouping(candidate) {
	if (candidate.matchOptions?.allowSameColorMerge === false) {
		return candidate;
	}

	const sourceCount = countedGroupCount(candidate.sourceGroups, candidate.ignoredSourceComponents);
	const referenceCount = countedGroupCount(candidate.referenceGroups, candidate.ignoredReferenceComponents);

	if (sourceCount === referenceCount) {
		return candidate;
	}

	let current = candidate;
	const mergeSides = sourceCount > referenceCount
		? ['source']
		: candidate.matchOptions?.allowReferenceRegroup === false
			? []
			: ['reference'];

	if (mergeSides.length === 0) {
		return candidate;
	}

	while (true) {
		const next = bestSameColorMergeCandidate(current, mergeSides);

		if (!next || next.score >= current.score) {
			return current;
		}

		current = next;
	}
}

function bestSameColorMergeCandidate(candidate, mergeSides) {
	return mergeSides
		.flatMap((side) => sameColorMergeCandidates(candidate, side))
		.sort((left, right) => left.score - right.score)[0] || null;
}

function sameColorMergeCandidates(candidate, side) {
	const groups = side === 'source' ? candidate.sourceGroups : candidate.referenceGroups;
	const otherGroups = side === 'source' ? candidate.referenceGroups : candidate.sourceGroups;
	const ignoredComponents = side === 'source' ? candidate.ignoredSourceComponents : candidate.ignoredReferenceComponents;
	const candidates = [];

	for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
			const left = groups[leftIndex];
			const right = groups[rightIndex];

			if (groupHasIgnoredComponent(left, ignoredComponents) || groupHasIgnoredComponent(right, ignoredComponents)) {
				continue;
			}

			if (!left.dominantColor || left.dominantColor !== right.dominantColor) {
				continue;
			}

			if (!sameColorGroupsCanMerge(left, right)) {
				continue;
			}

			const mergedGroups = mergeGroupPair(groups, leftIndex, rightIndex);
			const sourceGroups = side === 'source' ? mergedGroups : otherGroups;
			const referenceGroups = side === 'reference' ? mergedGroups : otherGroups;

			candidates.push(makeGroupingCandidate({
				expandedGap: candidate.expandedGap,
				sourceGroups,
				referenceGroups,
				strategy: `same-color-${side}-merge`,
				ignoredSourceComponents: candidate.ignoredSourceComponents,
				ignoredReferenceComponents: candidate.ignoredReferenceComponents,
				matchOptions: candidate.matchOptions,
			}));
		}
	}

	return candidates;
}

function sameColorGroupsCanMerge(left, right) {
	const expandedLeft = expandBounds(left.bounds, sameColorMergeTolerance(left, right));

	return rangesOverlap(expandedLeft.left, expandedLeft.right, right.bounds.left, right.bounds.right)
		|| rangesOverlap(expandedLeft.top, expandedLeft.bottom, right.bounds.top, right.bounds.bottom);
}

function sameColorMergeTolerance(left, right) {
	return Math.min(
		Math.max(left.bounds.width, right.bounds.width),
		Math.max(left.bounds.height, right.bounds.height),
	) * 0.35;
}

function mergeGroupPair(groups, leftIndex, rightIndex) {
	return groups
		.map((group, index) => {
			if (index === leftIndex) {
				return makeGroup([
					...groups[leftIndex].components,
					...groups[rightIndex].components,
				]);
			}

			return index === rightIndex ? null : group;
		})
		.filter(Boolean)
		.sort(compareByPosition);
}

function makeComponentSet(components) {
	return components instanceof Set
		? components
		: new Set(components || []);
}

function countedGroups(groups, ignoredComponents) {
	return groups.filter((group) => !groupHasIgnoredComponent(group, ignoredComponents));
}

function countedGroupCount(groups, ignoredComponents) {
	return countedGroups(groups, ignoredComponents).length;
}

function groupHasIgnoredComponent(group, ignoredComponents) {
	return group.components.some((component) => ignoredComponents.has(component));
}

export function matchAnalogComponentGroups(sourceGroups, referenceGroups, options = {}) {
	if (sourceGroups.length === referenceGroups.length) {
		return {
			matches: sourceGroups.map((sourceGroup, index) => ({
				sourceGroup,
				referenceGroup: referenceGroups[index],
			})),
			status: 'matched',
			message: null,
		};
	}

	const mergedSourceGroups = mergeSourceGroupsToReferenceCount(sourceGroups, referenceGroups);

	if (mergedSourceGroups.length === referenceGroups.length) {
		return {
			matches: mergedSourceGroups.map((sourceGroup, index) => ({
				sourceGroup,
				referenceGroup: referenceGroups[index],
			})),
			status: mergedSourceGroups.length === sourceGroups.length ? 'matched' : 'matched-merged-source',
			message: mergedSourceGroups.length === sourceGroups.length
				? null
				: `Merged ${sourceGroups.length} source fragments into ${mergedSourceGroups.length} analog groups.`,
		};
	}

	const regroupedReferenceGroups = options.allowReferenceRegroup === false
		? referenceGroups
		: regroupReferenceGroupsToSourceCount(sourceGroups, referenceGroups);

	if (regroupedReferenceGroups.length === sourceGroups.length) {
		return {
			matches: sourceGroups.map((sourceGroup, index) => ({
				sourceGroup,
				referenceGroup: regroupedReferenceGroups[index],
			})),
			status: regroupedReferenceGroups.length === referenceGroups.length ? 'matched' : 'matched-regrouped-reference',
			message: regroupedReferenceGroups.length === referenceGroups.length
				? null
				: `Regrouped ${referenceGroups.length} reference fragments into ${regroupedReferenceGroups.length} analog groups.`,
		};
	}

	if (sourceGroups.length !== referenceGroups.length) {
		return {
			matches: pairByNormalizedPosition(sourceGroups, referenceGroups),
			status: 'ambiguous-count',
			message: `Source/reference analog group count differs: ${sourceGroups.length} source, ${referenceGroups.length} reference.`,
		};
	}

	return {
		matches: sourceGroups.map((sourceGroup, index) => ({
			sourceGroup,
			referenceGroup: referenceGroups[index],
		})),
		status: 'matched',
		message: null,
	};
}

function scoreAnalogGrouping(sourceGroups, referenceGroups, matchResult) {
	const countPenalty = Math.abs(sourceGroups.length - referenceGroups.length) * 120;
	const groupingPenalty = groupingComplexityPenalty(sourceGroups)
		+ groupingComplexityPenalty(referenceGroups);
	const statusPenalty = matchResult.status === 'matched'
		? 0
		: matchResult.status === 'matched-merged-source'
			? 25
			: matchResult.status === 'matched-regrouped-reference'
				? 35
				: 80;
	const transformPenalty = matchResult.matches.reduce((total, match) => (
		total + scoreMatchTransform(match.sourceGroup, match.referenceGroup)
	), 0);

	return countPenalty + groupingPenalty + statusPenalty + transformPenalty;
}

function groupingComplexityPenalty(groups) {
	return groups.reduce((total, group) => (
		total + (Math.max(1, group.components.length) - 1) * 80
	), 0);
}

function scoreMatchTransform(sourceGroup, referenceGroup) {
	const sourceAspect = aspectRatio(sourceGroup.bounds);
	const referenceAspect = aspectRatio(referenceGroup.bounds);
	const aspectChange = Math.max(sourceAspect, referenceAspect) / Math.max(0.001, Math.min(sourceAspect, referenceAspect));
	const scaleX = referenceGroup.bounds.width / Math.max(0.001, sourceGroup.bounds.width);
	const scaleY = referenceGroup.bounds.height / Math.max(0.001, sourceGroup.bounds.height);
	const scaleSkew = Math.max(scaleX, scaleY) / Math.max(0.001, Math.min(scaleX, scaleY));
	const sourceComponentCount = Math.max(1, sourceGroup.components.length);
	const referenceComponentCount = Math.max(1, referenceGroup.components.length);
	const componentCountChange = Math.max(sourceComponentCount, referenceComponentCount) / Math.min(sourceComponentCount, referenceComponentCount);

	return ((aspectChange - 1) * 35)
		+ ((scaleSkew - 1) * 35)
		+ ((componentCountChange - 1) * 15);
}

function aspectRatio(bounds) {
	return bounds.width / Math.max(0.001, bounds.height);
}

export function compareByPosition(left, right) {
	return left.center.y - right.center.y || left.center.x - right.center.x;
}

function pairByNormalizedPosition(sourceGroups, referenceGroups) {
	const sourceBounds = unionBounds(sourceGroups.map((group) => group.bounds));
	const referenceBounds = unionBounds(referenceGroups.map((group) => group.bounds));
	const unmatched = [...sourceGroups];
	const matches = [];

	for (const referenceGroup of referenceGroups) {
		const referencePoint = normalizedCenter(referenceGroup, referenceBounds);
		const closest = unmatched
			.map((sourceGroup) => ({
				sourceGroup,
				distance: distance(referencePoint, normalizedCenter(sourceGroup, sourceBounds)),
			}))
			.sort((left, right) => left.distance - right.distance)[0];

		if (!closest) {
			break;
		}

		matches.push({ sourceGroup: closest.sourceGroup, referenceGroup });
		unmatched.splice(unmatched.indexOf(closest.sourceGroup), 1);
	}

	return matches;
}

function makeGroup(components) {
	const group = { components, bounds: null, center: null };
	refreshGroup(group);
	return group;
}

function refreshGroup(group) {
	group.bounds = unionBounds(group.components.map((component) => component.bounds || component));
	group.center = {
		x: (group.bounds.left + group.bounds.right) / 2,
		y: (group.bounds.top + group.bounds.bottom) / 2,
	};
	group.dominantColor = dominantGroupColor(group.components);
	group.partIds = uniqueValues(group.components.flatMap((component) => component.partIds || []));
	group.globalPartIds = uniqueValues(group.components.flatMap((component) => component.globalPartIds || []));
	group.semanticRoles = uniqueValues(group.components.flatMap((component) => component.semanticRoles || []));
}

function unionBounds(boundsList) {
	const validBounds = boundsList.filter(Boolean);

	if (validBounds.length === 0) {
		return null;
	}

	const left = Math.min(...validBounds.map((bounds) => bounds.left));
	const top = Math.min(...validBounds.map((bounds) => bounds.top));
	const right = Math.max(...validBounds.map((bounds) => bounds.right));
	const bottom = Math.max(...validBounds.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function boundsOverlap(left, right) {
	return left.left <= right.right
		&& left.right >= right.left
		&& left.top <= right.bottom
		&& left.bottom >= right.top;
}

function boundsArea(bounds) {
	return Math.max(0, bounds?.width || 0) * Math.max(0, bounds?.height || 0);
}

function rangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
	return leftStart <= rightEnd && leftEnd >= rightStart;
}

function expandBounds(bounds, amount) {
	return {
		left: bounds.left - amount,
		top: bounds.top - amount,
		right: bounds.right + amount,
		bottom: bounds.bottom + amount,
	};
}

function normalizedCenter(group, outerBounds) {
	return {
		x: (group.center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (group.center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
}

function normalizedPositionDistance(sourceGroup, sourceBounds, referenceGroup, referenceBounds) {
	return distance(
		normalizedCenter(sourceGroup, sourceBounds),
		normalizedCenter(referenceGroup, referenceBounds),
	);
}

function distance(left, right) {
	return Math.hypot(left.x - right.x, left.y - right.y);
}

function regroupReferenceGroupsToSourceCount(sourceGroups, referenceGroups) {
	if (referenceGroups.length <= sourceGroups.length || sourceGroups.length === 0) {
		return referenceGroups;
	}

	const mergedByColorAndRows = mergeReferenceGroupsByColorAndRows(referenceGroups, sourceGroups.length);

	if (mergedByColorAndRows.length === sourceGroups.length) {
		return mergedByColorAndRows;
	}

	return mergeReferenceGroupsByRowBands(referenceGroups, sourceGroups);
}

function mergeSourceGroupsToReferenceCount(sourceGroups, referenceGroups) {
	if (sourceGroups.length <= referenceGroups.length || referenceGroups.length === 0) {
		return sourceGroups;
	}

	const sourceBounds = unionBounds(sourceGroups.map((group) => group.bounds));
	const referenceBounds = unionBounds(referenceGroups.map((group) => group.bounds));
	const assigned = referenceGroups.map(() => []);

	for (const sourceGroup of sourceGroups) {
		const sourcePoint = normalizedCenter(sourceGroup, sourceBounds);
		const closestIndex = referenceGroups
			.map((referenceGroup, index) => ({
				index,
				distance: distance(sourcePoint, normalizedCenter(referenceGroup, referenceBounds)),
			}))
			.sort((left, right) => left.distance - right.distance)[0]?.index;

		if (closestIndex != null) {
			assigned[closestIndex].push(sourceGroup);
		}
	}

	if (assigned.some((groups) => groups.length === 0)) {
		return sourceGroups;
	}

	return assigned.map((groups) => makeGroup(groups.flatMap((group) => group.components)));
}

function mergeReferenceGroupsByColorAndRows(referenceGroups, targetCount) {
	const colorRuns = [];

	for (const group of referenceGroups) {
		const previous = colorRuns[colorRuns.length - 1];

		if (previous && previous.color === group.dominantColor) {
			previous.groups.push(group);
		} else {
			colorRuns.push({
				color: group.dominantColor,
				groups: [group],
			});
		}
	}

	if (colorRuns.length !== targetCount) {
		return referenceGroups;
	}

	return colorRuns.map((run) => makeGroup(run.groups.flatMap((group) => group.components)));
}

function mergeReferenceGroupsByRowBands(referenceGroups, sourceGroups) {
	const sourceBounds = unionBounds(sourceGroups.map((group) => group.bounds));
	const referenceBounds = unionBounds(referenceGroups.map((group) => group.bounds));
	const sourceBands = sourceGroups
		.map((group) => ({
			group,
			top: normalizeValue(group.bounds.top, sourceBounds.top, sourceBounds.height),
			bottom: normalizeValue(group.bounds.bottom, sourceBounds.top, sourceBounds.height),
		}))
		.sort((left, right) => left.top - right.top);
	const assigned = sourceBands.map(() => []);

	for (const referenceGroup of referenceGroups) {
		const centerY = normalizeValue(referenceGroup.center.y, referenceBounds.top, referenceBounds.height);
		const closestIndex = sourceBands
			.map((band, index) => ({
				index,
				distance: centerY < band.top
					? band.top - centerY
					: centerY > band.bottom
						? centerY - band.bottom
						: 0,
			}))
			.sort((left, right) => left.distance - right.distance)[0].index;
		assigned[closestIndex].push(referenceGroup);
	}

	if (assigned.some((groups) => groups.length === 0)) {
		return referenceGroups;
	}

	return assigned.map((groups) => makeGroup(groups.flatMap((group) => group.components)));
}

function normalizeValue(value, origin, span) {
	return (value - origin) / Math.max(1, span);
}

function dominantGroupColor(components) {
	const counts = new Map();

	for (const component of components) {
		const color = componentColor(component);

		if (!color) {
			continue;
		}

		counts.set(color, (counts.get(color) || 0) + (component.pixels || component.area || 1));
	}

	return [...counts.entries()]
		.sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function uniqueValues(values) {
	return [...new Set(values.filter(Boolean))];
}

function componentColor(component) {
	return component.dominantColor || component.fill || component.stroke || null;
}

function colorHueKey(color) {
	const rgb = parseColor(color);

	if (!rgb) {
		return 'unknown';
	}

	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const min = Math.min(rgb.r, rgb.g, rgb.b);
	const chroma = max - min;
	const luminance = ((0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b)) / 255;
	const saturation = max === 0 ? 0 : chroma / max;

	if (luminance <= 0.28 && saturation <= 0.75) {
		return 'dark-neutral';
	}

	return `hue-${Math.round(rgbToHue(rgb) / 45)}`;
}

function parseColor(color) {
	const value = String(color || '').trim().toLowerCase();

	if (value === 'black') {
		return { r: 0, g: 0, b: 0 };
	}

	const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);

	if (!hex) {
		return null;
	}

	const digits = hex[1].length === 3
		? hex[1].split('').map((digit) => `${digit}${digit}`).join('')
		: hex[1];

	return {
		r: Number.parseInt(digits.slice(0, 2), 16),
		g: Number.parseInt(digits.slice(2, 4), 16),
		b: Number.parseInt(digits.slice(4, 6), 16),
	};
}

function rgbToHue({ r, g, b }) {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const delta = max - min;

	if (delta === 0) {
		return 0;
	}

	if (max === rn) {
		return (60 * (((gn - bn) / delta) % 6) + 360) % 360;
	}

	if (max === gn) {
		return 60 * (((bn - rn) / delta) + 2);
	}

	return 60 * (((rn - gn) / delta) + 4);
}

