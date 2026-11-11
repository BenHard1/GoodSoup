import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { BottomNav, SideNav } from "./nav";
import { UserMenu } from "./user-menu";

export function AppShell({
  children,
  displayName,
  householdName,
}: {
  children: ReactNode;
  displayName: string;
  householdName?: string;
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/accueil" aria-label="Good Soup, accueil">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/assistant"
              className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-3 text-sm font-semibold hover:bg-cream"
            >
              <Sparkles aria-hidden className="size-4 text-coral-strong" />
              <span className="hidden sm:inline">Assistant</span>
              <span className="sr-only sm:hidden">Assistant</span>
            </Link>
            <UserMenu displayName={displayName} householdName={householdName} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 md:px-6">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 py-6 md:block">
          <SideNav />
        </aside>
        <main id="contenu" className="min-w-0 flex-1 pb-28 pt-6 md:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
