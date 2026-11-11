import { cn } from "@/lib/cn";

/** Logo : un bol fumant. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-9", className)}>
      <circle cx="24" cy="24" r="24" fill="#F4C65B" />
      <path
        d="M17 11c-2 2 2 4 0 6M24 9c-2 2 2 4 0 6M31 11c-2 2 2 4 0 6"
        stroke="#39483C"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M9 22h30a15 15 0 0 1-30 0Z" fill="#F47C58" />
      <path d="M9 22h30" stroke="#39483C" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="24" cy="38.5" rx="7" ry="1.6" fill="#39483C" opacity=".85" />
      <circle cx="18" cy="28" r="2" fill="#A8C686" />
      <circle cx="27" cy="30" r="1.6" fill="#F9EBD6" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight">Good Soup</span>
    </span>
  );
}
