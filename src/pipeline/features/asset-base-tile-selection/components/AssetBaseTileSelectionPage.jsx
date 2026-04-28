import React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Button, Pill } from "../../../components/index.js";

export default class AssetBaseTileSelectionPage extends React.Component {
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
		const { baseTileSelection, processing, messageDialog } = this.state;

		return (
			<section className="asset-base-tile-selection-page">
				{this.renderHeader()}
				<div className="asset-base-tile-selection-content">
					{baseTileSelection?.variants ? this.renderVariantGrid(baseTileSelection.variants) : this.renderEmptyState()}
				</div>
				{processing ? this.renderBusy() : null}
				{messageDialog ? this.renderMessageDialog(messageDialog) : null}
			</section>
		);
	}

	renderHeader() {
		const { baseTileSelection, processing, selectedVariantId } = this.state;
		const summary = baseTileSelection?.summary || {};
		const hasOptions = Boolean(baseTileSelection?.variants?.length);

		return (
			<header className="asset-base-tile-selection-header">
				<div className="asset-base-tile-selection-title">
					<h1>Base Tile Selection</h1>
					<div className="structure-header-summary asset-base-tile-selection-summary">
						<Pill>{summary.variantCount || 0} options</Pill>
						<Pill>{summary.faceCount || 0} faces</Pill>
						<Pill reportLevel={selectedVariantId ? "info" : "warning"}>
							{selectedVariantId || "none selected"}
						</Pill>
					</div>
				</div>
				<div className="asset-base-tile-selection-actions">
					<Button onClick={() => this.props.pageView.load({ force: true })} disabled={processing}>Reload</Button>
					<Button
						variant="primary"
						onClick={() => this.props.pageView.save()}
						disabled={processing || !hasOptions || !selectedVariantId}
					>
						Start
					</Button>
				</div>
			</header>
		);
	}

	renderVariantGrid(variants) {
		return (
			<section className="asset-base-tile-grid" aria-label="Base tile GLB options">
				{variants.map((variant) => (
					<BaseTileVariantCard
						key={variant.id}
						variant={variant}
						selected={variant.id === this.state.selectedVariantId}
						assetUrl={(path) => this.props.pageView.assetUrl(path)}
						onSelect={(variantId) => this.props.pageView.selectVariant(variantId)}
					/>
				))}
			</section>
		);
	}

	renderEmptyState() {
		return <div className="empty-state">No base tile GLB options are available.</div>;
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

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="base-tile-dialog-title">
					<header>
						<h2 id="base-tile-dialog-title">{messageDialog.title}</h2>
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
}

class BaseTileVariantCard extends React.Component {
	render() {
		const { variant, selected, onSelect } = this.props;
		const body = variant.body || {};

		return (
			<article className={[
				"asset-base-tile-card",
				selected ? "selected-asset-base-tile-card" : "",
			].filter(Boolean).join(" ")}>
				<label className="asset-base-tile-choice">
					<input
						type="radio"
						name="asset-base-tile-variant"
						value={variant.id}
						checked={selected}
						onChange={() => onSelect?.(variant.id)}
					/>
					<span>
						<strong>{variant.label || variant.id}</strong>
						<small>{variant.id}</small>
					</span>
				</label>
				<BaseTileGlbPreview
					glbUrl={variant.glb ? this.assetUrl(variant.glb) : ""}
					label={variant.label || variant.id}
				/>
				<p>{variant.description}</p>
				<dl className="asset-base-tile-details">
					<dt>Dimensions</dt>
					<dd>{formatDimension(body.width)} x {formatDimension(body.height)} x {formatDimension(body.depth)}</dd>
					<dt>Kind</dt>
					<dd>{variant.kind}</dd>
					<dt>Status</dt>
					<dd>{variant.temporary ? "temporary" : "production"}</dd>
				</dl>
				<div className="asset-base-tile-links">
					{variant.glb ? <a href={this.assetUrl(variant.glb)}>GLB</a> : null}
					{variant.metadata ? <a href={this.assetUrl(variant.metadata)}>Metadata</a> : null}
				</div>
			</article>
		);
	}

	assetUrl(path) {
		return this.props.assetUrl(path);
	}
}

class BaseTileGlbPreview extends React.Component {
	constructor(props) {
		super(props);
		this.containerRef = React.createRef();
		this.state = {
			loadFailed: false,
		};
	}

	componentDidMount() {
		this.mounted = true;
		this.startScene();
	}

	componentDidUpdate(previousProps) {
		if (previousProps.glbUrl !== this.props.glbUrl) {
			this.stopScene();
			this.setState({ loadFailed: false }, () => this.startScene());
		}
	}

	componentWillUnmount() {
		this.mounted = false;
		this.stopScene();
	}

	render() {
		return (
			<div className="asset-base-tile-preview" ref={this.containerRef} aria-label={`${this.props.label} 3D preview`}>
				{this.state.loadFailed ? <div className="asset-base-tile-preview-fallback">Preview unavailable</div> : null}
			</div>
		);
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
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.enablePan = false;
		controls.screenSpacePanning = false;
		controls.minDistance = 1.2;
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
				this.animate();
			},
			undefined,
			() => {
				if (this.mounted) {
					this.setState({ loadFailed: true });
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
		this.sceneState.scene.traverse((object) => {
			if (object.isLight) {
				object.dispose?.();
			}
		});
		this.sceneState.renderer.dispose();
		this.sceneState.renderer.domElement.remove();
		this.sceneState = null;
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

function formatDimension(value) {
	return Number.isFinite(value) ? value.toFixed(2) : "?";
}
