// HTTP API. Never calls the LLM: it only reads loaded results and challenges.
import express, { type Response } from "express";
import type { MatchData, PlayerInfo } from "./data.js";
import { applyOverrides, isSimulated, type OverrideStore } from "./demo/overrides.js";
import { buildLobbyView } from "./matchmaking/inputs.js";
import { buildPlayerProfile } from "./profile/build.js";
import type { Challenge, ChallengeStatus, ChallengeStore, Result } from "./profile/challenges.js";
import type { EvidenceIndex } from "./profile/evidence.js";
import type { Guidance } from "./profile/guidance.js";
import type { MatchResultsFile } from "./scoring/results.js";

export interface AppState {
  players: PlayerInfo[];
  matches: MatchData[];
  results: MatchResultsFile; // as loaded from scoring output (or mock); never modified
  guidance: Guidance;
  evidence: EvidenceIndex;
  challenges: ChallengeStore;
  overrides: OverrideStore; // M7 demo-only simulated AI error
}

/** Loaded results with any demo overrides applied. Profiles, challenges, review and lobby all use this. */
const effectiveResults = (s: AppState) => applyOverrides(s.results, s.overrides.list());

const STATUSES: ChallengeStatus[] = ["pending", "upheld", "overturned"];

function send<T>(res: Response, r: Result<T>, okStatus = 200) {
  if (r.ok) res.status(okStatus).json(r.value);
  else res.status(r.status).json({ error: r.error });
}

/** Reviewer view of one challenge: AI proposal, evidence lines and 2 messages of context each side. */
function reviewItem(c: Challenge, s: AppState, results: MatchResultsFile) {
  const r = results.matches.find((m) => m.matchId === c.matchId)?.players[c.playerId]?.[c.dimension];
  return {
    ...c,
    playerName: s.players.find((p) => p.id === c.playerId)?.displayName ?? c.playerId,
    matchDate: s.matches.find((m) => m.id === c.matchId)?.date ?? null,
    proposal: r ? { score: r.score, confidence: r.confidence, aiSummary: r.rationale, simulated: isSimulated(r) } : null,
    evidence: (r?.evidenceMessageIds ?? []).map((id) => s.evidence.withContext(id)).filter((e) => e !== null),
  };
}

export function createApp(s: AppState) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/players", (_req, res) => {
    res.json(s.players.map((p) => ({ id: p.id, displayName: p.displayName })));
  });

  app.get("/api/profile/:playerId", (req, res) => {
    const profile = buildPlayerProfile(req.params.playerId, { ...s, results: effectiveResults(s), challenges: s.challenges.list() });
    if (!profile) res.status(404).json({ error: `Unknown player: ${req.params.playerId}` });
    else res.json(profile);
  });

  app.post("/api/challenges", (req, res) => {
    send(res, s.challenges.create(req.body, { players: s.players, results: effectiveResults(s) }), 201);
  });

  app.get("/api/challenges", (req, res) => {
    const status = req.query.status;
    if (status !== undefined && !STATUSES.includes(status as ChallengeStatus)) {
      res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
      return;
    }
    const results = effectiveResults(s);
    res.json(s.challenges.list(status as ChallengeStatus | undefined).map((c) => reviewItem(c, s, results)));
  });

  app.post("/api/challenges/:id/decision", (req, res) => {
    send(res, s.challenges.decide(req.params.id, req.body));
  });

  // M6: recomputed from current counted profiles on every request, so challenge outcomes change the next lobby.
  app.get("/api/lobby/:playerId", (req, res) => {
    const view = buildLobbyView(req.params.playerId, {
      players: s.players,
      matches: s.matches,
      results: effectiveResults(s),
      challenges: s.challenges.list(),
    });
    if (!view) res.status(404).json({ error: `Unknown player: ${req.params.playerId}` });
    else res.json(view);
  });

  app.get("/api/demo/status", (_req, res) => {
    res.json({ simulatedAiErrorActive: s.overrides.active() });
  });

  // M7: idempotent; applying twice changes nothing.
  app.post("/api/demo/simulate-ai-error", (_req, res) => {
    const added = s.overrides.simulateAiError();
    res.json({ added, simulatedAiErrorActive: s.overrides.active() });
  });

  app.post("/api/demo/reset", (_req, res) => {
    res.json({ cleared: s.challenges.reset(), overridesCleared: s.overrides.reset() });
  });

  return app;
}
