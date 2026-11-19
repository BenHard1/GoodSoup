import { describe, expect, it } from "vitest";
import { isPublicAddress } from "@/features/import/ip";

describe("import par lien : adresses autorisées", () => {
  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "2a00:1450:4007:80e::200e"])("%s est publique", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "fd00::1",
    "fe80::1",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::",
    "localhost",
  ])("%s est refusée", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});
