import React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Button, Pill } from "../../../components/index.js";

const MAX_ACTIVE_GLB_PREVIEWS = 4;
const activeGlbPreviews = new Set();
const waitingGlbPreviews = [];

export default class AssetReviewPage extends React.Component {
	constructor(props) {
		super(props);
		this.state = props.pageView.getState();
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen("updated", (pageState) => {
			this.setState(pageState);
		});
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten("updated", this.updateListener);
	}

	render() {
		const { assetReview, processing, messageDialog } = this.state;

		return (
			<section className="asset-review-page">
				{this.renderHeader()}
				<div className="asset-review-content">
					{assetReview?.faces ? this.renderFaceGrid(assetReview.faces) : this.renderEmptyState()}
				</div>
				{this.state.viewerFace ? this.renderViewer() : null}
				{processing && this.state.processingLabel ? this.renderBusy() : null}
				{messageDialog ? this.renderMessageDialog(messageDialog) : null}
			</section>
		);
	}

	renderHeader() {
		const { generationRunning, processing, summary } = this.state;
		const hasQueuedWork = Boolean(generationRunning || summary?.buildingCount || summary?.queuedCount);

		return (
			<header className="asset-review-header">
				<div className="asset-review-title">
					<h1>Asset Review</h1>
					<div className="structure-header-summary asset-review-summary">
						<Pill>{summary?.faceCount || 0} faces</Pill>
						<Pill>{summary?.readyCount || 0} ready</Pill>
						<Pill reportLevel={summary?.buildingCount ? "warning" : "info"}>{summary?.buildingCount || 0} building</Pill>
						<Pill reportLevel={summary?.queuedCount ? "warning" : "info"}>{summary?.queuedCount || 0} queued</Pill>
						<Pill reportLevel={summary?.staleCount ? "warning" : "info"}>{summary?.staleCount || 0} stale</Pill>
						<Pill reportLevel={summary?.failedCount ? "error" : "info"}>{summary?.failedCount || 0} failed</Pill>
						<Pill reportLevel={summary?.unavailableCount ? "warning" : "info"}>{summary?.unavailableCount || 0} unavailable</Pill>
					</div>
				</div>
				<div className="asset-review-actions">
					<Button onClick={() => this.props.pageView.startGeneration()} disabled={processing || generationRunning}>Generate</Button>
					<Button onClick={() => this.props.pageView.cancelGeneration()} disabled={processing || !hasQueuedWork}>Cancel</Button>
					<Button onClick={() => this.props.pageView.resetGeneration()} disabled={processing}>Reset</Button>
					<Button onClick={() => this.props.pageView.load({ force: true })} disabled={processing}>Reload</Button>
				</div>
			</header>
		);
	}

	renderFaceGrid(faces) {
		const retryDisabled = this.state.processing || this.state.generationRunning;

		return (
			<section className="asset-review-grid" aria-label="Generated final tile assets">
				{faces.map((face) => (
					<AssetReviewFaceCard
						key={face.faceKey}
						face={face}
						assetUrl={(path) => this.props.pageView.assetUrl(path)}
						onOpenViewer={(viewerFace) => this.openViewer(viewerFace)}
						onRetryFace={(faceKey) => this.props.pageView.retryFace(faceKey)}
						retryDisabled={retryDisabled}
					/>
				))}
			</section>
		);
	}

	renderEmptyState() {
		return <div className="empty-state">No generated tile assets are available.</div>;
	}

	renderBusy() {
		return (
			<div className="pipeline-busy-overlay" role="status" aria-live="polite">
				<div className="pipeline-busy">
					<div className="pipeline-spinner" />
					<span>{this.state.processingLabel || "Working..."}</span>
				</div>
			</div>
		);
	}

	renderViewer() {
		const face = this.state.viewerFace;
		const asset = face?.asset || {};

		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog asset-review-viewer-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-review-viewer-title">
					<header>
						<h2 id="asset-review-viewer-title">{face.faceKey}</h2>
					</header>
					<div className="asset-review-viewer">
						<AssetGlbPreview
							glbUrl={this.props.pageView.assetUrl(asset.glb, asset.cacheKey)}
							label={face.faceKey}
						/>
					</div>
					<footer>
						<span />
						<Button variant="primary" onClick={() => this.closeViewer()}>Close</Button>
					</footer>
				</section>
			</div>
		);
	}

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-review-dialog-title">
					<header>
						<h2 id="asset-review-dialog-title">{messageDialog.title}</h2>
					</header>
					<p>{messageDialog.message}</p>
					<footer>
						<span />
						<Button variant="primary" onClick={() => this.props.pageView.dismissMessageDialog()}>OK</Button>
					</footer>
				</section>
			</div>
		);
	}

	openViewer(face) {
		if (!face?.asset?.glb) {
			return;
		}

		this.setState({ viewerFace: face });
	}

	closeViewer() {
		this.setState({ viewerFace: null });
	}
}

