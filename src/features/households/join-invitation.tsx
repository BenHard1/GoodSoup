"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { joinHousehold } from "./actions";

export function JoinInvitation({ token, next }: { token: string; next: string }) {
  const [state, action] = useActionState(joinHousehold, initialActionState);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.push(next);
  }, [state, next, router]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="invitation" value={token} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <SubmitButton pendingLabel="Un instant…">Rejoindre le foyer</SubmitButton>
    </form>
  );
}
