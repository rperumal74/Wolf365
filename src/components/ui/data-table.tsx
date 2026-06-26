"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Search,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export type DataCell = string | number | null;

export interface DataRow {
  id: string;
  href: string;
  cells: Record<string, DataCell>;
}

/**
 * Generic sortable + text-filterable table for connector-synced records. The
 * first column links to the row's detail page; every column header toggles
 * sort. Used for the per-connector client validation views.
 */
export function DataTable({
  columns,
  rows,
  searchPlaceholder = "Filter…",
}: {
  columns: DataColumn[];
  rows: DataRow[];
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) =>
          columns.some((c) =>
            String(r.cells[c.key] ?? "").toLowerCase().includes(needle),
          ),
        )
      : rows;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const av = a.cells[sortKey];
      const bv = b.cells[sortKey];
      let cmp: number;
      if (col?.numeric) cmp = (Number(av) || 0) - (Number(bv) || 0);
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [query, rows, columns, sortKey, dir]);

  function toggle(key: string) {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("asc");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-72 rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {visible.length} of {rows.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((c) => {
                const active = c.key === sortKey;
                const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
                return (
                  <th key={c.key} className="px-4 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {c.label}
                      <Icon className="h-3 w-3" />
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-2 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t hover:bg-accent/40">
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("px-4 py-2", c.numeric && "tabular-nums")}>
                    {i === 0 ? (
                      <Link href={r.href} className="font-medium hover:underline">
                        {r.cells[c.key] ?? "—"}
                      </Link>
                    ) : (
                      (r.cells[c.key] ?? <span className="text-muted-foreground">—</span>)
                    )}
                  </td>
                ))}
                <td className="px-4 py-2 text-right">
                  <Link
                    href={r.href}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
