import { CalendarPlus, ChefHat, Clock, EyeOff, Globe, Lock, Pencil, ShoppingBasket, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteRecipe } from "@/features/recipes/actions";
import { FavoriteButton } from "@/features/recipes/components/favorite-button";
import { RecipeImagePlaceholder } from "@/features/recipes/components/recipe-image-placeholder";
import {
  CopyRecipeButton,
  MyRating,
  PersonalNote,
  ReportDialog,
  ShareButton,
} from "@/features/recipes/components/recipe-side-actions";
import { ServingsScaler } from "@/features/recipes/components/servings-scaler";
import { dietLabel, difficultyLabel, formatMinutes } from "@/features/recipes/format";
import { getRecipe, getUnits } from "@/features/recipes/queries";

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export async function generateMetadata({ params }: PageProps<"/recettes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = isUuid(id) ? await getRecipe(id) : null;
  return { title: detail?.recipe.title ?? "Recette" };
}

export default async function RecipePage({ params, searchParams }: PageProps<"/recettes/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const [detail, units] = await Promise.all([getRecipe(id), getUnits()]);
  if (!detail) notFound();
  const { recipe: r } = detail;
  const [cover, ...gallery] = detail.images;

  const VisibilityIcon = { private: Lock, household: Users, public: Globe }[r.visibility];
  const visibilityText = {
    private: "Privée",
    household: `Partagée avec le foyer${detail.householdName ? ` « ${detail.householdName} »` : ""}`,
    public: "Publique",
  }[r.visibility];
  const times = [
    ["Préparation", r.prep_minutes],
    ["Cuisson", r.cook_minutes],
    ["Repos", r.rest_minutes],
  ].filter(([, v]) => typeof v === "number" && v > 0) as [string, number][];
  const failedPhotos = Number(query.photos_echec ?? query.photos_manquantes ?? 0);

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6">
      {query.enregistree ? <Alert tone="success">Recette enregistrée.</Alert> : null}
      {query.copiee ? (
        <Alert tone="success">
          Copie ajoutée à tes recettes. Elle est privée et indépendante de l&apos;original : tu peux la modifier
          librement.
        </Alert>
      ) : null}
      {failedPhotos > 0 ? (
        <Alert tone="error">
          La recette est enregistrée, mais {failedPhotos} photo(s) n&apos;ont pas pu être envoyées.
          {detail.canEdit ? (
            <>
              {" "}
              <Link href={`/recettes/${r.id}/modifier`} className="underline">
                Réessayer depuis la modification
              </Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      {r.moderation_status === "hidden" ? (
        <Alert tone="error">
          <span className="inline-flex items-center gap-2">
            <EyeOff aria-hidden className="size-4" /> Cette recette est masquée de la bibliothèque publique après des
            signalements, en attente de modération.
          </span>
        </Alert>
      ) : null}

      <header className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="relative aspect-[16/9] max-h-[28rem] w-full bg-cream sm:aspect-[21/9]">
          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt={cover.alt_text ?? `Photo de ${r.title}`} className="size-full object-cover" />
          ) : (
            <RecipeImagePlaceholder title={r.title} />
          )}
        </div>
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <VisibilityIcon aria-hidden className="size-4" /> {visibilityText}
            </span>
            {detail.categories.map((c) => (
              <span key={c.id} className="rounded-full bg-sage-soft px-3 py-1 font-semibold text-ink">
                {c.name}
              </span>
            ))}
          </div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{r.title}</h1>
          {detail.authorName && !detail.isOwner ? (
            <p className="text-ink-soft">
              par{" "}
              {r.visibility === "public" ? (
                <Link
                  href={`/auteurs/${r.owner_id}`}
                  className="font-semibold text-coral-deep underline-offset-4 hover:underline"
                >
                  {detail.authorName}
                </Link>
              ) : (
                <span className="font-semibold">{detail.authorName}</span>
              )}
            </p>
          ) : null}
          {r.attribution ? <p className="text-sm text-ink-soft">{r.attribution}</p> : null}
          {r.origin === "copy" && detail.sourceAvailable ? (
            <Link
              href={`/recettes/${r.source_recipe_id}`}
              className="w-fit text-sm font-semibold text-coral-deep underline-offset-4 hover:underline"
            >
              Voir la recette d&apos;origine
            </Link>
          ) : null}
          {r.description ? <p className="whitespace-pre-line text-lg">{r.description}</p> : null}
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {r.total_minutes > 0 ? (
              <div className="flex items-center gap-2">
                <Clock aria-hidden className="size-5 text-coral-deep" />
                <dt className="sr-only">Durée totale</dt>
                <dd className="font-semibold">{formatMinutes(r.total_minutes)}</dd>
                {times.length > 1 ? (
                  <dd className="text-sm text-ink-soft">
                    ({times.map(([label, v]) => `${label.toLowerCase()} ${formatMinutes(v)}`).join(", ")})
                  </dd>
                ) : null}
              </div>
            ) : null}
            {r.difficulty ? (
              <div className="flex items-center gap-2">
                <ChefHat aria-hidden className="size-5 text-coral-deep" />
                <dt className="sr-only">Difficulté</dt>
                <dd className="font-semibold">{difficultyLabel(r.difficulty)}</dd>
              </div>
            ) : null}
          </dl>
          {r.diets.length || r.tags.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Régimes et mots-clés">
              {r.diets.map((d) => (
                <li key={d} className="rounded-full bg-lemon-soft px-3 py-1 text-sm font-semibold">
                  {dietLabel(d)}
                </li>
              ))}
              {r.tags.map((t) => (
                <li key={t} className="rounded-full border border-line px-3 py-1 text-sm">
                  #{t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {detail.canEdit ? (
          <Button asChild>
            <Link href={`/recettes/${r.id}/modifier`}>
              <Pencil aria-hidden className="size-4" /> Modifier
            </Link>
          </Button>
        ) : null}
        <FavoriteButton recipeId={r.id} isFavorite={detail.isFavorite} withLabel />
        <CopyRecipeButton recipeId={r.id} label={detail.isOwner ? "Dupliquer" : "Copier dans mes recettes"} />
        {r.visibility !== "private" ? <ShareButton title={r.title} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section
          aria-labelledby="ingredients"
          className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6"
        >
          <h2 id="ingredients" className="mb-3 text-2xl font-semibold">
            Ingrédients
          </h2>
          {detail.ingredients.length ? (
            <ServingsScaler servings={r.servings} ingredients={detail.ingredients} units={units} />
          ) : (
            <p className="text-ink-soft">Aucun ingrédient renseigné.</p>
          )}
        </section>

        <section aria-labelledby="etapes" className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 id="etapes" className="mb-3 text-2xl font-semibold">
            Préparation
          </h2>
          {detail.steps.length ? (
            <ol className="flex flex-col gap-4">
              {detail.steps.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral-soft font-semibold text-coral-deep"
                  >
                    {i + 1}
                  </span>
                  <div>
                    {s.section ? (
                      <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{s.section}</p>
                    ) : null}
                    <p className="whitespace-pre-line">{s.instruction}</p>
                    {s.duration_minutes ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-soft">
                        <Clock aria-hidden className="size-4" /> {formatMinutes(s.duration_minutes)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-soft">Aucune étape renseignée.</p>
          )}
          {r.tips ? (
            <div className="mt-6 rounded-xl bg-lemon-soft p-4">
              <h3 className="font-semibold">Astuces</h3>
              <p className="mt-1 whitespace-pre-line">{r.tips}</p>
            </div>
          ) : null}
          {r.source_name || r.source_url ? (
            <p className="mt-4 text-sm text-ink-soft">
              Source :{" "}
              {r.source_url ? (
                <a href={r.source_url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                  {r.source_name || new URL(r.source_url).hostname}
                </a>
              ) : (
                r.source_name
              )}
            </p>
          ) : null}
        </section>
      </div>

      {gallery.length ? (
        <section aria-labelledby="galerie">
          <h2 id="galerie" className="mb-3 text-2xl font-semibold">
            Photos
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((img, i) =>
              img.url ? (
                <li key={img.id} className="aspect-square overflow-hidden rounded-xl bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt_text ?? `Photo ${i + 2} de ${r.title}`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="pour-moi"
        className="flex flex-col gap-5 rounded-card border border-line bg-white p-5 shadow-card sm:p-6"
      >
        <h2 id="pour-moi" className="text-2xl font-semibold">
          Pour moi
        </h2>
        <MyRating recipeId={r.id} rating={detail.myRating} />
        <PersonalNote recipeId={r.id} note={detail.myNote} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled aria-describedby="phase4">
            <CalendarPlus aria-hidden className="size-4" /> Ajouter au menu
          </Button>
          <Button type="button" variant="secondary" disabled aria-describedby="phase4">
            <ShoppingBasket aria-hidden className="size-4" /> Ajouter aux courses
          </Button>
          <p id="phase4" className="w-full text-sm text-ink-soft">
            Menus et liste de courses arrivent avec la phase 4.
          </p>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        {r.visibility === "public" && !detail.isOwner ? (
          <ReportDialog recipeId={r.id} alreadyReported={detail.hasReported} />
        ) : (
          <span />
        )}
        {detail.isOwner ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" size="sm" className="text-danger">
                <Trash2 aria-hidden className="size-4" /> Supprimer la recette
              </Button>
            }
            title="Supprimer cette recette ?"
            description={
              <p>
                La recette et ses photos seront définitivement supprimées. Les copies faites par d&apos;autres membres
                restent intactes.
              </p>
            }
            confirmLabel="Supprimer"
            action={deleteRecipe}
            hiddenFields={{ recipeId: r.id }}
          />
        ) : null}
      </footer>
    </article>
  );
}
