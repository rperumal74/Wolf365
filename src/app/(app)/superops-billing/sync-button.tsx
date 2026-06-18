"use client";

import { useActionState } from "react";
import { syncSuperOpsAction, type SoActionResult } from "./actions";

export function SyncSuperOpsButton() {
  const [state, action, pending] = useActionState<SoActionResult | null, FormData>(
    syncSuperOpsAction,
    null,
  );
  return (
    <form action={action} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import from SuperOps"}
      </button>
      {state && (
        <span className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