class AssetReviewFaceCard extends React.Component {
	render() {
		const { face } = this.props;
		const asset = face.asset || null;

		return (
			<article className={`asset-review-card asset-review-card-${face.state}`}>
				<header>
					<div>
						<strong>{face.faceKey}</strong>
						<small>{this.renderSubtitle(face)}</small>
					</div>
					<AssetReviewStatusIcon
						faceKey={face.faceKey}
						state={face.state}
						onRetryFace={this.props.onRetryFace}
						retryDisabled={this.props.retryDisabled}
					/>
				</header>
				{this.renderPreview(face, asset)}
				<div className="asset-review-card-footer">
					{asset?.glb ? <a href={this.assetUrl(asset.glb, asset.cacheKey)}>GLB</a> : null}
					{asset?.metadata ? <a href={this.assetUrl(asset.metadata, asset.cacheKey)}>Metadata</a> : null}
					{face.failure?.message ? <span>{face.failure.message}</span> : null}
				</div>
			</article>
		);
	}

	renderSubtitle(face) {
		if (face.building) {
			return face.queue?.currentStep || face.build?.currentStep || "processing";
		}
		if (face.queued) {
			return "queued";
		}
		if (face.unavailable) {
			return "no generated asset";
		}
		return face.recordedFinalHash ? shortHash(face.recordedFinalHash) : "no final hash";
	}

	renderPreview(face, asset) {
		if (asset?.previewPng) {
			return (
				<div className="asset-review-preview-frame">
					<button
						type="button"
						className="asset-review-preview-button"
						onClick={() => this.props.onOpenViewer(face)}
						aria-label={`Open ${face.faceKey} 3D asset viewer`}
					>
						<img src={this.assetUrl(asset.previewPng, asset.cacheKey)} alt={`${face.faceKey} generated tile preview`} />
					</button>
				</div>
			);
		}

		if (asset?.glb) {
			return <button type="button" className="asset-review-unavailable" onClick={() => this.props.onOpenViewer(face)}>Open 3D preview</button>;
		}

		if (face.building) {
			return <div className="asset-review-unavailable">Processing</div>;
		}

		if (face.queued) {
			return <div className="asset-review-unavailable">Queued</div>;
		}

		if (face.stale) {
			return <div className="asset-review-unavailable">Stale - generate</div>;
		}

		return <div className="asset-review-unavailable">Not available</div>;
	}

	assetUrl(path, cacheKey = "") {
		return this.props.assetUrl(path, cacheKey);
	}
}

function AssetReviewStatusIcon({ faceKey, state, onRetryFace, retryDisabled = false }) {
	const iconName = iconNameForState(state);
	const label = labelForState(state);
	const retryable = state === "stale" || state === "failed";
	const className = `asset-review-status-icon asset-review-status-icon-${state || "unavailable"}`;
	const icon = <img src={`assets/images/${iconName}.svg`} alt="" aria-hidden="true" />;

	if (retryable) {
		return (
			<button
				type="button"
				className={`${className} asset-review-status-icon-button`}
				onClick={() => onRetryFace?.(faceKey)}
				disabled={retryDisabled}
				aria-label={`Queue ${faceKey} for asset generation`}
				title={retryDisabled ? "Asset generation is already running" : `Queue ${faceKey} for asset generation`}
			>
				{icon}
			</button>
		);
	}

	return (
		<span
			className={className}
			role="img"
			aria-label={label}
			title={label}
		>
			{icon}
		</span>
	);
}

class AssetGlbPreview extends React.Component {
	constructor(props) {
		super(props);
		this.containerRef = React.createRef();
		this.state = {
			inView: false,
			hasPreviewSlot: false,
			loading: true,
			loadFailed: false,
		};
	}

	componentDidMount() {
		this.mounted = true;
		this.observeVisibility();
	}

	componentDidUpdate(previousProps) {
		if (previousProps.glbUrl !== this.props.glbUrl) {
			this.stopScene();
			this.setState({ loading: true, loadFailed: false }, () => this.startSceneWhenVisible());
		}
	}

	componentWillUnmount() {
		this.mounted = false;
		this.visibilityObserver?.disconnect();
		this.stopScene();
		this.releasePreviewSlot();
	}

