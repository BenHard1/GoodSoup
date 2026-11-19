import "server-only";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";
import { isPublicAddress } from "./ip";

/**
 * Récupération d'une page web pour l'import par lien, protégée contre les détournements (SSRF) :
 * http(s) uniquement, ports standard, aucune adresse privée ou locale (vérifiée à la connexion même,
 * donc aussi après chaque redirection et contre le « DNS rebinding »), taille et durée limitées.
 */

export class FetchPageError extends Error {}

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; GoodSoupRecipeImport/1.0)";

const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = (Array.isArray(addresses) ? addresses : [addresses]) as { address: string; family: number }[];
    const allowed = list.filter((a) => isPublicAddress(a.address));
    if (!allowed.length || allowed.length !== list.length) {
      return callback(new FetchPageError("Adresse non autorisée."), "", 0);
    }
    if ((options as { all?: boolean }).all)
      return (callback as unknown as (e: null, a: typeof allowed) => void)(null, allowed);
    callback(null, allowed[0].address, allowed[0].family);
  });
};

export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchPageError("Adresse web invalide.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new FetchPageError("Seuls les liens http(s) sont acceptés.");
  if (url.username || url.password) throw new FetchPageError("Adresse web invalide.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchPageError("Adresse web non autorisée.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new FetchPageError("Adresse web non autorisée.");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host))
    throw new FetchPageError("Adresse web non autorisée.");
  url.hash = "";
  return url;
}

type Page = { url: string; html: string };

function requestOnce(url: URL): Promise<{ status: number; location?: string; body?: Buffer; contentType: string }> {
  return new Promise((resolveRaw, rejectRaw) => {
    // Délai global (résolution DNS comprise), en plus du délai d'inactivité du socket.
    const timer = setTimeout(
      () => req.destroy(new FetchPageError("Le site met trop de temps à répondre.")),
      TIMEOUT_MS,
    );
    const resolve: typeof resolveRaw = (v) => {
      clearTimeout(timer);
      resolveRaw(v);
    };
    const reject = (e: unknown) => {
      clearTimeout(timer);
      rejectRaw(e);
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return resolve({ status, contentType });
        }
        if (contentType && !/text\/html|application\/xhtml|text\/plain|application\/ld\+json/i.test(contentType)) {
          res.resume();
          return reject(new FetchPageError("Ce lien ne mène pas à une page web."));
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" || encoding === "x-gzip"
            ? res.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? res.pipe(zlib.createInflate())
              : encoding === "br"
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new FetchPageError("Cette page est trop volumineuse."));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, body: Buffer.concat(chunks), contentType }));
        stream.on("error", () => reject(new FetchPageError("La page n'a pas pu être lue.")));
      },
    );
    req.on("timeout", () => req.destroy(new FetchPageError("Le site met trop de temps à répondre.")));
    req.on("error", (e) => reject(e instanceof FetchPageError ? e : new FetchPageError("Le site est injoignable.")));
    req.end();
  });
}

function decode(body: Buffer, contentType: string): string {
  const head = body.subarray(0, 2048).toString("latin1");
  const charset =
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export async function fetchPage(raw: string): Promise<Page> {
  let url = checkUrl(raw);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await requestOnce(url);
    if (res.location) {
      url = checkUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status === 404 || res.status === 410) throw new FetchPageError("Cette page n'existe pas (ou plus).");
    if (res.status === 401 || res.status === 403)
      throw new FetchPageError("Ce site refuse l'accès automatique à ses pages.");
    if (!res.body) throw new FetchPageError("Le site a répondu avec une erreur. Réessaie plus tard.");
    return { url: url.toString(), html: decode(res.body, res.contentType) };
  }
  throw new FetchPageError("Trop de redirections.");
}
