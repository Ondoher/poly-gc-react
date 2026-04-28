/**
 * Provides the filesystem operations used by source normalization.
 */
type SourceNormalizationFileSystem = {
	/** Checks whether a file can be accessed. */
	access(filePath: string): Promise<void>;
	/** Reads a UTF-8 text file. */
	readFile(filePath: string, encoding: string): Promise<string>;
	/** Writes a text file with an explicit encoding. */
	writeFile(filePath: string, content: string, encoding: string): Promise<void>;
	/** Creates a directory, usually recursively. */
	mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
};

/**
 * Extracts source SVG visual components for normalization.
 */
type SourceNormalizationExtractComponents = (
	/** Source SVG text. */
	svgSource: string,
	/** Extractor options used by normalization. */
	options: {
		/** Whether compound paths should be split into island subcomponents. */
		splitCompoundPaths: boolean;
		/** Optional OpenType font instance used to convert text nodes into path geometry. */
		textFont?: unknown;
		/** Optional font path used to convert text nodes into path geometry. */
		textFontPath?: string;
	},
) => SourceComponentExtraction;

/**
 * Describes suit-level output settings written into tileset pipeline state.
 */
type TilesetSuitOutputOptions = {
	/** Suit/family key these options apply to. */
	suitId: string;
	/** Optional output part settings keyed by part id. */
	parts?: Record<string, {
		/** Optional part id. */
		partId: string;
		/** Semantic content kind. */
		contentKind: string;
		/** Semantic role. */
		role: string;
		/** Whether this optional part should appear in final output. */
		outputPresent: boolean;
		/** Provenance for the option value. */
		source: string;
		/** Review status for the option value. */
		reviewStatus: string;
	}>;
	/** Optional suit-wide layout settings. */
	layout?: {
		/** Layout scaling mode to apply in final rendering. */
		scaleMode?: string;
	};
	/** Optional suit-wide color settings. */
	color?: Record<string, unknown>;
	/** Optional face artwork settings, used only for face-level freeform artwork output. */
	artwork?: {
		/** Mirror eligible freeform artwork horizontally during final rendering. */
		mirrorX?: boolean;
	};
};

/**
 * Configures a source normalization runner instance.
 */
type SourceNormalizationRunnerDependencies = {
	/** Filesystem implementation used for reads, writes, existence checks, and mkdir. */
	fileSystem?: SourceNormalizationFileSystem;
	/** Path module implementation, normally Node's `path`. */
	pathModule?: typeof import('path');
	/** Repository root used for relative artifact paths and source SVG resolution. */
	rootDir?: string;
	/** Root 3D output directory for source normalization artifacts. */
	output3dDir?: string;
	/** Component extractor used to decompose each source SVG. */
	extractComponents?: SourceNormalizationExtractComponents;
	/** Clock used to stamp generated artifacts and in-memory summaries. */
	clock?: () => string;
};

/**
 * Describes one source normalization run.
 */
type SourceNormalizationRunOptions = {
	/** Canonical tileset pipeline state JSON. Defaults from the tileset id. */
	pipelineStatePath?: string;
	/** Tileset id override. Defaults to pipeline state `tilesetId`, then `wiki`. */
	tilesetId?: string | null;
	/** Optional single face key to normalize. */
	faceKey?: string | null;
};

/**
 * Summarizes a completed normalization run for CLI output.
 */
type SourceNormalizationSummary = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Number of canonical faces processed. */
	faceCount: number;
	/** Single requested face key, or null for a full run. */
	faceKey: string | null;
	/** Total normalized component count. */
	componentCount: number;
	/** Total downstream alignment component count. */
	alignmentComponentCount: number;
	/** Total source shape count. */
	shapeCount: number;
	/** Total downstream alignment shape count. */
	alignmentShapeCount: number;
	/** Repository-relative normalized components directory. */
	componentsDir: string;
	/** Number of in-memory summary warnings. */
	warningCount: number;
};

/**
 * Provides values for creating the report shell.
 */
type SourceNormalizationCreateReportOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Absolute canonical pipeline state path. */
	pipelineStatePath: string;
	/** Single requested face key, or null for a full run. */
	requestedFaceKey: string | null;
	/** Sorted face entries selected from the pipeline state. */
	faceEntries: Array<[string, PipelineFaceState]>;
};

/**
 * Provides context for processing one face from the canonical pipeline state.
 */
type SourceNormalizationProcessFaceOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being normalized. */
	faceKey: string;
	/** Canonical state entry for the face. */
	faceState: PipelineFaceState;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Absolute directory for normalized component JSON artifacts. */
	componentsDir: string;
	/** Absolute directory for identified component debug SVGs. */
	identifiedSvgsDir: string;
	/** Absolute directory for identified shape debug SVGs. */
	identifiedShapesSvgsDir: string;
	/** Report object that accumulates per-face results. */
	report: SourceNormalizationReport;
};

/**
 * Provides context for recording a missing source file.
 */
type SourceNormalizationMissingSourceOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key whose source is missing. */
	faceKey: string;
	/** Expected absolute source path, or null if face state lacks one. */
	sourceFile: string | null;
	/** Canonical state entry for the face, if available. */
	faceState?: PipelineFaceState | null;
	/** ISO timestamp for generated state. */
	generatedOn: string;
	/** Report object that receives the warning and face status. */
	report: SourceNormalizationReport;
};

/**
 * Provides extracted face data for artifact construction.
 */
type SourceNormalizationArtifactOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key that owns the artifact. */
	faceKey: string;
	/** Absolute source SVG path. */
	sourceFile: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Extracted visual component data. */
	extracted: SourceComponentExtraction;
	/** Canonical face state whose configuration metadata should be copied into the artifact. */
	faceState?: PipelineFaceState | null;
};

/**
 * Describes the canonical pipeline state slice needed by source normalization.
 */
type PipelineFaceState = {
	/** Mutable per-face domain state. */
	state?: {
		components?: Record<string, SourceNormalizedComponent>;
		shapes?: Record<string, SourceShape>;
		parts?: Record<string, unknown>;
		bindings?: Record<string, unknown>;
	};
	/** Stage-owned artifact pointers for this face. */
	artifacts?: {
		sourceSvg?: string | null;
		normalizedComponents?: string | null;
		identifiedComponentsSvg?: string | null;
		identifiedShapesSvg?: string | null;
	};
	/** Face-local configuration copied into normalized artifacts when present. */
	configuration?: {
		sourceMetadata?: SourceIntakeMetadata;
	};
};

/**
 * Describes one face entry from a source manifest.
 */
type SourceManifestFace = {
	/** Preferred source or generated SVG path. */
	output?: string;
	/** Fallback source SVG path. */
	source?: string;
	/** Source intake metadata consumed by later preprocessing stages. */
	sourceMetadata?: SourceIntakeMetadata;
};

/**
 * Describes the explicit source SVG manifest shape consumed during tileset
 * intake.
 */
type SourceSvgManifest = {
	/** Optional manifest tileset id used to verify the requested tileset id. */
	sheetId?: string;
	/** Global source SVG annotation hints applied to copied source files. */
	sourceSvgHints?: SourceSvgIntakeHints;
	/** Per-face source entries keyed by canonical face key. */
	faces?: Record<string, SourceSvgManifestFace>;
};

/**
 * Describes one face entry in a source SVG manifest.
 */
type SourceSvgManifestFace = SourceManifestFace & {
	/** Original source SVG path to copy and annotate before intake. */
	source?: string;
	/** Intaken per-face source SVG path recorded on the canonical face. */
	output: string;
	/** Source viewBox or crop bounds recorded on the intake stage. */
	viewBox?: SourceBounds | SourceViewBox | null;
	/** Face-local source SVG annotation hints. */
	sourceSvgHints?: SourceSvgIntakeHints;
	/** Source sprite-sheet group id when the manifest was generated from a sheet. */
	sourceGroupId?: string;
};

/**
 * Describes source SVG annotation hints used by intake to mark known source
 * layers before normalization.
 */
type SourceSvgIntakeHints = {
	/** SVG group ids that should receive `data-source-layer="tile-background"`. */
	tileBackgroundGroupIds?: string[];
	/** SVG element ids that should receive `data-source-layer="tile-background"`. */
	tileBackgroundElementIds?: string[];
};

/**
 * Describes the source pipeline bootstrap document before a concrete tileset
 * id and source manifest are applied.
 */
