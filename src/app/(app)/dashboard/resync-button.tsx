"use client";

import { useActionState } from "react";
import { resyncOntology, type FormState } from "../actions";

export function ResyncButton() {
  const [state, action, pending] = useActionState<FormState>(resyncOntology, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <button disabled={pending} className="underline underline-offset-4">
        {pending ? "Menyinkron…" : "Sinkron ulang ontologi"}
      </button>
      {state.ok && <span className="text-jade">{state.ok}</span>}
      {state.error && <span className="text-berry">{state.error}</span>}
    </form>
  );
}
