import React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Button, Pill } from "../../../components/index.js";

export default class AssetBaseTileSelectionPage extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			...props.pageView.getState(),
			openPreviewVariant: null,
		};
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen("updated", (pageState) => {
			this.setState((state) => ({
				...pageState,
				openPreviewVariant: refreshOpenPreviewVariant(state.openPreviewVariant, pageState.baseTileSelection?.variants),
			}));
		});
		window.addEventListener("keydown", this.handleKeyDown);
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten("updated", this.updateListener);
		window.removeEventListener("keydown", this.handleKeyDown);
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
				{this.state.openPreviewVariant ? this.renderPreviewDialog(this.state.openPreviewVariant) : null}
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
						onOpenPreview={(previewVariant) => this.openPreview(previewVariant)}
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

	renderPreviewDialog(variant) {
		return (
			<div className="pipeline-dialog-overlay asset-base-tile-preview-dialog-overlay" role="presentation" onMouseDown={(event) => this.closePreviewOnBackdrop(event)}>
				<section className="pipeline-dialog asset-base-tile-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="base-tile-preview-dialog-title">
					<header>
						<div>
							<h2 id="base-tile-preview-dialog-title">{variant.label || variant.id}</h2>
							<p>{variant.id}</p>
						</div>
						<Button onClick={() => this.closePreview()}>Close</Button>
					</header>
				<BaseTileGlbPreview
					glbUrl={variant.glb ? this.props.pageView.assetUrl(variant.glb) : ""}
					label={variant.label || variant.id}
					variant={variant}
					assetUrl={(path) => this.props.pageView.assetUrl(path)}
					large
				/>
				</section>
			</div>
		);
	}

	openPreview(variant) {
		this.setState({ openPreviewVariant: variant });
	}

	closePreview() {
		this.setState({ openPreviewVariant: null });
	}

	closePreviewOnBackdrop(event) {
		if (event.target === event.currentTarget) {
			this.closePreview();
		}
	}

	handleKeyDown = (event) => {
		if (event.key === "Escape" && this.state.openPreviewVariant) {
			this.closePreview();
		}
	};
}

