"use client";

import { useActionState } from "react";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { createUserAction } from "./users-actions";

const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Invite a new user by email so they can sign in (sign-in is invite-only). */
export function CreateUserForm() {
  const [result, action, pending] = useActionState(createUserAction, null);

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">Add a user</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Users can only sign in after you create them here. They authenticate
          with Microsoft 365 using this exact email.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="person@yourco.com"
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Name (optional)</span>
          <input name="name" type="text" className={cn(inputCls, "mt-1")} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <select name="role" defaultValue="REVIEWER" className={cn(inputCls, "mt-1")}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
      {result && (
        <p
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            result.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
          )}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
