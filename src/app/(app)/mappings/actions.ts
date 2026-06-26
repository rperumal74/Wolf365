"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { safeErrorMessage } from "@/lib/redact";
import {
  proposeClientMatches,
  proposeSkuMatches,
  confirmClientMatch,
  rejectClientMatch,
  setProductMappingStatus,
  materializeClients,
} from "@/lib/mapping/service";

export interface MappingActionResult {
  ok: boolean;
  message: string;
}

export async function autoMatchClientsAction(
  _prev: MappingActionResult | null,
  _formData: FormData,
): Promise<MappingActionResult> {
  const user = await requirePermission("mappings:propose");
  try {
    // First match QBO↔TD: exact names merge automatically, fuzzy near-matches
    // become proposals for review. THEN materialize a Client for every remaining
    // customer (skipping those with a pending proposal, so they stay reviewable).
    const match = await proposeClientMatches({ id: user.id, email: user.email });
    const mat = await materializeClients({ id: user.id, email: user.email });
    revalidatePath("/mappings");
    revalidatePath("/clients");
    return {
      ok: true,
      message: `${match.proposed} match(es) awaiting review · ${match.autoConfirmed} auto-linked · ${mat.created} new client(s) materialized.`,
    };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}

export async function autoMatchSkusAction(
  _prev: MappingActionResult | null,
  _formData: FormData,
): Promise<MappingActionResult> {
  const user = await requirePermission("mappings:propose");
  try {
    const r = await proposeSkuMatches({ id: user.id, email: user.email });
    revalidatePath("/mappings");
    return {
      ok: true,
      message: `${r.proposed} SKU mapping(s) awaiting review · ${r.autoConfirmed} auto-linked.`,
    };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err) };
  }
}

export async function confirmClientAction(formData: FormData): Promise<void> {
  const user = await requirePermission("mappings:approve");
  await confirmClientMatch(String(formData.get("id")), {
    id: user.id,
    email: user.email,
  });
  revalidatePath("/mappings");
}

export async function rejectClientAction(formData: FormData): Promise<void> {
  const user = await requirePermission("mappings:approve");
  await rejectClientMatch(String(formData.get("id")), {
    id: user.id,
    email: user.email,
  });
  revalidatePath("/mappings");
}

export async function confirmSkuAction(formData: FormData): Promise<void> {
  const user = await requirePermission("mappings:approve");
  await setProductMappingStatus(String(formData.get("sku")), "CONFIRMED", {
    id: user.id,
    email: user.email,
  });
  revalidatePath("/mappings");
}

export async function rejectSkuAction(formData: FormData): Promise<void> {
  const user = await requirePermission("mappings:approve");
  await setProductMappingStatus(String(formData.get("sku")), "REJECTED", {
    id: user.id,
    email: user.email,
  });
  revalidatePath("/mappings");
}
