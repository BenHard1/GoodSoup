const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  oelig: "œ",
  OElig: "Œ",
  aelig: "æ",
  ccedil: "ç",
  Ccedil: "Ç",
  eacute: "é",
  Eacute: "É",
  egrave: "è",
  Egrave: "È",
  ecirc: "ê",
  Ecirc: "Ê",
  euml: "ë",
  agrave: "à",
  Agrave: "À",
  acirc: "â",
  auml: "ä",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  ouml: "ö",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  ntilde: "ñ",
};

/** Décode les entités HTML courantes (« &eacute; », « &#233; », « &#xE9; »). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code] ?? m;
  });
}

/** Texte lisible depuis un fragment HTML : balises retirées, entités décodées, espaces normalisés. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote|dd|dt)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ​]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** Une ligne propre : HTML retiré, espaces simples. */
export function cleanInline(s: string): string {
  return htmlToText(s).replace(/\s+/g, " ").trim();
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}
