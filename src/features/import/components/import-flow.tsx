"use client";

import { Camera, FileText, Link2, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { RecipeForm } from "@/features/recipes/components/recipe-form";
import type { Unit } from "@/features/recipes/quantity";
import type { Category } from "@/features/recipes/queries";
import { cn } from "@/lib/cn";
import { importRecipeFromText, importRecipeFromUrl, type ImportResult } from "../actions";
import { draftToFormValues } from "../to-form-values";
import type { RecipeDraft } from "../types";

export type ImportMode = "lien" | "pdf" | "photo";

const MODES: { value: ImportMode; label: string; Icon: typeof Link2 }[] = [
  { value: "lien", label: "Lien", Icon: Link2 },
  { value: "pdf", label: "PDF", Icon: FileText },
  { value: "photo", label: "Photo", Icon: Camera },
];

const MAX_PHOTOS = 4;

/** Erreur dont le message s'adresse directement à l'utilisateur. */
class ImportError extends Error {}
const PHOTO_TYPES = "image/jpeg,image/png,image/webp";

type Props = {
  initialMode: ImportMode;
  units: Unit[];
  categories: Category[];
  households: { id: string; name: string }[];
  ingredientNames: string[];
};

export function ImportFlow({ initialMode, units, categories, households, ingredientNames }: Props) {
  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [url, setUrl] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), [photos]);

  const choose = (next: ImportMode) => {
    setMode(next);
    setError(null);
    const params = new URLSearchParams(window.location.search);
    params.set("depuis", next);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  function finish(result: ImportResult, text: string | null) {
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setDraft(result.draft);
    setRawText(text);
    requestAnimationFrame(() => reviewRef.current?.focus());
  }

  async function run(task: () => Promise<void>) {
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      console.error(e);
      const name = e instanceof Error ? e.name : "";
      setError(
        e instanceof ImportError
          ? e.message
          : name === "PasswordException"
            ? "Ce PDF est protégé par un mot de passe."
            : name === "InvalidPDFException"
              ? "Ce fichier n'est pas un PDF valide."
              : "La lecture a échoué. Vérifie ta connexion et réessaie, ou passe par la saisie manuelle.",
      );
    } finally {
      setBusy(null);
    }
  }

  const importUrl = () =>
    run(async () => {
      setBusy("Lecture de la page…");
      finish(await importRecipeFromUrl(url), null);
    });

  const importPdf = (file: File) =>
    run(async () => {
      const { MAX_PDF_BYTES, readPdf, renderPdfPages } = await import("../browser/pdf");
      if (file.size > MAX_PDF_BYTES) throw new ImportError("Ce PDF est trop lourd (20 Mo maximum).");
      setBusy("Lecture du PDF…");
      const pdf = await readPdf(file);
      let text = pdf.text;
      let scanned = false;
      if (text.replace(/\s/g, "").length < 80) {
        // PDF scanné : pas de texte, on lit les pages comme des photos.
        scanned = true;
        setBusy("PDF scanné : préparation des pages…");
        const pages = await renderPdfPages(file);
        const { recognizeText } = await import("../browser/ocr");
        text = await recognizeText(pages, (p) =>
          setBusy(`${p.status} (page ${p.image}/${p.total}) ${Math.round(p.progress * 100)} %`),
        );
      }
      setBusy("Analyse de la recette…");
      const result = await importRecipeFromText({ text, origin: "import_pdf", sourceName: null });
      finish(result, text);
      const notes = [
        pdf.truncated ? `Seules les ${pdf.pageCount} premières pages ont été lues.` : null,
        scanned ? "Ce PDF est une image scannée : son texte a été reconnu automatiquement, relis-le avec soin." : null,
      ].filter(Boolean);
      if (notes.length) setNotice(notes.join(" "));
    });

  const importPhotos = () =>
    run(async () => {
      if (!photos.length) throw new ImportError("Ajoute au moins une photo.");
      const { recognizeText } = await import("../browser/ocr");
      setBusy("Chargement du moteur de lecture…");
      const text = await recognizeText(
        photos.map((p) => p.file),
        (p) =>
          setBusy(
            `${p.status}${p.total > 1 ? ` (photo ${p.image}/${p.total})` : ""} ${Math.round(p.progress * 100)} %`,
          ),
      );
      setBusy("Analyse de la recette…");
      finish(await importRecipeFromText({ text, origin: "import_photo", sourceName: null }), text);
    });

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const next = [...files]
      .filter((f) => PHOTO_TYPES.split(",").includes(f.type))
      .slice(0, Math.max(room, 0))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (next.length < files.length) {
      setError(`Formats acceptés : JPEG, PNG ou WebP, ${MAX_PHOTOS} photos maximum.`);
    }
    setPhotos((p) => [...p, ...next]);
  };

  if (draft) {
    return (
      <div className="flex flex-col gap-6">
        <div ref={reviewRef} tabIndex={-1} className="flex flex-col gap-3 outline-none">
          <Alert tone="info">
            <p>
              Relis et corrige la recette avant de l&apos;enregistrer.{" "}
              {draft.method === "structured"
                ? "Elle a été lue à partir des informations publiées par le site."
                : "Elle a été reconnue automatiquement à partir du texte : des erreurs sont possibles."}
            </p>
            {[...draft.warnings, ...(notice ? [notice] : [])].length ? (
              <ul className="mt-1 list-disc pl-5 font-normal">
                {[...draft.warnings, ...(notice ? [notice] : [])].map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(null);
                setRawText(null);
                setNotice(null);
              }}
            >
              <RotateCcw aria-hidden className="size-4" /> Importer autre chose
            </Button>
            {draft.sourceUrl ? (
              <a
                href={draft.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm font-semibold underline"
              >
                Ouvrir la page d&apos;origine
              </a>
            ) : null}
          </div>
          {rawText ? (
            <details className="rounded-card border border-line bg-white p-4 text-sm">
              <summary className="cursor-pointer font-semibold">Voir le texte lu, pour comparer</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-ink-soft">{rawText}</pre>
            </details>
          ) : null}
        </div>
        <RecipeForm
          key={`${draft.origin}-${draft.title}-${draft.sourceUrl ?? ""}`}
          initial={draftToFormValues(draft)}
          units={units}
          categories={categories}
          households={households}
          ingredientNames={ingredientNames}
          canChangeSharing={false}
          importOrigin={draft.origin}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Importer depuis" className="flex gap-2">
        {MODES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => choose(value)}
            disabled={Boolean(busy)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold",
              mode === value ? "bg-ink text-white" : "border border-line bg-white text-ink",
            )}
          >
            <Icon aria-hidden className="size-4" /> {label}
          </button>
        ))}
      </div>

      <section
        role="tabpanel"
        aria-label={MODES.find((m) => m.value === mode)?.label}
        className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 shadow-card sm:p-6"
      >
        {mode === "lien" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void importUrl();
            }}
          >
            <Field
              label="Adresse de la page de la recette"
              hint="Fonctionne avec la plupart des sites et blogs de cuisine, qui décrivent leurs recettes dans un format standard. La page est lue par Good Soup, sans IA."
            >
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  inputMode="url"
                  required
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={Boolean(busy)}
                />
              )}
            </Field>
            <div>
              <Button type="submit" disabled={Boolean(busy) || !url.trim()}>
                Importer
              </Button>
            </div>
          </form>
        ) : mode === "pdf" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Le PDF est lu sur ton appareil : il n&apos;est envoyé nulle part. Seul le texte extrait sert à pré-remplir
              la recette. Les PDF scannés sont aussi acceptés (lecture plus lente).
            </p>
            <label
              className={cn(
                "inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-full bg-coral-strong px-5 font-semibold text-white",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <FileText aria-hidden className="size-4" /> Choisir un PDF
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                disabled={Boolean(busy)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importPdf(file);
                }}
              />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-soft">
              Photographie la page d&apos;un livre, une fiche ou une capture d&apos;écran (jusqu&apos;à {MAX_PHOTOS}{" "}
              photos, par exemple ingrédients puis préparation). La lecture se fait sur ton appareil : les photos ne
              sont envoyées nulle part. Prends la page bien à plat, de face et bien éclairée.
            </p>
            {photos.length ? (
              <ul className="flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <li key={p.preview} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
                    <img
                      src={p.preview}
                      alt={`Photo ${i + 1}`}
                      className="size-24 rounded-xl border border-line object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Retirer la photo ${i + 1}`}
                      disabled={Boolean(busy)}
                      onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                      className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-ink text-white"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {photos.length < MAX_PHOTOS ? (
                <label
                  className={cn(
                    "inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-ink px-5 font-semibold",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  <Camera aria-hidden className="size-4" />{" "}
                  {photos.length ? "Ajouter une photo" : "Choisir ou prendre une photo"}
                  <input
                    type="file"
                    accept={PHOTO_TYPES}
                    multiple
                    className="sr-only"
                    disabled={Boolean(busy)}
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : null}
              <Button type="button" onClick={() => void importPhotos()} disabled={Boolean(busy) || !photos.length}>
                Lire la recette
              </Button>
            </div>
          </div>
        )}

        {busy ? (
          <p role="status" className="flex items-center gap-2 text-sm font-semibold">
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> {busy}
          </p>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
      </section>

      <p className="text-sm text-ink-soft">
        Rien n&apos;est enregistré avant ta relecture. Une recette importée reste privée et garde sa source ; tu pourras
        la partager ensuite.
      </p>
    </div>
  );
}
