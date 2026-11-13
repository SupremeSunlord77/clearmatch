import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { loadMatches, loadPlayers } from "../src/data.js";
import { buildPlayerProfile, type ProfileDeps } from "../src/profile/build.js";
import { ChallengeStore } from "../src/profile/challenges.js";
import { EvidenceIndex } from "../src/profile/evidence.js";
import { bandFor, loadGuidance, tipsFor, type Guidance } from "../src/profile/guidance.js";
import { scoreWithMock, type MatchResultsFile } from "../src/scoring/results.js";

// Mock results: p2 respect = 1, 1, 2, 1 across matches 1–4 (all accepted).
const players = loadPlayers();
const matches = loadMatches();
const baseResults = await scoreWithMock();
const evidence = new EvidenceIndex(matches, players);
const guidance = loadGuidance();
const ctx = { players, results: baseResults };
const dataText = new Map(matches.flatMap((m) => m.messages).map((x) => [x.id, x]));

function setup(results: MatchResultsFile = baseResults) {
  const store = new ChallengeStore(null);
  const deps = (): ProfileDeps => ({ players, matches, results, guidance, evidence, challenges: store.list() });
  const profile = (pid: string) => buildPlayerProfile(pid, deps())!;
  const dim = (pid: string, d: "respect" | "teamwork" | "communication") => profile(pid).dimensions.find((x) => x.dimension === d)!;
  const challenge = (matchId: string, extra: object = {}) => {
    const r = store.create({ playerId: "p2", dimension: "respect", matchId, reason: "missing_context", ...extra }, { players, results });
    assert.ok(r.ok, r.ok ? "" : r.error);
    return r.value;
  };
  return { store, profile, dim, challenge };
}

describe("evidence comes only from the data files (D2)", () => {
  test("every evidence line's text, speaker and time match data/matches", () => {
    const { profile } = setup();
    for (const p of players) {
      for (const d of profile(p.id).dimensions) {
        for (const lm of d.loweringMatches) {
          for (const e of lm.evidence) {
            const src = dataText.get(e.messageId)!;
            assert.equal(e.text, src.text);
            assert.equal(e.speakerId, src.playerId);
            assert.equal(e.timestamp, src.timestamp);
            assert.equal(e.matchId, lm.matchId);
          }
        }
      }
    }
  });

  test("model text is never used as evidence; unknown IDs are dropped", () => {
    const tampered: MatchResultsFile = structuredClone(baseResults);
    const r = tampered.matches[0].players.p2.respect;
    r.rationale = "MODEL TEXT that must not appear as evidence";
    r.evidenceMessageIds = ["m01-005", "m01-999"];
    const lm = setup(tampered).dim("p2", "respect").loweringMatches[0];
    assert.deepEqual(lm.evidence.map((e) => e.text), [dataText.get("m01-005")!.text]);
    assert.ok(!lm.evidence.some((e) => e.text.includes("MODEL TEXT")));
    assert.equal(lm.aiSummary, "MODEL TEXT that must not appear as evidence"); // shown only as the AI summary
  });

  test("context: 2 messages before and after, from the same match", () => {
    const c = evidence.withContext("m01-005")!;
    assert.deepEqual(c.before.map((l) => l.messageId), ["m01-003", "m01-004"]);
    assert.deepEqual(c.after.map((l) => l.messageId), ["m01-006", "m01-007"]);
    const first = evidence.withContext("m01-001")!;
    assert.deepEqual(first.before, []);
  });
});

describe("challenge decisions (D5)", () => {
  test("baseline: p2 respect 1.3, low, expanded, 4 lowering matches", () => {
    const d = setup().dim("p2", "respect");
    assert.equal(d.score, 1.3);
    assert.equal(d.band, "low");
    assert.equal(d.expanded, true);
    assert.deepEqual(d.loweringMatches.map((m) => [m.matchId, m.score]), [["match_01", 1], ["match_02", 1], ["match_03", 2], ["match_04", 1]]);
  });

  test("overturned excludes exactly that match + dimension and changes the aggregate", () => {
    const { store, dim, challenge } = setup();
    const before = { teamwork: dim("p2", "teamwork").score, communication: dim("p2", "communication").score, p1: dim("p1", "respect").score };
    const c = challenge("match_01");
    store.decide(c.id, { decision: "overturned" });
    const d = dim("p2", "respect");
    assert.equal(d.score, 1.4); // (1·1 + 2·2 + 1·2) / 5
    const lm = d.loweringMatches.find((m) => m.matchId === "match_01")!;
    assert.equal(lm.counted, false);
    assert.equal(lm.review!.status, "overturned");
    assert.equal(lm.canChallenge, false);
    assert.ok(d.loweringMatches.filter((m) => m.matchId !== "match_01").every((m) => m.counted));
    // Other dimensions and other players are unchanged.
    assert.equal(dim("p2", "teamwork").score, before.teamwork);
    assert.equal(dim("p2", "communication").score, before.communication);
    assert.equal(dim("p1", "respect").score, before.p1);
  });

  test("upheld changes nothing and keeps the reviewer comment", () => {
    const { store, dim, challenge } = setup();
    const c = challenge("match_03");
    store.decide(c.id, { decision: "upheld", comment: "Insults were aimed at a teammate." });
    const d = dim("p2", "respect");
    assert.equal(d.score, 1.3);
    const lm = d.loweringMatches.find((m) => m.matchId === "match_03")!;
    assert.equal(lm.counted, true);
    assert.equal(lm.review!.status, "upheld");
    assert.equal(lm.review!.reviewerComment, "Insults were aimed at a teammate.");
  });

  test("pending still counts", () => {
    const { dim, challenge } = setup();
    challenge("match_02");
    const d = dim("p2", "respect");
    assert.equal(d.score, 1.3);
    const lm = d.loweringMatches.find((m) => m.matchId === "match_02")!;
    assert.equal(lm.counted, true);
    assert.equal(lm.review!.status, "pending");
    assert.equal(lm.canChallenge, false);
  });

  test('trend becomes "not enough data" when a half is empty', () => {
    const { store, dim, challenge } = setup();
    for (const m of ["match_01", "match_02"]) store.decide(challenge(m).id, { decision: "overturned" });
    const d = dim("p2", "respect");
    assert.equal(d.score, 1.5); // matches 3–4 only: (2·2 + 1·2) / 4
    assert.equal(d.trend, "not_enough_data");
  });

  test("challenges persist to file and survive a restart", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "clearmatch-")), "challenges.json");
    const a = new ChallengeStore(file);
    const r = a.create({ playerId: "p2", dimension: "respect", matchId: "match_01", reason: "other" }, ctx);
    assert.ok(r.ok);
    const b = new ChallengeStore(file);
    assert.equal(b.list().length, 1);
    assert.equal(b.list()[0].status, "pending");
  });
});

