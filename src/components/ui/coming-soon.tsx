import { Construction } from "lucide-react";
import type { ReactNode } from "react";

/** Panneau honnête pour un module pas encore construit : jamais de fonctionnalité simulée. */
export function ComingSoonPanel({ title, phase, children }: { title: string; phase: number; children: ReactNode }) {
  return (
    <section className="rounded-card border border-dashed border-ink-faint bg-white/70 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-lemon-soft">
          <Construction aria-hidden className="size-6 text-ink" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm font-semibold text-coral-strong">Arrive en Phase {phase}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-ink-soft">{children}</div>
    </section>
  );
}
