import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {subtitle ? <p className="mt-2 text-ink-soft">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </Card>
  );
}
