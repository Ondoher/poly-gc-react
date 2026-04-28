import fs from "fs";
import path from "path";
import process from "process";
import { execFileSync } from "child_process";
import { GENERATED_FACE_IMAGES_DIR, ROOT_DIR } from "../3d-assets/asset-paths.js";

const PSD_PATH = path.resolve(ROOT_DIR, "Designs", "icons", "faces.psd");
const GENERATED_ROOT = GENERATED_FACE_IMAGES_DIR;

const FACE_SPECS = Object.freeze([
  { key: "dragon-w", facePath: "Faces/Dragons/white" },
  { key: "dragon-r", facePath: "Faces/Dragons/red" },
  { key: "dragon-g", facePath: "Faces/Dragons/green" },
  { key: "d-1", facePath: "Faces/Dots/1" },
  { key: "d-2", facePath: "Faces/Dots/2" },
  { key: "d-3", facePath: "Faces/Dots/3" },
  { key: "d-4", facePath: "Faces/Dots/4" },
  { key: "d-5", facePath: "Faces/Dots/5" },
  { key: "d-6", facePath: "Faces/Dots/6" },
  { key: "d-7", facePath: "Faces/Dots/7" },
  { key: "d-8", facePath: "Faces/Dots/8" },
  { key: "d-9", facePath: "Faces/Dots/9" },
  { key: "c-1", facePath: "Faces/Characters/1" },
  { key: "c-2", facePath: "Faces/Characters/2" },
  { key: "c-3", facePath: "Faces/Characters/3" },
  { key: "c-4", facePath: "Faces/Characters/4" },
  { key: "c-5", facePath: "Faces/Characters/5" },
  { key: "c-6", facePath: "Faces/Characters/6" },
  { key: "c-7", facePath: "Faces/Characters/7" },
  { key: "c-8", facePath: "Faces/Characters/8" },
  { key: "c-9", facePath: "Faces/Characters/9" },
  { key: "b-1", facePath: "Faces/Bamboo/1-Alt" },
  { key: "b-2", facePath: "Faces/Bamboo/2" },
  { key: "b-3", facePath: "Faces/Bamboo/3" },
  { key: "b-4", facePath: "Faces/Bamboo/4" },
  { key: "b-5", facePath: "Faces/Bamboo/5" },
  { key: "b-6", facePath: "Faces/Bamboo/6" },
  { key: "b-7", facePath: "Faces/Bamboo/7" },
  { key: "b-8", facePath: "Faces/Bamboo/8" },
  { key: "b-9", facePath: "Faces/Bamboo/9" },
  { key: "flower-1", facePath: "Faces/Flowers/Wiki/Plum" },
  { key: "flower-2", facePath: "Faces/Flowers/Wiki/Orchid" },
  { key: "flower-3", facePath: "Faces/Flowers/Wiki/Chrysanthemum" },
  { key: "flower-4", facePath: "Faces/Flowers/Wiki/Bamboo" },
  { key: "season-1", facePath: "Faces/Seasons/Wiki/Spring" },
  { key: "season-2", facePath: "Faces/Seasons/Wiki/Summer" },
  { key: "season-3", facePath: "Faces/Seasons/Wiki/Autumn" },
  { key: "season-4", facePath: "Faces/Seasons/Wiki/Winter" },
  { key: "wind-w", facePath: "Faces/Winds/W" },
  { key: "wind-s", facePath: "Faces/Winds/S" },
  { key: "wind-n", facePath: "Faces/Winds/N" },
  { key: "wind-e", facePath: "Faces/Winds/E" }
]);

for (const spec of FACE_SPECS) {
  execFileSync(
    process.execPath,
    [
      path.resolve(process.cwd(), "export-face.js"),
      PSD_PATH,
      spec.facePath
    ],
    {
      stdio: "inherit",
      cwd: process.cwd()
    }
  );

  const sourceDir = path.resolve(process.cwd(), "out", sanitizeFileName(spec.facePath));
  const targetDir = path.resolve(GENERATED_ROOT, spec.key);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const fileName of [
    "face-color-full.png",
    "face-height.png",
    "face-cavity.png",
    "face-normal.png",
    "face-roughness.png",
    "face-metadata.json"
  ]) {
    fs.copyFileSync(
      path.resolve(sourceDir, fileName),
      path.resolve(targetDir, fileName)
    );
  }
}

const manifestPath = path.resolve(GENERATED_ROOT, "manifest.json");
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      sourcePsd: PSD_PATH,
      faces: FACE_SPECS
    },
    null,
    2
  )
);

console.log(`Exported ${FACE_SPECS.length} faces to ${GENERATED_ROOT}`);

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*]+/g, "-");
}
