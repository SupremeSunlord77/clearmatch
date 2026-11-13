import { createApp } from "./app.js";
import { loadMatches, loadPlayers } from "./data.js";
import { ChallengeStore } from "./profile/challenges.js";
import { EvidenceIndex } from "./profile/evidence.js";
import { loadGuidance } from "./profile/guidance.js";
import { loadMatchResults } from "./scoring/results.js";

const port = Number(process.env.PORT) || 3001;
const players = loadPlayers();
const matches = loadMatches();

// D1: scoring happens before the server starts (or falls back to mock); never on a page request.
const results = await loadMatchResults();

const app = createApp({
  players,
  matches,
  results,
  guidance: loadGuidance(),
  evidence: new EvidenceIndex(matches, players),
  challenges: new ChallengeStore(),
});

app.listen(port, () => {
  console.log(`ClearMatch server listening on http://localhost:${port}`);
});
