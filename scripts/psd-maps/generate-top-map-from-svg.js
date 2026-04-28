import fs from "fs";
import path from "path";
import process from "process";
import { createCanvas, loadImage } from "canvas";
import { GENERATED_FACE_IMAGES_DIR, GENERATED_TOP_MAPS_DIR, ROOT_DIR } from "../3d-assets/asset-paths.js";

const SVG_TOP_MAP_PROFILE = Object.freeze({
  fieldColor: { r: 245, g: 241, b: 233 },
  glyphBoost: 1.04,
  glyphLift: 0.01,
  wallDarkening: 0.74,
  floorDarkening: 0.08,
  shoulderLift: 0.12,
  cavityChannelWeight: 0.12,
  wallWidthPx: 1,
  shoulderWidthPx: 3,
  floorInsetPx: 3,
  red: "#fb1d05",
  blue: "#0505d1",
  green: "#038248"
});
const SVG_OUTPUT_SCALE = 4;

const [, , faceKeyArg, svgPathArg] = process.argv;

if (!faceKeyArg || !svgPathArg) {
  console.error("Usage: node generate-top-map-from-svg.js <face-key> <path-to-svg>");
  process.exit(1);
}

const svgPath = path.resolve(ROOT_DIR, svgPathArg);
const faceColorPath = path.resolve(GENERATED_FACE_IMAGES_DIR, faceKeyArg, "face-color-full.png");
const outputDir = path.resolve(GENERATED_TOP_MAPS_DIR, faceKeyArg);

