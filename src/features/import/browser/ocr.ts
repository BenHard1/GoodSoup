"use client";

/**
 * Reconnaissance de caractères (OCR) dans le navigateur avec Tesseract.js : les photos ne sont envoyées
 * à aucun service. Le moteur et le modèle français (~5 Mo au premier usage, puis en cache) sont servis
 * par l'application depuis /vendor.
 */

const VENDOR = "/vendor/tesseract";
const MAX_SIDE = 2400;

export type OcrProgress = { image: number; total: number; status: string; progress: number };

const STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "Chargement du moteur de lecture",
  "initializing tesseract": "Préparation du moteur de lecture",
  "loading language traineddata": "Chargement du français",
  "initializing api": "Préparation du moteur de lecture",
  "recognizing text": "Lecture du texte",
};

/** Réduit les très grandes photos : plus rapide, et sans perte de lisibilité pour l'OCR. */
async function prepare(source: File | HTMLCanvasElement): Promise<HTMLCanvasElement | File> {
  if (!(source instanceof File)) return source;
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return source;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function recognizeText(
  images: (File | HTMLCanvasElement)[],
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker("fra", OEM.LSTM_ONLY, {
    workerPath: `${VENDOR}/worker.min.js`,
    corePath: `${VENDOR}/`,
    langPath: `${VENDOR}/lang`,
    workerBlobURL: false,
    gzip: true,
    logger: (m: { status: string; progress: number }) =>
      onProgress?.({
        image: current + 1,
        total: images.length,
        status: STATUS_LABELS[m.status] ?? "Lecture du texte",
        progress: m.progress,
      }),
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1" });
    const texts: string[] = [];
    for (const [i, image] of images.entries()) {
      current = i;
      const { data } = await worker.recognize(await prepare(image));
      texts.push(data.text);
    }
    return texts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
