"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/utils";
import {
  createBillingRunAction,
  type BillingActionResult,
} from "../actions";

interface Props {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}

export function NewRunForm({ clients, defaultClientId }: Props) {
  const [mode, setMode] = useState<"monthly" | "custom">("monthly");
  const [state, action, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(createBillingRunAction, null);

  return (
    <form action={action} className="max-w-xl space-y-5 rounded-lg border bg-card p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Client</label>
        <select
          name="clientId"
          defaultValue={defaultClientId ?? ""}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Billing period</label>
        <div className="mb-3 flex gap-2">
          {(["monthly", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm capitalize transition",
                mode === m ? "border-primary bg-accent" : "hover:bg-accent/60",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <input type="hidden" name="mode" value={mode} />

        {mode === "monthly" ? (
          <input
            type="month"
            name="month"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Start</label>
              <input type="date" name="start" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">End (exclusive)</label>
              <input type="date" name="end" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Invoice date (optional)</label>
        <input
          type="date"
          name="invoiceDate"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Defaults to the period start date.
        </p>
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate draft billing run"}
      </button>
    </form>
  );
}