type SourcePipelineBootstrapDocument = {
	/** Bootstrap schema version. */
	schemaVersion: number;
	/** Stable bootstrap id. */
	bootstrapId?: string;
	/** Human-readable bootstrap name. */
	name?: string;
	/** Source-side search, expectation, and stage configuration defaults. */
	configuration?: Record<string, unknown>;
	/** Final rendering defaults and overrides copied into tileset state. */
	rendering?: Record<string, unknown>;
	/** Source SVG pipeline bootstrap data. */
	svgPipeline?: {
		/** Canonical face records keyed by face key. */
		faces?: Record<string, PipelineFaceState>;
	};
	/** Generated asset pipeline bootstrap data. */
	assetPipeline?: {
		/** Asset pipeline schema version. */
		schemaVersion?: number;
		/** Generated asset face records keyed by face key. */
		faces?: Record<string, unknown>;
	};
	/** Bootstrap-level artifact pointers, usually empty before intake. */
	artifacts?: Record<string, unknown>;
};

/**
 * Describes the canonical mutable tileset state document written as
 * `tileset.json`.
 */
type CanonicalTilesetState = SourcePipelineBootstrapDocument & {
	/** Canonical source tileset id. */
	tilesetId: string;
	/** ISO timestamp when this canonical state was initially generated. */
	generatedOn?: string;
	/** ISO timestamp when this canonical state was last updated. */
	updatedOn?: string;
	/** Canonical top-level artifact pointers for the tileset. */
	artifacts: Record<string, unknown>;
	/** Source SVG pipeline state, keyed by canonical face key. */
	svgPipeline: {
		/** Source-side face records keyed by face key. */
		faces: Record<string, PipelineFaceState>;
	};
};

/**
 * Provides the inputs used to build initial canonical tileset state from an
 * explicit source SVG manifest.
 */
type PipelineBootstrapOptions = {
	/** Source pipeline bootstrap JSON cloned into the new `tileset.json`. */
	bootstrap: SourcePipelineBootstrapDocument;
	/** Source manifest whose face entries point to intaken per-face source SVGs. */
	manifest: SourceSvgManifest;
	/** Absolute source manifest path recorded in top-level `artifacts.sourceManifest`. */
	manifestPath: string;
	/** Absolute output path for the generated canonical `tileset.json`. */
	pipelineStatePath: string;
	/** Canonical source tileset id being intaken. */
	tilesetId: string;
	/** ISO timestamp used for initial stage and lifecycle stamps. */
	generatedOn: string;
};

/**
 * Provides the inputs used to build initial canonical tileset state from a
 * sprite-sheet extraction manifest.
 */
type SpriteSheetPipelineStateBootstrapOptions = {
	/** Source pipeline bootstrap JSON cloned into the new `tileset.json`. */
	bootstrap: SourcePipelineBootstrapDocument;
	/** Generated source manifest for extracted per-face SVGs. */
	manifest: SourceSvgManifest;
	/** Absolute generated manifest path recorded in top-level `artifacts.sourceManifest`. */
	manifestPath: string;
	/** Absolute output path for the generated canonical `tileset.json`. */
	pipelineStatePath: string;
	/** Absolute source sprite-sheet SVG path recorded in top-level `artifacts.sourceSpriteSheet`. */
	sourcePath: string;
	/** Canonical source tileset id created from the sprite sheet. */
	sheetId: string;
	/** ISO timestamp used for initial stage and lifecycle stamps. */
	generatedOn: string;
};

/**
 * Describes source-intake metadata copied from a manifest face to normalized artifacts.
 */
type SourceIntakeMetadata = {
	/** Suit-level output options discovered or declared during source intake. */
	outputOptions?: Partial<TilesetSuitOutputOptions>;
	/** Explicit source parsing policy for optional source-controlled parts. */
	sourceParsing?: {
		/** Optional source parts to search for, keyed by part id or listed with partId. */
		optionalParts?: Record<string, SourceIntakeOptionalPart> | SourceIntakeOptionalPart[];
	};
	/** Explicit rendering policy for optional/rendered parts. */
	rendering?: {
		/** Rendered parts keyed by part id or listed with partId. */
		parts?: Record<string, SourceIntakeRenderPart> | SourceIntakeRenderPart[];
	};
};

/**
 * Describes one optional source-controlled part declared during source intake.
 */
type SourceIntakeOptionalPart = {
	/** Stage-local part id, required when the part is listed in an array. */
	partId?: string;
	/** Semantic content kind such as label or glyph. */
	contentKind?: string;
	/** Semantic role expected for the optional source part. */
	role?: string;
	/** Expected source region used by optional-part candidate scoring. */
	region?: string;
	/** Metadata seed key used for legacy glyph layout output. */
	metadataKey?: string;
	/** Whether source intake expects this part to be included from source components. */
	searchSource?: boolean;
};

/**
 * Describes one rendered part policy declared during source intake.
 */
type SourceIntakeRenderPart = {
	/** Stage-local part id, required when the part is listed in an array. */
	partId?: string;
	/** Semantic content kind such as label or glyph. */
	contentKind?: string;
	/** Semantic role expected for the rendered part. */
	role?: string;
	/** Rendering source policy such as generated, source-preferred, or default-on. */
	source?: string;
	/** Whether final output should include this part. */
	outputPresent?: boolean;
};

/**
 * Describes raw component extraction output for one source SVG.
 */
type SourceComponentExtraction = {
	/** Source viewBox in source coordinate space. */
	viewBox?: SourceViewBox | null;
	/** Extracted visual components. */
	components: SourceExtractedComponent[];
	/** Source group ids represented by extracted components. */
	groups?: string[];
};

/**
 * Describes an SVG viewBox or bounds-like viewport.
 */
type SourceViewBox = {
	/** ViewBox minimum x value. */
	minX?: number;
	/** ViewBox minimum y value. */
	minY?: number;
	/** Bounds-style left value used by fallback rendering. */
	left?: number;
	/** Bounds-style top value used by fallback rendering. */
	top?: number;
	/** ViewBox width. */
	width: number;
	/** ViewBox height. */
	height: number;
};

/**
 * Describes component bounds in source coordinate space.
 */
type SourceBounds = {
	/** Left x coordinate. */
	left: number;
	/** Top y coordinate. */
	top: number;
	/** Right x coordinate. */
	right: number;
	/** Bottom y coordinate. */
	bottom: number;
	/** Bounds width. */
	width: number;
	/** Bounds height. */
	height: number;
	/** Optional bounds area. */
	area?: number;
	/** Optional bounds center point. */
	center?: {
		/** Center x coordinate. */
		x: number;
		/** Center y coordinate. */
		y: number;
	};
};

/**
 * Describes an SVG affine transform matrix.
 */
type SourceMatrix = {
	/** Matrix a value. */
	a?: number;
	/** Matrix b value. */
	b?: number;
	/** Matrix c value. */
	c?: number;
	/** Matrix d value. */
	d?: number;
	/** Matrix e translation value. */
	e?: number;
	/** Matrix f translation value. */
	f?: number;
};

/**
 * Describes a component emitted by source SVG extraction.
 */
type SourceExtractedComponent = {
	/** Source element id when available. */
	id?: string | null;
	/** Source SVG tag name. */
	tagName?: string;
	/** Source class name after inheritance. */
	className?: string | null;
	/** Normalized fill paint. */
	fill?: string | null;
	/** Normalized stroke paint. */
	stroke?: string | null;
	/** Stroke width from source attributes or styles. */
	strokeWidth?: string | number | null;
	/** Fill rule from source attributes or styles. */
	fillRule?: string | null;
	/** Opacity from source attributes or styles. */
	opacity?: string | number | null;
	/** Text content when this component was converted from an SVG text element. */
	textValue?: string | null;
	/** Font size used when converting an SVG text element into path geometry. */
	fontSize?: number | null;
	/** Source font family hint when available on an SVG text element. */
	fontFamily?: string | null;
	/** Font file used when converting an SVG text element into path geometry. */
	fontPath?: string | null;
	/** Component bounds in source coordinate space. */
	bounds: SourceBounds;
	/** Component center in source coordinate space. */
	center?: {
		/** Center x coordinate. */
		x: number;
		/** Center y coordinate. */
		y: number;
	};
	/** Component area. */
	area?: number;
	/** Source group ancestry ids. */
	parentGroupIds?: string[];
	/** Intake-authored source-layer roles inherited from SVG group hints. */
	sourceLayerRoles?: string[];
	/** Component transform matrix. */
	transform?: SourceMatrix | null;
	/** Source extraction index. */
	sourceIndex?: number;
	/** Original source element index. */
	sourceElementIndex?: number;
	/** Subcomponent index when split from a compound path. */
	subcomponentIndex?: number | null;
	/** Component granularity level. */
	componentLevel?: string;
	/** Strategy used to split or preserve the source element. */
	splitStrategy?: string;
	/** Original source element text. */
	sourceElement?: string;
	/** Component SVG path data. */
	pathData?: string;
	/** True when the component looks like tile/background chrome. */
	tileLayerCandidate?: boolean;
	/** True when the component looks like negative-space/cutout geometry. */
	negativeSpaceCandidate?: boolean;
};

