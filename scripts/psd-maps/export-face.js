import fs from "fs";
import path from "path";
import process from "process";
import "ag-psd/initialize-canvas.js";
import { readPsd } from "ag-psd";
import { createCanvas } from "canvas";

const ENGRAVING_PROFILE = Object.freeze({
  baselineHeight: 128,
  interiorHeightDelta: -52,
  edgeHeightDelta: 30,
  edgeWidthPx: 5,
  cavityEdgeWidthPx: 5,
  cavityInteriorExponent: 0.72,
  cavityEdgeStrength: 0.92,
  cavityInteriorStrength: 1,
  normalStrength: 2.4,
  panelRoughness: 214,
  interiorRoughness: 158,
  edgeRoughnessBoost: -18
});

const [, , psdPathArg, facePathArg] = process.argv;

if (!psdPathArg || !facePathArg) {
  console.error("Usage: npm run export-face -- <path-to-psd> <group/layer/path>");
  process.exit(1);
}

const psdPath = path.resolve(process.cwd(), psdPathArg);

if (!fs.existsSync(psdPath)) {
  console.error(`PSD file not found: ${psdPath}`);
  process.exit(1);
}

const pathSegments = facePathArg
  .split("/")
  .map((segment) => segment.trim())
  .filter(Boolean);

if (!pathSegments.length) {
  console.error("Face path must include at least one segment.");
  process.exit(1);
}

const buffer = fs.readFileSync(psdPath);
const psd = readPsd(buffer, {
  skipCompositeImageData: true,
  skipThumbnail: true
});

const layer = findLayerByPath(psd.children || [], pathSegments);

if (!layer) {
  console.error(`Could not find layer path: ${facePathArg}`);
  process.exit(1);
}

if (!layer.canvas) {
  console.error(`Layer has no raster canvas data: ${facePathArg}`);
  process.exit(1);
}

const outputDir = path.resolve(process.cwd(), "out", sanitizeFileName(facePathArg));
fs.mkdirSync(outputDir, { recursive: true });

const symbolPngPath = path.resolve(outputDir, "face-color.png");
fs.writeFileSync(symbolPngPath, layer.canvas.toBuffer("image/png"));

const fullColorCanvas = createCanvas(psd.width, psd.height);
const fullColorContext = fullColorCanvas.getContext("2d");
fullColorContext.clearRect(0, 0, psd.width, psd.height);
fullColorContext.drawImage(layer.canvas, layer.left || 0, layer.top || 0);

const fullColorPngPath = path.resolve(outputDir, "face-color-full.png");
fs.writeFileSync(fullColorPngPath, fullColorCanvas.toBuffer("image/png"));

const panelColorCanvas = createCanvas(psd.width, psd.height);
const panelColorContext = panelColorCanvas.getContext("2d");
panelColorContext.fillStyle = "#f7f5ec";
panelColorContext.fillRect(0, 0, psd.width, psd.height);
panelColorContext.drawImage(layer.canvas, layer.left || 0, layer.top || 0);

const panelColorPngPath = path.resolve(outputDir, "face-color-panel.png");
fs.writeFileSync(panelColorPngPath, panelColorCanvas.toBuffer("image/png"));

const heightImage = buildHeightImage(psd.width, psd.height, layer);
const heightCanvas = createCanvas(psd.width, psd.height);
const heightContext = heightCanvas.getContext("2d");
heightContext.putImageData(heightImage, 0, 0);

const heightPngPath = path.resolve(outputDir, "face-height.png");
fs.writeFileSync(heightPngPath, heightCanvas.toBuffer("image/png"));

const cavityImage = buildCavityImage(psd.width, psd.height, layer);
const cavityCanvas = createCanvas(psd.width, psd.height);
const cavityContext = cavityCanvas.getContext("2d");
cavityContext.putImageData(cavityImage, 0, 0);

const cavityPngPath = path.resolve(outputDir, "face-cavity.png");
fs.writeFileSync(cavityPngPath, cavityCanvas.toBuffer("image/png"));

const normalImage = buildNormalImage(heightImage);
const normalCanvas = createCanvas(psd.width, psd.height);
const normalContext = normalCanvas.getContext("2d");
normalContext.putImageData(normalImage, 0, 0);

const normalPngPath = path.resolve(outputDir, "face-normal.png");
fs.writeFileSync(normalPngPath, normalCanvas.toBuffer("image/png"));

const roughnessImage = buildRoughnessImage(psd.width, psd.height, layer);
const roughnessCanvas = createCanvas(psd.width, psd.height);
const roughnessContext = roughnessCanvas.getContext("2d");
roughnessContext.putImageData(roughnessImage, 0, 0);

const roughnessPngPath = path.resolve(outputDir, "face-roughness.png");
fs.writeFileSync(roughnessPngPath, roughnessCanvas.toBuffer("image/png"));

