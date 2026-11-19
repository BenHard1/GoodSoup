"use client";

import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DIETS } from "@/features/households/food-options";
import { cn } from "@/lib/cn";
import { saveRecipe } from "../actions";
import { valuesToPayload } from "../form-payload";
import { emptyIngredient, emptyStep, type IngredientRow, type RecipeFormValues, type StepRow } from "../form-values";
import { ACCEPTED_TYPES, MAX_PHOTOS, uploadRecipeImage } from "../image-upload";
import type { Unit } from "../quantity";
import type { Category } from "../queries";
import { DIFFICULTIES, VISIBILITIES } from "../schemas";

type Props = {
  initial: RecipeFormValues;
  units: Unit[];
  categories: Category[];
  households: { id: string; name: string }[];
  ingredientNames: string[];
  /** Seul l'auteur choisit la visibilité ; un membre du foyer peut modifier le contenu. */
  canChangeSharing: boolean;
  /** Raison pour laquelle la publication est impossible (copie d'une recette d'un autre auteur). */
  publishBlockedReason?: string;
  isCopy?: boolean;
  /** Relecture d'une recette importée : enregistrée en privé, le partage se règle ensuite. */
  importOrigin?: "import_url" | "import_pdf" | "import_photo";
};

const DRAFT_PREFIX = "goodsoup:recipe-draft:";

function readDraft(key: string): RecipeFormValues | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw).values as RecipeFormValues) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, values: RecipeFormValues | null) {
  try {
    if (values) window.localStorage.setItem(key, JSON.stringify({ values, savedAt: Date.now() }));
    else window.localStorage.removeItem(key);
  } catch {
    // stockage indisponible (navigation privée) : on continue sans brouillon local
  }
}

const sameContent = (a: RecipeFormValues, b: RecipeFormValues) => {
  const strip = (v: RecipeFormValues) =>
    JSON.stringify({
      ...v,
      expected_updated_at: undefined,
      ingredients: v.ingredients.map((row) => ({ ...row, key: undefined })),
      steps: v.steps.map((row) => ({ ...row, key: undefined })),
    });
  return strip(a) === strip(b);
};

