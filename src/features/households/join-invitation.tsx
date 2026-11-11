"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { joinHousehold } from "./actions";

export function JoinInvitation({ token, next }: { token: string; next: string }) {
  const [state, action] = useActionState(joinHousehold, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="invitation" value={token} />
      <input type="hidden" name="redirectTo" value={next} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <SubmitButton pendingLabel="Un instant…">Rejoindre le foyer</SubmitButton>
    </form>
  );
}
