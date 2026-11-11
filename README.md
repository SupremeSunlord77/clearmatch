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
- **Node.js 20+** — runtime for the server and tooling.
- **TypeScript** — typed language used in both client and server.
- **npm workspaces** — one repository holding the `client` and `server` packages.
- **Express** — HTTP server exposing the `/api` endpoints (port 3001).
- **tsx** — runs the TypeScript server directly during development.
- **React + Vite** — client user interface and its dev server/build tool; Vite proxies `/api` to the server.
- **concurrently** — runs client and server together with `npm run dev`.
- **JSON files** — data storage in `data/` (no database).
- **LLM provider** — undecided (Gemini or Claude); no LLM SDK is installed yet.

## Running or inspecting the work
<!-- Prerequisites, install, configuration, start, and expected result. -->
Prerequisites: Node.js 20 or later, npm, git.

```bash
npm install
cp .env.example .env
npm run dev
```

You should see the client at the URL Vite prints (normally http://localhost:5173) showing "ClearMatch — setup OK", and http://localhost:3001/api/health returning `{"status":"ok"}`.

## Supplying your own API key
<!-- How a reviewer supplies their own key; none is included. -->
No API key is included in this repository. To use a live LLM, add your own key to `.env` (which is gitignored) and set `LLM_PROVIDER`. Mock mode (`LLM_PROVIDER=mock`) needs no key.

## Development record
<!-- Significant changes, why, what was checked, commit links; full log in docs/development-log.md. -->

## AI assistance
<!-- Tools used, what they helped with, what I changed, how I checked; full notes in docs/ai-usage-log.md. -->

## Additional files
<!-- What is in docs/ and data/, and any ZIP. -->
