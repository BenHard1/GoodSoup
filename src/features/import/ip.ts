import { isIP } from "node:net";

/**
 * Une adresse IP est-elle publique (routable sur Internet) ?
 * Refuse boucle locale, réseaux privés, lien local, CGNAT, multicast, réservés et équivalents IPv6.
 */
export function isPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").split("%")[0];
  const v = isIP(ip);
  if (v === 4) return isPublicV4(ip);
  if (v !== 6) return false;
  const lower = ip.toLowerCase();
  // IPv4 encapsulée (::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::a.b.c.d)
  const embedded = lower.match(/(?:^::(?:ffff:)?|^64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) return isPublicV4(embedded[1]);
  const hextets = expandV6(lower);
  if (!hextets) return false;
  if (hextets.every((h) => h === 0)) return false; // ::
  if (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1) return false; // ::1
  if (hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff) return false; // ::ffff:hex form
  const first = hextets[0];
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 lien local
  if ((first & 0xffc0) === 0xfec0) return false; // fec0::/10 site local (obsolète)
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (first === 0x2001 && hextets[1] === 0x0db8) return false; // documentation
  if (first === 0x0064 && hextets[1] === 0xff9b) return false; // NAT64 sous forme hexadécimale
  if (first === 0x2002) return false; // 6to4 (peut encapsuler une adresse privée)
  if (first === 0x2001 && hextets[1] === 0) return false; // Teredo
  return (first & 0xe000) === 0x2000; // unicast global 2000::/3
}

function isPublicV4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // lien local, métadonnées cloud
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast, réservé, diffusion
  return true;
}

function expandV6(ip: string): number[] | null {
  const parts = ip.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (parts.length === 1 && missing !== 0) return null;
  const all = [...head, ...Array(Math.max(missing, 0)).fill("0"), ...tail];
  if (all.length !== 8) return null;
  const nums = all.map((h) => parseInt(h, 16));
  return nums.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff) ? null : nums;
}