const metadataPath = path.resolve(outputDir, "face-metadata.json");
fs.writeFileSync(
  metadataPath,
  JSON.stringify(
    {
      sourcePsd: psdPath,
      facePath: facePathArg,
      bounds: {
        top: layer.top ?? null,
        left: layer.left ?? null,
        bottom: layer.bottom ?? null,
        right: layer.right ?? null,
        width: layer.right != null && layer.left != null ? layer.right - layer.left : null,
        height: layer.bottom != null && layer.top != null ? layer.bottom - layer.top : null
      },
      hidden: Boolean(layer.hidden),
      opacity: layer.opacity ?? null,
      effects: layer.effects || null,
      generated: {
        profile: ENGRAVING_PROFILE,
        bevelEnabled: Boolean(layer.effects?.bevel?.enabled),
        bevelSizePx: layer.effects?.bevel?.size?.value ?? 0,
        innerShadowEnabled: Array.isArray(layer.effects?.innerShadow)
          ? layer.effects.innerShadow.some((effect) => effect.enabled)
          : Boolean(layer.effects?.innerShadow?.enabled),
        outputs: {
          symbolColor: symbolPngPath,
          fullColor: fullColorPngPath,
          panelColor: panelColorPngPath,
          height: heightPngPath,
          cavity: cavityPngPath,
          normal: normalPngPath,
          roughness: roughnessPngPath
        }
      }
    },
    null,
    2
  )
);

console.log(`Exported symbol PNG to: ${symbolPngPath}`);
console.log(`Exported full face PNG to: ${fullColorPngPath}`);
console.log(`Exported panel face PNG to: ${panelColorPngPath}`);
console.log(`Exported height map to: ${heightPngPath}`);
console.log(`Exported cavity map to: ${cavityPngPath}`);
console.log(`Exported normal map to: ${normalPngPath}`);
console.log(`Exported roughness map to: ${roughnessPngPath}`);
console.log(`Exported metadata to: ${metadataPath}`);

function findLayerByPath(children, segments) {
  const [current, ...rest] = segments;
  const match = children.find((child) => child.name === current);

  if (!match) {
    return null;
  }

  if (!rest.length) {
    return match;
  }

  return findLayerByPath(match.children || [], rest);
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*]+/g, "-");
}

function buildHeightImage(width, height, layer) {
  const image = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const data = image.data;
  const baseline = ENGRAVING_PROFILE.baselineHeight;
  const interiorHeightDelta = ENGRAVING_PROFILE.interiorHeightDelta;
  const edgeHeightDelta = ENGRAVING_PROFILE.edgeHeightDelta;
  const edgeWidth = ENGRAVING_PROFILE.edgeWidthPx;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = baseline;
    data[index + 1] = baseline;
    data[index + 2] = baseline;
    data[index + 3] = 255;
  }

  const layerContext = layer.canvas.getContext("2d");
  const layerImage = layerContext.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const alphaGrid = buildAlphaGrid(layerImage);

  for (let y = 0; y < layer.canvas.height; y += 1) {
    for (let x = 0; x < layer.canvas.width; x += 1) {
      const alpha = alphaGrid[y][x];

      if (alpha <= 0) {
        continue;
      }

      const edgeDistance = distanceToTransparent(alphaGrid, x, y, edgeWidth);
      const normalizedEdge = Math.min(1, edgeDistance / edgeWidth);
      const edgeProfile = easeInOut(normalizedEdge);
      const localHeight = clamp(
        baseline + interiorHeightDelta + ((1 - edgeProfile) * edgeHeightDelta),
        0,
        255
      );

      const docX = (layer.left || 0) + x;
      const docY = (layer.top || 0) + y;
      const docIndex = ((docY * width) + docX) * 4;

      data[docIndex] = localHeight;
      data[docIndex + 1] = localHeight;
      data[docIndex + 2] = localHeight;
      data[docIndex + 3] = 255;
    }
  }

  return image;
}

