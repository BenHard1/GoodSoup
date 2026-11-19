"use client";

/**
 * Lecture d'un PDF dans le navigateur avec pdf.js : le fichier ne quitte jamais l'appareil.
 * Pour un PDF numérique, on lit son texte ; pour un PDF scanné (images), on rend les pages en images
 * pour la reconnaissance de caractères.
 */

const VENDOR = "/vendor/pdfjs";
export const MAX_PDF_PAGES = 10;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

type TextLike = { str: string; hasEOL: boolean; transform: number[] };

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${VENDOR}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    cMapUrl: `${VENDOR}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${VENDOR}/standard_fonts/`,
    wasmUrl: `${VENDOR}/wasm/`,
    enableXfa: false,
  });
  return { doc: await task.promise, close: () => task.destroy() };
}

/** Texte du PDF, ligne par ligne, et nombre de pages lues. */
export async function readPdf(file: File): Promise<{ text: string; pageCount: number; truncated: boolean }> {
  const { doc, close } = await loadPdf(file);
  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let n = 1; n <= pageCount; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      let lastY: number | null = null;
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const item = raw as TextLike;
        const y = item.transform[5];
        // Changement de ligne détecté par la position verticale quand le PDF ne le signale pas.
        if (lastY !== null && Math.abs(y - lastY) > 2 && !text.endsWith("\n")) text += "\n";
        text += item.str;
        if (item.hasEOL) text += "\n";
        else if (item.str && !item.str.endsWith(" ")) text += " ";
        lastY = y;
      }
      pages.push(text);
      page.cleanup();
    }
    return { text: pages.join("\n"), pageCount, truncated: doc.numPages > MAX_PDF_PAGES };
  } finally {
    await close();
  }
}

/** Pages du PDF rendues en images (pour l'OCR d'un PDF scanné). */
export async function renderPdfPages(file: File, maxPages = 4): Promise<HTMLCanvasElement[]> {
  const { doc, close } = await loadPdf(file);
  try {
    const canvases: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, 2000 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
      page.cleanup();
    }
    return canvases;
  } finally {
    await close();
  }
}