/**
 * Describes a normalized component written to stage artifacts.
 */
type SourceNormalizedComponent = {
	/** Stable normalized component id. */
	componentId: string;
	/** Source extraction index. */
	sourceIndex: number;
	/** Original source element index. */
	sourceElementIndex: number;
	/** Stable id for the original source element. */
	sourceElementComponentId: string;
	/** Parent source element component id for subcomponents. */
	parentComponentId: string | null;
	/** Subcomponent index when split from a compound path. */
	subcomponentIndex: number | null;
	/** Component granularity level. */
	componentLevel: string;
	/** Strategy used to split or preserve the source element. */
	splitStrategy: string;
	/** Original source element id when available. */
	sourceElementId: string | null;
	/** Source SVG tag name. */
	tagName?: string;
	/** Source class name after inheritance. */
	className?: string | null;
	/** Normalized fill paint. */
	fill?: string | null;
	/** Normalized stroke paint. */
	stroke?: string | null;
	/** Stroke width from source attributes or styles. */
	strokeWidth?: string | number | null;
	/** Fill rule from source attributes or styles. */
	fillRule?: string | null;
	/** Opacity from source attributes or styles. */
	opacity?: string | number | null;
	/** Text content when this component was converted from an SVG text element. */
	textValue?: string | null;
	/** Font size used when converting an SVG text element into path geometry. */
	fontSize?: number | null;
	/** Source font family hint when available on an SVG text element. */
	fontFamily?: string | null;
	/** Font file used when converting an SVG text element into path geometry. */
	fontPath?: string | null;
	/** Component bounds in source coordinate space. */
	bounds: SourceBounds;
	/** Component center in source coordinate space. */
	center?: {
		/** Center x coordinate. */
		x: number;
		/** Center y coordinate. */
		y: number;
	};
	/** Component area. */
	area?: number;
	/** Source group ancestry ids. */
	parentGroupIds: string[];
	/** Intake-authored source-layer roles inherited from SVG group hints. */
	sourceLayerRoles?: string[];
	/** Component transform matrix. */
	transform?: SourceMatrix | null;
	/** Non-semantic classification flags used by downstream stages. */
	classification: {
		/** True when the component looks like tile/background chrome. */
		tileLayerCandidate: boolean;
		/** True when the component looks like negative-space/cutout geometry. */
		negativeSpaceCandidate: boolean;
	};
	/** Original source element text. */
	sourceElement?: string;
	/** Component SVG path data. */
	pathData?: string;
	/** Expected-label OCR evidence for this component, if it was scoreable. */
	labelOcr?: SourceLabelOcrEvidence | null;
};

/**
 * Describes one loaded label OCR template.
 */
type SourceLabelOcrTemplate = {
	/** Stable OCR template id. */
	templateId: string;
	/** Template filename. */
	file: string;
	/** Per-pixel darkness values in 0..1. */
	darkness: number[];
};

/**
 * Describes one label OCR pixel score.
 */
type SourceLabelOcrScore = {
	/** Stable OCR template id. */
	templateId: string;
	/** Mean absolute per-pixel darkness difference; lower is better. */
	pixelMeanAbsoluteError: number;
	/** Average candidate darkness. */
	candidateDarkness: number;
	/** Average template darkness. */
	templateDarkness: number;
};

/**
 * Describes expected-label OCR evidence attached during normalization.
 */
type SourceLabelOcrEvidence = {
	/** Evidence source id. */
	source: 'label-ocr-template' | string;
	/** Component or shape id that was scored. */
	sourceId: string;
	/** Component ids represented by this score. */
	componentIds: string[];
	/** Expected face label used for scoring. */
	expectedLabel: string;
	/** Best matching template id. */
	templateId: string;
	/** Mean absolute per-pixel darkness difference; lower is better. */
	pixelMeanAbsoluteError: number;
	/** Average candidate darkness. */
	candidateDarkness: number;
	/** Average template darkness. */
	templateDarkness: number;
	/** Match threshold used when the evidence was generated. */
	threshold: number;
	/** Whether the score is inside the match threshold. */
	match: boolean;
	/** Candidate max dimension as a ratio of source width. */
	maxDimensionRatioToSourceWidth?: number;
};

/**
 * Describes inputs for source label OCR scoring.
 */
type SourceLabelOcrEvidenceOptions = {
	/** Normalized artifact that owns the components. */
	artifact: SourceNormalizedFaceArtifact;
	/** Expected face label. */
	expectedLabel: string;
	/** Candidate templates for the expected label. */
	templates: SourceLabelOcrTemplate[];
	/** Components to render and score together. */
	components: SourceNormalizedComponent[];
	/** Component or shape id being scored. */
	sourceId: string;
};

/**
 * Describes a normalization diagnostic.
 */
type SourceNormalizationDiagnostic = {
	/** Diagnostic severity. */
	level: 'warning' | 'info' | string;
	/** Stable diagnostic code. */
	code: string;
	/** Human-readable diagnostic message. */
	message?: string;
};

/**
 * Describes the normalized face artifact written for one face.
 */
type SourceNormalizedFaceArtifact = {
	/** Artifact schema version. */
	schemaVersion: number;
	/** Tileset id that owns the face. */
	tilesetId: string;
	/** Face key that owns the artifact. */
	faceKey: string;
	/** ISO timestamp for artifact generation. */
	generatedOn: string;
	/** Repository-relative source SVG path. */
	sourceFile: string;
	/** Source intake metadata copied from the manifest. */
	sourceMetadata?: SourceIntakeMetadata;
	/** Source viewBox in source coordinate space. */
	viewBox?: SourceViewBox | null;
	/** Normalization status. */
	status: string;
	/** Total normalized component count. */
	componentCount: number;
	/** Total source shape count. */
	shapeCount: number;
	/** Component ids that remain eligible for downstream alignment. */
	alignmentComponentIds: string[];
	/** Source shape ids that remain eligible for downstream alignment. */
	alignmentShapeIds: string[];
	/** Union bounds of alignment components. */
	alignmentBounds: SourceBounds | null;
	/** Repository-relative identified component debug SVG path. */
	identifiedComponentsSvg: string | null;
	/** Repository-relative identified shape debug SVG path. */
	identifiedShapesSvg: string | null;
	/** Paint summary for report inspection. */
	paintSummary: SourcePaintSummaryEntry[];
	/** Source group ids represented by extracted components. */
	groups: string[];
	/** Normalization diagnostics. */
	diagnostics: SourceNormalizationDiagnostic[];
	/** Cohesive source-side shapes derived from normalized components. */
	sourceShapes: SourceShape[];
	/** Normalized component records. */
	components: SourceNormalizedComponent[];
};

/**
 * Describes a cohesive source-side visual shape.
 */
type SourceShape = {
	/** Stable source shape id. */
	shapeId: string;
	/** Source-order index used for stable sorting. */
	sourceOrder: number;
	/** Component ids contained by this shape. */
	componentIds: string[];
	/** Number of components contained by this shape. */
	componentCount: number;
	/** Primary source element component id for the shape. */
	sourceElementComponentId: string;
	/** All source element component ids represented by this shape. */
	sourceElementComponentIds: string[];
	/** Source SVG element ids represented by this shape. */
	sourceElementIds: string[];
	/** Source parent groups represented by this shape. */
	parentGroupIds: string[];
	/** Intake-authored source-layer roles represented by this shape. */
	sourceLayerRoles?: string[];
	/** Split strategies represented by this shape. */
	splitStrategies: string[];
	/** Reason these components form a shape. */
	cohesionReason: string;
	/** Whether downstream alignment may split this shape across source parts. */
	splittable: boolean;
	/** CSS class names represented by this shape. */
	classNames: string[];
	/** Fill paints represented by this shape. */
	fills: string[];
	/** Stroke paints represented by this shape. */
	strokes: string[];
	/** Dominant fill or stroke paint for the shape. */
	dominantColor: string | null;
	/** Union bounds of contained components. */
	bounds: SourceBounds | null;
	/** Center of the shape bounds. */
	center: SourcePoint | null;
	/** Sum of contained component areas. */
	area: number;
	/** Expected-label OCR evidence for this source shape, if it was scoreable. */
	labelOcr?: SourceLabelOcrEvidence | null;
	/** Aggregate source classification. */
	classification: {
		tileLayerCandidate: boolean;
		negativeSpaceCandidate: boolean;
	};
};