	render() {
		const waitingForSlot = this.state.inView && !this.state.hasPreviewSlot && !this.state.loadFailed;

		return (
			<div className="asset-review-preview" ref={this.containerRef} aria-label={`${this.props.label} final tile asset`}>
				{!this.state.inView ? <div className="asset-review-preview-pending">Preview pending</div> : null}
				{waitingForSlot ? <div className="asset-review-preview-pending">Preview queued</div> : null}
				{this.state.inView && this.state.hasPreviewSlot && this.state.loading && !this.state.loadFailed ? (
					<div className="asset-review-preview-loading">
						<span className="asset-review-preview-spinner" aria-hidden="true" />
						<span>Loading preview</span>
					</div>
				) : null}
				{this.state.loadFailed ? <div className="asset-review-preview-fallback">Preview unavailable</div> : null}
			</div>
		);
	}

	observeVisibility() {
		if (!this.containerRef.current || typeof IntersectionObserver === "undefined") {
			this.setState({ inView: true }, () => this.claimPreviewSlot());
			return;
		}

		this.visibilityObserver = new IntersectionObserver((entries) => {
			const isVisible = entries.some((entry) => entry.isIntersecting);
			if (isVisible === this.state.inView) {
				return;
			}

			if (isVisible) {
				this.setState({ inView: true }, () => this.claimPreviewSlot());
			} else {
				this.stopScene();
				this.releasePreviewSlot();
				this.setState({ inView: false, hasPreviewSlot: false, loading: true, loadFailed: false });
			}
		}, {
			rootMargin: "40px 0px",
			threshold: 0.01,
		});
		this.visibilityObserver.observe(this.containerRef.current);
	}

	claimPreviewSlot() {
		if (!this.props.glbUrl || !this.state.inView) {
			return;
		}

		if (requestGlbPreviewSlot(this)) {
			this.activatePreviewSlot();
		}
	}

	activatePreviewSlot() {
		if (!this.mounted || !this.canUsePreviewSlot()) {
			this.releasePreviewSlot();
			return;
		}

		this.setState({ hasPreviewSlot: true }, () => this.startSceneWhenVisible());
	}

	canUsePreviewSlot() {
		return Boolean(this.mounted && this.state.inView && this.props.glbUrl);
	}

	releasePreviewSlot() {
		releaseGlbPreviewSlot(this);
	}

	startSceneWhenVisible() {
		if (this.state.inView && this.state.hasPreviewSlot && !this.sceneState) {
			this.startScene();
		}
	}

	startScene() {
		if (!this.props.glbUrl || !this.containerRef.current) {
			return;
		}

		const container = this.containerRef.current;
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x050706);

		const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
		camera.position.set(1.6, 1.25, 1.8);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
			renderer.outputColorSpace = THREE.SRGBColorSpace;
		}
		const contextLostListener = (event) => {
			event.preventDefault();
			if (!this.mounted || this.loadingUrl !== this.props.glbUrl) {
				return;
			}
			this.stopScene();
			this.setState({ loading: true, loadFailed: false }, () => {
				window.setTimeout(() => this.startSceneWhenVisible(), 250);
			});
		};
		renderer.domElement.addEventListener("webglcontextlost", contextLostListener, false);
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.enablePan = false;
		controls.screenSpacePanning = false;
		controls.minDistance = 0.8;
		controls.maxDistance = 5;

		const grid = new THREE.GridHelper(2.2, 22, 0x2d7d6b, 0x1c332d);
		grid.position.y = -0.38;
		scene.add(grid);

		const ambient = new THREE.HemisphereLight(0xffffff, 0x24302b, 2.8);
		const key = new THREE.DirectionalLight(0xffffff, 2.2);
		key.position.set(2, 3, 2);
		const fill = new THREE.DirectionalLight(0xffffff, 0.8);
		fill.position.set(-2, 1.5, -1.5);
		scene.add(ambient, key, fill);

		this.sceneState = {
			scene,
			camera,
			renderer,
			controls,
			model: null,
			resizeObserver: null,
			frameId: null,
			contextLostListener,
		};

		this.resizeScene();
		this.sceneState.resizeObserver = new ResizeObserver(() => this.resizeScene());
		this.sceneState.resizeObserver.observe(container);

		const loader = new GLTFLoader();
		const loadingUrl = this.props.glbUrl;
		this.loadingUrl = loadingUrl;
		loader.load(
			loadingUrl,
			(gltf) => {
				if (!this.mounted || !this.sceneState || this.loadingUrl !== loadingUrl) {
					disposeObject(gltf.scene);
					return;
				}

				this.sceneState.model = gltf.scene;
				scene.add(gltf.scene);
				fitCameraToObject(camera, controls, gltf.scene);
				this.setState({ loading: false, loadFailed: false });
				this.animate();
			},
			undefined,
			() => {
				if (this.mounted && this.sceneState && this.loadingUrl === loadingUrl) {
					this.setState({ loading: false, loadFailed: true });
				}
			},
		);
	}

	resizeScene() {
		if (!this.sceneState || !this.containerRef.current) {
			return;
		}

		const bounds = this.containerRef.current.getBoundingClientRect();
		const width = Math.max(1, Math.floor(bounds.width));
		const height = Math.max(1, Math.floor(bounds.height));

		this.sceneState.camera.aspect = width / height;
		this.sceneState.camera.updateProjectionMatrix();
		this.sceneState.renderer.setSize(width, height, false);
		this.sceneState.renderer.render(this.sceneState.scene, this.sceneState.camera);
	}

	animate() {
		if (!this.sceneState) {
			return;
		}

		this.sceneState.controls.update();
		this.sceneState.renderer.render(this.sceneState.scene, this.sceneState.camera);
		this.sceneState.frameId = window.requestAnimationFrame(() => this.animate());
	}

	stopScene() {
		if (!this.sceneState) {
			return;
		}

		if (this.sceneState.frameId) {
			window.cancelAnimationFrame(this.sceneState.frameId);
		}
		this.sceneState.resizeObserver?.disconnect();
		this.sceneState.controls.dispose();
		if (this.sceneState.model) {
			disposeObject(this.sceneState.model);
		}
		this.sceneState.renderer.domElement.removeEventListener("webglcontextlost", this.sceneState.contextLostListener);
		this.sceneState.renderer.dispose();
		this.sceneState.renderer.domElement.remove();
		this.sceneState = null;
		this.loadingUrl = "";
	}
}

