import { describe, it, expect } from "vitest";
import { scoreMatch, proposeMatches, jaccard, tokenSet } from "@/lib/matching/similarity";

describe("similarity scoring", () => {
  it("scores exact normalized names as 1.0 / exact", () => {
    const r = scoreMatch({ nameA: "Acme, Inc.", nameB: "ACME LLC" });
    expect(r.exact).toBe(true);
    expect(r.confidence).toBe(1);
  });

  it("gives partial confidence to overlapping names", () => {
    const r = scoreMatch({ nameA: "Acme Cloud Services", nameB: "Acme Cloud" });
    expect(r.exact).toBe(false);
    expect(r.confidence).toBeGreaterThan(0.45);
    expect(r.confidence).toBeLessThan(1);
  });

  it("boosts confidence when domains match", () => {
    const withDomain = scoreMatch({
      nameA: "Acme Cloud",
      nameB: "Acme Services",
      domainA: "acme.com",
      domainB: "acme.com",
    });
    const without = scoreMatch({ nameA: "Acme Cloud", nameB: "Acme Services" });
    expect(withDomain.confidence).toBeGreaterThan(without.confidence);
  });

  it("jaccard handles disjoint and identical sets", () => {
    expect(jaccard(tokenSet("alpha beta"), tokenSet("alpha beta"))).toBe(1);
    expect(jaccard(tokenSet("alpha"), tokenSet("gamma"))).toBe(0);
  });

  it("proposes one-to-one matches greedily by confidence", () => {
    const sources = [
      { id: "q1", name: "Acme Inc" },
      { id: "q2", name: "Globex Corporation" },
    ];
    const targets = [
      { id: "t1", name: "Globex" },
      { id: "t2", name: "Acme" },
    ];
    const proposals = proposeMatches(sources, targets);
    const map = Object.fromEntries(proposals.map((p) => [p.sourceId, p.targetId]));
    expect(map.q1).toBe("t2");
    expect(map.q2).toBe("t1");
  });

  it("does not reuse a target across sources", () => {
    const sources = [
      { id: "q1", name: "Acme" },
      { id: "q2", name: "Acme" },
    ];
    const targets = [{ id: "t1", name: "Acme" }];
    const proposals = proposeMatches(sources, targets);
    expect(proposals).toHaveLength(1);
  });
});