/**
 * Describes one paint summary hueShade.
 */
type SourcePaintSummaryEntry = {
	/** Source class name for the hueShade. */
	className?: string | null;
	/** Fill paint for the hueShade. */
	fill?: string | null;
	/** Stroke paint for the hueShade. */
	stroke?: string | null;
	/** Number of components in the hueShade. */
	count: number;
	/** Total component area in the hueShade. */
	totalArea: number;
};

/**
 * Describes a source normalization report.
 */
type SourceNormalizationReport = {
	/** Report schema version. */
	schemaVersion: number;
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** ISO timestamp for report generation. */
	generatedOn: string;
	/** Repository-relative canonical pipeline state path. */
	pipelineState: string;
	/** Single requested face key, or null for a full run. */
	faceKey: string | null;
	/** Number of selected faces. */
	faceCount: number;
	/** Total normalized component count. */
	componentCount: number;
	/** Total downstream alignment component count. */
	alignmentComponentCount: number;
	/** Total source shape count. */
	shapeCount: number;
	/** Total downstream alignment shape count. */
	alignmentShapeCount: number;
	/** Per-face report entries. */
	faces: Record<string, unknown>;
	/** Report warnings. */
	warnings: Array<{
		/** Warning code. */
		code: string;
		/** Face key associated with the warning. */
		faceKey: string;
		/** Repository-relative source path, or null when none was provided. */
		sourceFile: string | null;
	}>;
};

/**
 * Provides filesystem operations used by optional-part assignment.
 */
type OptionalPartAssignmentFileSystem = {
	/** Checks whether a file can be accessed. */
	access(filePath: string): Promise<void>;
	/** Reads a UTF-8 text file. */
	readFile(filePath: string, encoding: string): Promise<string>;
	/** Writes a text file with an explicit encoding. */
	writeFile(filePath: string, content: string, encoding: string): Promise<void>;
	/** Creates a directory, usually recursively. */
	mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
};

/**
 * Writes optional-part assignment status into tileset pipeline state.
 */
type OptionalPartAssignmentUpdateState = (update: OptionalPartTilesetPipelineStateUpdate) => void;

/**
 * Configures an optional-part assignment runner instance.
 */
type OptionalPartAssignmentRunnerDependencies = {
	/** Filesystem implementation used for reads, writes, existence checks, and mkdir. */
	fileSystem?: OptionalPartAssignmentFileSystem;
	/** Path module implementation, normally Node's `path`. */
	pathModule?: typeof import('path');
	/** Repository root used for relative artifact paths and pipeline-state artifact resolution. */
	rootDir?: string;
	/** Root 3D output directory for optional-part artifacts. */
	output3dDir?: string;
	/** Clock used to stamp generated artifacts and in-memory summaries. */
	clock?: () => string;
};

/**
 * Describes one optional-part assignment run.
 */
type OptionalPartAssignmentRunOptions = {
	/** Tileset id used for output scope. */
	tilesetId?: string | null;
	/** Canonical pipeline storage/model interface. */
	pipelineModel: PipelineModel;
	/** Optional single face key to assign. */
	faceKey?: string | null;
};

/**
 * Summarizes a completed optional-part assignment run for CLI output.
 */
type OptionalPartAssignmentSummary = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Number of faces processed. */
	faceCount: number;
	/** Total optional-part record count. */
	optionalPartCount: number;
	/** Total scored candidate count. */
	candidateCount: number;
	/** Total diagnostic count. */
	diagnosticCount: number;
	/** Total warning count including missing input warnings. */
	warningCount: number;
};

/**
 * Minimal PipelineModel surface consumed by executable runners.
 */
type PipelineModel = {
	/** Mutable canonical pipeline state. */
	pipelineState: Record<string, unknown>;
	/** Absolute model-owned output directory for the tileset. */
	pipelineDir: string;
	/** Returns the active tileset id. */
	getTilesetId(): string;
	/** Returns canonical face state entries. */
	getFaceEntries(): [string, PipelineFaceState][];
	/** Returns mutable optional-part assignment configuration. */
	getOptionalPartAssignmentConfig(): OptionalPartAssignmentConfig;
	/** Returns the normalized component artifact pointer for a face. */
	getNormalizedComponentsPath(faceKey: string): string | null;
	/** Applies functional optional-part assignment facts for one face. */
	applyOptionalPartAssignment(faceKey: string, assignment: {
		parts?: Record<string, Partial<PipelinePartState>>;
		bindings?: Record<string, Partial<PipelineBindingState>>;
	}): void;
	/** Persists canonical pipeline state. */
	save(options?: Record<string, unknown>): Promise<void>;
};

/**
 * Configures a final rendering composition runner instance.
 */
type FinalRenderingCompositionRunnerDependencies = {
	/** Filesystem implementation used for reads, writes, existence checks, and mkdir. */
	fileSystem?: OptionalPartAssignmentFileSystem & {
		/** Reads directory entries. */
		readdir(dirPath: string): Promise<string[]>;
	};
	/** Path module implementation, normally Node's `path`. */
	pathModule?: typeof import('path');
	/** Repository root used for relative artifact paths. */
	rootDir?: string;
	/** Root 3D output directory for final rendering artifacts. */
	output3dDir?: string;
	/** Clock used to stamp generated artifacts and in-memory summaries. */
	clock?: () => string;
};

/**
 * Describes one final rendering composition run.
 */
type FinalRenderingCompositionRunOptions = {
	/** Tileset id used for output scope. */
	tilesetId?: string | null;
	/** Optional single face key to compose. */
	faceKey?: string | null;
	/** Optional repository-relative or absolute canonical tileset JSON path. */
	pipelineStatePath?: string | null;
};

/**
 * Summarizes a completed final rendering composition run for CLI output.
 */
type FinalRenderingCompositionSummary = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Optional single face key that was composed. */
	faceKey: string | null;
	/** Number of faces processed. */
	faceCount: number;
	/** Total optional part count. */
	optionalPartCount: number;
	/** Optional parts rendered from source geometry. */
	sourceRenderCount: number;
	/** Optional parts rendered as generated output. */
	generatedRenderCount: number;
	/** Optional parts omitted from final output. */
	omittedRenderCount: number;
	/** Optional parts that need review before rendering. */
	unresolvedRenderCount: number;
	/** Total diagnostic count. */
	diagnosticCount: number;
	/** Total warning count including missing input warnings. */
	warningCount: number;
};

/**
 * Inputs used to build one final-rendering composition artifact.
 */
type FinalRenderingCompositionArtifactOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being composed. */
	faceKey: string;
	/** ISO timestamp for artifact generation. */
	generatedOn: string;
	/** Current source-side tileset state. */
	tilesetState: Record<string, unknown>;
	/** Repository-relative optional-part assignment path. */
	optionalAssignmentPath: string;
	/** Optional-part assignment artifact. */
	optionalAssignment: OptionalPartAssignmentArtifact;
	/** Repository-relative semantic-map path. */
	semanticMapPath: string;
	/** Source semantic-map artifact. */
	semanticMap: Record<string, unknown>;
	/** Repository-relative normalized-components path. */
	normalizedComponentsPath?: string | null;
	/** Repository-relative alignment-map path. */
	alignmentMapPath?: string | null;
	/** Repository-relative active reference-structure path. */
	referenceStructurePath?: string | null;
	/** Repository-relative SVG emitted by the addOptional step. */
	addOptionalSvgPath?: string | null;
	/** Repository-relative SVG emitted by the layout step. */
	layoutSvgPath?: string | null;
};

/**
 * Inputs used to render the addOptional intermediate SVG.
 */
type FinalRenderingAddOptionalSvgOptions = {
	/** Final rendering artifact that owns the addOptional decisions. */
	artifact: Record<string, unknown>;
	/** Normalized component artifact used as source-space geometry. */
	normalizedComponents: Record<string, unknown>;
};

/**
 * Inputs used to render the prepared-space layout intermediate SVG.
 */
type FinalRenderingLayoutStepOptions = {
	/** Final rendering artifact that owns addOptional and layout step records. */
	artifact: Record<string, unknown>;
	/** Normalized component artifact used as source geometry. */
	normalizedComponents: Record<string, unknown>;
	/** Alignment map containing candidate transforms into prepared space. */
	alignmentMap: Record<string, unknown>;
	/** Accepted source semantic assignments for the face. */
	semanticMap: Record<string, unknown>;
	/** Active reference structure containing per-part target bounds. */
	referenceStructure: Record<string, unknown>;
};

/**
 * Result of building one prepared-space layout step.
 */
