import assert from "node:assert/strict";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { after, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { loadMatches, loadPlayers, type MatchData, type PlayerInfo } from "../src/data.js";
import { applyOverrides, OverrideStore, SIMULATED_AI_ERROR } from "../src/demo/overrides.js";
import { computeLobby, enumerateSplits, reasonsFor, teamworkGap, type LobbyPlayer, type Separation } from "../src/matchmaking/lobby.js";
import { buildLobbyView, lobbyPlayers, recentSeparations } from "../src/matchmaking/inputs.js";
import { buildPlayerProfile } from "../src/profile/build.js";
import { ChallengeStore } from "../src/profile/challenges.js";
import { EvidenceIndex } from "../src/profile/evidence.js";
import { loadGuidance } from "../src/profile/guidance.js";
import { DEMO_SNAPSHOT_PATH, loadMatchResults, MATCH_RESULTS_PATH, scoreWithMock, type MatchResultsFile } from "../src/scoring/results.js";

// Real data with the mock results (always available, no key).
const mockResults = await scoreWithMock();
const realPlayers = loadPlayers();
const realMatches = loadMatches();

const IDS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

/** In-memory fixture player. Defaults: no party, Neutral Respect, Teamwork 3. */
const lp = (id: string, o: Partial<LobbyPlayer> = {}): LobbyPlayer => ({
  id,
  displayName: id.toUpperCase(),
  partyGroup: null,
  respectBand: "neutral",
  teamwork: 3,
  ...o,
});
const roster = (o: Record<string, Partial<LobbyPlayer>> = {}) => IDS.map((id) => lp(id, o[id]));
const together = (r: { teams: { A: string[]; B: string[] } }, a: string, b: string) => r.teams.A.includes(a) === r.teams.A.includes(b);

describe("M3a: split enumeration", () => {
  test("all 35 distinct splits of 8 players into two teams of 4, each exactly once", () => {
    const splits = enumerateSplits(IDS);
    assert.equal(splits.length, 35);
    const keys = new Set(
      splits.map((s) => {
        assert.equal(s.A.length, 4);
        assert.equal(s.B.length, 4);
        assert.deepEqual([...s.A, ...s.B].sort(), IDS);
        return [s.A.join(","), s.B.join(",")].sort().join(" | "); // same split regardless of A/B labels
      })
    );
    assert.equal(keys.size, 35);
  });
});

describe("M3b: hard constraints", () => {
  test("(1) party members are always on the same team", () => {
    const r = computeLobby(roster({ p1: { partyGroup: "x" }, p8: { partyGroup: "x" } }), []);
    assert.ok(together(r, "p1", "p8"));
  });

  test("(2) a player is never on a team with someone they muted or reported", () => {
    const seps: Separation[] = [
      { by: "p1", target: "p2" },
      { by: "p3", target: "p4" },
      { by: "p5", target: "p1" },
    ];
    const r = computeLobby(roster(), seps);
    for (const s of seps) assert.ok(!together(r, s.by, s.target), `${s.by} with ${s.target}`);
    assert.deepEqual(r.relaxed, []);
  });

  test("(3) at most one Low-Respect player per team", () => {
    const r = computeLobby(roster({ p1: { respectBand: "low" }, p2: { respectBand: "low" } }), []);
    assert.ok(!together(r, "p1", "p2"));
    assert.deepEqual(r.relaxed, []);
  });

  test("M3e: a player with no counted Respect score is treated as Neutral", () => {
    const results: MatchResultsFile = structuredClone(mockResults);
    for (const m of results.matches) m.players.p1.respect.status = "needs_review"; // nothing counted for p1 Respect
    const p1 = lobbyPlayers({ players: realPlayers, matches: realMatches, results, challenges: [] }).find((p) => p.id === "p1")!;
    assert.equal(p1.respectBand, "neutral");
  });
});

describe("M3d: relaxation", () => {
  test("three Low-Respect players: (3) is relaxed first, (2) still holds", () => {
    const players = roster({ p1: { respectBand: "low" }, p2: { respectBand: "low" }, p3: { respectBand: "low" } });
    const seps = [{ by: "p4", target: "p5" }];
    const r = computeLobby(players, seps);
    assert.deepEqual(r.relaxed, ["low_respect_per_team"]);
    assert.ok(!together(r, "p4", "p5"));
  });

  test("when (2) also cannot be met, both are relaxed and reported; the party (1) still holds", () => {
    // p1 reported everyone outside the party, so p1's team cannot be filled without breaking (2).
    const players = roster({ p7: { partyGroup: "x" }, p8: { partyGroup: "x" } });
    const seps = ["p2", "p3", "p4", "p5", "p6", "p7"].map((t) => ({ by: "p1", target: t }));
    const players3 = players.map((p) => (["p2", "p3", "p4"].includes(p.id) ? { ...p, respectBand: "low" as const } : p));
    const r = computeLobby(players3, seps);
    assert.deepEqual(r.relaxed, ["low_respect_per_team", "reported_apart"]);
    assert.ok(together(r, "p7", "p8"), "party is never split");
  });

  test("(1) is never relaxed: a party larger than a team is an error, not a split party", () => {
    const players = roster(Object.fromEntries(["p1", "p2", "p3", "p4", "p5"].map((id) => [id, { partyGroup: "big" }])));
    assert.throws(() => computeLobby(players, []), /party/);
  });

  test("constraint_relaxed is shown to every player when a rule was relaxed, and only then", () => {
    const players = roster({ p1: { respectBand: "low" }, p2: { respectBand: "low" }, p3: { respectBand: "low" } });
    const r = computeLobby(players, []);
    for (const id of IDS) assert.ok(reasonsFor(id, r, players, []).includes("constraint_relaxed"));
    const ok = computeLobby(roster(), []);
    for (const id of IDS) assert.ok(!reasonsFor(id, ok, roster(), []).includes("constraint_relaxed"));
  });
});

describe("M3b(2) party exception", () => {
  // In-memory fixture: p3 and p4 are a party now; p3 reported p4 in an earlier match.
  const players = roster({ p3: { partyGroup: "party1" }, p4: { partyGroup: "party1" } });
  const seps: Separation[] = [{ by: "p3", target: "p4" }];

  test("the party stays together, (2) is not relaxed, no constraint_relaxed reason", () => {
    const r = computeLobby(players, seps);
    assert.ok(together(r, "p3", "p4"));
    assert.deepEqual(r.relaxed, []);
    for (const id of IDS) assert.ok(!reasonsFor(id, r, players, seps).includes("constraint_relaxed"));
  });

  test("the past report between party members gives neither of them a protection reason", () => {
    const r = computeLobby(players, seps);
    assert.ok(!reasonsFor("p3", r, players, seps).includes("protected_from_reports"));
    assert.ok(!reasonsFor("p4", r, players, seps).includes("kept_apart_from_targets"));
    assert.ok(reasonsFor("p3", r, players, seps).includes("party_together"));
  });
});

describe("M3c: Teamwork balance and tie-break", () => {
  test("chooses the split with the smallest Teamwork gap", () => {
    // Only splits that separate p1 and p2 reach a gap of 0.
    const tw = { p1: 5, p2: 5, p3: 2, p4: 2, p5: 2, p6: 2, p7: 2, p8: 2 } as Record<string, number>;
    const players = IDS.map((id) => lp(id, { teamwork: tw[id] }));
    const r = computeLobby(players, []);
    const min = Math.min(...enumerateSplits(IDS).map((s) => teamworkGap(s, players)));
    assert.ok(Math.abs(teamworkGap(r.teams, players) - min) < 1e-9);
    assert.ok(!together(r, "p1", "p2"), "the two strongest are split");
  });

  test("ties go to the lowest lexicographic split, so results repeat", () => {
    const r1 = computeLobby(roster(), []); // all Teamwork equal: every split ties
    const r2 = computeLobby([...roster()].reverse(), []);
    assert.deepEqual(r1.teams.A, ["p1", "p2", "p3", "p4"]);
    assert.deepEqual(r1, r2);
  });
});

describe("M9: Communication has no effect on the split", () => {
  test("changing only Communication scores never changes the lobby or reasons", () => {
    const base = { players: realPlayers, matches: realMatches, results: mockResults, challenges: [] };
    for (const score of [1, 5]) {
      const changed: MatchResultsFile = structuredClone(mockResults);
      for (const m of changed.matches) for (const dims of Object.values(m.players)) dims.communication.score = score;
      for (const id of IDS) {
        assert.deepEqual(buildLobbyView(id, { ...base, results: changed }), buildLobbyView(id, base));
      }
    }
  });
});

describe("M2: inputs from the data", () => {
  test("mutes and reports come from the last 4 matches", () => {
    const seps = recentSeparations(realMatches);
    assert.ok(seps.some((s) => s.by === "p1" && s.target === "p2"));
    assert.ok(seps.some((s) => s.by === "p5" && s.target === "p6"));
    assert.ok(seps.some((s) => s.by === "p8" && s.target === "p6"));
  });
});

// ---------- API: privacy (M4, M5), simulated error (M7), reset ----------

function makeServer(results: MatchResultsFile) {
  const state = {
    players: realPlayers,
    matches: realMatches,
    results,
    guidance: loadGuidance(),
    evidence: new EvidenceIndex(realMatches, realPlayers),
    challenges: new ChallengeStore(null),
    overrides: new OverrideStore(null),
  };
  const server = createApp(state).listen(0);
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (p: string) => (await fetch(base() + p)).json();
  const post = async (p: string, body: object = {}) =>
    (await fetch(base() + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  return { server, state, get, post };
}

describe("lobby API privacy (M4, M5)", () => {
  const api = makeServer(mockResults);
  after(() => api.server.close());

  test("no lobby response contains scores, bands or who reported whom", async () => {
    await api.post("/api/demo/simulate-ai-error"); // include the demo state too
    for (const id of IDS) {
      const v = await api.get(`/api/lobby/${id}`);
      assert.deepEqual(Object.keys(v).sort(), ["partyMemberNames", "playerId", "reasons", "teams", "yourTeam"]);
      for (const m of [...v.teams.A, ...v.teams.B]) assert.deepEqual(Object.keys(m).sort(), ["displayName", "you", "yourParty"]);
      const text = JSON.stringify(v);
      // No score or band fields or values, no decimals, no player ids other than the viewer's own.
      assert.doesNotMatch(text, /\d\.\d|"(score|band|respect|teamwork|communication|confidence|reportedBy|mutedBy)":|"(low|neutral|good)"/i);
      for (const other of IDS.filter((x) => x !== id)) assert.ok(!text.includes(`"${other}"`), `${id}'s lobby mentions ${other}`);
      // Party names only for the viewer's own party.
      const me = realPlayers.find((p) => p.id === id)!;
      const ownParty = realPlayers.filter((p) => p.id !== id && p.partyGroup && p.partyGroup === me.partyGroup).map((p) => p.displayName);
      assert.deepEqual(v.partyMemberNames, ownParty);
      assert.deepEqual([...v.teams.A, ...v.teams.B].filter((m: { yourParty: boolean }) => m.yourParty).map((m: { displayName: string }) => m.displayName), ownParty);
    }
    await api.post("/api/demo/reset");
  });

  test("unknown player → 404", async () => {
    const res = await fetch(`http://127.0.0.1:${(api.server.address() as AddressInfo).port}/api/lobby/p99`);
    assert.equal(res.status, 404);
  });
});

describe("M7: simulated AI error", () => {
  const dataText = new Map(realMatches.flatMap((m: MatchData) => m.messages).map((x) => [x.id, x]));

  test("override cites real p5 game-language lines from that same match, and is marked simulated", () => {
    for (const o of SIMULATED_AI_ERROR) {
      assert.equal(o.simulated, true);
      assert.equal(o.playerId, "p5");
      assert.equal(o.dimension, "respect");
      assert.equal(o.confidence, 0.8);
      assert.equal(o.rationale, "Threatening language towards opponents.");
      assert.ok(o.evidenceMessageIds.length >= 1 && o.evidenceMessageIds.length <= 3);
      for (const id of o.evidenceMessageIds) {
        const m = dataText.get(id);
        assert.ok(m, `${id} exists`);
        assert.equal(m.playerId, "p5");
        assert.ok(id.startsWith(o.matchId.replace("match_", "m")), `${id} is from ${o.matchId}`);
        assert.match(m.text, /kill|destroy/i);
      }
    }
  });

  test("simulate is idempotent; reset clears overrides (and challenges)", async () => {
    const api = makeServer(mockResults);
    try {
      assert.deepEqual(await api.get("/api/demo/status"), { simulatedAiErrorActive: false });
      assert.equal((await api.post("/api/demo/simulate-ai-error")).added, SIMULATED_AI_ERROR.length);
      assert.equal((await api.post("/api/demo/simulate-ai-error")).added, 0);
      assert.equal(api.state.overrides.list().length, SIMULATED_AI_ERROR.length);
      assert.deepEqual(await api.get("/api/demo/status"), { simulatedAiErrorActive: true });
      const reset = await api.post("/api/demo/reset");
      assert.equal(reset.overridesCleared, SIMULATED_AI_ERROR.length);
      assert.equal(api.state.overrides.list().length, 0);
      assert.deepEqual(await api.get("/api/demo/status"), { simulatedAiErrorActive: false });
    } finally {
      api.server.close();
    }
  });

  test("overrides persist to file and survive a restart", () => {
    const file = `${process.env.TEMP ?? "/tmp"}/clearmatch-overrides-${process.pid}.json`;
    try {
      new OverrideStore(file).simulateAiError();
      assert.equal(new OverrideStore(file).list().length, SIMULATED_AI_ERROR.length);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  // Conditions (a) and (b) on the committed run 4 snapshot (always), and on output/ when present.
  const sources: [string, string][] = [["run 4 snapshot", DEMO_SNAPSHOT_PATH]];
  if (fs.existsSync(MATCH_RESULTS_PATH)) sources.push(["output/match-results.json", MATCH_RESULTS_PATH]);
  for (const [label, file] of sources) {
    test(`${label}: (a) while active p5 Respect is Low and p5 sees own_respect_low; (b) one overturn returns p5 to Neutral or above and removes it`, async () => {
      const api = makeServer(JSON.parse(fs.readFileSync(file, "utf8")) as MatchResultsFile);
      try {
        const respect = async () => (await api.get("/api/profile/p5")).dimensions.find((d: { dimension: string }) => d.dimension === "respect");
        const reasons = async () => (await api.get("/api/lobby/p5")).reasons as string[];

        const before = await respect();
        assert.notEqual(before.band, "low", `before: ${before.score}`);
        assert.ok(!(await reasons()).includes("own_respect_low"));

        await api.post("/api/demo/simulate-ai-error");
        const active = await respect();
        assert.equal(active.band, "low", `while active: ${active.score}`);
        assert.ok((await reasons()).includes("own_respect_low"), "p5 is told their own Respect is Low");
        const lm = active.loweringMatches.find((m: { simulated: boolean }) => m.simulated);
        assert.ok(lm && lm.canChallenge, "the simulated score can be challenged");

        const ch = await api.post("/api/challenges", { playerId: "p5", dimension: "respect", matchId: lm.matchId, reason: "game_language" });
        await api.post(`/api/challenges/${ch.id}/decision`, { decision: "overturned" });
        const afterOverturn = await respect();
        assert.notEqual(afterOverturn.band, "low", `after one overturn: ${afterOverturn.score}`);
        assert.ok(!(await reasons()).includes("own_respect_low"));
      } finally {
        api.server.close();
      }
    });
  }

  test("applyOverrides never changes the loaded results", () => {
    const copy = structuredClone(mockResults);
    applyOverrides(mockResults, SIMULATED_AI_ERROR);
    assert.deepEqual(mockResults, copy);
  });

  test("the profile treats the override like any other score (shown, counted, marked simulated)", () => {
    const results = applyOverrides(mockResults, SIMULATED_AI_ERROR);
    const prof = buildPlayerProfile("p5", {
      players: realPlayers as PlayerInfo[],
      matches: realMatches,
      results,
      challenges: [],
      guidance: loadGuidance(),
      evidence: new EvidenceIndex(realMatches, realPlayers),
    })!;
    const lm = prof.dimensions.find((d) => d.dimension === "respect")!.loweringMatches.find((m) => m.matchId === "match_03")!;
    assert.equal(lm.simulated, true);
    assert.equal(lm.counted, true);
    assert.deepEqual(lm.evidence.map((e) => e.messageId), SIMULATED_AI_ERROR[0].evidenceMessageIds);
  });
});

describe("Respect reasons are only ever about the viewer's own Respect", () => {
  const own = ["low_respect_spread", "own_respect_low"];
  const cases: [string, Partial<Record<string, Partial<LobbyPlayer>>>][] = [
    ["two Low players, (3) met", { p2: { respectBand: "low" }, p6: { respectBand: "low" } }],
    ["three Low players, (3) relaxed", { p2: { respectBand: "low" }, p5: { respectBand: "low" }, p6: { respectBand: "low" } }],
  ];
  for (const [name, o] of cases) {
    test(name, () => {
      const players = roster(o as Record<string, Partial<LobbyPlayer>>);
      const r = computeLobby(players, []);
      for (const p of players) {
        const got = reasonsFor(p.id, r, players, []).filter((x) => own.includes(x));
        if (p.respectBand === "low") {
          assert.equal(got.length, 1, `${p.id} gets exactly one reason about their own Respect`);
          assert.equal(got[0], r.relaxed.includes("low_respect_per_team") ? "own_respect_low" : "low_respect_spread");
        } else {
          assert.deepEqual(got, [], `${p.id} (not Low) must not get a Respect reason`);
        }
      }
    });
  }

  test("on the snapshot with the error active: only p2, p5 and p6 (the Low players) get own_respect_low", async () => {
    const api = makeServer(JSON.parse(fs.readFileSync(DEMO_SNAPSHOT_PATH, "utf8")) as MatchResultsFile);
    try {
      await api.post("/api/demo/simulate-ai-error");
      const got: string[] = [];
      for (const id of IDS) if ((await api.get(`/api/lobby/${id}`)).reasons.includes("own_respect_low")) got.push(id);
      assert.deepEqual(got, ["p2", "p5", "p6"]);
    } finally {
      api.server.close();
    }
  });
});

describe("2A: results load order", () => {
  const missing = `${process.env.TEMP ?? "/tmp"}/clearmatch-missing-${process.pid}.json`;
  test("output first, then the committed run 4 snapshot, then mock; the source is logged", async () => {
    const lines: string[] = [];
    const fromSnapshot = await loadMatchResults((l) => lines.push(l), { output: missing, snapshot: DEMO_SNAPSHOT_PATH });
    assert.equal(fromSnapshot.model, "gemini-3.5-flash-lite");
    assert.match(lines.at(-1)!, /committed demo snapshot: data[\\/]demo[\\/]run4-match-results\.json/);

    const fromMock = await loadMatchResults((l) => lines.push(l), { output: missing, snapshot: missing });
    assert.equal(fromMock.provider, "mock");
    assert.equal(lines.at(-1), "No scoring output found; using mock results");

    if (fs.existsSync(MATCH_RESULTS_PATH)) {
      await loadMatchResults((l) => lines.push(l), { output: MATCH_RESULTS_PATH, snapshot: DEMO_SNAPSHOT_PATH });
      assert.match(lines.at(-1)!, /^Loaded scoring output: output/);
    }
  });

  test("the snapshot holds scores, confidence, evidence IDs, rationale and reasons only (no raw responses, no keys)", () => {
    const text = fs.readFileSync(DEMO_SNAPSHOT_PATH, "utf8");
    assert.doesNotMatch(text, /AIza|api[_-]?key|GEMINI_API_KEY|rawResponse|Bearer/i);
    const f = JSON.parse(text) as MatchResultsFile;
    assert.deepEqual(Object.keys(f).sort(), ["generatedAt", "matches", "model", "provider"]);
    for (const m of f.matches) {
      assert.deepEqual(Object.keys(m).sort(), ["date", "matchId", "players", "responseReason", "responseRejected"]);
      assert.equal(m.responseReason, null);
      for (const dims of Object.values(m.players))
        for (const r of Object.values(dims))
          assert.deepEqual(Object.keys(r).sort(), ["confidence", "evidenceMessageIds", "rationale", "reasons", "score", "status"]);
    }
  });
});
