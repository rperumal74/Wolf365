/** Connector-scoped client browsers (visual validation of synced data). */
export type SourceSlug = "td-synnex" | "qbo" | "superops" | "hudu";

export const SOURCE_LABELS: Record<SourceSlug, string> = {
  "td-synnex": "TD SYNNEX Clients",
  qbo: "QBO Clients",
  superops: "SuperOps Clients",
  hudu: "Hudu Clients",
};

export const SOURCE_BLURB: Record<SourceSlug, string> = {
  "td-synnex":
    "Customers synced from TD SYNNEX StreamOne Stellr. Click one to inspect everything synced about them, including M365 licensing.",
  qbo: "Customers synced from QuickBooks Online. Click one to inspect every synced field.",
  superops: "Clients synced from SuperOps. Click one to inspect every synced field.",
  hudu: "Companies synced from Hudu. Click one to inspect every synced field.",
};

export function isSourceSlug(s: string): s is SourceSlug {
  return s === "td-synnex" || s === "qbo" || s === "superops" || s === "hudu";
}
