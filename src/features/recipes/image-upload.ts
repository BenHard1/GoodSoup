"use client";

import { createClient } from "@/lib/supabase/client";
import { registerRecipeImage } from "./actions";

export const MAX_PHOTOS = 8;
const MAX_SIDE = 1600;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/**
 * Réduit la photo dans le navigateur (1600 px max, WebP) : envoi rapide sur mobile,
 * et les métadonnées (position GPS de l'appareil photo) ne sont pas conservées.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number; ext: string }> {
  if (file.size > MAX_INPUT_BYTES) throw new Error("Cette photo est trop lourde (25 Mo maximum).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Ce format de photo n'est pas pris en charge par ton navigateur. Essaie en JPEG ou PNG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer la photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, width, height, ext: "webp" };
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Impossible de préparer la photo.");
  return { blob: jpeg, width, height, ext: "jpg" };
}

/** Compresse, envoie dans le stockage privé puis enregistre la photo de la recette. */
export async function uploadRecipeImage(recipeId: string, file: File): Promise<void> {
  const { blob, width, height, ext } = await compressImage(file);
  const path = `${recipeId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(path, blob, { contentType: blob.type, cacheControl: "3600", upsert: false });
  if (error) throw new Error("L'envoi de la photo a échoué. Vérifie ta connexion et réessaie.");
  const result = await registerRecipeImage({ recipeId, path, width, height });
  if (result.status === "error") throw new Error(result.message ?? "La photo n'a pas pu être enregistrée.");
}
