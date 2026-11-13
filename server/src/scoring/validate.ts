// Validates one model response against the match data.
// Never throws on bad model output: always returns a structured result.
import { rosterOf, type MatchData } from "../data.js";
import {
  DIMENSIONS,
  type Dimension,
  type DimensionScore,
  type DimensionValidation,
  type MatchValidationResult,
} from "./types.js";

export const MIN_CONFIDENCE = 0.7;
export const MAX_EVIDENCE = 3;
export const MAX_RATIONALE_CHARS = 200;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Shape check for one dimension object; returns a problem or null. */
function dimensionShapeProblem(v: unknown): string | null {
  if (!isObject(v)) return "is not an object";
  for (const key of ["score", "confidence", "evidenceMessageIds", "rationale"]) {
    if (!(key in v)) return `is missing "${key}"`;
  }
  if (!Array.isArray(v.evidenceMessageIds) || !v.evidenceMessageIds.every((x) => typeof x === "string")) {
    return "evidenceMessageIds is not an array of strings";
  }
  if (typeof v.rationale !== "string") return "rationale is not a string";
  return null;
}

/** Whole-response rejection: every player in the match gets needs_review. */
export function rejectAll(match: MatchData, reason: string): MatchValidationResult {
  const dimensions: DimensionValidation[] = rosterOf(match).flatMap((playerId) =>
    DIMENSIONS.map((dimension) => ({
      matchId: match.id,
      playerId,
      dimension,
      status: "needs_review" as const,
      reasons: [reason],
      proposed: null,
    }))
  );
  return { matchId: match.id, responseRejected: true, responseReason: reason, dimensions };
}

function checkDimension(
  match: MatchData,
  playerId: string,
  dimension: Dimension,
  d: DimensionScore
): DimensionValidation {
  const reasons: string[] = [];
  const authorOf = new Map(match.messages.map((m) => [m.id, m.playerId]));

  const scoreOk = Number.isInteger(d.score) && d.score >= 1 && d.score <= 5;
  if (!scoreOk) reasons.push(`score ${JSON.stringify(d.score)} is not an integer from 1 to 5`);

  const confOk = typeof d.confidence === "number" && d.confidence >= 0 && d.confidence <= 1;
  if (!confOk) reasons.push(`confidence ${JSON.stringify(d.confidence)} is not a number from 0 to 1`);
  else if (d.confidence < MIN_CONFIDENCE) reasons.push(`confidence ${d.confidence} is below ${MIN_CONFIDENCE}`);

  const ids = d.evidenceMessageIds;
  if (ids.length > MAX_EVIDENCE) reasons.push(`${ids.length} evidence IDs (max ${MAX_EVIDENCE})`);
  if (scoreOk && d.score !== 3 && ids.length === 0) {
    reasons.push(`evidence is required for score ${d.score}`);
  }
  for (const id of ids) {
    const author = authorOf.get(id);
    if (author === undefined) reasons.push(`evidence ${id} is not a message in ${match.id}`);
    else if (author !== playerId) reasons.push(`evidence ${id} was written by ${author}, not ${playerId}`);
  }

  if (d.rationale.length > MAX_RATIONALE_CHARS) {
    reasons.push(`rationale is ${d.rationale.length} characters (max ${MAX_RATIONALE_CHARS})`);
  }

  return {
    matchId: match.id,
    playerId,
    dimension,
    status: reasons.length === 0 ? "accepted" : "needs_review",
    reasons,
    proposed: d,
  };
}

/** raw: the model's text output (or an already-parsed object). */
export function validateResponse(raw: unknown, match: MatchData): MatchValidationResult {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return rejectAll(match, "response is not valid JSON");
    }
  }

  if (!isObject(data)) return rejectAll(match, "wrong shape: response is not a JSON object");
  if (typeof data.matchId !== "string") return rejectAll(match, "wrong shape: matchId is not a string");
  if (!Array.isArray(data.players)) return rejectAll(match, "wrong shape: players is not an array");
  for (const [i, p] of data.players.entries()) {
    if (!isObject(p) || typeof p.playerId !== "string") {
      return rejectAll(match, `wrong shape: players[${i}] has no string playerId`);
    }
    for (const dim of DIMENSIONS) {
      const problem = dimensionShapeProblem(p[dim]);
      if (problem) return rejectAll(match, `wrong shape: ${p.playerId}.${dim} ${problem}`);
    }
  }

  if (data.matchId !== match.id) {
    return rejectAll(match, `matchId mismatch: got ${data.matchId}, expected ${match.id}`);
  }

  const roster = rosterOf(match);
  const seen = new Set<string>();
  for (const p of data.players as { playerId: string }[]) {
    if (!roster.includes(p.playerId)) return rejectAll(match, `unknown playerId ${p.playerId}`);
    if (seen.has(p.playerId)) return rejectAll(match, `duplicated playerId ${p.playerId}`);
    seen.add(p.playerId);
  }
  const missing = roster.filter((id) => !seen.has(id));
  if (missing.length > 0) return rejectAll(match, `missing players: ${missing.join(", ")}`);

  const byId = new Map((data.players as Record<string, unknown>[]).map((p) => [p.playerId as string, p]));
  const dimensions = roster.flatMap((playerId) =>
    DIMENSIONS.map((dim) => checkDimension(match, playerId, dim, byId.get(playerId)![dim] as DimensionScore))
  );
  return { matchId: match.id, responseRejected: false, responseReason: null, dimensions };
}