type FinalRenderingLayoutStepResult = {
	/** Layout step record to persist under `steps.layout`. */
	step: Record<string, unknown>;
	/** Intermediate layout SVG source. */
	svg: string;
	/** Diagnostics emitted while laying out parts. */
	diagnostics: Array<Record<string, unknown>>;
};

/**
 * Stores a parsed RGB color as integer channels.
 */
type ColorPaletteRgbColor = [
	/** Red channel from 0 to 255. */
	number,
	/** Green channel from 0 to 255. */
	number,
	/** Blue channel from 0 to 255. */
	number,
];

/**
 * Maps a canonical hue center to ordered shade offsets.
 */
type ColorPaletteHueShadesByHue = Map<string, number[]>;

/**
 * Maps a canonical hue center to the number of unique source colors in that hue.
 */
type ColorPaletteColorCountByHue = Map<string, number>;

/**
 * Maps a stable source component palette key to its computed output paint.
 */
type ColorPaletteOutputPaintByKey = Map<string, string>;

/**
 * Configures one color palette instance.
 */
type ColorPaletteOptions = {
	/** Learned shade offsets keyed by canonical hue center. */
	hueShadesByHue?: ColorPaletteHueShadesByHue;
	/** Unique source color counts keyed by canonical hue center. */
	sourceColorCountByHue?: ColorPaletteColorCountByHue;
	/** Source-only shade offsets keyed by canonical hue center. */
	sourceHueShadesByHue?: ColorPaletteHueShadesByHue;
	/** Precomputed overlap output paints keyed by stable source component palette key. */
	overlapPaletteColors?: ColorPaletteOutputPaintByKey;
};

/**
 * Describes one source-to-target paint relationship used to learn palette shades.
 */
type ColorPaletteMapping = {
	/** Stable source component palette key, when this mapping should precompute an output paint. */
	key?: string;
	/** Optional semantic/rendered part id used by callers to group overlap evidence. */
	partId?: string;
	/** Source component paint before recoloring. */
	source: string;
	/** Target/reference paint after semantic color matching. */
	target: string;
	/** Relative visual weight, usually pixels or area. */
	weight?: number;
	/** Source drawing order index used to anchor center shade selection. */
	sourceIndex?: number;
};

/**
 * Groups related source-to-target paint relationships that should share one shade-depth calculation.
 */
type ColorPaletteOverlap = {
	/** Related overlap items, usually all paint components in one semantic part or matched group. */
	items: ColorPaletteMapping[];
};

/**
 * Builds a palette from source/reference color mappings and grouped overlap evidence.
 */
type ColorPaletteFromMappingsOptions = {
	/** Source-to-target paint mappings used to learn mapped hue shades. */
	mappings?: ColorPaletteMapping[];
	/** Additional source/reference colors used as shade hueShade evidence. */
	colors?: string[];
	/** Source paints used to learn source-only shade counts and anchors. */
	sourcePaints?: string[];
	/** Grouped overlap evidence used to precompute output paints for related components. */
	overlaps?: ColorPaletteOverlap[];
};

/**
 * Describes one output paint request against a palette.
 */
type ColorPaletteOutputPaintOptions = {
	/** Stable source component palette key used for overlap precomputed colors. */
	paletteKey: string;
	/** Source component paint before recoloring. */
	sourcePaint: string;
	/** Target/reference paint after semantic color matching. */
	targetPaint: string | null | undefined;
};

/**
 * Configures interpolation from a source paint shade into a target paint hue.
 */
type ColorPaletteInterpolationOptions = {
	/** Learned shade offsets keyed by canonical hue center. */
	hueShadesByHue?: ColorPaletteHueShadesByHue;
	/** Unique source color counts keyed by canonical hue center. */
	sourceColorCountByHue?: ColorPaletteColorCountByHue;
	/** Source-only shade offsets keyed by canonical hue center. */
	sourceHueShadesByHue?: ColorPaletteHueShadesByHue;
};

/**
 * Minimal paint component shape used by freeform color matching.
 */
type ColorPaletteMatchComponent = {
	/** Stable component id, when available. */
	componentId?: string;
	/** Source SVG element id, when available. */
	id?: string;
	/** Fill paint used by the component. */
	fill?: string | null;
	/** Stroke paint used by the component when fill is absent. */
	stroke?: string | null;
	/** Dominant reference paint for a reference component. */
	dominantColor?: string | null;
	/** Component bounds in source or reference coordinates. */
	bounds?: {
		/** Left edge. */
		left?: number;
		/** Top edge. */
		top?: number;
		/** Right edge. */
		right?: number;
		/** Bottom edge. */
		bottom?: number;
		/** Minimum x value. */
		minX?: number;
		/** Minimum y value. */
		minY?: number;
		/** Bounds width. */
		width?: number;
		/** Bounds height. */
		height?: number;
	};
	/** Optional precomputed center point. */
	center?: {
		/** Center x coordinate. */
		x: number;
		/** Center y coordinate. */
		y: number;
	};
	/** Component area in coordinate-space units. */
	area?: number;
	/** Component area in pixel units. */
	pixels?: number;
};

/**
 * Inputs for the freeform old-exporter reference component endpoint.
 */
type ColorPaletteFreeformReferenceComponentMatchOptions = {
	/** Source component to match. */
	sourceComponent: ColorPaletteMatchComponent;
	/** Source components in the same semantic part. */
	sourceComponents?: ColorPaletteMatchComponent[];
	/** Candidate reference components. */
	referenceComponents?: ColorPaletteMatchComponent[];
};

/**
 * Inputs for the freeform old-exporter reference paint endpoint.
 */
type ColorPaletteFreeformReferencePaintOptions = ColorPaletteFreeformReferenceComponentMatchOptions & {
	/** Reference palette paints available for the freeform part. */
	paletteColors?: string[];
	/** Average source paint keyed by perceived hue center. */
	sourceHueAverages?: Map<string, string>;
};

/**
 * Provides values for creating an optional-part assignment report shell.
 */
type OptionalPartCreateReportOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
};

/**
 * Provides context for processing one optional-part assignment face.
 */
type OptionalPartProcessFaceOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being assigned. */
	faceKey: string;
	/** Canonical state entry for the face. */
	faceState: PipelineFaceState;
	/** Root canonical pipeline state. */
	pipelineState: Record<string, unknown>;
	/** Canonical pipeline storage/model interface. */
	pipelineModel: PipelineModel;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Report object that accumulates per-face results. */
	report: OptionalPartAssignmentReport;
	/** Optional bulk source-search settings. */
	bulkOptions: OptionalPartBulkOptions | null;
	/** Optional UI-saved component assignments by face and optional part. */
	manualAssignments: OptionalPartManualAssignments | null;
};

/**
 * Provides inputs for building one optional-part assignment artifact.
 */
type OptionalPartArtifactOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key that owns the artifact. */
	faceKey: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Absolute normalized artifact path. */
	normalizedPath: string;
	/** Source SVG path from canonical face state or normalized artifact. */
	sourceFile: string | null;
	/** Normalized face artifact consumed by optional assignment. */
	normalized: SourceNormalizedFaceArtifact;
	/** Canonical state entry for the face. */
	faceState: PipelineFaceState;
	/** Root canonical pipeline state. */
	pipelineState: Record<string, unknown>;
	/** Optional bulk source-search settings. */
	bulkOptions: OptionalPartBulkOptions | null;
	/** Optional UI-saved component assignments by face and optional part. */
	manualAssignments: OptionalPartManualAssignments | null;
};

/**
 * Stores UI-selected optional-part component assignments.
 */
type OptionalPartManualAssignments = {
	/** Face-keyed manual assignments. */
	faces?: Record<string, OptionalPartManualFaceAssignments>;
};

/**
 * Stores UI-selected component ids for one face's optional parts.
 */
type OptionalPartManualFaceAssignments = {
	/** Part-keyed selected normalized source component ids. */
	[partId: string]: string[] | undefined;
};

/**
 * Describes saved bulk source-search settings for optional parts.
 */
type OptionalPartBulkOptions = {
	/** Optional family-keyed settings; when absent, the object itself may be family keyed. */
	families?: Record<string, OptionalPartFamilyBulkOptions>;
	/** Optional face-keyed settings that override family settings. */
	faces?: Record<string, OptionalPartFamilyBulkOptions>;
	/** Additional direct family keys accepted for command-line shorthand settings. */
	[family: string]: OptionalPartFamilyBulkOptions | Record<string, OptionalPartFamilyBulkOptions> | undefined;
};

/**
 * Describes bulk settings for one face family.
 */
type OptionalPartFamilyBulkOptions = {
	/** Optional label source-search choice. */
	label?: OptionalPartBulkChoice;
	/** Optional character glyph source-search choice. */
	character?: OptionalPartBulkChoice;
	/** Pair layout for flower/season label and character glyphs. */
	layout?: string;
};

