"use client";

import { ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { deleteRecipeImage, setRecipeCover } from "../actions";
import { ACCEPTED_TYPES, MAX_PHOTOS, uploadRecipeImage } from "../image-upload";

/** Photos d'une recette existante : chaque action est enregistrée immédiatement. */
export function PhotoManager({
  recipeId,
  coverImageId,
  images,
}: {
  recipeId: string;
  coverImageId: string | null;
  images: { id: string; url: string | null }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const cover = coverImageId ?? images[0]?.id;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, MAX_PHOTOS - images.length);
    setMessage(null);
    let failures = 0;
    let lastError = "";
    for (const [i, file] of list.entries()) {
      setBusy(`Envoi de la photo ${i + 1}/${list.length}…`);
      try {
        await uploadRecipeImage(recipeId, file);
      } catch (e) {
        failures++;
        lastError = e instanceof Error ? e.message : "";
      }
    }
    setBusy(null);
    setMessage(
      failures
        ? { tone: "error", text: `${failures} photo(s) non envoyée(s). ${lastError}` }
        : { tone: "success", text: list.length > 1 ? "Photos ajoutées." : "Photo ajoutée." },
    );
    startTransition(() => router.refresh());
  }

  const run = (label: string, fn: () => Promise<{ status: string; message?: string }>) => {
    setBusy(label);
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      setBusy(null);
      if (res.status === "error") setMessage({ tone: "error", text: res.message ?? "Action impossible." });
      router.refresh();
    });
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 shadow-card sm:p-6"
      aria-labelledby="photos-titre"
    >
      <div>
        <h2 id="photos-titre" className="text-xl font-semibold">
          Photos
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Jusqu&apos;à {MAX_PHOTOS} photos. Les changements de photos sont enregistrés immédiatement.
        </p>
      </div>
      {images.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-cream">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              ) : null}
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button
                  type="button"
                  disabled={Boolean(busy) || img.id === cover}
                  onClick={() => run("Mise à jour…", () => setRecipeCover(recipeId, img.id))}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full bg-white/90",
                    img.id === cover && "bg-lemon",
                  )}
                  aria-label={
                    img.id === cover
                      ? `Photo ${i + 1} : photo principale`
                      : `Choisir la photo ${i + 1} comme photo principale`
                  }
                  aria-pressed={img.id === cover}
                >
                  <Star aria-hidden className={cn("size-4", img.id === cover && "fill-ink")} />
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => run("Suppression…", () => deleteRecipeImage(img.id))}
                  className="flex size-9 items-center justify-center rounded-full bg-white/90 text-danger"
                  aria-label={`Supprimer la photo ${i + 1}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {busy ? (
        <p role="status" className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <LoaderCircle aria-hidden className="size-4 animate-spin" /> {busy}
        </p>
      ) : images.length < MAX_PHOTOS ? (
        <label className="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold hover:bg-cream focus-within:outline-2 focus-within:outline-coral-deep">
          <ImagePlus aria-hidden className="size-5" /> Ajouter des photos
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="sr-only"
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
    </section>
  );
}
