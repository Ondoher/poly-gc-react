import fs from "fs";
import path from "path";
import process from "process";
import { createCanvas, loadImage } from "canvas";
import { GENERATED_FACE_IMAGES_DIR, GENERATED_TOP_MAPS_DIR, ROOT_DIR } from "../3d-assets/asset-paths.js";

const TOP_MAP_PROFILE = Object.freeze({
  fieldColor: { r: 245, g: 241, b: 233 },
  fieldShadowStrength: 0,
  borderInsetPx: 0,
  borderStrength: 0,
  glyphBoost: 1.12,
  glyphLift: 0.02,
  edgeDarkening: 0.72,
  interiorPreservation: 0.92,
  cavityChannelWeight: 0.22,
  edgeExponent: 0.52,
  fillExponent: 1.15,
  cavityExponent: 0.78,
  hardEdgeWidthPx: 2,
  hardEdgeStrength: 1,
  hardFillInsetPx: 2
});

const [, , faceKeyArg, sourceImageOverrideArg] = process.argv;

if (!faceKeyArg) {
  console.error("Usage: node generate-top-map.js <face-key> [source-image-path]");
  process.exit(1);
}

const FACE_DIR = path.resolve(GENERATED_FACE_IMAGES_DIR, faceKeyArg);
const OUTPUT_DIR = path.resolve(GENERATED_TOP_MAPS_DIR, faceKeyArg);

const faceColorPath = sourceImageOverrideArg
  ? path.resolve(ROOT_DIR, sourceImageOverrideArg)
  : path.resolve(FACE_DIR, "face-color-full.png");
const faceCavityPath = path.resolve(FACE_DIR, "face-cavity.png");

