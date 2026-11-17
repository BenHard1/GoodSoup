import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { moderateRecipe } from "@/features/recipes/actions";
import { getOpenReports, isAppAdmin } from "@/features/recipes/queries";
import { REPORT_REASONS } from "@/features/recipes/schemas";

export const metadata: Metadata = { title: "Modération" };

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

export default async function ReportsPage() {
  if (!(await isAppAdmin())) notFound();
  const reports = await getOpenReports();
  const byRecipe = new Map<string, typeof reports>();
  for (const r of reports) byRecipe.set(r.recipe_id, [...(byRecipe.get(r.recipe_id) ?? []), r]);

  return (
    <>
      <PageHeader title="Modération" description="Signalements ouverts sur les recettes publiques." />
      {byRecipe.size === 0 ? (
        <p className="rounded-card bg-cream p-8 text-center text-ink-soft">Aucun signalement en attente.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {[...byRecipe.entries()].map(([recipeId, list]) => {
            const recipe = list[0].recipe;
            return (
              <li key={recipeId}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      <Link href={`/recettes/${recipeId}`} className="underline-offset-4 hover:underline">
                        {recipe?.title ?? "Recette supprimée"}
                      </Link>
                    </h2>
                    <span className="text-sm text-ink-soft">
                      {list.length} signalement{list.length > 1 ? "s" : ""} ·{" "}
                      {recipe?.moderation_status === "hidden" ? "masquée automatiquement" : "visible"}
                    </span>
                  </div>
                  <ul className="list-disc pl-5 text-sm">
                    {list.map((r) => (
                      <li key={r.id}>
                        <strong>{reasonLabel(r.reason)}</strong>
                        {r.details ? ` : ${r.details}` : ""}{" "}
                        <span className="text-ink-soft">({new Date(r.created_at).toLocaleDateString("fr-FR")})</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {(["hide", "restore"] as const).map((decision) => (
                      <form key={decision} action={moderateRecipe}>
                        <input type="hidden" name="recipeId" value={recipeId} />
                        <input type="hidden" name="decision" value={decision} />
                        <Button type="submit" size="sm" variant={decision === "hide" ? "danger" : "secondary"}>
                          {decision === "hide" ? "Masquer la recette" : "Rejeter les signalements (laisser visible)"}
                        </Button>
                      </form>
                    ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
