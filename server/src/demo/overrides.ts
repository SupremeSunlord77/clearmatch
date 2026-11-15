// M7: a clearly labelled SIMULATED AI error for the overturn demo.
// Overrides replace one match score in the loaded results before profiles are built, so the profile,
// challenges, reviewer page and lobby all treat it like any other score. The real scoring pipeline,
// validator and output/match-results.json are never changed. Stored in output/demo-overrides.json.
import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR, type DimensionResult, type MatchResultsFile } from "../scoring/results.js";
import type { Dimension } from "../scoring/types.js";

export const OVERRIDES_PATH = path.join(OUTPUT_DIR, "demo-overrides.json");

export interface ScoreOverride {
  playerId: string;
  dimension: Dimension;
  matchId: string;
  score: number;
  confidence: number;
  rationale: string;
  evidenceMessageIds: string[];
  simulated: true;
}

/** A result that may carry the simulated flag after overrides are applied. */
export type EffectiveDimensionResult = DimensionResult & { simulated?: true };

export const isSimulated = (r: DimensionResult | undefined) => (r as EffectiveDimensionResult | undefined)?.simulated === true;

/**
 * The simulated error: Havoc (p5) Respect in match 3 scored 1, citing p5's own game language
 * ("gonna kill it this round", "destroy their base", "gg, killed it") as if it were threatening.
 * With the run 4 data (p5 Respect 3, 3, 4, 3; weights 1, 1, 2, 2):
 *   before:            (3 + 3 + 2×4 + 2×3) / 6 = 20/6 = 3.3  Neutral
 *   while active:      (3 + 3 + 2×1 + 2×3) / 6 = 14/6 = 2.3  Low
 *   after overturning: (3 + 3 + 2×3) / 4       = 12/4 = 3.0  Neutral (match 3 no longer counts)
 */
export const SIMULATED_AI_ERROR: ScoreOverride[] = [
  {
    playerId: "p5",
    dimension: "respect",
    matchId: "match_03",
    score: 1,
    confidence: 0.8,
    rationale: "Threatening language towards opponents.",
    evidenceMessageIds: ["m03-007", "m03-020", "m03-030"],
    simulated: true,
  },
];

export class OverrideStore {
  private items: ScoreOverride[] = [];

  /** file = null keeps overrides in memory only (used by tests). */
  constructor(private file: string | null = OVERRIDES_PATH) {
    if (file && fs.existsSync(file)) this.items = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  private save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.items, null, 2) + "\n");
  }

  list(): ScoreOverride[] {
    return [...this.items];
  }

  active(): boolean {
    return this.items.length > 0;
  }

  /** Idempotent: applying twice leaves exactly one copy of each override. Returns how many were added. */
  simulateAiError(): number {
    let added = 0;
    for (const o of SIMULATED_AI_ERROR) {
      const exists = this.items.some((x) => x.playerId === o.playerId && x.dimension === o.dimension && x.matchId === o.matchId);
      if (!exists) {
        this.items.push({ ...o, evidenceMessageIds: [...o.evidenceMessageIds] });
        added++;
      }
    }
    if (added > 0) this.save();
    return added;
  }

  reset(): number {
    const n = this.items.length;
    this.items = [];
    this.save();
    return n;
  }
}

/** Returns a copy of the results with the overrides in place (accepted, marked simulated). */
export function applyOverrides(results: MatchResultsFile, overrides: ScoreOverride[]): MatchResultsFile {
  if (overrides.length === 0) return results;
  const out: MatchResultsFile = structuredClone(results);
  for (const o of overrides) {
    const dims = out.matches.find((m) => m.matchId === o.matchId)?.players[o.playerId];
    if (!dims) continue; // player did not play in that match
    const r: EffectiveDimensionResult = {
      status: "accepted",
      score: o.score,
      confidence: o.confidence,
      evidenceMessageIds: [...o.evidenceMessageIds],
      rationale: o.rationale,
      reasons: [],
      simulated: true,
    };
    dims[o.dimension] = r;
  }
  return out;
}
