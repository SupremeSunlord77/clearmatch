// Types for the scoring pipeline: model response → validation → profile.

export const DIMENSIONS = ["respect", "teamwork", "communication"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

// ---- Model response (what the LLM proposes for one match) ----

export interface DimensionScore {
  score: number; // integer 1–5
  confidence: number; // 0–1
  evidenceMessageIds: string[]; // max 3, from this match and this player
  rationale: string; // max 2 sentences, max 200 characters, no chat quotes
}

export interface PlayerMatchScore {
  playerId: string;
  respect: DimensionScore;
  teamwork: DimensionScore;
  communication: DimensionScore;
}

export interface ModelMatchResponse {
  matchId: string;
  players: PlayerMatchScore[];
}

// ---- Validation result (decided by the application) ----

export type ValidationStatus = "accepted" | "needs_review";

export interface DimensionValidation {
  matchId: string;
  playerId: string;
  dimension: Dimension;
  status: ValidationStatus;
  reasons: string[]; // empty when accepted
  proposed: DimensionScore | null; // null when the whole response was rejected
}

export interface MatchValidationResult {
  matchId: string;
  responseRejected: boolean; // true = whole response unusable, all players needs_review
  responseReason: string | null;
  dimensions: DimensionValidation[]; // one per player per dimension
}

// ---- Aggregated profile (computed in code, never by the model) ----

export type TrendLabel = "improving" | "declining" | "stable";

export interface MatchContribution {
  matchId: string;
  date: string;
  weight: number;
  score: number;
  evidenceMessageIds: string[];
}

export interface DimensionProfile {
  status: "ok" | "insufficient_data";
  score: number | null; // weighted average, 1 decimal
  trend: number | null; // mean(matches 3–4) − mean(matches 1–2), 1 decimal
  trendLabel: TrendLabel | null;
  contributions: MatchContribution[]; // accepted scores only
  needsReviewCount: number; // match scores sent to human review by the validator
  excludedCount: number; // match scores removed from aggregation (e.g. overturned on review)
}

export interface PlayerProfile {
  playerId: string;
  displayName: string;
  respect: DimensionProfile;
  teamwork: DimensionProfile;
  communication: DimensionProfile;
}
