"use client";

import { LogOut, Settings, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { signOut } from "@/features/auth/actions";

const itemCls =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink outline-none data-[highlighted]:bg-cream";

export function UserMenu({ displayName, householdName }: { displayName: string; householdName?: string }) {
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Menu du compte de ${displayName || "l'utilisateur"}`}
        className="flex size-11 items-center justify-center rounded-full bg-sage font-display text-lg font-semibold text-ink"
      >
        {initial}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-60 rounded-xl border border-line bg-white p-1.5 shadow-card"
        >
          <div className="px-3 py-2">
            <p className="font-semibold">{displayName || "Mon compte"}</p>
            {householdName ? <p className="text-sm text-ink-soft">{householdName}</p> : null}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={itemCls}>
            <Link href="/profil">
              <UserRound aria-hidden className="size-4" /> Mon profil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemCls}>
            <Link href="/foyer">
              <Users aria-hidden className="size-4" /> Mon foyer
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemCls}>
            <Link href="/parametres">
              <Settings aria-hidden className="size-4" /> Paramètres
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={itemCls} onSelect={() => void signOut()}>
            <LogOut aria-hidden className="size-4" /> Se déconnecter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
