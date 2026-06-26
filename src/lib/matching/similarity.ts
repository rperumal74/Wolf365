import { normalizeName } from "@/lib/reconciliation/discrepancies";

/**
 * Matching / similarity scoring used for AI-assisted client and SKU mapping.
 *
 * The approach is deterministic first (exact normalized-name equality scores
 * 1.0), then a confidence score derived from token-set similarity plus signal
 * bonuses (shared domain). This is intentionally explainable and dependency-free
 * — the "confidence" is a transparent heuristic, not an opaque model — so every
 * proposed match can be justified to a human reviewer.
 */

export function tokenSet(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 1),
  );
}

/** Jaccard similarity between two token sets: |A∩B| / |A∪B|. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface MatchSignals {
  nameA: string;
  nameB: string;
  domainA?: string | null;
  domainB?: string | null;
}

export interface MatchScore {
  /** Confidence in [0, 1]. */
  confidence: number;
  /** True when an exact normalized-name match was found (deterministic). */
  exact: boolean;
}

/** Normalized name with spaces removed — lets "Buhler Industries" line up with
 *  a domain-derived "buhlerindustries". */
function collapse(name: string): string {
  return normalizeName(name).replace(/ /g, "");
}

export function scoreMatch(signals: MatchSignals): MatchScore {
  const normA = normalizeName(signals.nameA);
  const normB = normalizeName(signals.nameB);

  // Only a true normalized-name match auto-confirms (no human review).
  if (normA && normA === normB) {
    return { confidence: 1, exact: true };
  }

  const nameSim = jaccard(tokenSet(signals.nameA), tokenSet(signals.nameB));

  // Space-collapsed equality / containment (e.g. "buhler industries" vs a
  // domain-derived "buhlerindustries") — strong, but surfaced for review rather
  // than auto-merged.
  const cA = collapse(signals.nameA);
  const cB = collapse(signals.nameB);
  const collapsedEqual = cA.length >= 4 && cA === cB;
  const contained =
    cA.length >= 5 && cB.length >= 5 && (cA.includes(cB) || cB.includes(cA));

  // Shared domain is a strong corroborating signal on its own.
  const domainMatch =
    !!signals.domainA &&
    !!signals.domainB &&
    signals.domainA.toLowerCase() === signals.domainB.toLowerCase();

  let base = nameSim * 0.85;
  if (collapsedEqual) base = Math.max(base, 0.95);
  else if (contained) base = Math.max(base, 0.7);

  // Capped below 1.0 so only exact normalized-name matches auto-confirm;
  // everything else stays reviewable.
  let confidence = Math.min(0.99, base + (domainMatch ? 0.5 : 0));
  confidence = Math.round(confidence * 100) / 100;

  return { confidence, exact: false };
}

export interface Candidate {
  id: string;
  name: string;
  domain?: string | null;
}

export interface Proposal {
  sourceId: string;
  targetId: string;
  confidence: number;
  exact: boolean;
}

/**
 * Greedily propose the best target for each source. Each target is used at most
 * once. Only proposals above `threshold` are returned, sorted by confidence.
 */
export function proposeMatches(
  sources: Candidate[],
  targets: Candidate[],
  threshold = 0.45,
): Proposal[] {
  const scored: Proposal[] = [];
  for (const s of sources) {
    for (const t of targets) {
      const { confidence, exact } = scoreMatch({
        nameA: s.name,
        nameB: t.name,
        domainA: s.domain,
        domainB: t.domain,
      });
      if (confidence >= threshold) {
        scored.push({ sourceId: s.id, targetId: t.id, confidence, exact });
      }
    }
  }

  // Highest-confidence proposals win; each source/target used once.
  scored.sort((a, b) => b.confidence - a.confidence);
  const usedSource = new Set<string>();
  const usedTarget = new Set<string>();
  const result: Proposal[] = [];
  for (const p of scored) {
    if (usedSource.has(p.sourceId) || usedTarget.has(p.targetId)) continue;
    usedSource.add(p.sourceId);
    usedTarget.add(p.targetId);
    result.push(p);
  }
  return result;
}
