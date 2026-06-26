"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setClientSubsidiariesAction } from "../actions";

export interface ClientOption {
  id: string;
  name: string;
  parentClientId: string | null;
}

/**
 * Two-box subsidiary mapper: the parent client on the left, a searchable,
 * multi-select list of all other clients on the right. Saving sets the parent's
 * full subsidiary list — selecting a client already under another parent moves
 * it here; deselecting a current subsidiary detaches it.
 */
export function SubsidiaryMapper({
  parentId,
  parentName,
  options,
  initialSelectedIds,
}: {
  parentId: string;
  parentName: string;
  options: ClientOption[];
  initialSelectedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));

  const nameById = useMemo(
    () => new Map(options.map((o) => [o.id, o.name])),
    [options],
  );

  // Selectable = every client except the parent itself.
  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options
      .filter((o) => o.id !== parentId)
      .filter((o) => !needle || o.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [options, parentId, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await setClientSubsidiariesAction(parentId, [...selected]);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  const dirty =
    selected.size !== initialSelectedIds.length ||
    initialSelectedIds.some((id) => !selected.has(id));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Left: the parent client */}
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Parent client</p>
          <div className="mt-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{parentName}</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {selected.size} subsidiary(ies) selected. Selecting a client that&apos;s
            already under another parent will move it here.
          </p>
        </div>

        {/* Right: all clients, multi-select */}
        <div className="rounded-lg border">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients…"
                className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-auto p-1">
            {list.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No matching clients.</p>
            ) : (
              list.map((o) => {
                const checked = selected.has(o.id);
                const otherParent =
                  o.parentClientId && o.parentClientId !== parentId
                    ? nameById.get(o.parentClientId) ?? "another client"
                    : null;
                return (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      className="h-4 w-4 rounded border"
                    />
                    <span className="flex-1">{o.name}</span>
                    {otherParent && (
                      <span className="text-xs text-warning">under {otherParent}</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90",
            (pending || !dirty) && "cursor-not-allowed opacity-50",
          )}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save associations
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
