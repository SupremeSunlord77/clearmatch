# ClearMatch

A transparent, contestable behaviour-aware matchmaking prototype: players can see their behaviour scores, the exact chat lines behind them, why they were placed in their lobby, and challenge a score.

README prose word count: TBC

## Repository and submitted version
<!-- Release tag and commit hash added at submission. -->

## Project status
<!-- What is implemented, simulated and planned; copied verbatim from docs/scope.md. -->
The authoritative scope is in [docs/scope.md](docs/scope.md).

Implemented
- An AI scores each player's behaviour profile (Respect, Teamwork, Communication) from their chat history, returning structured JSON: score, confidence, and the message IDs used as evidence.
- A validator checks the AI output. Invalid output, made-up message IDs, or low confidence go to human review instead of the player.
- A private profile screen shows each score, a short explanation of how it is worked out, and the exact chat lines behind it.
- A simple matchmaking rule forms lobbies from profiles and explains to the player why they were placed in their lobby.
- A player can challenge a score. The decision updates their profile and changes their next lobby.
- A mock mode runs the whole demo without an API key.

Simulated
- Players, matches and chat messages come from synthetic, seeded data, not a live game.
- The human reviewer's decision is a simple control in the demo, not a real moderation team.
- The player pool is a small fixed set of players.

Planned (not built)
- Lobby preference setting (e.g. "avoid players with recent reports").
- Reflective coach chatbot.
- Emotion as a signal; full friendship and target-reaction context.
- A long-term study of player trust, reliance and manipulation, and of player-base segmentation.

## Technology stack
<!-- Each technology and what it does in this project. -->
- **Node.js 20.12+** — runtime for the server and tooling.
- **TypeScript** — typed language used in both client and server.
- **npm workspaces** — one repository holding the `client` and `server` packages.
- **Express** — HTTP server exposing the `/api` endpoints (port 3001).
- **tsx** — runs the TypeScript server directly during development.
- **React + Vite** — client user interface and its dev server/build tool; Vite proxies `/api` to the server.
- **concurrently** — runs client and server together with `npm run dev`.
- **JSON files** — data storage in `data/` (no database).
- **Gemini (`@google/genai`)** — Google's official SDK; the LLM that proposes behaviour scores as JSON. The model is set by `LLM_MODEL` in `.env`.

## Running or inspecting the work
<!-- Prerequisites, install, configuration, start, and expected result. -->
Prerequisites: Node.js 20.12 or later, npm, git.

```bash
npm install
cp .env.example .env
npm run dev
```

The server runs at http://localhost:3001 (http://localhost:3001/api/health returns `{"status":"ok"}`); the client runs at the URL Vite prints (normally http://localhost:5173).

**Scores used by the app.** The server reads the scores saved by the last `npm run score` in `output/match-results.json`. If that file does not exist, it logs "No scoring output found; using mock results" and uses the mock results instead, so the demo works without an API key. The LLM is never called while you use the app.

**See a profile.** Open the client URL. The profile of the selected player is shown; use "View profile of" in the yellow "Demo control" bar to choose another player (or open `/?player=p1` … `/?player=p8`). Each dimension shows its score, band and trend, the matches that lowered it with the exact chat lines, and a "Challenge this score" button for match scores of 1 or 2.

**Review a challenge.** Click "Open simulated reviewer" in the demo bar (or open `/review`). Each pending challenge shows the AI's proposal, the evidence lines with surrounding messages, and the player's reason. Uphold or overturn it, then go back to the profile to see the result: an overturned match no longer counts and the score is recalculated.

**Reset the demo.** Click "Reset demo" in the demo bar. This clears all challenges (saved in `output/challenges.json`) and returns every profile to its original state.

**Run the tests yourself.** [docs/testing-guide.md](docs/testing-guide.md) explains how to run the automated tests, the scoring runs and the browser walkthrough in VS Code.

## Supplying your own API key
<!-- How a reviewer supplies their own key; none is included. -->
No API key is included in this repository. To use a live LLM, add your own key to `.env` (which is gitignored) and set `LLM_PROVIDER`. Mock mode (`LLM_PROVIDER=mock`) needs no key.

## Development record
<!-- Significant changes, why, what was checked, commit links; full log in docs/development-log.md. -->

## AI assistance
<!-- Tools used, what they helped with, what I changed, how I checked; full notes in docs/ai-usage-log.md. -->

## Additional files
<!-- What is in docs/ and data/, and any ZIP. -->
