"use client";

import { useActionState } from "react";
import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerBackupAction, type BackupActionResult } from "./actions";

/** On-demand backup button + data-export download link. */
export function BackupPanel({ neonConfigured }: { neonConfigured: boolean }) {
  const [state, action, pending] = useActionState<BackupActionResult | null, FormData>(
    triggerBackupAction,
    null,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <form action={action}>
          <button
            type="submit"
            disabled={!neonConfigured || pending}
            title={
              neonConfigured
                ? "Create a Neon branch snapshot of the whole database now."
                : "Set NEON_API_KEY and NEON_PROJECT_ID to enable Neon backups."
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90",
              (!neonConfigured || pending) && "cursor-not-allowed opacity-50",
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DatabaseBackup className="h-4 w-4" />
            )}
            Back up now
          </button>
        </form>

        <a
          href="/api/backup/export"
          className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Download data export (JSON)
        </a>
      </div>

      {state && (
        <p className={cn("text-sm", state.ok ? "text-success" : "text-danger")}>
          {state.message}
        </p>
      )}
    </div>
  );
}
