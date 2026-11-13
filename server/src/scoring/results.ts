// Per-match validated results (D1): written by `npm run score`, loaded by the server.
import fs from "node:fs";
import path from "node:path";
import { loadMatches, loadPlayers, REPO_ROOT, type MatchData } from "../data.js";
import { createMockProvider } from "../llm/mock.js";
import { scoreOneMatch } from "./pipeline.js";
import { DIMENSIONS, type Dimension, type MatchValidationResult, type ValidationStatus } from "./types.js";

export const OUTPUT_DIR = path.join(REPO_ROOT, "output");
export const MATCH_RESULTS_PATH = path.join(OUTPUT_DIR, "match-results.json");

export interface DimensionResult {
  status: ValidationStatus;
  score: number | null;
  confidence: number | null;
  evidenceMessageIds: string[];
  rationale: string | null;
  reasons: string[];
}

export interface MatchResult {
  matchId: string;
  date: string;
  responseRejected: boolean;
  responseReason: string | null;
  players: Record<string, Record<Dimension, DimensionResult>>;
}

export interface MatchResultsFile {
  generatedAt: string;
  provider: string;
  model: string | null;
  matches: MatchResult[];
}

const num = (v: unknown) => (typeof v === "number" ? v : null);

export function toMatchResults(
  log: MatchValidationResult[],
  matches: MatchData[],
  meta: { generatedAt: string; provider: string; model: string | null }
): MatchResultsFile {
  const out: MatchResult[] = [];
  for (const m of matches) {
    const v = log.find((r) => r.matchId === m.id);
    if (!v) continue;
    const players: MatchResult["players"] = {};
    for (const d of v.dimensions) {
      (players[d.playerId] ??= {} as Record<Dimension, DimensionResult>)[d.dimension] = {
        status: d.status,
        score: num(d.proposed?.score),
        confidence: num(d.proposed?.confidence),
        evidenceMessageIds: d.proposed?.evidenceMessageIds ?? [],
        rationale: d.proposed?.rationale ?? null,
        reasons: d.reasons,
      };
    }
    out.push({ matchId: m.id, date: m.date, responseRejected: v.responseRejected, responseReason: v.responseReason, players });
  }
  return { ...meta, matches: out };
}

/** Back to the validator's shape, so the Day 3 aggregation can be reused unchanged. */
export function toValidationResults(file: MatchResultsFile): MatchValidationResult[] {
  return file.matches.map((m) => ({
    matchId: m.matchId,
    responseRejected: m.responseRejected,
    responseReason: m.responseReason,
    dimensions: Object.entries(m.players).flatMap(([playerId, dims]) =>
      DIMENSIONS.map((dimension) => {
        const r = dims[dimension];
        return {
          matchId: m.matchId,
          playerId,
          dimension,
          status: r.status,
          reasons: r.reasons,
          proposed:
            r.score === null
              ? null
              : { score: r.score, confidence: r.confidence ?? 0, evidenceMessageIds: r.evidenceMessageIds, rationale: r.rationale ?? "" },
        };
      })
    ),
  }));
}

/** Scores every match with the mock provider (no API key, no network). */
export async function scoreWithMock(): Promise<MatchResultsFile> {
  const provider = createMockProvider();
  const players = loadPlayers();
  const matches = loadMatches();
  const log: MatchValidationResult[] = [];
  for (const match of matches) log.push(await scoreOneMatch(provider, match, players));
  return toMatchResults(log, matches, { generatedAt: new Date().toISOString(), provider: "mock", model: null });
}

/** D1: load output/match-results.json; if missing, score with the mock provider in memory. */
export async function loadMatchResults(log: (line: string) => void = console.log): Promise<MatchResultsFile> {
  if (fs.existsSync(MATCH_RESULTS_PATH)) {
    const file = JSON.parse(fs.readFileSync(MATCH_RESULTS_PATH, "utf8")) as MatchResultsFile;
    log(`Loaded scoring output: ${path.relative(REPO_ROOT, MATCH_RESULTS_PATH)} (provider ${file.provider}${file.model ? `, model ${file.model}` : ""})`);
    return file;
  }
  log("No scoring output found; using mock results");
  return scoreWithMock();
}
