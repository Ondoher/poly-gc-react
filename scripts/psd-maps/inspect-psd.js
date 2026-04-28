import fs from "fs";
import path from "path";
import process from "process";

const [, , psdPathArg] = process.argv;

if (!psdPathArg) {
  console.error("Usage: npm run inspect -- <path-to-psd>");
  process.exit(1);
}

const psdPath = path.resolve(process.cwd(), psdPathArg);

if (!fs.existsSync(psdPath)) {
  console.error(`PSD file not found: ${psdPath}`);
  process.exit(1);
}

const outputDir = path.resolve(process.cwd(), "out");
fs.mkdirSync(outputDir, { recursive: true });

let parserName = null;
let inspectPsd = null;

try {
  const agPsd = await import("ag-psd");
  parserName = "ag-psd";
  inspectPsd = () => {
    const buffer = fs.readFileSync(psdPath);
    const psd = agPsd.readPsd(buffer, {
      skipLayerImageData: true,
      skipCompositeImageData: true,
      skipThumbnail: true
    });

    return {
      parser: parserName,
      file: {
        path: psdPath,
        name: path.basename(psdPath)
      },
      document: {
        width: psd.width,
        height: psd.height,
        children: summarizeChildren(psd.children || [])
      }
    };
  };
} catch (agPsdError) {
  try {
    const webtoon = await import("@webtoon/psd");
    parserName = "@webtoon/psd";
    inspectPsd = () => {
      const buffer = fs.readFileSync(psdPath);
      const psd = webtoon.PSD.parse(buffer);

      return {
        parser: parserName,
        file: {
          path: psdPath,
          name: path.basename(psdPath)
        },
        document: {
          width: psd.width,
          height: psd.height,
          children: summarizeWebtoonChildren(psd.children || [])
        }
      };
    };
  } catch (webtoonError) {
    console.error("No supported PSD parser is installed in scripts/psd-maps.");
    console.error("Tried ag-psd and @webtoon/psd.");
    process.exit(1);
  }
}

const summary = inspectPsd();
const outputPath = path.resolve(outputDir, `${path.basename(psdPath, path.extname(psdPath))}.summary.json`);

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

console.log(`Parser: ${parserName}`);
console.log(`Summary written to: ${outputPath}`);

function summarizeChildren(children) {
  return children.map((child) => ({
    name: child.name || "",
    top: child.top ?? null,
    left: child.left ?? null,
    bottom: child.bottom ?? null,
    right: child.right ?? null,
    hidden: Boolean(child.hidden),
    opacity: child.opacity ?? null,
    hasMask: Boolean(child.mask),
    hasText: Boolean(child.text),
    hasVectorMask: Boolean(child.vectorMask),
    hasEffects: Boolean(child.effects),
    effects: summarizeEffects(child.effects),
    children: summarizeChildren(child.children || [])
  }));
}

function summarizeEffects(effects) {
  if (!effects) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(effects).map(([key, value]) => [
      key,
      value && typeof value === "object"
        ? {
            enabled: value.enabled ?? null,
            opacity: value.opacity ?? null,
            size: value.size ?? null,
            distance: value.distance ?? null,
            blur: value.blur ?? null,
            angle: value.angle ?? null,
            depth: value.depth ?? null,
            soften: value.soften ?? null,
            style: value.style ?? null,
            technique: value.technique ?? null
          }
        : value
    ])
  );
}

function summarizeWebtoonChildren(children) {
  return children.map((child) => ({
    name: child.name || "",
    top: child.top ?? null,
    left: child.left ?? null,
    bottom: child.bottom ?? null,
    right: child.right ?? null,
    hidden: Boolean(child.hidden),
    opacity: child.opacity ?? null,
    children: summarizeWebtoonChildren(child.children || [])
  }));
}
