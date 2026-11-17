"use client";

import { Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/cn";
import { toggleFavorite } from "../actions";

export function FavoriteButton({
  recipeId,
  isFavorite,
  withLabel = false,
  className,
}: {
  recipeId: string;
  isFavorite: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();
  const label = optimistic ? "Retirer des favoris" : "Ajouter aux favoris";
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={withLabel ? undefined : label}
      title={label}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleFavorite(recipeId, !optimistic);
        })
      }
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full font-semibold transition-colors",
        withLabel ? "border border-line bg-white px-4 hover:bg-cream" : "bg-white/90 shadow-sm hover:bg-white",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-5", optimistic ? "fill-coral-strong text-coral-strong" : "text-ink")} />
      {withLabel ? <span>{optimistic ? "Dans mes favoris" : "Ajouter aux favoris"}</span> : null}
    </button>
  );
}