class BaseTileVariantCard extends React.Component {
	render() {
		const { variant, selected, onSelect, onOpenPreview } = this.props;
		const body = variant.body || {};
		const previewOnly = Boolean(variant.previewOnly);

		return (
			<article className={[
				"asset-base-tile-card",
				selected ? "selected-asset-base-tile-card" : "",
				previewOnly ? "preview-only-asset-base-tile-card" : "",
			].filter(Boolean).join(" ")}>
				<label className="asset-base-tile-choice">
					<input
						type="radio"
						name="asset-base-tile-variant"
						value={variant.id}
						checked={selected}
						disabled={previewOnly}
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
					variant={variant}
					assetUrl={(path) => this.assetUrl(path)}
				/>
				<p>{variant.description}</p>
				<dl className="asset-base-tile-details">
					<dt>Dimensions</dt>
					<dd>{formatDimension(body.width)} x {formatDimension(body.height)} x {formatDimension(body.depth)}</dd>
					<dt>Kind</dt>
					<dd>{variant.kind}</dd>
					<dt>Status</dt>
					<dd>{previewOnly ? "preview only" : variant.temporary ? "temporary" : "production"}</dd>
				</dl>
				<div className="asset-base-tile-links">
					{variant.glb ? <a href={this.assetUrl(variant.glb)}>GLB</a> : null}
					{variant.metadata ? <a href={this.assetUrl(variant.metadata)}>Metadata</a> : null}
					<Button onClick={() => onOpenPreview?.(variant)} disabled={!variant.glb}>Open</Button>
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
		if (previousProps.glbUrl !== this.props.glbUrl || previousProps.variant !== this.props.variant) {
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
			<div className={[
				"asset-base-tile-preview",
				this.props.large ? "asset-base-tile-preview-large" : "",
			].filter(Boolean).join(" ")} ref={this.containerRef} aria-label={`${this.props.label} 3D preview`}>
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
				applyBaseTilePreviewMaterials(gltf.scene, this.props.variant, this.props.assetUrl);
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

function applyBaseTilePreviewMaterials(root, variant, assetUrl) {
	if (variant?.previewMaterialSource === "embedded") {
		return;
	}

	const materialEntries = Object.entries(variant?.material || {});
	if (materialEntries.length === 0) {
		return;
	}

	for (const [materialId, entry] of materialEntries) {
		const meshName = entry?.meshName;
		if (!meshName) {
			continue;
		}

		root.traverse((object) => {
			if (!object.isMesh || object.name !== meshName) {
				return;
			}

			const previousGeometry = object.geometry;
			object.geometry = createPreviewUvGeometry(object.geometry);
			const previousMaterials = Array.isArray(object.material) ? object.material : [object.material];
			object.material = createBaseTilePreviewMaterial(materialId, entry, assetUrl);
			previousGeometry?.dispose?.();
			for (const material of previousMaterials) {
				disposeMaterial(material);
			}
		});
	}
}

function createBaseTilePreviewMaterial(materialId, entry, assetUrl) {
	const texture = createPreviewMaterialTexture(materialId, entry, assetUrl);
	const material = new THREE.MeshStandardMaterial({
		name: entry.sourceMaterial || `${materialId}-preview-material`,
		color: new THREE.Color(0xffffff),
		map: texture,
		roughness: materialId === "bamboo" ? 0.62 : 0.74,
		metalness: 0.02,
	});

	if (materialId === "ivory") {
		material.emissive = new THREE.Color(0x241f18);
		material.emissiveIntensity = 0.03;
	}

	return material;
}

function createPreviewUvGeometry(sourceGeometry) {
	const geometry = sourceGeometry.clone();
	const position = geometry.getAttribute("position");
	if (!position) {
		return geometry;
	}

	if (!geometry.getAttribute("normal")) {
		geometry.computeVertexNormals();
	}
	geometry.computeBoundingBox();
	const normal = geometry.getAttribute("normal");
	const bounds = geometry.boundingBox;
	const size = new THREE.Vector3();
	bounds.getSize(size);

	const uv = new Float32Array(position.count * 2);
	for (let index = 0; index < position.count; index += 1) {
		const x = position.getX(index);
		const y = position.getY(index);
		const z = position.getZ(index);
		const nx = Math.abs(normal.getX(index));
		const ny = Math.abs(normal.getY(index));
		const nz = Math.abs(normal.getZ(index));
		let u = normalizeRange(x, bounds.min.x, size.x);
		let v = normalizeRange(z, bounds.min.z, size.z);

		if (nx >= ny && nx >= nz) {
			u = normalizeRange(z, bounds.min.z, size.z);
			v = normalizeRange(y, bounds.min.y, size.y);
		} else if (nz >= nx && nz >= ny) {
			u = normalizeRange(x, bounds.min.x, size.x);
			v = normalizeRange(y, bounds.min.y, size.y);
		}

		uv[index * 2] = u;
		uv[index * 2 + 1] = v;
	}

	geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
	return geometry;
}

function normalizeRange(value, min, size) {
	return size > 0 ? (value - min) / size : 0;
}

function createPreviewMaterialTexture(materialId, entry, assetUrl) {
	if (entry?.textureMap && typeof assetUrl === "function") {
		const texture = new THREE.TextureLoader().load(assetUrl(entry.textureMap));
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(materialId === "bamboo" ? 1 : 1.15, materialId === "bamboo" ? 1.35 : 1.15);
		return texture;
	}

	if (materialId === "bamboo") {
		return createBambooPreviewTexture("#d3b374");
	}
	return createIvoryPreviewTexture("#eef0ee");
}

function createIvoryPreviewTexture(baseColor) {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const context = canvas.getContext("2d");
	context.fillStyle = baseColor;
	context.fillRect(0, 0, canvas.width, canvas.height);

	const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
	gradient.addColorStop(0, "rgba(255, 255, 255, 0.28)");
	gradient.addColorStop(0.48, "rgba(214, 224, 231, 0.08)");
	gradient.addColorStop(1, "rgba(154, 172, 185, 0.06)");
	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	for (let index = 0; index < 850; index += 1) {
		const x = previewRandom(index, 13) * canvas.width;
		const y = previewRandom(index, 47) * canvas.height;
		const radius = 0.12 + previewRandom(index, 83) * 0.48;
		const alpha = 0.008 + previewRandom(index, 109) * 0.02;
		context.fillStyle = previewRandom(index, 151) > 0.58
			? `rgba(122, 132, 130, ${alpha})`
			: `rgba(255, 255, 255, ${alpha})`;
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
	}

	for (let index = 0; index < 18; index += 1) {
		const y = previewRandom(index, 389) * canvas.height;
		const alpha = 0.01 + previewRandom(index, 397) * 0.02;
		context.strokeStyle = `rgba(116, 128, 132, ${alpha})`;
		context.lineWidth = 0.35 + previewRandom(index, 401) * 0.55;
		context.beginPath();
		context.moveTo(0, y);
		context.bezierCurveTo(78, y + Math.sin(index) * 7, 164, y - Math.cos(index) * 8, canvas.width, y + Math.sin(index * 1.7) * 5);
		context.stroke();
	}

	return finishPreviewTexture(canvas, 1, 1);
}

function createBambooPreviewTexture(baseColor) {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const context = canvas.getContext("2d");
	context.fillStyle = baseColor;
	context.fillRect(0, 0, canvas.width, canvas.height);

	const baseGradient = context.createLinearGradient(0, 0, canvas.width, 0);
	baseGradient.addColorStop(0, "rgba(128, 86, 36, 0.12)");
	baseGradient.addColorStop(0.32, "rgba(255, 236, 176, 0.18)");
	baseGradient.addColorStop(0.68, "rgba(149, 101, 47, 0.13)");
	baseGradient.addColorStop(1, "rgba(255, 234, 164, 0.16)");
	context.fillStyle = baseGradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	for (let x = 0; x < canvas.width; x += 1) {
		const wave = Math.sin(x * 0.035) * 9 + Math.sin(x * 0.012) * 20;
		const alpha = 0.026 + (Math.sin(x * 0.09) + 1) * 0.02;
		context.fillStyle = `rgba(111, 74, 31, ${alpha})`;
		context.fillRect(x, 0, 1, canvas.height);
		context.fillStyle = "rgba(255, 244, 199, 0.07)";
		context.fillRect(x, (wave + canvas.height) % canvas.height, 1, 74);
	}

	for (let index = 0; index < 34; index += 1) {
		const x = previewRandom(index, 211) * canvas.width;
		const width = 0.55 + previewRandom(index, 271) * 1.9;
		context.fillStyle = `rgba(83, 56, 25, ${0.045 + previewRandom(index, 313) * 0.085})`;
		context.fillRect(x, 0, width, canvas.height);
	}

	for (let index = 0; index < 9; index += 1) {
		const x = previewRandom(index, 503) * canvas.width;
		const y = previewRandom(index, 541) * canvas.height;
		const radiusX = 8 + previewRandom(index, 557) * 18;
		const radiusY = 2 + previewRandom(index, 563) * 5;
		context.save();
		context.translate(x, y);
		context.rotate((previewRandom(index, 577) - 0.5) * 0.35);
		const knot = context.createRadialGradient(0, 0, 1, 0, 0, radiusX);
		knot.addColorStop(0, "rgba(92, 51, 16, 0.18)");
		knot.addColorStop(0.65, "rgba(148, 95, 37, 0.08)");
		knot.addColorStop(1, "rgba(255, 232, 160, 0)");
		context.fillStyle = knot;
		context.beginPath();
		context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
		context.fill();
		context.restore();
	}

	return finishPreviewTexture(canvas, 1, 1.35);
}

function finishPreviewTexture(canvas, repeatX, repeatY) {
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeatX, repeatY);
	texture.needsUpdate = true;
	return texture;
}

function previewRandom(index, salt) {
	const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
	return value - Math.floor(value);
}

function previewMaterialFallbackColor(materialId) {
	if (materialId === "bamboo") {
		return "#b58143";
	}
	if (materialId === "ivory") {
		return "#f2ece2";
	}
	return "#d8d0c2";
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

function refreshOpenPreviewVariant(openPreviewVariant, variants) {
	if (!openPreviewVariant || !Array.isArray(variants)) {
		return openPreviewVariant;
	}

	return variants.find((variant) => variant.id === openPreviewVariant.id) || openPreviewVariant;
}

function formatDimension(value) {
	return Number.isFinite(value) ? value.toFixed(2) : "?";
}
