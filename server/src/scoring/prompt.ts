// Loads prompts/scoring-prompt.md at runtime and inserts one match's data.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, rosterOf, type MatchData, type PlayerInfo } from "../data.js";

const PROMPT_PATH = path.join(REPO_ROOT, "prompts", "scoring-prompt.md");
const PLACEHOLDER = "{{MATCH_DATA}}";

export function buildScoringPrompt(match: MatchData, players: PlayerInfo[]): string {
  const template = fs.readFileSync(PROMPT_PATH, "utf8");
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`${PROMPT_PATH} must contain ${PLACEHOLDER} inside the <match_data> block`);
  }
  const inMatch = new Set(rosterOf(match));
  const payload = {
    matchId: match.id,
    date: match.date,
    teams: match.teams,
    players: players.filter((p) => inMatch.has(p.id)),
    messages: match.messages,
    events: match.events,
  };
  // Chat text is untrusted: stop any message from closing the data block early.
  const json = JSON.stringify(payload, null, 2).replace(/<\/?match_data>/gi, (t) => t.replace("<", "&lt;"));
  return template.replace(PLACEHOLDER, json);
}
