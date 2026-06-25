"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { STAGE_ORDER, STAGE_LABELS } from "@/lib/crm/constants";

const fieldCls =
  "rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-xs font-medium text-muted-foreground";

/** Stage + close-date-range filter for a CRM line. State lives in the URL so the
 *  cards and the table both reflect the same filtered set. */
export function CrmFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const stage = sp.get("stage") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters = Boolean(stage || from || to);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <div>
        <label className={labelCls} htmlFor="filter-stage">
          Stage
        </label>
        <select
          id="filter-stage"
          value={stage}
          onChange={(e) => update("stage", e.target.value)}
          className={fieldCls}
        >
          <option value="">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls} htmlFor="filter-from">
          Close date from
        </label>
        <input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => update("from", e.target.value)}
          className={fieldCls}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="filter-to">
          Close date to
        </label>
        <input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => update("to", e.target.value)}
          className={fieldCls}
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" /> Clear
        </button>
      )}
    </div>
  );
}