describe("challenge rules (D4)", () => {
  const reject = (body: object, status: number, message: RegExp, store = new ChallengeStore(null)) => {
    const r = store.create({ playerId: "p2", dimension: "respect", matchId: "match_01", reason: "other", ...body }, ctx);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, status);
      assert.match(r.error, message);
    }
  };

  test("score 3 or higher cannot be challenged", () => {
    reject({ playerId: "p1" }, 400, /Only match scores of 1 or 2 can be challenged; this score is 5/); // p1 respect match_01 = 5
    reject({ playerId: "p3" }, 400, /this score is 3/);
  });
  test("duplicate open challenge is rejected", () => {
    const store = new ChallengeStore(null);
    assert.ok(store.create({ playerId: "p2", dimension: "respect", matchId: "match_01", reason: "other" }, ctx).ok);
    reject({}, 409, /already an open challenge/, store);
  });
  test("unknown player, match, dimension or reason", () => {
    reject({ playerId: "p99" }, 404, /Unknown player: p99/);
    reject({ matchId: "match_99" }, 404, /Unknown match: match_99/);
    reject({ dimension: "kindness" }, 400, /Unknown dimension/);
    reject({ reason: "because" }, 400, /Unknown reason/);
  });
  test("note over 200 characters is rejected", () => {
    reject({ note: "x".repeat(201) }, 400, /note is 201 characters \(max 200\)/);
  });
  test("a match score already with a human reviewer cannot be challenged", () => {
    const results: MatchResultsFile = structuredClone(baseResults);
    results.matches[0].players.p2.respect.status = "needs_review";
    const r = new ChallengeStore(null).create({ playerId: "p2", dimension: "respect", matchId: "match_01", reason: "other" }, { players, results });
    assert.equal(r.ok, false);
  });
  test("decisions: only pending, only upheld/overturned", () => {
    const store = new ChallengeStore(null);
    const c = store.create({ playerId: "p2", dimension: "respect", matchId: "match_01", reason: "other" }, ctx);
    assert.ok(c.ok);
    if (!c.ok) return;
    assert.equal(store.decide(c.value.id, { decision: "maybe" }).ok, false);
    assert.ok(store.decide(c.value.id, { decision: "upheld" }).ok);
    const again = store.decide(c.value.id, { decision: "overturned" });
    assert.equal(again.ok, false);
  });
});

describe("guidance (D6)", () => {
  const g: Guidance = {
    respect: { low: ["L1", "L2", "L3"], neutral: ["N1"], good: [] },
    teamwork: { low: [], neutral: [], good: [] },
    communication: { low: [], neutral: [], good: [] },
    howItWorks: "x",
  };

  test("band edges: 2.4 low, 2.5 neutral, 3.4 neutral, 3.5 good", () => {
    assert.equal(bandFor(2.4), "low");
    assert.equal(bandFor(2.5), "neutral");
    assert.equal(bandFor(3.4), "neutral");
    assert.equal(bandFor(3.5), "good");
  });
  test("at most 2 tips; none without a counted score", () => {
    assert.deepEqual(tipsFor(g, "respect", "low"), ["L1", "L2"]);
    assert.deepEqual(tipsFor(g, "respect", "neutral"), ["N1"]);
    assert.deepEqual(tipsFor(g, "respect", null), []);
  });
  test("no tips for a dimension with no counted scores", () => {
    const { store, dim, challenge } = setup();
    for (const m of ["match_01", "match_02", "match_03", "match_04"]) store.decide(challenge(m).id, { decision: "overturned" });
    const d = dim("p2", "respect");
    assert.equal(d.status, "insufficient_data");
    assert.equal(d.score, null);
    assert.deepEqual(d.tips, []);
    assert.equal(d.trend, "not_enough_data");
  });
  test("improving trend → acknowledgement; collapsed when neutral/good and not declining", () => {
    const { dim } = setup();
    const p7 = dim("p7", "respect"); // mock: 1, 2, 4, 5 → +3.0 improving, 3.5 good
    assert.equal(p7.trend, "improving");
    assert.equal(p7.improvingAck, true);
    assert.equal(p7.expanded, false);
    assert.equal(dim("p1", "respect").expanded, false);
  });
});