/**
 * Describes one bulk source-search choice.
 */
type OptionalPartBulkChoice = {
	/** Whether the optional assignment pass should search source components for this part. */
	searchSource?: boolean;
	/** Source-region hint used to score candidates for the optional part. */
	region?: string;
};

/**
 * Describes parsed face identity for optional-part assignment.
 */
type OptionalPartFaceDescription = {
	/** Original face key. */
	faceKey: string;
	/** Parsed face family such as `bamboo`, `flower`, or `wind`. */
	family: string;
	/** Parsed face value, or raw suffix/null when non-numeric. */
	value: number | string | null;
};

/**
 * Describes the paired source regions for flower/season label and character parts.
 */
type OptionalPartPairLayoutRegions = {
	/** Region used to search for the label. */
	labelRegion: string;
	/** Region used to search for the character glyph. */
	characterRegion: string;
};

/**
 * Describes one optional-part source-search spec.
 */
type OptionalPartSourceSpec = {
	/** Stage-local optional part id such as `label` or `glyph`. */
	partId: string;
	/** Semantic content kind such as `label` or `glyph`. */
	contentKind: string;
	/** Semantic role expected for this optional part. */
	role: string;
	/** Expected source region. */
	region: string;
	/** Normalized target point for candidate scoring. */
	targetPoint: { x: number; y: number };
	/** Glyph metadata key to seed. */
	metadataKey: string;
	/** Expected visible label text for OCR/text evidence, when this spec is a label. */
	expectedLabel?: string | null;
	/** Whether source components should be searched and reserved. */
	searchSource: boolean;
	/** Initial bootstrap-only scoring preferences. */
	initialCandidateScoring?: Object | null;
};

/**
 * Describes one optional/rendered part output policy.
 */
type OptionalPartRenderSpec = {
	/** Stage-local rendered part id such as `label` or `glyph`. */
	partId: string;
	/** Semantic content kind such as `label` or `glyph`. */
	contentKind: string;
	/** Semantic role expected in final output. */
	role: string;
	/** Rendering source policy such as generated, source-preferred, or default-on. */
	source: string;
	/** Whether final output should include this part. */
	outputPresent: boolean;
};

/**
 * Provides inputs for building a candidate unit.
 */
type OptionalPartMakeCandidateUnitOptions = {
	/** Component ids represented by the unit. */
	componentIds: string[];
	/** Normalized components represented by the unit. */
	components: SourceNormalizedComponent[];
	/** Overall source bounds used for normalized position and area ratio. */
	sourceBounds: SourceBounds;
	/** Candidate unit kind. */
	unitKind: string;
};

/**
 * Describes an optional-part candidate unit before scoring.
 */
type OptionalPartCandidateUnit = {
	/** Candidate unit kind, such as `component` or `source-element-group`. */
	unitKind: string;
	/** Component ids represented by the unit. */
	componentIds: string[];
	/** Union bounds of the represented components. */
	bounds: SourceBounds;
	/** Source-space center of the unit. */
	center: { x: number; y: number };
	/** Center normalized against source bounds. */
	normalizedCenter: { x: number; y: number };
	/** Earliest source order represented by the unit. */
	sourceOrder: number;
	/** Number of components represented by the unit. */
	componentCount: number;
	/** Component granularity level for the unit. */
	componentLevel: string;
	/** Source class names represented by the unit. */
	classNames: string[];
	/** Fill colors represented by the unit. */
	fills: string[];
	/** Unit area as a ratio of source bounds area. */
	areaRatio: number;
	/** Unit width as a ratio of source width. */
	widthRatioToSourceWidth?: number;
	/** Unit height as a ratio of source width. */
	heightRatioToSourceWidth?: number;
	/** Unit max dimension as a ratio of source width. */
	maxDimensionRatioToSourceWidth?: number;
	/** Whether this unit came from an SVG text element. */
	textComponent?: boolean;
	/** Text values carried by represented SVG text elements. */
	textValues?: string[];
	/** Expected-label OCR evidence that exactly represents this candidate unit. */
	labelOcr?: SourceLabelOcrEvidence | null;
};

/**
 * Describes a scored optional-part candidate.
 */
type OptionalPartScoredCandidate = {
	/** Component ids represented by the candidate. */
	componentIds: string[];
	/** Candidate bounds in source coordinate space. */
	bounds: SourceBounds;
	/** Candidate center normalized against source bounds. */
	normalizedCenter: { x: number; y: number };
	/** Nearest named source region. */
	region: string;
	/** Earliest source order represented by the candidate. */
	sourceOrder: number;
	/** Number of components represented by the candidate. */
	componentCount: number;
	/** Candidate unit kind. */
	unitKind: string;
	/** Whether this candidate came from an SVG text element. */
	textComponent?: boolean;
	/** Text values carried by represented SVG text elements. */
	textValues?: string[];
	/** Whether candidate text exactly matches the expected label. */
	textLabelMatch?: boolean;
	/** Expected-label OCR evidence used for candidate scoring. */
	labelOcr?: SourceLabelOcrEvidence | null;
	/** Whether OCR evidence matched the expected label. */
	labelOcrMatch?: boolean;
	/** Source class names represented by the candidate. */
	classNames: string[];
	/** Fill colors represented by the candidate. */
	fills: string[];
	/** Candidate area as a ratio of source bounds area. */
	areaRatio: number;
	/** Candidate max dimension as a ratio of source width. */
	maxDimensionRatioToSourceWidth?: number;
	/** Final candidate score from 0 to 1. */
	score: number;
	/** Component score breakdown. */
	scores: {
		/** Region proximity score. */
		region: number;
		/** Named position-priority hueShade. */
		positionPriority?: number;
		/** Discrete position score. */
		position?: number;
		/** Top-band placement score. */
		topBand: number;
		/** Area fit score. */
		area: number;
		/** Source order score. */
		sourceOrder: number;
		/** Expected-label text match score. */
		textComponent?: number;
		/** Expected-label OCR match score. */
		labelOcr?: number;
	};
	/** Binding strength for the candidate, with manual UI selections marked strong. */
	strength?: string;
	/** Review status for the candidate. */
	reviewStatus?: string;
	/** Human-readable scoring reason codes. */
	reasons: string[];
};

/**
 * Describes one optional part in the Stage 3 artifact.
 */
type OptionalPartRecord = {
	/** Stage-local optional part id. */
	partId: string;
	/** Semantic content kind. */
	contentKind: string;
	/** Semantic role. */
	role: string;
	/** Source state such as `candidate-found`, `needs-review`, or `source-absent`. */
	sourceState: string;
	/** Region hint used to find the candidate. */
	hint: {
		/** Expected source region. */
		region: string;
		/** Normalized target point for candidate scoring. */
		targetPoint: { x: number; y: number };
	};
	/** Suggested normalized component ids. */
	suggestedComponentIds: string[];
	/** Suggested candidate bounds, if any. */
	suggestedBounds: SourceBounds | null;
	/** Binding strength for the selected suggestion. */
	strength: string;
	/** Review status for the selected suggestion. */
	reviewStatus: string;
	/** Ranked candidate list. */
	candidates: OptionalPartScoredCandidate[];
};

/**
 * Describes a reservation that alignment should consume before generic artwork matching.
 */
type OptionalPartComponentReservation = {
	/** Stage-local optional part id. */
	partId: string;
	/** Reserved normalized component ids. */
	componentIds: string[];
	/** Reservation bounds. */
	bounds?: SourceBounds;
	/** Candidate score that produced the reservation. */
	score?: number;
	/** Binding strength; manual UI reservations are strong. */
	strength?: string;
	/** Review status of the reservation. */
	reviewStatus: string;
};

/**
 * Describes Stage 3 metadata seeds for legacy glyph metadata consumers.
 */
type OptionalPartMetadataSeed = {
	/** Glyph layout seed values keyed by label/character metadata key. */
	glyphLayout: Record<string, {
		/** Whether source components are present for the glyph/label. */
		sourcePresent: boolean;
		/** Legacy source corner hint. */
		sourceCorner: string | null;
		/** Source bounds for the suggested candidate. */
		sourceBounds: SourceBounds | null;
		/** Suggested source component ids. */
		sourceComponentIds: string[];
		/** Candidate confidence score. */
		confidence: number;
		/** Binding strength for the seeded metadata. */
		strength?: string;
		/** Review status for the seeded metadata. */
		reviewStatus: string;
	}>;
};

/**
 * Describes a Stage 3 optional-part assignment artifact.
 */
