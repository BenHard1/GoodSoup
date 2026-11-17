import { Clock, EyeOff, Globe, Lock, Users } from "lucide-react";
import Link from "next/link";
import { difficultyLabel, formatMinutes, visibilityLabel } from "../format";
import type { RecipeCardData } from "../queries";
import { FavoriteButton } from "./favorite-button";
import { RecipeImagePlaceholder } from "./recipe-image-placeholder";

const VISIBILITY_ICONS = { private: Lock, household: Users, public: Globe } as const;

export function RecipeCard({ recipe, showAuthor = false }: { recipe: RecipeCardData; showAuthor?: boolean }) {
  const VisibilityIcon = VISIBILITY_ICONS[recipe.visibility];
  const minutes = formatMinutes(recipe.total_minutes);
  const difficulty = difficultyLabel(recipe.difficulty);
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="relative aspect-[4/3] bg-cream">
        {recipe.coverUrl ? (
          // Image privée servie par URL signée temporaire : pas d'optimisation next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <RecipeImagePlaceholder title={recipe.title} />
        )}
        <FavoriteButton recipeId={recipe.id} isFavorite={recipe.isFavorite} className="absolute right-2 top-2 z-10" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg font-semibold leading-snug">
          <Link href={`/recettes/${recipe.id}`} className="after:absolute after:inset-0 hover:underline">
            {recipe.title}
          </Link>
        </h3>
        {showAuthor && recipe.authorName ? <p className="text-sm text-ink-soft">par {recipe.authorName}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          {minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden className="size-4" /> {minutes}
            </span>
          ) : null}
          {difficulty ? <span>{difficulty}</span> : null}
          <span className="inline-flex items-center gap-1">
            <VisibilityIcon aria-hidden className="size-4" /> {visibilityLabel(recipe.visibility)}
          </span>
          {recipe.moderation_status === "hidden" ? (
            <span className="inline-flex items-center gap-1 font-semibold text-danger">
              <EyeOff aria-hidden className="size-4" /> Masquée
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function RecipeGrid({ recipes, showAuthor }: { recipes: RecipeCardData[]; showAuthor?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {recipes.map((r) => (
        <li key={r.id}>
          <RecipeCard recipe={r} showAuthor={showAuthor} />
        </li>
      ))}
    </ul>
  );
}
