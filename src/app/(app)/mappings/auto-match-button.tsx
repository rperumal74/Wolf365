"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MappingActionResult } from "./actions";

/** "Run auto-match" button that reports how many matches/links it produced. */
export function AutoMatchButton({
  action,
}: {
  action: (
    prev: MappingActionResult | null,
    formData: FormData,
  ) => Promise<MappingActionResult>;
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState<MappingActionResult | null, FormData>(
    async (prev, fd) => {
      const result = await action(prev, fd);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={dispatch}>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-accent",
            pending && "cursor-not-allowed opacity-50",
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Run auto-match
        </button>
      </form>
      {state && (
        <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")}>
          {state.message}
        </p>
      )}
    </div>
  );
}
