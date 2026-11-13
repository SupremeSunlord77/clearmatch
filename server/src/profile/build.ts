// Builds the player-facing profile (D2–D7) from per-match results, challenges and guidance.
// Returns codes and data only; all wording lives in client/src/copy.ts.
import type { MatchData, PlayerInfo } from "../data.js";
import { buildProfiles, exclusionKey } from "../scoring/aggregate.js";
import { toValidationResults, type MatchResultsFile } from "../scoring/results.js";
import { DIMENSIONS, type Dimension } from "../scoring/types.js";
import type { Challenge, ChallengeStatus } from "./challenges.js";
import type { EvidenceIndex, EvidenceLine } from "./evidence.js";
import { bandFor, tipsFor, type Band, type Guidance } from "./guidance.js";

export type TrendWord = "improving" | "stable" | "declining" | "not_enough_data";

export interface LoweringMatch {
  matchId: string;
  matchNumber: number; // 1–4 in date order
  date: string;
  score: number; // 1 or 2
  counted: boolean; // false once overturned on review
  review: { challengeId: string; status: ChallengeStatus; reviewerComment: string | null } | null;
  canChallenge: boolean;
  evidence: EvidenceLine[]; // up to 3, real chat lines from the data files
  aiSummary: string | null; // the model's rationale, shown only labelled "AI summary"
}

export interface DimensionView {
  dimension: Dimension;
  status: "ok" | "insufficient_data";
  score: number | null; // 1 decimal
  band: Band | null;
  trend: TrendWord;
  expanded: boolean; // D7: low or declining
  loweringMatches: LoweringMatch[];
  underReviewCount: number; // validator sent to a person: "not counted yet"
  tips: string[]; // up to 2
  improvingAck: boolean;
}

export interface PlayerProfileView {
  playerId: string;
  displayName: string;
  dimensions: DimensionView[];
  howItWorks: string;
}

export interface ProfileDeps {
  players: PlayerInfo[];
  matches: MatchData[];
  results: MatchResultsFile;
  challenges: Challenge[];
  guidance: Guidance;
  evidence: EvidenceIndex;
}

const MAX_EVIDENCE_LINES = 3;

/** Latest challenge for one player + dimension + match. */
function latestChallenge(challenges: Challenge[], playerId: string, dim: Dimension, matchId: string) {
  return challenges
    .filter((c) => c.playerId === playerId && c.dimension === dim && c.matchId === matchId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
}

export function buildPlayerProfile(playerId: string, deps: ProfileDeps): PlayerProfileView | null {
  const player = deps.players.find((p) => p.id === playerId);
  if (!player) return null;

  const ordered = [...deps.matches].sort((a, b) => a.date.localeCompare(b.date));
  const mine = deps.challenges.filter((c) => c.playerId === playerId);

  // D5: overturned → excluded from aggregation. Upheld and pending still count.
  const excluded = new Set(
    mine
      .filter((c) => latestChallenge(mine, playerId, c.dimension, c.matchId)?.status === "overturned")
      .map((c) => exclusionKey(c.matchId, playerId, c.dimension))
  );
  const agg = buildProfiles([player], ordered, toValidationResults(deps.results), excluded)[0];

  const dimensions = DIMENSIONS.map((dim): DimensionView => {
    const a = agg[dim];
    const band = a.score === null ? null : bandFor(a.score);
    const trend: TrendWord = a.status !== "ok" || a.trendLabel === null ? "not_enough_data" : a.trendLabel;

    const loweringMatches: LoweringMatch[] = [];
    ordered.forEach((m, i) => {
      const r = deps.results.matches.find((x) => x.matchId === m.id)?.players[playerId]?.[dim];
      if (!r || r.status !== "accepted" || (r.score !== 1 && r.score !== 2)) return;
      const c = latestChallenge(mine, playerId, dim, m.id);
      loweringMatches.push({
        matchId: m.id,
        matchNumber: i + 1,
        date: m.date,
        score: r.score,
        counted: c?.status !== "overturned",
        review: c ? { challengeId: c.id, status: c.status, reviewerComment: c.reviewerComment } : null,
        canChallenge: !c || c.status === "upheld",
        evidence: deps.evidence.lines(r.evidenceMessageIds).slice(0, MAX_EVIDENCE_LINES),
        aiSummary: r.rationale,
      });
    });

    return {
      dimension: dim,
      status: a.status,
      score: a.score,
      band,
      trend,
      expanded: band === "low" || trend === "declining",
      loweringMatches,
      underReviewCount: a.needsReviewCount,
      tips: tipsFor(deps.guidance, dim, band),
      improvingAck: trend === "improving",
    };
  });

  return { playerId, displayName: player.displayName, dimensions, howItWorks: deps.guidance.howItWorks };
}
