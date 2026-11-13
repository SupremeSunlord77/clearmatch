import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { loadMatches } from "../src/data.js";
import { MOCK_FIXTURE_DIR } from "../src/llm/mock.js";
import { validateResponse } from "../src/scoring/validate.js";

const match01 = loadMatches().find((m) => m.id === "match_01")!;
const fixture = (name: string) => fs.readFileSync(path.join(MOCK_FIXTURE_DIR, name), "utf8");
const valid = () => JSON.parse(fixture("match_01.json"));

const dim = (r: ReturnType<typeof validateResponse>, playerId: string, dimension: string) =>
  r.dimensions.find((d) => d.playerId === playerId && d.dimension === dimension)!;

describe("invalid_example.json: each deliberate fault is caught", () => {
  const r = validateResponse(fixture("invalid_example.json"), match01);

  test("response as a whole is not rejected (faults are per dimension)", () => {
    assert.equal(r.responseRejected, false);
  });

  test("evidence ID from another player → needs_review", () => {
    const d = dim(r, "p1", "respect");
    assert.equal(d.status, "needs_review");
    assert.deepEqual(d.reasons, ["evidence m01-005 was written by p2, not p1"]);
  });

  test("made-up evidence ID → needs_review", () => {
    const d = dim(r, "p3", "teamwork");
    assert.equal(d.status, "needs_review");
    assert.deepEqual(d.reasons, ["evidence m01-999 is not a message in match_01"]);
  });

  test("score of 7 → needs_review", () => {
    const d = dim(r, "p5", "respect");
    assert.equal(d.status, "needs_review");
    assert.deepEqual(d.reasons, ["score 7 is not an integer from 1 to 5"]);
  });

  test("confidence 0.4 → needs_review", () => {
    const d = dim(r, "p8", "communication");
    assert.equal(d.status, "needs_review");
    assert.deepEqual(d.reasons, ["confidence 0.4 is below 0.7"]);
  });

  test("only the 4 faulty dimensions are flagged; the other 20 are accepted", () => {
    assert.equal(r.dimensions.filter((d) => d.status === "needs_review").length, 4);
    assert.equal(r.dimensions.filter((d) => d.status === "accepted").length, 20);
  });
});

describe("valid response", () => {
  test("a fully valid response is accepted (all 24 dimensions)", () => {
    const r = validateResponse(fixture("match_01.json"), match01);
    assert.equal(r.responseRejected, false);
    assert.equal(r.dimensions.length, 24);
    assert.ok(r.dimensions.every((d) => d.status === "accepted" && d.reasons.length === 0));
  });
});

describe("per-dimension rules", () => {
  const withP1Respect = (patch: object) => {
    const v = valid();
    Object.assign(v.players.find((p: { playerId: string }) => p.playerId === "p1").respect, patch);
    return dim(validateResponse(v, match01), "p1", "respect");
  };

  test("evidence ID belonging to another player is rejected", () => {
    const d = withP1Respect({ evidenceMessageIds: ["m01-002"] }); // written by p3
    assert.equal(d.status, "needs_review");
    assert.deepEqual(d.reasons, ["evidence m01-002 was written by p3, not p1"]);
  });

  test("evidence ID from another match is rejected", () => {
    const d = withP1Respect({ evidenceMessageIds: ["m02-001"] }); // p1's, but match_02
    assert.deepEqual(d.reasons, ["evidence m02-001 is not a message in match_01"]);
  });

  test("more than 3 evidence IDs", () => {
    const d = withP1Respect({ evidenceMessageIds: ["m01-001", "m01-006", "m01-011", "m01-019"] });
    assert.deepEqual(d.reasons, ["4 evidence IDs (max 3)"]);
  });

  test("evidence required for scores 1, 2, 4, 5 but not 3", () => {
    for (const score of [1, 2, 4, 5]) {
      assert.deepEqual(withP1Respect({ score, evidenceMessageIds: [] }).reasons, [`evidence is required for score ${score}`]);
    }
    assert.equal(withP1Respect({ score: 3, evidenceMessageIds: [] }).status, "accepted");
  });

  test("non-integer score and out-of-range confidence", () => {
    assert.deepEqual(withP1Respect({ score: 4.5 }).reasons, ["score 4.5 is not an integer from 1 to 5"]);
    assert.deepEqual(withP1Respect({ confidence: 1.2 }).reasons, ["confidence 1.2 is not a number from 0 to 1"]);
  });

  test("rationale over 200 characters", () => {
    assert.deepEqual(withP1Respect({ rationale: "x".repeat(201) }).reasons, ["rationale is 201 characters (max 200)"]);
  });
});

describe("whole-response rejection", () => {
  const rejected = (raw: unknown, reason: string) => {
    const r = validateResponse(raw, match01);
    assert.equal(r.responseRejected, true);
    assert.equal(r.responseReason, reason);
    assert.equal(r.dimensions.length, 24);
    assert.ok(r.dimensions.every((d) => d.status === "needs_review" && d.reasons[0] === reason));
  };

  test("not valid JSON", () => rejected("{ not json", "response is not valid JSON"));
  test("empty output", () => rejected("", "response is not valid JSON"));
  test("wrong shape", () => rejected("[]", "wrong shape: response is not a JSON object"));
  test("missing dimension field", () => {
    const v = valid();
    delete v.players[0].teamwork.rationale;
    rejected(v, 'wrong shape: p1.teamwork is missing "rationale"');
  });
  test("matchId mismatch", () => {
    const v = valid();
    v.matchId = "match_02";
    rejected(v, "matchId mismatch: got match_02, expected match_01");
  });
  test("missing player", () => {
    const v = valid();
    v.players = v.players.filter((p: { playerId: string }) => p.playerId !== "p8");
    rejected(v, "missing players: p8");
  });
  test("duplicated player", () => {
    const v = valid();
    v.players.push(v.players[0]);
    rejected(v, "duplicated playerId p1");
  });
  test("unknown player", () => {
    const v = valid();
    v.players[0].playerId = "p99";
    rejected(v, "unknown playerId p99");
  });
});
