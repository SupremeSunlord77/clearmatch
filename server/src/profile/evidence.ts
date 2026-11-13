// D2: evidence text comes ONLY from data/matches/*.json, looked up by message ID.
// The model's text is never used here.
import type { MatchData, PlayerInfo } from "../data.js";

export interface EvidenceLine {
  messageId: string;
  matchId: string;
  speakerId: string;
  speakerName: string;
  timestamp: string;
  text: string; // exact text from the data file
}

export interface EvidenceWithContext {
  line: EvidenceLine;
  before: EvidenceLine[]; // up to 2 earlier messages in the same match
  after: EvidenceLine[]; // up to 2 later messages in the same match
}

export class EvidenceIndex {
  private byId = new Map<string, { match: MatchData; index: number }>();
  private names: Map<string, string>;

  constructor(matches: MatchData[], players: PlayerInfo[]) {
    this.names = new Map(players.map((p) => [p.id, p.displayName]));
    for (const match of matches) match.messages.forEach((_, index) => this.byId.set(match.messages[index].id, { match, index }));
  }

  private toLine(match: MatchData, index: number): EvidenceLine {
    const m = match.messages[index];
    return { messageId: m.id, matchId: match.id, speakerId: m.playerId, speakerName: this.names.get(m.playerId) ?? m.playerId, timestamp: m.timestamp, text: m.text };
  }

  /** The real chat line for an ID, or null if it is not in the data (it is then never shown). */
  line(messageId: string): EvidenceLine | null {
    const hit = this.byId.get(messageId);
    return hit ? this.toLine(hit.match, hit.index) : null;
  }

  /** Real lines for a list of IDs, dropping any that are not in the data. */
  lines(messageIds: string[]): EvidenceLine[] {
    return messageIds.map((id) => this.line(id)).filter((l): l is EvidenceLine => l !== null);
  }

  withContext(messageId: string, size = 2): EvidenceWithContext | null {
    const hit = this.byId.get(messageId);
    if (!hit) return null;
    const { match, index } = hit;
    const range = (from: number, to: number) =>
      Array.from({ length: Math.max(0, to - from) }, (_, k) => this.toLine(match, from + k));
    return {
      line: this.toLine(match, index),
      before: range(Math.max(0, index - size), index),
      after: range(index + 1, Math.min(match.messages.length, index + 1 + size)),
    };
  }
}
