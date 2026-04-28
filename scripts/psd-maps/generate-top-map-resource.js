import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { GENERATED_TOP_MAPS_DIR, ROOT_DIR } from "../3d-assets/asset-paths.js";

const [, , faceKeyArg, sourceTypeOverrideArg, sourcePathOverrideArg] = process.argv;

if (!faceKeyArg) {
  console.error("Usage: node generate-top-map-resource.js <face-key> [source-type] [source-path]");
  process.exit(1);
}

const SCRIPT_DIR = process.cwd();
const registryPath = path.resolve(SCRIPT_DIR, "top-map-sources.json");
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
  : {};

const registryEntry = registry[faceKeyArg] ?? {};
const sourceType = sourceTypeOverrideArg ?? registryEntry.sourceType ?? "bitmap";
const outputDir = path.resolve(GENERATED_TOP_MAPS_DIR, faceKeyArg);

fs.mkdirSync(outputDir, { recursive: true });

if (sourceType === "svg") {
  const svgPath = sourcePathOverrideArg ?? registryEntry.svgPath;

  if (!svgPath) {
    console.error(`No svgPath configured for ${faceKeyArg}`);
    process.exit(1);
  }

  runNodeScript("generate-top-map-from-svg.js", [faceKeyArg, svgPath]);
  promoteVariantOutputs(faceKeyArg, "svg");
  writeActiveMetadata(faceKeyArg, "svg", registryEntry, {
    topColor: path.resolve(outputDir, "top-color.png"),
    topCavity: path.resolve(outputDir, "top-cavity.png"),
    topMask: path.resolve(outputDir, "top-mask.png"),
    topRelief: path.resolve(outputDir, "top-relief.png"),
    topMetadata: path.resolve(outputDir, "top-map-metadata.json"),
    variantTopColor: path.resolve(outputDir, "top-color-svg.png"),
    variantTopCavity: path.resolve(outputDir, "top-cavity-svg.png"),
    variantTopMask: path.resolve(outputDir, "top-mask-svg.png"),
    variantTopRelief: path.resolve(outputDir, "top-relief-svg.png"),
    variantMetadata: path.resolve(outputDir, "top-map-svg-metadata.json")
  });
} else if (sourceType === "bitmap") {
  runNodeScript(
    "generate-top-map.js",
    sourcePathOverrideArg ? [faceKeyArg, sourcePathOverrideArg] : [faceKeyArg]
  );
  writeActiveMetadata(faceKeyArg, "bitmap", registryEntry, {
    topColor: path.resolve(outputDir, "top-color.png"),
    topCavity: path.resolve(outputDir, "top-cavity.png"),
    topMask: path.resolve(outputDir, "top-mask.png"),
    topRelief: path.resolve(outputDir, "top-relief.png"),
    topMetadata: path.resolve(outputDir, "top-map-metadata.json")
  });
} else {
  console.error(`Unsupported sourceType "${sourceType}" for ${faceKeyArg}`);
  process.exit(1);
}

console.log(`Active top-map source for ${faceKeyArg}: ${sourceType}`);

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [scriptName, ...args], {
    cwd: SCRIPT_DIR,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function promoteVariantOutputs(faceKey, variantName) {
  const variantSuffix = `-${variantName}`;
  const variantTopColor = path.resolve(outputDir, `top-color${variantSuffix}.png`);
  const variantTopCavity = path.resolve(outputDir, `top-cavity${variantSuffix}.png`);
  const variantTopMask = path.resolve(outputDir, `top-mask${variantSuffix}.png`);
  const variantTopRelief = path.resolve(outputDir, `top-relief${variantSuffix}.png`);
  const variantMetadata = path.resolve(outputDir, `top-map${variantSuffix === "-svg" ? "-svg" : variantSuffix}-metadata.json`);

  if (
    !fs.existsSync(variantTopColor) ||
    !fs.existsSync(variantTopCavity) ||
    !fs.existsSync(variantTopMask) ||
    !fs.existsSync(variantTopRelief) ||
    !fs.existsSync(variantMetadata)
  ) {
    console.error(`Missing ${variantName} variant outputs for ${faceKey}`);
    process.exit(1);
  }

  fs.copyFileSync(variantTopColor, path.resolve(outputDir, "top-color.png"));
  fs.copyFileSync(variantTopCavity, path.resolve(outputDir, "top-cavity.png"));
  fs.copyFileSync(variantTopMask, path.resolve(outputDir, "top-mask.png"));
  fs.copyFileSync(variantTopRelief, path.resolve(outputDir, "top-relief.png"));
  fs.copyFileSync(variantMetadata, path.resolve(outputDir, "top-map-metadata.json"));
}

function writeActiveMetadata(faceKey, sourceTypeName, registryConfig, paths) {
  const activeMetadataPath = path.resolve(outputDir, "top-map-active.json");
  fs.writeFileSync(
    activeMetadataPath,
    JSON.stringify(
      {
        faceKey,
        sourceType: sourceTypeName,
        registryConfig,
        outputs: paths
      },
      null,
      2
    )
  );
}
