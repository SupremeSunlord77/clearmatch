// Builds player profiles from ACCEPTED match scores (D6). Done in code, not by the model.
import type { PlayerInfo } from "../data.js";
import {
  DIMENSIONS,
  type Dimension,
  type DimensionProfile,
  type MatchContribution,
  type MatchValidationResult,
  type PlayerProfile,
  type TrendLabel,
} from "./types.js";

/** Weights by match position in date order: matches 1–4. */
export const MATCH_WEIGHTS = [1, 1, 2, 2];
export const TREND_THRESHOLD = 0.5;

export interface MatchRef {
  id: string;
  date: string;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function trendLabel(trend: number): TrendLabel {
  if (trend >= TREND_THRESHOLD) return "improving";
  if (trend <= -TREND_THRESHOLD) return "declining";
  return "stable";
}

function buildDimension(
  playerId: string,
  dim: Dimension,
  matches: MatchRef[],
  results: MatchValidationResult[]
): DimensionProfile {
  const contributions: MatchContribution[] = [];
  const early: number[] = []; // matches 1–2
  const late: number[] = []; // matches 3–4
  let needsReviewCount = 0;

  matches.forEach((m, i) => {
    const v = results
      .find((r) => r.matchId === m.id)
      ?.dimensions.find((d) => d.playerId === playerId && d.dimension === dim);
    if (!v) return; // player not in this match
    if (v.status !== "accepted" || !v.proposed) {
      needsReviewCount++;
      return;
    }
    const weight = MATCH_WEIGHTS[i];
    contributions.push({ matchId: m.id, date: m.date, weight, score: v.proposed.score, evidenceMessageIds: v.proposed.evidenceMessageIds });
    (i < 2 ? early : late).push(v.proposed.score);
  });

  if (contributions.length === 0) {
    return { status: "insufficient_data", score: null, trend: null, trendLabel: null, contributions, needsReviewCount };
  }

  const totalWeight = contributions.reduce((a, c) => a + c.weight, 0);
  const score = round1(contributions.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight);
  // Trend needs at least one accepted score in each half.
  const trend = early.length > 0 && late.length > 0 ? round1(mean(late) - mean(early)) : null;
  return { status: "ok", score, trend, trendLabel: trend === null ? null : trendLabel(trend), contributions, needsReviewCount };
}

export function buildProfiles(
  players: PlayerInfo[],
  matches: MatchRef[],
  results: MatchValidationResult[]
): PlayerProfile[] {
  if (matches.length > MATCH_WEIGHTS.length) {
    throw new Error(`aggregation expects at most ${MATCH_WEIGHTS.length} matches, got ${matches.length}`);
  }
  const ordered = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  return players.map((p) => {
    const dims = Object.fromEntries(DIMENSIONS.map((d) => [d, buildDimension(p.id, d, ordered, results)]));
    return { playerId: p.id, displayName: p.displayName, ...dims } as PlayerProfile;
  });
}
