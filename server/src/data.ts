// Loads the synthetic players and matches from data/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../..");

export interface PlayerInfo {
  id: string;
  displayName: string;
  partyGroup: string | null;
}

export interface ChatMessage {
  id: string;
  timestamp: string;
  playerId: string;
  team: "A" | "B";
  text: string;
}

export interface MatchEvent {
  id: string;
  timestamp: string;
  type: "mute" | "report" | "leave";
  byPlayerId: string;
  targetPlayerId: string;
}

export interface MatchData {
  id: string;
  date: string;
  teams: { A: string[]; B: string[] };
  messages: ChatMessage[];
  events: MatchEvent[];
}

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

export function loadPlayers(): PlayerInfo[] {
  return readJson(path.join(REPO_ROOT, "data", "players.json"));
}

/** All matches, sorted by date (oldest first). */
export function loadMatches(): MatchData[] {
  const dir = path.join(REPO_ROOT, "data", "matches");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(dir, f)) as MatchData)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const rosterOf = (m: MatchData) => [...m.teams.A, ...m.teams.B];
