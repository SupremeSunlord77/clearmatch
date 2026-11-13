// Challenges (D4, D5): kept in memory and persisted to output/challenges.json.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PlayerInfo } from "../data.js";
import { OUTPUT_DIR, type MatchResultsFile } from "../scoring/results.js";
import { DIMENSIONS, type Dimension } from "../scoring/types.js";

export const CHALLENGES_PATH = path.join(OUTPUT_DIR, "challenges.json");
export const CHALLENGE_REASONS = ["misread_banter", "game_language", "missing_context", "not_me", "other"] as const;
export type ChallengeReason = (typeof CHALLENGE_REASONS)[number];
export type ChallengeStatus = "pending" | "upheld" | "overturned";
export const MAX_NOTE_CHARS = 200;

export interface Challenge {
  id: string;
  playerId: string;
  dimension: Dimension;
  matchId: string;
  reason: ChallengeReason;
  note: string | null;
  status: ChallengeStatus;
  reviewerComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });

export interface ChallengeContext {
  players: PlayerInfo[];
  results: MatchResultsFile;
}

export class ChallengeStore {
  private items: Challenge[] = [];

  /** file = null keeps challenges in memory only (used by tests). */
  constructor(private file: string | null = CHALLENGES_PATH) {
    if (file && fs.existsSync(file)) this.items = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  private save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.items, null, 2) + "\n");
  }

  list(status?: ChallengeStatus): Challenge[] {
    return this.items.filter((c) => !status || c.status === status);
  }

  get(id: string): Challenge | undefined {
    return this.items.find((c) => c.id === id);
  }

  forPlayer(playerId: string): Challenge[] {
    return this.items.filter((c) => c.playerId === playerId);
  }

  /** D4: only a 1 or 2 match score; one open challenge per player + dimension + match. */
  create(input: unknown, ctx: ChallengeContext): Result<Challenge> {
    const b = (input ?? {}) as Record<string, unknown>;
    const { playerId, dimension, matchId, reason, note } = b;

    if (typeof playerId !== "string" || !ctx.players.some((p) => p.id === playerId)) {
      return fail(404, `Unknown player: ${String(playerId)}`);
    }
    if (typeof dimension !== "string" || !DIMENSIONS.includes(dimension as Dimension)) {
      return fail(400, `Unknown dimension: ${String(dimension)}. Use one of: ${DIMENSIONS.join(", ")}`);
    }
    const match = ctx.results.matches.find((m) => m.matchId === matchId);
    if (typeof matchId !== "string" || !match) return fail(404, `Unknown match: ${String(matchId)}`);
    const r = match.players[playerId]?.[dimension as Dimension];
    if (!r) return fail(404, `${playerId} did not play in ${matchId}`);
    if (r.status !== "accepted") {
      return fail(400, "This match score is already with a human reviewer and does not count yet, so it cannot be challenged");
    }
    if (r.score !== 1 && r.score !== 2) {
      return fail(400, `Only match scores of 1 or 2 can be challenged; this score is ${r.score}`);
    }
    if (typeof reason !== "string" || !CHALLENGE_REASONS.includes(reason as ChallengeReason)) {
      return fail(400, `Unknown reason: ${String(reason)}. Use one of: ${CHALLENGE_REASONS.join(", ")}`);
    }
    if (note !== undefined && note !== null && typeof note !== "string") return fail(400, "note must be text");
    const cleanNote = typeof note === "string" && note.trim() !== "" ? note.trim() : null;
    if (cleanNote && cleanNote.length > MAX_NOTE_CHARS) {
      return fail(400, `note is ${cleanNote.length} characters (max ${MAX_NOTE_CHARS})`);
    }

    const same = this.items.filter((c) => c.playerId === playerId && c.dimension === dimension && c.matchId === matchId);
    if (same.some((c) => c.status === "pending")) {
      return fail(409, "There is already an open challenge for this score");
    }
    if (same.some((c) => c.status === "overturned")) {
      return fail(409, "This score was already overturned on review and no longer counts");
    }

    const challenge: Challenge = {
      id: `ch_${randomUUID().slice(0, 8)}`,
      playerId,
      dimension: dimension as Dimension,
      matchId,
      reason: reason as ChallengeReason,
      note: cleanNote,
      status: "pending",
      reviewerComment: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    this.items.push(challenge);
    this.save();
    return { ok: true, value: challenge };
  }

  decide(id: string, input: unknown): Result<Challenge> {
    const c = this.get(id);
    if (!c) return fail(404, `Unknown challenge: ${id}`);
    if (c.status !== "pending") return fail(409, `This challenge was already decided (${c.status})`);
    const { decision, comment } = (input ?? {}) as Record<string, unknown>;
    if (decision !== "upheld" && decision !== "overturned") {
      return fail(400, 'decision must be "upheld" or "overturned"');
    }
    if (comment !== undefined && comment !== null && typeof comment !== "string") return fail(400, "comment must be text");
    c.status = decision;
    c.reviewerComment = typeof comment === "string" && comment.trim() !== "" ? comment.trim() : null;
    c.decidedAt = new Date().toISOString();
    this.save();
    return { ok: true, value: c };
  }

  reset(): number {
    const n = this.items.length;
    this.items = [];
    this.save();
    return n;
  }
}
