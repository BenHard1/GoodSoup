// Copie dans public/vendor les fichiers nécessaires à l'import (PDF et photo) dans le navigateur :
// moteur OCR Tesseract, données de langue française, worker pdf.js. Servis par l'application elle-même :
// aucune requête vers un CDN tiers, compatible avec la Content-Security-Policy.
// Lancé automatiquement avant `next dev` et `next build` ; le dossier généré n'est pas versionné.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = (p) => join(root, "node_modules", p);
const out = join(root, "public", "vendor");

const copies = [
  [mod("tesseract.js/dist/worker.min.js"), "tesseract/worker.min.js"],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map(
    (f) => [mod(`tesseract.js-core/${f}`), `tesseract/${f}`],
  ),
  [mod("@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz"), "tesseract/lang/fra.traineddata.gz"],
  [mod("pdfjs-dist/build/pdf.worker.min.mjs"), "pdfjs/pdf.worker.min.mjs"],
  [mod("pdfjs-dist/cmaps"), "pdfjs/cmaps"],
  [mod("pdfjs-dist/standard_fonts"), "pdfjs/standard_fonts"],
  ...readdirSync(mod("pdfjs-dist/wasm"))
    .filter((f) => /^(jbig2|openjpeg|qcms)/.test(f))
    .map((f) => [mod(`pdfjs-dist/wasm/${f}`), `pdfjs/wasm/${f}`]),
];

rmSync(out, { recursive: true, force: true });
for (const [from, to] of copies) {
  if (!existsSync(from)) throw new Error(`Fichier introuvable : ${from} (lancer npm install)`);
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(from, dest, { recursive: true });
}
console.log(`Import : ${copies.length} ressources copiées dans public/vendor`);
