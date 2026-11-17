"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatIngredientQuantity, type Unit } from "../quantity";
import type { RecipeIngredient } from "../queries";

/** Ajustement du nombre de portions : purement visuel, la recette enregistrée ne change pas. */
export function ServingsScaler({
  servings,
  ingredients,
  units,
}: {
  servings: number;
  ingredients: RecipeIngredient[];
  units: Unit[];
}) {
  const [target, setTarget] = useState(servings);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.code, u])), [units]);
  const factor = target / servings;
  const btn =
    "flex size-11 items-center justify-center rounded-full border border-line bg-white hover:bg-cream disabled:opacity-40";

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btn}
          onClick={() => setTarget((t) => Math.max(1, t - 1))}
          disabled={target <= 1}
          aria-label="Une portion de moins"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <p className="min-w-28 text-center font-semibold" aria-live="polite">
          {target} portion{target > 1 ? "s" : ""}
        </p>
        <button
          type="button"
          className={btn}
          onClick={() => setTarget((t) => Math.min(100, t + 1))}
          disabled={target >= 100}
          aria-label="Une portion de plus"
        >
          <Plus aria-hidden className="size-4" />
        </button>
        {target !== servings ? (
          <button
            type="button"
            onClick={() => setTarget(servings)}
            className="min-h-11 text-sm font-semibold text-coral-deep underline-offset-4 hover:underline"
          >
            Revenir à {servings}
          </button>
        ) : null}
      </div>
      {target !== servings ? (
        <p className="mt-2 text-sm text-ink-soft">
          Quantités recalculées pour l&apos;affichage ; la recette n&apos;est pas modifiée.
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-line">
        {ingredients.map((ing, i) => {
          const header = ing.section && ing.section !== ingredients[i - 1]?.section ? ing.section : null;
          const qty = formatIngredientQuantity(ing, unitMap, factor);
          return (
            <li key={ing.id} className="py-2.5">
              {header ? (
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">{header}</p>
              ) : null}
              <span className="font-semibold tabular-nums">{qty}</span> {ing.name}
              {ing.note ? <span className="text-ink-soft">, {ing.note}</span> : null}
              {ing.is_optional ? <span className="ml-2 text-sm text-ink-soft">(facultatif)</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
