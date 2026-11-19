import { cn } from "@/lib/cn";
import { expiryLabel, expiryStatus } from "../expiry";

const tones = {
  expired: "bg-danger-soft text-danger",
  today: "bg-coral-soft text-coral-deep",
  soon: "bg-lemon-soft text-ink",
  ok: "text-ink-soft",
  none: "",
} as const;

export function ExpiryBadge({ expiresOn, today }: { expiresOn: string | null; today: string }) {
  const label = expiryLabel(expiresOn, today);
  if (!label) return null;
  const status = expiryStatus(expiresOn, today);
  return (
    <span
      className={cn(
        "inline-flex items-center text-sm font-semibold",
        status !== "ok" && "rounded-full px-2.5 py-0.5",
        tones[status],
      )}
    >
      {label}
    </span>
  );
}
