import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildProfiles, trendLabel } from "../src/scoring/aggregate.js";
import type { DimensionValidation, MatchValidationResult } from "../src/scoring/types.js";

// Hand-made example: one player, four matches given out of date order on purpose.
const matches = [
  { id: "m3", date: "2026-01-03" },
  { id: "m1", date: "2026-01-01" },
  { id: "m4", date: "2026-01-04" },
  { id: "m2", date: "2026-01-02" },
];
const player = [{ id: "x", displayName: "X", partyGroup: null }];

/** respect scores for m1..m4; null = needs_review. Teamwork and communication are always 3. */
function results(respect: (number | null)[]): MatchValidationResult[] {
  return ["m1", "m2", "m3", "m4"].map((matchId, i) => {
    const mk = (dimension: DimensionValidation["dimension"], score: number | null): DimensionValidation => ({
      matchId,
      playerId: "x",
      dimension,
      status: score === null ? "needs_review" : "accepted",
      reasons: score === null ? ["confidence 0.5 is below 0.7"] : [],
      proposed: { score: score ?? 3, confidence: score === null ? 0.5 : 0.9, evidenceMessageIds: [], rationale: "" },
    });
    return {
      matchId,
      responseRejected: false,
      responseReason: null,
      dimensions: [mk("respect", respect[i]), mk("teamwork", 3), mk("communication", 3)],
    };
  });
}
const respectOf = (scores: (number | null)[]) => buildProfiles(player, matches, results(scores))[0].respect;

describe("aggregation (D6)", () => {
  test("weights 1,1,2,2 in date order: 1,2,4,5 → 3.5, improving", () => {
    const r = respectOf([1, 2, 4, 5]); // (1+2+8+10)/6 = 3.5
    assert.equal(r.status, "ok");
    assert.equal(r.score, 3.5);
    assert.deepEqual(r.contributions.map((c) => [c.matchId, c.weight]), [["m1", 1], ["m2", 1], ["m3", 2], ["m4", 2]]);
    assert.equal(r.trend, 3); // 4.5 − 1.5
    assert.equal(r.trendLabel, "improving");
  });

  test("rounds to 1 decimal: 5,5,4,4 → 4.3, declining", () => {
    const r = respectOf([5, 5, 4, 4]); // 26/6 = 4.333…
    assert.equal(r.score, 4.3);
    assert.equal(r.trend, -1);
    assert.equal(r.trendLabel, "declining");
  });

  test("flat history → stable", () => {
    const r = respectOf([3, 4, 4, 3]);
    assert.equal(r.trend, 0);
    assert.equal(r.trendLabel, "stable");
  });

  test("trend label thresholds at ±0.5", () => {
    assert.equal(trendLabel(0.5), "improving");
    assert.equal(trendLabel(0.4), "stable");
    assert.equal(trendLabel(-0.4), "stable");
    assert.equal(trendLabel(-0.5), "declining");
    assert.equal(respectOf([3, 3, 3, 4]).trendLabel, "improving"); // 3.5 − 3 = 0.5
  });

  test("needs_review scores are excluded and counted", () => {
    const r = respectOf([null, 2, 4, 5]); // (2+8+10)/5 = 4.0
    assert.equal(r.score, 4);
    assert.equal(r.needsReviewCount, 1);
    assert.equal(r.trend, 2.5); // 4.5 − 2
  });

  test("no accepted scores → insufficient_data", () => {
    const r = respectOf([null, null, null, null]);
    assert.equal(r.status, "insufficient_data");
    assert.equal(r.score, null);
    assert.equal(r.trendLabel, null);
    assert.equal(r.needsReviewCount, 4);
  });

  test("trend is null when one half has no accepted scores", () => {
    const r = respectOf([null, null, 4, 5]);
    assert.equal(r.score, 4.5);
    assert.equal(r.trend, null);
    assert.equal(r.trendLabel, null);
  });
});
