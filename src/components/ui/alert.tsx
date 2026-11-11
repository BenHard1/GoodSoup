import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  error: { cls: "bg-danger-soft text-danger border-danger/30", Icon: CircleAlert, role: "alert" as const },
  success: { cls: "bg-sage-soft text-success border-sage", Icon: CircleCheck, role: "status" as const },
  info: { cls: "bg-lemon-soft text-ink border-lemon", Icon: Info, role: "status" as const },
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  const { cls, Icon, role } = tones[tone];
  return (
    <div
      role={role}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold", cls, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