type OptionalPartAssignmentArtifact = {
	/** Artifact schema version. */
	schemaVersion: number;
	/** Tileset id that owns the face. */
	tilesetId: string;
	/** Face key that owns the artifact. */
	faceKey: string;
	/** ISO timestamp for artifact generation. */
	generatedOn: string;
	/** Repository-relative source SVG path. */
	sourceFile: string;
	/** Repository-relative normalized artifact path. */
	normalizedComponents: string;
	/** Assignment status. */
	status: string;
	/** Parsed face description. */
	face: OptionalPartFaceDescription;
	/** Overall source bounds used for candidate scoring. */
	sourceBounds: SourceBounds | null;
	/** Count summary for the artifact. */
	summary: {
		/** Number of source components considered. */
		sourceComponentCount: number;
		/** Number of candidate units built. */
		candidateUnitCount: number;
		/** Number of scored candidates retained. */
		candidateCount: number;
	};
	/** Optional-part records keyed by part id. */
	optionalParts: Record<string, OptionalPartRecord>;
	/** Component reservations alignment should consume. */
	componentReservations: OptionalPartComponentReservation[];
	/** Metadata seeds for downstream legacy metadata consumers. */
	metadataSeed: OptionalPartMetadataSeed;
	/** Artifact diagnostics. */
	diagnostics: SourceNormalizationDiagnostic[];
};

/**
 * Describes an optional-part assignment report.
 */
type OptionalPartAssignmentReport = {
	/** Report schema version. */
	schemaVersion: number;
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** ISO timestamp for report generation. */
	generatedOn: string;
	/** Number of processed faces. */
	faceCount: number;
	/** Total optional-part record count. */
	optionalPartCount: number;
	/** Total scored candidate count. */
	candidateCount: number;
	/** Total diagnostic count. */
	diagnosticCount: number;
	/** Total warning diagnostic count. */
	warningCount: number;
	/** Report warnings for missing inputs. */
	warnings: Array<{
		/** Face key associated with the warning. */
		faceKey: string;
		/** Stable warning code. */
		code: string;
		/** Human-readable warning message. */
		message: string;
	}>;
	/** Per-face report entries. */
	faces: Record<string, unknown>;
};

/**
 * Describes the optional-part assignment slice of a tileset pipeline state update.
 */
type OptionalPartTilesetPipelineStateUpdate = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being updated. */
	faceKey: string;
	/** Repository-relative source SVG path. */
	sourceSvg: string;
	/** ISO timestamp for state generation. */
	generatedOn: string;
	/** Optional suit-level output settings discovered during optional-part assignment. */
	outputOptions?: TilesetSuitOutputOptions | null;
	/** Optional-part assignment rerun configuration. */
	optionalPartAssignment?: Record<string, unknown>;
};

/**
 * Provides filesystem operations used by source alignment.
 */
type SourceAlignmentFileSystem = {
	/** Checks whether a file can be accessed. */
	access(filePath: string): Promise<void>;
	/** Reads a UTF-8 text file. */
	readFile(filePath: string, encoding: string): Promise<string>;
	/** Writes a text file with an explicit encoding. */
	writeFile(filePath: string, content: string, encoding: string): Promise<void>;
	/** Creates a directory, usually recursively. */
	mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
};

/**
 * Loads face preprocessing metadata for source alignment.
 */
type SourceAlignmentLoadMetadata = (metadataPath: string | null) => Record<string, SourceFaceMetadata>;

/**
 * Observes canonical source alignment state updates in tests.
 */
type SourceAlignmentUpdateState = (update: SourceAlignmentTilesetPipelineStateUpdate) => void;

/**
 * Configures a source alignment runner instance.
 */
type SourceAlignmentRunnerDependencies = {
	/** Filesystem implementation used for reads, writes, existence checks, and mkdir. */
	fileSystem?: SourceAlignmentFileSystem;
	/** Path module implementation, normally Node's `path`. */
	pathModule?: typeof import('path');
	/** Repository root used for relative artifact paths. */
	rootDir?: string;
	/** Root 3D output directory for alignment artifacts. */
	output3dDir?: string;
	/** Metadata loader used for face preprocessing hints. */
	loadMetadata?: SourceAlignmentLoadMetadata;
	/** Optional observer for per-face state updates, used by tests. */
	updateState?: SourceAlignmentUpdateState;
	/** Clock used to stamp generated artifacts and in-memory summaries. */
	clock?: () => string;
};

/**
 * Describes one source alignment run.
 */
type SourceAlignmentRunOptions = {
	/** Tileset id used for output scope. */
	tilesetId?: string | null;
	/** Optional single face key to align. */
	faceKey?: string | null;
	/** Canonical pipeline storage/model interface. */
	pipelineModel: PipelineModel;
	/** Optional legacy metadata path. */
	metadataPath?: string | null;
};

/**
 * Summarizes a completed source alignment run for CLI output.
 */
type SourceAlignmentSummary = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Number of selected reference faces. */
	faceCount: number;
	/** Single requested face key, or null for a full run. */
	faceKey: string | null;
	/** Total alignment group count. */
	alignmentGroupCount: number;
	/** Total alignment candidate count. */
	candidateCount: number;
	/** Number of report warnings. */
	warningCount: number;
};

/**
 * Provides values for creating a source alignment report shell.
 */
type SourceAlignmentCreateReportOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Active reference structure document. */
	referenceStructure: ReferenceStructureDocument;
	/** Absolute reference structure path. */
	referenceStructurePath: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Single requested face key, or null for a full run. */
	requestedFaceKey: string | null;
	/** Sorted face keys selected for the run. */
	faceKeys: string[];
};

/**
 * Provides context for processing one source alignment face.
 */
type SourceAlignmentProcessFaceOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being aligned. */
	faceKey: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Active reference structure document. */
	referenceStructure: ReferenceStructureDocument;
	/** Absolute reference structure path. */
	referenceStructurePath: string;
	/** Canonical pipeline storage/model interface. */
	pipelineModel: PipelineModel;
	/** Report object that accumulates per-face results. */
	report: SourceAlignmentReport;
	/** Legacy face metadata hints. */
	faceMetadata: SourceFaceMetadata | null;
};

/**
 * Provides inputs for aligning one face.
 */
type SourceAlignmentFaceOptions = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being aligned. */
	faceKey: string;
	/** ISO timestamp for generated artifacts. */
	generatedOn: string;
	/** Active reference structure document. */
	referenceStructure: ReferenceStructureDocument;
	/** Reference face within the active reference structure. */
	referenceFace: ReferenceStructureFace;
	/** Absolute reference structure path. */
	referenceStructurePath: string;
	/** Normalized source face artifact. */
	normalizedFace: SourceNormalizedFaceArtifact;
	/** Absolute normalized source face path. */
	normalizedPath: string;
	/** Optional-part assignment artifact for the face, if available. */
	optionalAssignment?: OptionalPartAssignmentArtifact | null;
	/** Absolute optional-part assignment artifact path, if available. */
	optionalAssignmentPath?: string | null;
	/** Legacy face metadata hints. */
	faceMetadata: SourceFaceMetadata | null;
};

/**
 * Describes the reference structure document consumed by alignment.
 */
type ReferenceStructureDocument = {
	/** Reference set identity and coordinate-space metadata. */
	referenceSet?: {
		/** Reference set id. */
		referenceSetId?: string | null;
		/** Coordinate-space metadata. */
		coordinateSpace?: {
			/** Prepared SVG viewBox tuple. */
			preparedViewBox?: [number, number, number, number];
		};
	};
	/** Lifecycle metadata for the structure. */
	lifecycle?: {
		/** Lifecycle status. */
		status?: string | null;
		/** Initial generation timestamp. */
		generatedOn?: string | null;
		/** Last update timestamp. */
		updatedOn?: string | null;
	};
	/** Fallback document status. */
	status?: string | null;
	/** Reference faces keyed by face key. */
	faces: Record<string, ReferenceStructureFace>;
};

/**
 * Describes one reference face consumed by alignment.
 */
type ReferenceStructureFace = {
	/** Reference image dimensions. */
	image?: {
		/** Reference image width in pixels. */
		width: number;
		/** Reference image height in pixels. */
		height: number;
	};
	/** Semantic reference parts keyed by part id. */
	parts?: Record<string, ReferenceStructurePart>;
	/** Detected reference components. */
	components: ReferenceStructureComponent[];
};

/**
 * Describes one semantic reference part consumed by alignment.
 */
type ReferenceStructurePart = {
	/** Semantic role for the part. */
	role: string;
	/** Semantic content kind for the part. */
	contentKind: string;
	/** Bound reference component ids. */
	componentIds?: string[];
	/** Prepared viewBox target bounds for the part. */
	targetBounds?: SourceBounds | null;
};