function buildNormalImage(heightImage) {
  const normalImage = createCanvas(heightImage.width, heightImage.height)
    .getContext("2d")
    .createImageData(heightImage.width, heightImage.height);
  const src = heightImage.data;
  const dst = normalImage.data;
  const strength = ENGRAVING_PROFILE.normalStrength;

  for (let y = 0; y < heightImage.height; y += 1) {
    for (let x = 0; x < heightImage.width; x += 1) {
      const left = getHeight(src, heightImage.width, heightImage.height, x - 1, y);
      const right = getHeight(src, heightImage.width, heightImage.height, x + 1, y);
      const up = getHeight(src, heightImage.width, heightImage.height, x, y - 1);
      const down = getHeight(src, heightImage.width, heightImage.height, x, y + 1);

      const dx = (right - left) / 255;
      const dy = (down - up) / 255;
      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1;
      const length = Math.sqrt((nx * nx) + (ny * ny) + (nz * nz)) || 1;

      const outIndex = ((y * heightImage.width) + x) * 4;
      dst[outIndex] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      dst[outIndex + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      dst[outIndex + 2] = Math.round(((nz / length) * 0.5 + 0.5) * 255);
      dst[outIndex + 3] = 255;
    }
  }

  return normalImage;
}

function buildCavityImage(width, height, layer) {
  const image = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const data = image.data;
  const edgeWidth = ENGRAVING_PROFILE.cavityEdgeWidthPx;
  const interiorExponent = ENGRAVING_PROFILE.cavityInteriorExponent;
  const edgeStrength = ENGRAVING_PROFILE.cavityEdgeStrength;
  const interiorStrength = ENGRAVING_PROFILE.cavityInteriorStrength;
  const layerContext = layer.canvas.getContext("2d");
  const layerImage = layerContext.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const alphaGrid = buildAlphaGrid(layerImage);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
    data[index + 3] = 0;
  }

  for (let y = 0; y < layer.canvas.height; y += 1) {
    for (let x = 0; x < layer.canvas.width; x += 1) {
      const alpha = alphaGrid[y][x];

      if (alpha <= 0) {
        continue;
      }

      const edgeDistance = distanceToTransparent(alphaGrid, x, y, edgeWidth);
      const normalizedEdge = clamp(edgeDistance / edgeWidth, 0, 1);
      const interiorMask = Math.pow(easeInOut(normalizedEdge), interiorExponent) * interiorStrength;
      const edgeMask = (1 - easeOut(normalizedEdge)) * edgeStrength;
      const combinedMask = clamp(Math.max(interiorMask * 0.84, edgeMask), 0, 1);
      const docX = (layer.left || 0) + x;
      const docY = (layer.top || 0) + y;
      const docIndex = ((docY * width) + docX) * 4;

      data[docIndex] = Math.round(interiorMask * 255);
      data[docIndex + 1] = Math.round(edgeMask * 255);
      data[docIndex + 2] = Math.round(combinedMask * 255);
      data[docIndex + 3] = alpha;
    }
  }

  return image;
}

function buildRoughnessImage(width, height, layer) {
  const image = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const data = image.data;
  const background = ENGRAVING_PROFILE.panelRoughness;
  const symbolBase = ENGRAVING_PROFILE.interiorRoughness;
  const edgeWidth = ENGRAVING_PROFILE.edgeWidthPx;
  const layerContext = layer.canvas.getContext("2d");
  const layerImage = layerContext.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const alphaGrid = buildAlphaGrid(layerImage);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = background;
    data[index + 1] = background;
    data[index + 2] = background;
    data[index + 3] = 255;
  }

  for (let y = 0; y < layer.canvas.height; y += 1) {
    for (let x = 0; x < layer.canvas.width; x += 1) {
      const alpha = alphaGrid[y][x];

      if (alpha <= 0) {
        continue;
      }

      const edgeDistance = distanceToTransparent(alphaGrid, x, y, edgeWidth);
      const normalizedEdge = Math.min(1, edgeDistance / edgeWidth);
      const edgeProfile = easeInOut(normalizedEdge);
      const localRoughness = Math.round(
        symbolBase + ((1 - edgeProfile) * ENGRAVING_PROFILE.edgeRoughnessBoost)
      );
      const docX = (layer.left || 0) + x;
      const docY = (layer.top || 0) + y;
      const docIndex = ((docY * width) + docX) * 4;

      data[docIndex] = localRoughness;
      data[docIndex + 1] = localRoughness;
      data[docIndex + 2] = localRoughness;
      data[docIndex + 3] = 255;
    }
  }

  return image;
}

function buildAlphaGrid(layerImage) {
  const alphaGrid = [];

  for (let y = 0; y < layerImage.height; y += 1) {
    const row = [];
    for (let x = 0; x < layerImage.width; x += 1) {
      const alphaIndex = ((y * layerImage.width) + x) * 4 + 3;
      row.push(layerImage.data[alphaIndex]);
    }
    alphaGrid.push(row);
  }

  return alphaGrid;
}

function distanceToTransparent(alphaGrid, x, y, limit) {
  let best = limit;

  for (let offsetY = -limit; offsetY <= limit; offsetY += 1) {
    for (let offsetX = -limit; offsetX <= limit; offsetX += 1) {
      const sampleX = x + offsetX;
      const sampleY = y + offsetY;

      if (
        sampleY < 0 ||
        sampleY >= alphaGrid.length ||
        sampleX < 0 ||
        sampleX >= alphaGrid[0].length ||
        alphaGrid[sampleY][sampleX] <= 0
      ) {
        const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY));
        best = Math.min(best, distance);
      }
    }
  }

  return best;
}

function getHeight(data, width, height, x, y) {
  const safeX = clamp(x, 0, width - 1);
  const safeY = clamp(y, 0, height - 1);
  return data[((safeY * width) + safeX) * 4];
}

function easeOut(value) {
  return 1 - ((1 - value) * (1 - value));
}

function easeInOut(value) {
  if (value < 0.5) {
    return 2 * value * value;
  }

  return 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