if (!fs.existsSync(svgPath) || !fs.existsSync(faceColorPath)) {
  console.error("Missing SVG or face-color-full input.");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const referenceFace = await loadImage(faceColorPath);
const sanitizedSvg = sanitizeSvg(fs.readFileSync(svgPath, "utf8"));
const svgImage = await loadImage(svgToDataUrl(sanitizedSvg));
const outputWidth = referenceFace.width * SVG_OUTPUT_SCALE;
const outputHeight = referenceFace.height * SVG_OUTPUT_SCALE;
const scaledProfile = getScaledProfile();

const colorCanvas = createCanvas(outputWidth, outputHeight);
const colorContext = colorCanvas.getContext("2d");
const cavityCanvas = createCanvas(outputWidth, outputHeight);
const cavityContext = cavityCanvas.getContext("2d");
const maskCanvas = createCanvas(outputWidth, outputHeight);
const maskContext = maskCanvas.getContext("2d");
const reliefCanvas = createCanvas(outputWidth, outputHeight);
const reliefContext = reliefCanvas.getContext("2d");

colorContext.clearRect(0, 0, outputWidth, outputHeight);
colorContext.drawImage(svgImage, 0, 0, outputWidth, outputHeight);
const svgColorImage = colorContext.getImageData(0, 0, outputWidth, outputHeight);

const topColorImage = buildSvgTopColor(svgColorImage, outputWidth, outputHeight, scaledProfile);
const topCavityImage = buildSvgTopCavity(svgColorImage, outputWidth, outputHeight, scaledProfile);
const topMaskImage = buildSvgTopMask(svgColorImage, outputWidth, outputHeight);
const topReliefImage = buildSvgTopRelief(svgColorImage, outputWidth, outputHeight, scaledProfile);

colorContext.putImageData(topColorImage, 0, 0);
cavityContext.putImageData(topCavityImage, 0, 0);
maskContext.putImageData(topMaskImage, 0, 0);
reliefContext.putImageData(topReliefImage, 0, 0);

const topColorPath = path.resolve(outputDir, "top-color-svg.png");
const topCavityPath = path.resolve(outputDir, "top-cavity-svg.png");
const topMaskPath = path.resolve(outputDir, "top-mask-svg.png");
const topReliefPath = path.resolve(outputDir, "top-relief-svg.png");
const metadataPath = path.resolve(outputDir, "top-map-svg-metadata.json");

fs.writeFileSync(topColorPath, colorCanvas.toBuffer("image/png"));
fs.writeFileSync(topCavityPath, cavityCanvas.toBuffer("image/png"));
fs.writeFileSync(topMaskPath, maskCanvas.toBuffer("image/png"));
fs.writeFileSync(topReliefPath, reliefCanvas.toBuffer("image/png"));
fs.writeFileSync(
  metadataPath,
  JSON.stringify(
    {
      faceKey: faceKeyArg,
      source: {
        svg: svgPath,
        faceReference: faceColorPath
      },
      outputs: {
        topColor: topColorPath,
        topCavity: topCavityPath,
        topMask: topMaskPath,
        topRelief: topReliefPath
      },
      profile: SVG_TOP_MAP_PROFILE,
      outputScale: SVG_OUTPUT_SCALE,
      outputWidth,
      outputHeight
    },
    null,
    2
  )
);

console.log(`Generated SVG top-color for ${faceKeyArg}: ${topColorPath}`);
console.log(`Generated SVG top-cavity for ${faceKeyArg}: ${topCavityPath}`);
console.log(`Generated SVG top-mask for ${faceKeyArg}: ${topMaskPath}`);
console.log(`Generated SVG top-relief for ${faceKeyArg}: ${topReliefPath}`);
console.log(`Generated SVG metadata for ${faceKeyArg}: ${metadataPath}`);

function sanitizeSvg(svgSource) {
  const viewBoxMatch = svgSource.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch?.[1] ?? "-192 293.9 210 255";
  const [, , width = "210", height = "255"] = viewBox.split(/\s+/);
  const glyphPaths = Array.from(
    svgSource.matchAll(/<path\b[^>]*class="st(?:7|8|9|10)"[\s\S]*?\/>/g),
    (match) => match[0]
  );

  if (glyphPaths.length === 0) {
    throw new Error("No glyph paths found in SVG source.");
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">
      <style>
        .st7{fill:${SVG_TOP_MAP_PROFILE.red};}
        .st8{fill:${SVG_TOP_MAP_PROFILE.blue};}
        .st9{fill:${SVG_TOP_MAP_PROFILE.red};}
        .st10{fill:${SVG_TOP_MAP_PROFILE.green};}
      </style>
      ${glyphPaths.join("\n")}
    </svg>
  `;
}

function svgToDataUrl(svgSource) {
  return `data:image/svg+xml;base64,${Buffer.from(svgSource).toString("base64")}`;
}

function buildSvgTopColor(svgColorImage, width, height, scaledProfile) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const src = svgColorImage.data;
  const alphaGrid = buildAlphaGridFromImageData(svgColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const alpha = src[index + 3] / 255;
      const bevelMasks = buildBevelMasks(alphaGrid, x, y, scaledProfile);
      let outR = SVG_TOP_MAP_PROFILE.fieldColor.r;
      let outG = SVG_TOP_MAP_PROFILE.fieldColor.g;
      let outB = SVG_TOP_MAP_PROFILE.fieldColor.b;

      if (alpha > 0) {
        const boosted = boostColor(
          src[index],
          src[index + 1],
          src[index + 2],
          SVG_TOP_MAP_PROFILE.glyphBoost,
          SVG_TOP_MAP_PROFILE.glyphLift
        );
        const glyphCarry = Math.max(alpha * 0.92, bevelMasks.floor * 0.84 + bevelMasks.shoulder * 0.5 + bevelMasks.wall * 0.22);
        outR = lerp(outR, boosted.r, glyphCarry);
        outG = lerp(outG, boosted.g, glyphCarry);
        outB = lerp(outB, boosted.b, glyphCarry);

        outR = lerp(outR, outR * 0.78, bevelMasks.floor * SVG_TOP_MAP_PROFILE.floorDarkening);
        outG = lerp(outG, outG * 0.78, bevelMasks.floor * SVG_TOP_MAP_PROFILE.floorDarkening);
        outB = lerp(outB, outB * 0.78, bevelMasks.floor * SVG_TOP_MAP_PROFILE.floorDarkening);

        outR = lerp(outR, outR * 0.34, bevelMasks.wall * SVG_TOP_MAP_PROFILE.wallDarkening);
        outG = lerp(outG, outG * 0.34, bevelMasks.wall * SVG_TOP_MAP_PROFILE.wallDarkening);
        outB = lerp(outB, outB * 0.34, bevelMasks.wall * SVG_TOP_MAP_PROFILE.wallDarkening);

        outR = lerp(outR, Math.min(255, outR + (255 - outR) * 0.55), bevelMasks.shoulder * SVG_TOP_MAP_PROFILE.shoulderLift);
        outG = lerp(outG, Math.min(255, outG + (255 - outG) * 0.55), bevelMasks.shoulder * SVG_TOP_MAP_PROFILE.shoulderLift);
        outB = lerp(outB, Math.min(255, outB + (255 - outB) * 0.55), bevelMasks.shoulder * SVG_TOP_MAP_PROFILE.shoulderLift);

        const cavityPresence = Math.max(bevelMasks.wall, bevelMasks.floor * 0.45);
        outR = lerp(outR, outR * 0.86, cavityPresence * SVG_TOP_MAP_PROFILE.cavityChannelWeight);
        outG = lerp(outG, outG * 0.86, cavityPresence * SVG_TOP_MAP_PROFILE.cavityChannelWeight);
        outB = lerp(outB, outB * 0.86, cavityPresence * SVG_TOP_MAP_PROFILE.cavityChannelWeight);
      }

      out[index] = Math.round(clamp(outR, 0, 255));
      out[index + 1] = Math.round(clamp(outG, 0, 255));
      out[index + 2] = Math.round(clamp(outB, 0, 255));
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildSvgTopCavity(svgColorImage, width, height, scaledProfile) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const alphaGrid = buildAlphaGridFromImageData(svgColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const bevelMasks = buildBevelMasks(alphaGrid, x, y, scaledProfile);
      out[index] = Math.round(bevelMasks.floor * 255);
      out[index + 1] = Math.round(bevelMasks.wall * 255);
      out[index + 2] = Math.round(bevelMasks.shoulder * 255);
      out[index + 3] = 255;
    }
  }

  return output;
}

function buildSvgTopMask(svgColorImage, width, height) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const src = svgColorImage.data;

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

function buildSvgTopRelief(svgColorImage, width, height, scaledProfile) {
  const output = createCanvas(width, height).getContext("2d").createImageData(width, height);
  const out = output.data;
  const alphaGrid = buildAlphaGridFromImageData(svgColorImage, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const bevelMasks = buildBevelMasks(alphaGrid, x, y, scaledProfile);
      const reliefValue = clamp((bevelMasks.floor * 0.92) + (bevelMasks.wall * 0.58) + (bevelMasks.shoulder * 0.24), 0, 1);
      const encoded = Math.round(reliefValue * 255);

      out[index] = encoded;
      out[index + 1] = encoded;
      out[index + 2] = encoded;
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

function buildBevelMasks(alphaGrid, x, y, scaledProfile) {
  const alpha = getAlpha(alphaGrid, x, y);
  if (alpha <= 0) {
    return { floor: 0, wall: 0, shoulder: 0 };
  }

  const searchLimit = Math.max(
    scaledProfile.wallWidthPx,
    scaledProfile.shoulderWidthPx,
    scaledProfile.floorInsetPx
  );
  const distance = distanceToTransparentAlpha(alphaGrid, x, y, searchLimit);
  const edgeBlend = smoothstep(0.06, 0.92, alpha);
  const wall = (1 - smoothstep(scaledProfile.wallWidthPx - 0.75, scaledProfile.wallWidthPx + 0.75, distance))
    * edgeBlend;
  const shoulder = smoothstep(scaledProfile.wallWidthPx - 0.5, scaledProfile.wallWidthPx + 0.8, distance)
    * (1 - smoothstep(scaledProfile.shoulderWidthPx - 0.8, scaledProfile.shoulderWidthPx + 0.8, distance))
    * edgeBlend;
  const floor = smoothstep(scaledProfile.floorInsetPx - 1.1, scaledProfile.floorInsetPx + 1.1, distance)
    * edgeBlend;

  return { floor, wall, shoulder };
}

function getScaledProfile() {
  return {
    wallWidthPx: Math.max(1, Math.round(SVG_TOP_MAP_PROFILE.wallWidthPx * SVG_OUTPUT_SCALE)),
    shoulderWidthPx: Math.max(1, Math.round(SVG_TOP_MAP_PROFILE.shoulderWidthPx * SVG_OUTPUT_SCALE)),
    floorInsetPx: Math.max(1, Math.round(SVG_TOP_MAP_PROFILE.floorInsetPx * SVG_OUTPUT_SCALE))
  };
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
