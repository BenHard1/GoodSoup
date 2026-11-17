import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream/60">
      <header className="px-4 py-5 sm:px-8">
        <Link href="/" aria-label="Good Soup, accueil">
          <Logo />
        </Link>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-10">
        {children}
      </main>
      <footer className="flex flex-wrap justify-center gap-4 px-4 py-6 text-sm text-ink-soft">
        <Link className="underline-offset-4 hover:underline" href="/confidentialite">
          Confidentialité
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/mentions-legales">
          Mentions légales
        </Link>
      </footer>
    </div>
  );
}
