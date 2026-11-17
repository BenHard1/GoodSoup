import { CookingPot } from "lucide-react";

/** Visuel neutre quand une recette n'a pas encore de photo (aucune image générée ni inventée). */
export function RecipeImagePlaceholder({ title }: { title: string }) {
  const tones = ["bg-coral-soft", "bg-sage-soft", "bg-lemon-soft", "bg-cream"];
  const tone = tones[[...title].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % tones.length];
  return (
    <div className={`flex size-full items-center justify-center ${tone}`}>
      <CookingPot aria-hidden className="size-12 text-ink/30" />
    </div>
  );
}