export function RecipeForm({
  initial,
  units,
  categories,
  households,
  ingredientNames,
  canChangeSharing,
  publishBlockedReason,
  isCopy,
  importOrigin,
}: Props) {
  const router = useRouter();
  const draftKey = DRAFT_PREFIX + (initial.id ?? (importOrigin ? "import" : "nouvelle"));
  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [restorable, setRestorable] = useState<RecipeFormValues | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ message: string; list: string[]; fields: Record<string, string[]> } | null>(
    null,
  );
  const [conflict, setConflict] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

  // Brouillon local : proposé au retour si différent de la version enregistrée.
  useEffect(() => {
    const draft = readDraft(draftKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage local au montage
    if (draft && !sameContent(draft, initial)) setRestorable(draft);
  }, [draftKey, initial]);

  // Les photos s'enregistrent à part et modifient la date de mise à jour : on suit la version affichée.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec la version serveur
    setValues((v) => ({ ...v, expected_updated_at: initial.expected_updated_at }));
  }, [initial.expected_updated_at]);

  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => writeDraft(draftKey, values), 400);
    return () => window.clearTimeout(t);
  }, [dirty, draftKey, values]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const update = (patch: Partial<RecipeFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
  };

  const unitGroups = useMemo(() => {
    const labels: Record<string, string> = { mass: "Poids", volume: "Volume", count: "Pièces", other: "Autres" };
    const groups = new Map<string, Unit[]>();
    for (const u of units) groups.set(u.kind, [...(groups.get(u.kind) ?? []), u]);
    return [...groups.entries()].map(([kind, list]) => ({ label: labels[kind] ?? kind, units: list }));
  }, [units]);

  const fieldError = (name: string) => errors?.fields[name];

  async function submit() {
    setErrors(null);
    setConflict(false);
    const { payload, errors: localErrors } = valuesToPayload(values);
    if (!values.title.trim()) localErrors.unshift("Donne un titre à ta recette.");
    if (localErrors.length) {
      setErrors({ message: "Certains champs sont à corriger.", list: localErrors, fields: {} });
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    writeDraft(draftKey, values); // le brouillon est conservé tant que le serveur n'a pas confirmé
    setPending(true);
    setProgress("Enregistrement…");
    try {
      const result = await saveRecipe(payload);
      if (result.status === "error") {
        const fields = result.fieldErrors ?? {};
        setErrors({ message: result.message, list: Object.values(fields).flat(), fields });
        setConflict(Boolean(result.conflict));
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      writeDraft(draftKey, null);
      setDirty(false);
      let photoFailures = 0;
      for (const [i, p] of photos.entries()) {
        setProgress(`Envoi des photos (${i + 1}/${photos.length})…`);
        try {
          await uploadRecipeImage(result.recipeId, p.file);
        } catch {
          photoFailures++;
        }
      }
      const query = photoFailures ? `?photos_echec=${photoFailures}` : "?enregistree=1";
      router.push(`/recettes/${result.recipeId}${query}`);
      router.refresh();
    } catch {
      setErrors({
        message:
          "Connexion perdue : la recette n'a pas été enregistrée. Ton brouillon est gardé sur cet appareil, réessaie quand le réseau revient.",
        list: [],
        fields: {},
      });
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  const setIngredient = (index: number, patch: Partial<IngredientRow>) =>
    update({ ingredients: values.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const setStep = (index: number, patch: Partial<StepRow>) =>
    update({ steps: values.steps.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const move = <T,>(list: T[], from: number, to: number) => {
    if (to < 0 || to >= list.length) return list;
    const copy = [...list];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const next = [...files].slice(0, Math.max(room, 0)).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...next]);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) void submit();
      }}
      className="flex flex-col gap-6"
    >
      {restorable ? (
        <Alert tone="info">
          <p>Un brouillon non enregistré de cette recette a été retrouvé sur cet appareil.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setValues({ ...restorable, expected_updated_at: initial.expected_updated_at });
                setDirty(true);
                setRestorable(null);
              }}
            >
              Reprendre le brouillon
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                writeDraft(draftKey, null);
                setRestorable(null);
              }}
            >
              L&apos;ignorer
            </Button>
          </div>
        </Alert>
      ) : null}

      {errors ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert tone="error">
            <p>{errors.message}</p>
            {errors.list.length ? (
              <ul className="mt-1 list-disc pl-5 font-normal">
                {errors.list.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            {conflict ? (
              <button type="button" onClick={() => window.location.reload()} className="mt-2 underline">
                Recharger la dernière version (ton brouillon reste disponible)
              </button>
            ) : null}
          </Alert>
        </div>
      ) : null}

      <Section title="L'essentiel">
        <Field label="Titre" error={fieldError("title")}>
          {(p) => (
            <Input
              {...p}
              name="title"
              value={values.title}
              maxLength={150}
              required
              autoComplete="off"
              onChange={(e) => update({ title: e.target.value })}
            />
          )}
        </Field>
        <Field label="Présentation (facultatif)" error={fieldError("description")}>
          {(p) => (
            <Textarea
              {...p}
              name="description"
              value={values.description}
              maxLength={2000}
              rows={3}
              onChange={(e) => update({ description: e.target.value })}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Portions" error={fieldError("servings")}>
            {(p) => (
              <Input
                {...p}
                name="servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={values.servings}
                onChange={(e) => update({ servings: e.target.value })}
              />
            )}
          </Field>
          <MinutesField
            label="Préparation (min)"
            value={values.prep_minutes}
            onChange={(v) => update({ prep_minutes: v })}
            error={fieldError("prep_minutes")}
          />
          <MinutesField
            label="Cuisson (min)"
            value={values.cook_minutes}
            onChange={(v) => update({ cook_minutes: v })}
            error={fieldError("cook_minutes")}
          />
          <MinutesField
            label="Repos (min)"
            value={values.rest_minutes}
            onChange={(v) => update({ rest_minutes: v })}
            error={fieldError("rest_minutes")}
          />
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">Difficulté</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ value: "", label: "Non précisée" }, ...DIFFICULTIES].map((d) => (
              <Chip
                key={d.value}
                type="radio"
                name="difficulty"
                checked={values.difficulty === d.value}
                onChange={() => update({ difficulty: d.value })}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </Section>

      {!initial.id ? (
        <Section title="Photos" description={`Jusqu'à ${MAX_PHOTOS} photos. Elles sont réduites avant l'envoi.`}>
          {photos.length ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Photo ${i + 1} sélectionnée`} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                    className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-white/90"
                    aria-label={`Retirer la photo ${i + 1}`}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {photos.length < MAX_PHOTOS ? (
            <label className="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold hover:bg-cream focus-within:outline-2 focus-within:outline-coral-deep">
              <ImagePlus aria-hidden className="size-5" /> Ajouter des photos
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </Section>
      ) : null}

      <Section
        title="Ingrédients"
        description="Quantité libre : 200, 1,5, 1/2 ou une fourchette 2-3. Laisse vide pour « sel, poivre »."
        error={fieldError("ingredients")}
      >
        <datalist id="ingredients-connus">
          {ingredientNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <ol className="flex flex-col gap-3">
          {values.ingredients.map((row, i) => (
            <li key={row.key} className="rounded-xl border border-line bg-paper p-3">
              <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[6rem_9rem_1fr]">
                <label className="sr-only" htmlFor={`${row.key}-q`}>
                  Quantité de l&apos;ingrédient {i + 1}
                </label>
                <Input
                  id={`${row.key}-q`}
                  value={row.quantity}
                  inputMode="decimal"
                  placeholder="Qté"
                  onChange={(e) => setIngredient(i, { quantity: e.target.value })}
                />
                <label className="sr-only" htmlFor={`${row.key}-u`}>
                  Unité de l&apos;ingrédient {i + 1}
                </label>
                <select
                  id={`${row.key}-u`}
                  value={row.unit_code}
                  onChange={(e) => setIngredient(i, { unit_code: e.target.value })}
                  className="min-h-12 rounded-field border border-ink-faint bg-white px-2 text-base"
                >
                  <option value="">Sans unité</option>
                  {unitGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`${row.key}-n`}>
                  Nom de l&apos;ingrédient {i + 1}
                </label>
                <Input
                  id={`${row.key}-n`}
                  className="col-span-2 sm:col-span-1"
                  value={row.name}
                  list="ingredients-connus"
                  maxLength={120}
                  placeholder="Ingrédient"
                  autoComplete="off"
                  onChange={(e) => setIngredient(i, { name: e.target.value })}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`${row.key}-note`}>
                  Précision pour l&apos;ingrédient {i + 1}
                </label>
                <Input
                  id={`${row.key}-note`}
                  className="min-h-10 flex-1 py-2 text-sm"
                  value={row.note}
                  maxLength={200}
                  placeholder="Précision (ex. coupé en dés)"
                  onChange={(e) => setIngredient(i, { note: e.target.value })}
                />
                <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-coral-strong"
                    checked={row.is_optional}
                    onChange={(e) => setIngredient(i, { is_optional: e.target.checked })}
                  />
                  Facultatif
                </label>
                <RowActions
                  label={`l'ingrédient ${i + 1}`}
                  onUp={i > 0 ? () => update({ ingredients: move(values.ingredients, i, i - 1) }) : undefined}
                  onDown={
                    i < values.ingredients.length - 1
                      ? () => update({ ingredients: move(values.ingredients, i, i + 1) })
                      : undefined
                  }
                  onRemove={() => update({ ingredients: values.ingredients.filter((_, j) => j !== i) })}
                />
              </div>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          disabled={values.ingredients.length >= 100}
          onClick={() => update({ ingredients: [...values.ingredients, emptyIngredient()] })}
        >
          <Plus aria-hidden className="size-5" /> Ajouter un ingrédient
        </Button>
      </Section>

      <Section title="Étapes" error={fieldError("steps")}>
        <ol className="flex flex-col gap-3">
          {values.steps.map((row, i) => (
            <li key={row.key} className="flex gap-3 rounded-xl border border-line bg-paper p-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral-soft font-semibold text-coral-deep"
              >
                {i + 1}
              </span>
              <div className="flex flex-1 flex-col gap-2">
                <label className="sr-only" htmlFor={`${row.key}-i`}>
                  Étape {i + 1}
                </label>
                <Textarea
                  id={`${row.key}-i`}
                  value={row.instruction}
                  rows={3}
                  maxLength={3000}
                  placeholder={`Étape ${i + 1}`}
                  onChange={(e) => setStep(i, { instruction: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm" htmlFor={`${row.key}-d`}>
                    Minuteur (min, facultatif)
                  </label>
                  <Input
                    id={`${row.key}-d`}
                    className="min-h-10 w-24 py-2 text-sm"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={row.duration_minutes}
                    onChange={(e) => setStep(i, { duration_minutes: e.target.value })}
                  />
                  <RowActions
                    label={`l'étape ${i + 1}`}
                    onUp={i > 0 ? () => update({ steps: move(values.steps, i, i - 1) }) : undefined}
                    onDown={
                      i < values.steps.length - 1 ? () => update({ steps: move(values.steps, i, i + 1) }) : undefined
                    }
                    onRemove={() => update({ steps: values.steps.filter((_, j) => j !== i) })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          disabled={values.steps.length >= 60}
          onClick={() => update({ steps: [...values.steps, emptyStep()] })}
        >
          <Plus aria-hidden className="size-5" /> Ajouter une étape
        </Button>
      </Section>

      <Section title="Classement">
        <fieldset>
          <legend className="text-sm font-semibold">Catégories</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.id}
                type="checkbox"
                checked={values.category_ids.includes(c.id)}
                onChange={() => update({ category_ids: toggle(values.category_ids, c.id) })}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">Convient aux régimes</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip
                key={d.value}
                type="checkbox"
                checked={values.diets.includes(d.value)}
                onChange={() => update({ diets: toggle(values.diets, d.value) })}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Field label="Mots-clés (séparés par des virgules)" error={fieldError("tags")}>
          {(p) => (
            <Input
              {...p}
              value={values.tags}
              placeholder="ex. réconfortant, hiver, enfants"
              onChange={(e) => update({ tags: e.target.value })}
            />
          )}
        </Field>
      </Section>

      <Section title="Astuces et source">
        <Field label="Astuces (facultatif)" error={fieldError("tips")}>
          {(p) => (
            <Textarea
              {...p}
              value={values.tips}
              rows={3}
              maxLength={5000}
              onChange={(e) => update({ tips: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source : nom (facultatif)" hint="Livre, site, personne…" error={fieldError("source_name")}>
            {(p) => (
              <Input
                {...p}
                value={values.source_name}
                maxLength={200}
                onChange={(e) => update({ source_name: e.target.value })}
              />
            )}
          </Field>
          <Field
            label={importOrigin === "import_url" ? "Source : adresse web" : "Source : adresse web (facultatif)"}
            error={fieldError("source_url")}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                value={values.source_url}
                placeholder="https://"
                onChange={(e) => update({ source_url: e.target.value })}
              />
            )}
          </Field>
        </div>
        {isCopy ? (
          values.attribution ? (
            <p className="text-sm text-ink-soft">Mention conservée : {values.attribution}</p>
          ) : null
        ) : (
          <Field
            label="Crédit à afficher (facultatif)"
            hint="ex. « Recette de ma grand-mère »"
            error={fieldError("attribution")}
          >
            {(p) => (
              <Input
                {...p}
                value={values.attribution}
                maxLength={300}
                onChange={(e) => update({ attribution: e.target.value })}
              />
            )}
          </Field>
        )}
      </Section>

      {importOrigin ? (
        <Section title="Partage">
          <p className="text-sm text-ink-soft">
            Une recette importée est enregistrée en <strong className="text-ink">privé</strong>, avec sa source. Tu
            pourras ensuite la partager avec ton foyer, ou la publier si tu confirmes en avoir le droit (recette
            personnelle ou autorisation de l&apos;auteur), depuis « Modifier ».
          </p>
        </Section>
      ) : canChangeSharing ? (
        <Section title="Partage" error={fieldError("visibility") ?? fieldError("rights_confirmed")}>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Visibilité</legend>
            {VISIBILITIES.map((v) => {
              const disabled =
                (v.value === "household" && households.length === 0) ||
                (v.value === "public" && Boolean(publishBlockedReason));
              return (
                <label
                  key={v.value}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3",
                    values.visibility === v.value ? "border-ink bg-cream" : "border-line bg-white",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    className="mt-1 size-5 accent-coral-strong"
                    checked={values.visibility === v.value}
                    disabled={disabled}
                    onChange={() => update({ visibility: v.value })}
                  />
                  <span>
                    <span className="font-semibold">{v.label}</span>
                    <span className="block text-sm text-ink-soft">
                      {v.value === "public" && publishBlockedReason ? publishBlockedReason : v.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          {values.visibility === "household" ? (
            <div className="flex flex-col gap-3 rounded-xl bg-paper p-3">
              {households.length > 1 ? (
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Foyer
                  <select
                    value={values.household_id}
                    onChange={(e) => update({ household_id: e.target.value })}
                    className="min-h-12 rounded-field border border-ink-faint bg-white px-3 text-base font-normal"
                  >
                    {households.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 accent-coral-strong"
                  checked={values.household_can_edit}
                  onChange={(e) => update({ household_can_edit: e.target.checked })}
                />
                Les membres du foyer peuvent modifier cette recette
              </label>
            </div>
          ) : null}
          {values.visibility === "public" ? (
            <label className="flex items-start gap-3 rounded-xl bg-lemon-soft p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 accent-coral-strong"
                checked={values.rights_confirmed}
                onChange={(e) => update({ rights_confirmed: e.target.checked })}
              />
              <span>
                Je confirme que cette recette est la mienne ou que j&apos;ai le droit de la publier (pas de copie
                d&apos;un livre ou d&apos;un site sans autorisation). Les photos doivent aussi m&apos;appartenir.
              </span>
            </label>
          ) : null}
        </Section>
      ) : (
        <p className="text-sm text-ink-soft">Seul l&apos;auteur peut changer le partage de cette recette.</p>
      )}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-card md:border">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {progress ? (
            <span role="status" className="text-sm text-ink-soft">
              {progress}
            </span>
          ) : dirty ? (
            <span className="text-sm text-ink-soft">Brouillon gardé sur cet appareil</span>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            {initial.id ? "Enregistrer" : "Créer la recette"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  error,
  children,
}: {
  title: string;
  description?: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 shadow-card sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {error?.length ? <p className="text-sm font-semibold text-danger">{error.join(" ")}</p> : null}
      {children}
    </section>
  );
}

function MinutesField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string[];
}) {
  return (
    <Field label={label} error={error}>
      {(p) => (
        <Input
          {...p}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function Chip({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors",
        "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-coral-deep",
        checked ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-cream",
      )}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function RowActions({
  label,
  onUp,
  onDown,
  onRemove,
}: {
  label: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}) {
  const cls = "flex size-10 items-center justify-center rounded-full hover:bg-cream disabled:opacity-30";
  return (
    <div className="ml-auto flex items-center">
      <button type="button" className={cls} onClick={onUp} disabled={!onUp} aria-label={`Monter ${label}`}>
        <ArrowUp aria-hidden className="size-4" />
      </button>
      <button type="button" className={cls} onClick={onDown} disabled={!onDown} aria-label={`Descendre ${label}`}>
        <ArrowDown aria-hidden className="size-4" />
      </button>
      <button type="button" className={cn(cls, "text-danger")} onClick={onRemove} aria-label={`Supprimer ${label}`}>
        <Trash2 aria-hidden className="size-4" />
      </button>
    </div>
  );
}