function requestGlbPreviewSlot(preview) {
	if (activeGlbPreviews.has(preview)) {
		return true;
	}
	if (activeGlbPreviews.size < MAX_ACTIVE_GLB_PREVIEWS) {
		activeGlbPreviews.add(preview);
		return true;
	}
	if (!waitingGlbPreviews.includes(preview)) {
		waitingGlbPreviews.push(preview);
	}
	return false;
}

function releaseGlbPreviewSlot(preview) {
	activeGlbPreviews.delete(preview);
	const waitingIndex = waitingGlbPreviews.indexOf(preview);
	if (waitingIndex >= 0) {
		waitingGlbPreviews.splice(waitingIndex, 1);
	}
	fillGlbPreviewSlots();
}

function fillGlbPreviewSlots() {
	while (activeGlbPreviews.size < MAX_ACTIVE_GLB_PREVIEWS && waitingGlbPreviews.length) {
		const preview = waitingGlbPreviews.shift();
		if (!preview.canUsePreviewSlot()) {
			continue;
		}

		activeGlbPreviews.add(preview);
		preview.activatePreviewSlot();
	}
}

function fitCameraToObject(camera, controls, object) {
	const box = new THREE.Box3().setFromObject(object);
	const size = box.getSize(new THREE.Vector3());
	const center = box.getCenter(new THREE.Vector3());
	const radius = Math.max(size.length() * 0.5, 0.4);
	const distance = radius / Math.sin((camera.fov * Math.PI / 180) * 0.5);

	object.position.sub(center);
	controls.target.set(0, 0, 0);
	camera.position.set(distance * 0.62, distance * 0.42, distance * 0.78);
	camera.near = Math.max(0.01, distance / 100);
	camera.far = distance * 10;
	camera.updateProjectionMatrix();
	controls.update();
}

function disposeObject(object) {
	object.traverse((child) => {
		if (!child.isMesh) {
			return;
		}

		child.geometry?.dispose();
		const materials = Array.isArray(child.material) ? child.material : [child.material];
		for (const material of materials) {
			disposeMaterial(material);
		}
	});
}

function disposeMaterial(material) {
	if (!material) {
		return;
	}

	for (const value of Object.values(material)) {
		if (value?.isTexture) {
			value.dispose();
		}
	}
	material.dispose?.();
}

function labelForState(state) {
	if (state === "ready") {
		return "Ready";
	}
	if (state === "building") {
		return "Processing";
	}
	if (state === "queued") {
		return "Queued";
	}
	if (state === "stale") {
		return "Stale";
	}
	if (state === "failed") {
		return "Failed";
	}
	return "Not available";
}

function iconNameForState(state) {
	if (state === "ready") {
		return "circle-check";
	}
	if (state === "building") {
		return "loader-2";
	}
	if (state === "queued") {
		return "clock";
	}
	if (state === "stale") {
		return "refresh-dot";
	}
	if (state === "failed") {
		return "alert-circle";
	}
	return "circle-off";
}

function shortHash(hash) {
	return hash ? hash.slice(0, 10) : "";
}
