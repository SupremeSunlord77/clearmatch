// Thin client for the server API (proxied by Vite to :3001). No LLM calls happen here.

export interface Player {
  id: string;
  displayName: string;
}

export interface EvidenceLine {
  messageId: string;
  matchId: string;
  speakerId: string;
  speakerName: string;
  timestamp: string;
  text: string;
}

export type ReviewStatus = "pending" | "upheld" | "overturned";

export interface LoweringMatch {
  matchId: string;
  matchNumber: number;
  date: string;
  score: number;
  counted: boolean;
  simulated: boolean; // demo-only simulated AI error
  review: { challengeId: string; status: ReviewStatus; reviewerComment: string | null } | null;
  canChallenge: boolean;
  evidence: EvidenceLine[];
  aiSummary: string | null;
}

export interface DimensionView {
  dimension: string;
  status: "ok" | "insufficient_data";
  score: number | null;
  band: "low" | "neutral" | "good" | null;
  trend: "improving" | "stable" | "declining" | "not_enough_data";
  expanded: boolean;
  loweringMatches: LoweringMatch[];
  underReviewCount: number;
  tips: string[];
  improvingAck: boolean;
}

export interface Profile {
  playerId: string;
  displayName: string;
  dimensions: DimensionView[];
  howItWorks: string;
}

export interface ReviewItem {
  id: string;
  playerId: string;
  playerName: string;
  dimension: string;
  matchId: string;
  matchDate: string | null;
  reason: string;
  note: string | null;
  status: ReviewStatus;
  proposal: { score: number | null; confidence: number | null; aiSummary: string | null; simulated: boolean } | null;
  evidence: { line: EvidenceLine; before: EvidenceLine[]; after: EvidenceLine[] }[];
}

export type ReasonCode =
  | "party_together"
  | "protected_from_reports"
  | "kept_apart_from_targets"
  | "low_respect_spread"
  | "own_respect_low"
  | "balanced_teamwork"
  | "constraint_relaxed";

export interface LobbyMember {
  displayName: string;
  you: boolean;
  yourParty: boolean;
}

/** Private to the viewing player: names only, their own reasons. */
export interface Lobby {
  playerId: string;
  yourTeam: "A" | "B";
  teams: { A: LobbyMember[]; B: LobbyMember[] };
  reasons: ReasonCode[];
  partyMemberNames: string[];
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = <T,>(url: string, data: unknown = {}) => call<T>(url, { method: "POST", body: JSON.stringify(data) });

export const api = {
  players: () => call<Player[]>("/api/players"),
  profile: (playerId: string) => call<Profile>(`/api/profile/${encodeURIComponent(playerId)}`),
  challenge: (data: { playerId: string; dimension: string; matchId: string; reason: string; note?: string }) =>
    post("/api/challenges", data),
  pending: () => call<ReviewItem[]>("/api/challenges?status=pending"),
  decide: (id: string, decision: "upheld" | "overturned", comment?: string) =>
    post(`/api/challenges/${encodeURIComponent(id)}/decision`, { decision, comment }),
  lobby: (playerId: string) => call<Lobby>(`/api/lobby/${encodeURIComponent(playerId)}`),
  demoStatus: () => call<{ simulatedAiErrorActive: boolean }>("/api/demo/status"),
  simulateAiError: () => post<{ added: number; simulatedAiErrorActive: boolean }>("/api/demo/simulate-ai-error"),
  reset: () => post<{ cleared: number; overridesCleared: number }>("/api/demo/reset"),
};

export const MAX_NOTE_CHARS = 200;
export const MAX_COMMENT_CHARS = 300;
export const CHALLENGE_REASONS = ["misread_banter", "game_language", "missing_context", "not_me", "other"];