if (!fs.existsSync(faceColorPath) || (!sourceImageOverrideArg && !fs.existsSync(faceCavityPath))) {
  console.error(`Missing input maps for ${faceKeyArg}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const faceImage = await loadImage(faceColorPath);
const cavityImage = sourceImageOverrideArg ? null : await loadImage(faceCavityPath);

const topColorCanvas = createCanvas(faceImage.width, faceImage.height);
const topColorContext = topColorCanvas.getContext("2d");
const topCavityCanvas = createCanvas(faceImage.width, faceImage.height);
const topCavityContext = topCavityCanvas.getContext("2d");
const topMaskCanvas = createCanvas(faceImage.width, faceImage.height);
const topMaskContext = topMaskCanvas.getContext("2d");
const topReliefCanvas = createCanvas(faceImage.width, faceImage.height);
const topReliefContext = topReliefCanvas.getContext("2d");

topColorContext.drawImage(faceImage, 0, 0);
const faceColorData = topColorContext.getImageData(0, 0, faceImage.width, faceImage.height);

const cavityData = cavityImage
  ? (() => {
      topCavityContext.drawImage(cavityImage, 0, 0);
      return topCavityContext.getImageData(0, 0, faceImage.width, faceImage.height);
    })()
  : buildSyntheticCavityImage(faceColorData, faceImage.width, faceImage.height);

const topColorImage = buildTopColor(faceColorData, cavityData, faceImage.width, faceImage.height);
const topCavityImage = buildTopCavity(faceColorData, cavityData, faceImage.width, faceImage.height);
const topMaskImage = buildTopMask(faceColorData, faceImage.width, faceImage.height);
const topReliefImage = buildTopRelief(faceColorData, cavityData, faceImage.width, faceImage.height);

topColorContext.putImageData(topColorImage, 0, 0);
topCavityContext.putImageData(topCavityImage, 0, 0);
topMaskContext.putImageData(topMaskImage, 0, 0);
topReliefContext.putImageData(topReliefImage, 0, 0);

const topColorPath = path.resolve(OUTPUT_DIR, "top-color.png");
const topCavityPath = path.resolve(OUTPUT_DIR, "top-cavity.png");
const topMaskPath = path.resolve(OUTPUT_DIR, "top-mask.png");
const topReliefPath = path.resolve(OUTPUT_DIR, "top-relief.png");
const topMetadataPath = path.resolve(OUTPUT_DIR, "top-map-metadata.json");

fs.writeFileSync(topColorPath, topColorCanvas.toBuffer("image/png"));
fs.writeFileSync(topCavityPath, topCavityCanvas.toBuffer("image/png"));
fs.writeFileSync(topMaskPath, topMaskCanvas.toBuffer("image/png"));
fs.writeFileSync(topReliefPath, topReliefCanvas.toBuffer("image/png"));
fs.writeFileSync(
  topMetadataPath,
  JSON.stringify(
    {
      faceKey: faceKeyArg,
      source: {
        faceColor: faceColorPath,
        faceCavity: cavityImage ? faceCavityPath : null,
        externalBitmap: sourceImageOverrideArg ? faceColorPath : null,
        cavityMode: cavityImage ? "psd-derived" : "synthetic-from-alpha"
      },
      outputs: {
        topColor: topColorPath,
        topCavity: topCavityPath,
        topMask: topMaskPath,
        topRelief: topReliefPath
      },
      profile: TOP_MAP_PROFILE
    },
    null,
    2
  )
);

console.log(`Generated top-color for ${faceKeyArg}: ${topColorPath}`);
console.log(`Generated top-cavity for ${faceKeyArg}: ${topCavityPath}`);
console.log(`Generated top-mask for ${faceKeyArg}: ${topMaskPath}`);
console.log(`Generated top-relief for ${faceKeyArg}: ${topReliefPath}`);
console.log(`Generated metadata for ${faceKeyArg}: ${topMetadataPath}`);

function buildTopColor(faceColorImage, cavityImage, width, height) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const src = faceColorImage.data;
  const cavity = cavityImage.data;
  const alphaGrid = buildAlphaGridFromImageData(faceColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const alpha = src[index + 3] / 255;
      const softInterior = Math.pow(cavity[index] / 255, TOP_MAP_PROFILE.fillExponent);
      const softEdge = Math.pow(cavity[index + 1] / 255, TOP_MAP_PROFILE.edgeExponent);
      const combined = Math.pow(cavity[index + 2] / 255, TOP_MAP_PROFILE.cavityExponent);
      const hardMasks = buildHardMasks(alphaGrid, x, y);
      const interior = Math.max(softInterior * 0.65, hardMasks.fill);
      const edge = Math.max(softEdge * 0.45, hardMasks.edge);
      const baseColor = {
        r: TOP_MAP_PROFILE.fieldColor.r,
        g: TOP_MAP_PROFILE.fieldColor.g,
        b: TOP_MAP_PROFILE.fieldColor.b
      };

      let outR = baseColor.r;
      let outG = baseColor.g;
      let outB = baseColor.b;

      if (alpha > 0) {
        const boosted = boostColor(
          src[index],
          src[index + 1],
          src[index + 2],
          TOP_MAP_PROFILE.glyphBoost,
          TOP_MAP_PROFILE.glyphLift
        );
        const colorPreservation = Math.min(1, interior * TOP_MAP_PROFILE.interiorPreservation + alpha * 0.24);
        const edgeShadow = edge * TOP_MAP_PROFILE.edgeDarkening;
        const cavityShadow = combined * TOP_MAP_PROFILE.cavityChannelWeight;

        outR = lerp(baseColor.r, boosted.r, colorPreservation);
        outG = lerp(baseColor.g, boosted.g, colorPreservation);
        outB = lerp(baseColor.b, boosted.b, colorPreservation);

        outR = lerp(outR, outR * 0.45, edgeShadow);
        outG = lerp(outG, outG * 0.45, edgeShadow);
        outB = lerp(outB, outB * 0.45, edgeShadow);

        outR = lerp(outR, outR * 0.78, cavityShadow);
        outG = lerp(outG, outG * 0.78, cavityShadow);
        outB = lerp(outB, outB * 0.78, cavityShadow);
      }

      out[index] = Math.round(clamp(outR, 0, 255));
      out[index + 1] = Math.round(clamp(outG, 0, 255));
      out[index + 2] = Math.round(clamp(outB, 0, 255));
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildTopCavity(faceColorImage, cavityImage, width, height) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const faceSrc = faceColorImage.data;
  const src = cavityImage.data;
  const alphaGrid = buildAlphaGridFromImageData(faceColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const alpha = faceSrc[index + 3] / 255;
      const hardMasks = buildHardMasks(alphaGrid, x, y);
      const interior = Math.max(
        Math.pow(src[index] / 255, TOP_MAP_PROFILE.fillExponent) * 0.65,
        hardMasks.fill
      );
      const edge = Math.max(
        Math.pow(src[index + 1] / 255, TOP_MAP_PROFILE.edgeExponent) * 0.45,
        hardMasks.edge
      );
      const combined = Math.max(
        Math.pow(src[index + 2] / 255, TOP_MAP_PROFILE.cavityExponent) * 0.7,
        edge,
        interior * alpha
      );

      out[index] = Math.round(interior * 255);
      out[index + 1] = Math.round(edge * 255);
      out[index + 2] = Math.round(combined * 255);
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildTopMask(faceColorImage, width, height) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const src = faceColorImage.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const alpha = src[index + 3];
      out[index] = alpha;
      out[index + 1] = alpha;
      out[index + 2] = alpha;
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildTopRelief(faceColorImage, cavityImage, width, height) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const faceSrc = faceColorImage.data;
  const cavitySrc = cavityImage.data;
  const alphaGrid = buildAlphaGridFromImageData(faceColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const alpha = faceSrc[index + 3] / 255;
      const hardMasks = buildHardMasks(alphaGrid, x, y);
      const interior = Math.max(
        Math.pow(cavitySrc[index] / 255, TOP_MAP_PROFILE.fillExponent) * 0.65,
        hardMasks.fill
      );
      const edge = Math.max(
        Math.pow(cavitySrc[index + 1] / 255, TOP_MAP_PROFILE.edgeExponent) * 0.45,
        hardMasks.edge
      );
      const reliefValue = clamp((interior * 0.9) + (edge * 0.55), 0, 1) * alpha;
      const encoded = Math.round(reliefValue * 255);

      out[index] = encoded;
      out[index + 1] = encoded;
      out[index + 2] = encoded;
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildSyntheticCavityImage(faceColorImage, width, height) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const alphaGrid = buildAlphaGridFromImageData(faceColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const alpha = alphaGrid[y][x];

      if (alpha <= 0) {
        out[index] = 0;
        out[index + 1] = 0;
        out[index + 2] = 0;
        out[index + 3] = 255;
        continue;
      }

      const distance = distanceToTransparentAlpha(
        alphaGrid,
        x,
        y,
        Math.max(TOP_MAP_PROFILE.hardEdgeWidthPx, TOP_MAP_PROFILE.hardFillInsetPx) + 4
      );
      const edge = (1 - smoothstep(0.8, TOP_MAP_PROFILE.hardEdgeWidthPx + 0.85, distance)) * alpha;
      const interior = smoothstep(
        TOP_MAP_PROFILE.hardFillInsetPx - 0.75,
        TOP_MAP_PROFILE.hardFillInsetPx + 1.5,
        distance
      ) * alpha;
      const combined = clamp((interior * 0.82) + (edge * 0.9), 0, 1);

      out[index] = Math.round(interior * 255);
      out[index + 1] = Math.round(edge * 255);
      out[index + 2] = Math.round(combined * 255);
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildAlphaGridFromImageData(imageData, width, height) {
  const alphaGrid = [];

  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4 + 3;
      row.push(imageData.data[index] / 255);
    }
    alphaGrid.push(row);
  }

  return alphaGrid;
}

function buildHardMasks(alphaGrid, x, y) {
  const alpha = getAlpha(alphaGrid, x, y);
  if (alpha <= 0) {
    return { fill: 0, edge: 0 };
  }

  const edgeDistance = distanceToTransparentAlpha(alphaGrid, x, y, TOP_MAP_PROFILE.hardEdgeWidthPx);
  const fillDistance = distanceToTransparentAlpha(
    alphaGrid,
    x,
    y,
    Math.max(TOP_MAP_PROFILE.hardEdgeWidthPx, TOP_MAP_PROFILE.hardFillInsetPx)
  );
  const edge = edgeDistance <= TOP_MAP_PROFILE.hardEdgeWidthPx
    ? TOP_MAP_PROFILE.hardEdgeStrength
    : 0;
  const fill = fillDistance > TOP_MAP_PROFILE.hardFillInsetPx ? 1 : 0;

  return { fill, edge };
}

function distanceToTransparentAlpha(alphaGrid, x, y, limit) {
  let best = limit + 1;

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
        const distance = Math.hypot(offsetX, offsetY);
        best = Math.min(best, distance);
      }
    }
  }

  return best;
}

function getAlpha(alphaGrid, x, y) {
  if (y < 0 || y >= alphaGrid.length || x < 0 || x >= alphaGrid[0].length) {
    return 0;
  }

  return alphaGrid[y][x];
}

function boostColor(r, g, b, gain, lift) {
  return {
    r: ((r / 255 - 0.5) * gain + 0.5 + lift) * 255,
    g: ((g / 255 - 0.5) * gain + 0.5 + lift) * 255,
    b: ((b / 255 - 0.5) * gain + 0.5 + lift) * 255
  };
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - (2 * t));
}
