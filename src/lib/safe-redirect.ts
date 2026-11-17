/** N'accepte qu'un chemin interne (évite les redirections ouvertes vers un autre site). */
export function safeNextPath(next: unknown, fallback = "/accueil"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