/**
 * Describes one reference component consumed by alignment.
 */
type ReferenceStructureComponent = {
	/** Stable reference component id. */
	componentId: string;
	/** Component bounds in reference image coordinate space. */
	bounds: SourceBounds;
	/** Component center in reference image coordinate space. */
	center?: { x: number; y: number };
	/** Dominant color for grouping and color transfer. */
	dominantColor?: string | null;
	/** Bound part ids. */
	partIds?: string[];
	/** Bound global part ids. */
	globalPartIds?: string[];
	/** Bound semantic roles. */
	semanticRoles?: string[];
};

/**
 * Describes legacy face metadata hints consumed by alignment.
 */
type SourceFaceMetadata = {
	/** Legacy glyph layout hints keyed by label/character/glyph. */
	glyphLayout?: Record<string, SourceGlyphMetadata>;
};

/**
 * Describes legacy source glyph/label metadata.
 */
type SourceGlyphMetadata = {
	/** Whether a source glyph/label is expected to exist. */
	sourcePresent?: boolean;
	/** Explicit source bounds for the glyph/label. */
	sourceBounds?: SourceBounds | null;
	/** Source corner hint for the glyph/label. */
	sourceCorner?: string | null;
};

/**
 * Describes one source alignment report.
 */
type SourceAlignmentReport = {
	/** Report schema version. */
	schemaVersion: number;
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Reference set id. */
	referenceSetId: string | null;
	/** ISO timestamp for report generation. */
	generatedOn: string;
	/** Repository-relative reference structure path. */
	referenceStructurePath: string;
	/** Single requested face key, or null for a full run. */
	faceKey: string | null;
	/** Number of selected faces. */
	faceCount: number;
	/** Total alignment group count. */
	alignmentGroupCount: number;
	/** Total alignment candidate count. */
	candidateCount: number;
	/** Per-face report entries. */
	faces: Record<string, unknown>;
	/** Report warnings. */
	warnings: Array<{
		/** Stable warning code. */
		code: string;
		/** Face key associated with the warning. */
		faceKey: string;
		/** Repository-relative missing artifact path. */
		path: string;
	}>;
};

/**
 * Describes a Stage 4 source alignment map artifact.
 */
type SourceAlignmentMapArtifact = {
	/** Artifact schema version. */
	schemaVersion: number;
	/** Tileset id that owns the face. */
	tilesetId: string;
	/** Face key that owns the artifact. */
	faceKey: string;
	/** Reference set id. */
	referenceSetId: string | null;
	/** ISO timestamp for artifact generation. */
	generatedOn: string;
	/** Alignment status. */
	status: string;
	/** Input artifact metadata. */
	inputs: {
		/** Reference structure input metadata. */
		referenceStructure: Record<string, unknown>;
		/** Normalized components input metadata. */
		normalizedComponents: Record<string, unknown>;
		/** Optional-part assignment input metadata, if present. */
		optionalPartAssignment: Record<string, unknown> | null;
	};
	/** Coordinate-space metadata for source and output. */
	coordinateSpace: {
		/** Source viewBox, if known. */
		sourceViewBox: SourceViewBox | null;
		/** Prepared SVG viewBox tuple. */
		preparedViewBox: [number, number, number, number];
	};
	/** Explicit inferred source-part to reference-part mappings. */
	sourcePartMappings: SourceAlignmentSourcePartMapping[];
	/** Alignment groups derived from reference semantic parts. */
	alignmentGroups: SourceAlignmentGroup[];
	/** Alignment candidates created from matcher results. */
	candidates: SourceAlignmentCandidate[];
	/** Artifact diagnostics. */
	diagnostics: SourceNormalizationDiagnostic[];
};

/**
 * Describes one explicit inferred mapping from source part components to reference parts.
 */
type SourceAlignmentSourcePartMapping = {
	/** Stable mapping id. */
	mappingId: string;
	/** Stage-local source part id inferred from the reference part or group. */
	sourcePartId: string;
	/** Semantic role copied from the reference alignment group. */
	role: string;
	/** Semantic content kind copied from the reference alignment group. */
	contentKind: string;
	/** Source component ids that make up the inferred source part. */
	sourceComponentIds: string[];
	/** Reference part ids that this source part maps to. */
	referencePartIds: string[];
	/** Reference component ids that this source part maps to. */
	referenceComponentIds: string[];
	/** Owning alignment group id. */
	alignmentGroupId: string;
	/** Alignment candidate ids represented by this mapping. */
	alignmentIds: string[];
	/** Single alignment candidate id when the mapping came from a candidate. */
	alignmentCandidateId: string | null;
	/** Matcher status for the mapped group or candidate. */
	matchStatus: string;
	/** Strategy that produced the mapped group or candidate. */
	strategy: string;
	/** Match score, if one exists. */
	score: number | null;
	/** Score kind description, if one exists. */
	scoreKind: string | null;
	/** Identity resolver hint for repeated/ambiguous mappings. */
	identityResolver: Record<string, unknown>;
	/** Review status for this inferred mapping. */
	reviewStatus: string;
	/** Whether the mapping was derived from an alignment group or candidate. */
	provenance: string;
};

/**
 * Describes one source alignment group.
 */
type SourceAlignmentGroup = {
	/** Stable alignment group id. */
	alignmentGroupId: string;
	/** Group id derived from reference part ids or roles. */
	groupId: string;
	/** Semantic role. */
	role: string;
	/** Semantic content kind. */
	contentKind: string;
	/** Reference part ids represented by the group. */
	referencePartIds: string[];
	/** Reference component ids represented by the group. */
	referenceComponentIds: string[];
	/** Source component ids selected for the group. */
	sourceComponentIds: string[];
	/** Source component count. */
	sourceComponentCount: number;
	/** Reference component count. */
	referenceComponentCount: number;
	/** Alignment candidate ids produced for the group. */
	alignmentIds: string[];
	/** Grouping strategy used by the matcher. */
	strategy: string;
	/** Matcher status. */
	matchStatus: string;
	/** Matcher score, lower is better when present. */
	score: number | null;
	/** Score kind description. */
	scoreKind: string | null;
	/** Identity resolver hint for repeated/ambiguous groups. */
	identityResolver: Record<string, unknown>;
	/** Review status for the group. */
	reviewStatus: string;
	/** Group diagnostics. */
	diagnostics: SourceNormalizationDiagnostic[];
};

/**
 * Describes one source alignment candidate.
 */
type SourceAlignmentCandidate = {
	/** Stable alignment candidate id. */
	alignmentId: string;
	/** Owning alignment group id. */
	alignmentGroupId: string;
	/** Source component ids represented by the candidate. */
	sourceComponentIds: string[];
	/** Source shape ids represented by the candidate, when shape data is available. */
	sourceShapeIds?: string[];
	/** Reference component ids represented by the candidate. */
	referenceComponentIds: string[];
	/** Candidate reference part ids. */
	referencePartCandidates: string[];
	/** Candidate type such as `direct`, `merge-source`, or `grouped`. */
	candidateType: string;
	/** Grouping strategy used by the matcher. */
	strategy: string;
	/** Matcher status. */
	matchStatus: string;
	/** Transform penalty score. */
	score: number;
	/** Score kind description. */
	scoreKind: string;
	/** Identity resolver hint for repeated/ambiguous groups. */
	identityResolver: Record<string, unknown>;
	/** Review status for the candidate. */
	reviewStatus: string;
	/** Source bounds in source coordinate space. */
	sourceBounds: SourceBounds;
	/** Reference bounds in reference image coordinate space. */
	referenceBounds: SourceBounds;
	/** Prepared viewBox target bounds. */
	targetBounds: SourceBounds;
	/** Bounds after applying the candidate transform. */
	alignedBounds: SourceBounds;
	/** Candidate transform metadata. */
	transform: Record<string, unknown>;
	/** Alternative candidate records reserved for future review UI. */
	alternatives: unknown[];
	/** Candidate diagnostics. */
	diagnostics: SourceNormalizationDiagnostic[];
	/** Semantic context copied from reference components. */
	semanticContext: Record<string, unknown>;
};

/**
 * Describes the source alignment slice of a tileset pipeline state update.
 */
type SourceAlignmentTilesetPipelineStateUpdate = {
	/** Tileset id used for output scope. */
	tilesetId: string;
	/** Face key being updated. */
	faceKey: string;
	/** Reference set id, if available. */
	referenceSetId: string | null;
	/** Repository-relative source SVG path, if available. */
	sourceSvg?: string | null;
	/** ISO timestamp for state generation. */
	generatedOn: string;
};
