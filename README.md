# ClearMatch

A transparent, contestable behaviour-aware matchmaking prototype: players can see their behaviour scores, the exact chat lines behind them, why they were placed in their lobby, and challenge a score.

README prose word count: TBC

## Repository and submitted version
<!-- Release tag and commit hash added at submission. -->
Repository: https://github.com/SupremeSunlord77/clearmatch

Submitted version: release tag `v1.0`, commit `TBC` (added at submission).


## Project status
<!-- What is implemented, simulated and planned; copied verbatim from docs/scope.md. -->
The authoritative scope is in [docs/scope.md](docs/scope.md).

Implemented
- An AI scores each player's behaviour profile (Respect, Teamwork, Communication) from their chat history, returning structured JSON: score, confidence, and the message IDs used as evidence.
- A validator checks the AI output. Invalid output, made-up message IDs, or low confidence are held back from the player's score and marked as awaiting review. Temporary provider errors are retried, and failures are recorded honestly.
- A private profile screen shows each score with a word label and trend, the matches that lowered it, the exact chat lines behind it, and a labelled AI summary. Low or declining scores open automatically; others stay collapsed.
- Each score comes with improvement tips (drafted with AI assistance and reviewed by the designer), and the profile explains in plain words how it is worked out, without showing the formula.
- A player can challenge one score in one match when that match scored 1 or 2. A reviewer upholds or overturns it: an overturned match no longer counts and the score is recalculated; an upheld decision is final and shows the reviewer's comment.
- A simple matchmaking rule forms lobbies from profiles and explains privately to the player why they were placed in their lobby. Challenge outcomes update the next lobby and its explanation; with only 8 players, the protection rules keep the same teams, so the explanation changes rather than the teammates.
- A mock mode runs the whole demo without an API key.

Simulated
- Players, matches and chat messages come from synthetic, seeded data, not a live game.
- The scores shown in the demo come from a recorded live AI run (Gemini 3.5 Flash-Lite), or from mock results when no scoring output exists.
- The human reviewer is a demo page, not a real moderation team.
- The player pool is a small fixed set of 8 players.
- An AI scoring error is simulated with a labelled demo control, because the live runs produced no false positives to demonstrate a successful challenge.

Planned (not built)
- Lobby preference setting (e.g. "avoid players with recent reports").
- Reflective coach chatbot.
- Emotion as a signal; full friendship and target-reaction context.
- Clearer dimension definitions, so the same message does not lower Respect and Communication at once.
- A step that detects prompt-injection lines before they can be cited as evidence.
- A long-term study of player trust, reliance and manipulation, and of player-base segmentation.
- Chat restriction for low-Respect players.
- A guided reflection with a coach chatbot that unlocks chat; the score recovers only through later behaviour.
- Reports between party members weighted less in scoring, so joke reports between friends do not lower a friend's score.
- A reviewer queue for AI scores the model was unsure about (the demo reviewer handles player challenges only).

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
npm run demo
```

`npm run demo` starts the server and the client (like `npm run dev`), prints the client URL (normally http://localhost:5173) and a short guide to the two demo stories below. No `.env` or API key is needed. Stop it with Ctrl+C. The server alone runs at http://localhost:3001 (`/api/health` returns `{"status":"ok"}`).

**Scores used by the app.** The scores shown are from live run 4 (gemini-3.5-flash-lite), included in the repo as `data/demo/run4-match-results.json`. The server loads, in order: `output/match-results.json` (your own latest `npm run score`, if any), then that committed run 4 file, then mock results. It logs which one it used at startup. The LLM is never called while you use the app.

**Demo controls.** Everything in the yellow "Demo control" bar is demo-only: switching player, opening the simulated reviewer (`/review`), "Simulate an AI error" and "Reset demo". Reset demo clears all challenges and the simulated error, and returns every profile and lobby to its original state.

**Story 1: a real AI result, challenged and upheld (Brickwall, p7)**
1. Open `/?player=p7` and click "Show details" on Respect. Match 1 lowered the score: see the exact chat lines, the AI summary, the improvement acknowledgement and the tips.
2. Click "Challenge this score" on match 1, choose a reason, and submit. The match shows "Challenged — under review".
3. Click "Open simulated reviewer". Read the evidence lines in context, add a comment, and click "Uphold score".
4. Back on the profile, match 1 shows "Upheld on review" with the reviewer's comment; the score is unchanged and cannot be challenged again.
5. Click "Find next match" to see both teams and "Why you're in this lobby".

**Story 2: a simulated AI error, challenged and overturned (Havoc, p5)**

The AI error in this story is simulated: live run 4 produced no false positives, so a demo control injects one labelled error (Havoc's game language scored as threatening in match 3). Nothing in the real scoring pipeline changes.
1. Click "Reset demo", open `/lobby?player=p5`, and note the teams and reasons.
2. Click "Simulate an AI error". The bar shows "Demo control: simulated AI error active".
3. Open `/?player=p5`. Respect is now Low, citing Havoc's game language ("gonna kill it this round", "destroy their base, let's go").
4. Click "Find next match". Havoc's reasons now say their Respect is Low and that not every fairness rule could be met.
5. Challenge match 3 with "It was game language, not abuse", open the simulated reviewer, and click "Overturn score".
6. Back on the profile, match 3 no longer counts and Respect is recalculated to Neutral. Click "Find next match" again: the extra reasons are gone.

**Run the tests.** Run `npm test` (no API key needed). It checks the validator, score aggregation and trends, provider retries, the profile and challenge rules, and matchmaking (constraints, relaxation, privacy of lobby reasons and the simulated AI error).

### How matchmaking works

The next match puts all 8 players into two teams of 4, so matching means choosing the team split. The server checks all 35 possible splits against three rules: party members play together; nobody is placed with a player they muted or reported in the last 4 matches, which protects targets (unless the two are in the same party now, because they chose to play together); and each team has at most one player with Low Respect. Spreading Low-Respect players avoids toxic teams and echo chambers; grouping them would need a much larger pool, so this is a deliberate trade-off. Among the splits that pass, it picks the one with the smallest difference in average Teamwork, with a fixed tie-break so results repeat. If no split passes, the Low-Respect rule is relaxed first, then the report rule; the party rule never is, and every player is told in general terms that not every rule could be met. Each dimension has one role: Respect decides grouping (protection), Teamwork decides balance (fairness), and Communication is not used, because in current results it overlaps with Respect and would punish the same messages twice (chat restriction is planned instead). Safety rules are deliberately put before balance. With only 8 players, the protection rules leave a single valid split, so challenges change a player's explanation rather than their teammates. At scale, the behaviour rules would filter candidate lobbies before skill-based matching (for example by rank), at the cost of longer queue times (planned, untested). Each player sees only their own reasons, never anyone else's scores, bands or reports.

## Supplying your own API key
<!-- How a reviewer supplies their own key; none is included. -->
No API key is included in this repository. The demo needs no key.

To score the matches live with your own key, copy `.env.example` to `.env` (gitignored) and set `LLM_PROVIDER=gemini`, `LLM_MODEL` (e.g. `gemini-3.5-flash-lite`) and `GEMINI_API_KEY`. Run `npm run score`, then `npm run demo`. Live results can differ from run 4, so the two stories may not reproduce exactly. Mock mode (`LLM_PROVIDER=mock`) needs no key.

## Development record
<!-- Significant changes, why, what was checked, commit links; full log in docs/development-log.md. -->
The full record, with what was checked for each change, is in [docs/development-log.md](docs/development-log.md). The main stages:

- **Direction (11 Nov).** Chose transparent behaviour-aware matchmaking over a moderation loop, a coach chatbot and an in-the-moment nudge, using a decision matrix. [164d258](https://github.com/SupremeSunlord77/clearmatch/commit/164d258)
- **Scoring pipeline (12–13 Nov).** The model proposes scores as JSON; a validator rejects invented or misattributed evidence and low confidence; code calculates profiles. [d0b25ae](https://github.com/SupremeSunlord77/clearmatch/commit/d0b25ae)
- **Changes from testing (13 Nov).** Trend threshold raised to ±1.0 after single-point flips [75f2605](https://github.com/SupremeSunlord77/clearmatch/commit/75f2605); retry added after every call to gemini-3.8-flash returned 503 [a4c0f3f](https://github.com/SupremeSunlord77/clearmatch/commit/a4c0f3f); prompt v2 added score anchors after run 2 never awarded a 5 and rewarded banter [a0cf488](https://github.com/SupremeSunlord77/clearmatch/commit/a0cf488). Live results went from 6 to 7 of 8 expected outcomes, partly because case E's expectation was revised with a dated note ([test results](docs/test-results-day3.md)).
- **Profile and challenges (13–14 Nov).** Evidence shown from the data only; overturned matches stop counting; upheld decisions are final. [956dc94](https://github.com/SupremeSunlord77/clearmatch/commit/956dc94), [33e08fa](https://github.com/SupremeSunlord77/clearmatch/commit/33e08fa)
- **Matchmaking (14–15 Nov).** Safety rules before balance; private reasons. With 8 players the protection rule fixes the teams, so challenges change the explanation, not the teammates. Live run 4 committed so markers see the tested demo. [5d59a5e](https://github.com/SupremeSunlord77/clearmatch/commit/5d59a5e), [2c7035b](https://github.com/SupremeSunlord77/clearmatch/commit/2c7035b)


## AI assistance
<!-- Tools used, what they helped with, what I changed, how I checked; full notes in docs/ai-usage-log.md. -->
Details, with what I kept or changed each time, are in [docs/ai-usage-log.md](docs/ai-usage-log.md).

- **Claude Code** wrote most of the code, tests, synthetic data and log drafts, following design decisions I specified in phased prompts. I reviewed each phase before committing and ran the tests and browser walkthroughs.
- **Claude (chat)** helped plan the schedule, find and check sources, draft the decision matrix, concept statement, improvement tips and the system diagram, and advise on test results.
- **My own decisions and edits:** the matchmaking focus and journey; the prompt's context rules; the trend threshold, model choice, stopping at prompt v2, upheld-is-final and the demo data; the party-report case and the reflection-chatbot idea.
- **Checks:** 90 automated tests; live runs compared against my expected outcomes; sources checked against the papers and official pages; claims without a source removed.
- **Gemini 3.5 Flash-Lite** is the model inside the system that proposes behaviour scores.


## Additional files
<!-- What is in docs/ and data/, and any ZIP. -->
- `docs/scope.md`: implemented, simulated and planned features.
- `docs/development-log.md` and `docs/ai-usage-log.md`: development record and AI use.
- `docs/expected-outcomes.md` and `docs/test-results-day3.md`: expected results per test case and the four live runs.
- `docs/screenshots/`: screenshots of both demo stories.
- `docs/system-diagram.png` / `.svg`: system diagram; `docs/system-diagram.mmd`: its Mermaid source (drafted with Claude, checked against the code).
- `data/matches/`, `data/players.json`: synthetic chat logs; `data/README.md` maps test cases A–H to message IDs.
- `data/demo/run4-match-results.json`: live run 4 results used by the demo.
- `data/guidance.json`: improvement tips. `prompts/scoring-prompt.md`: the scoring prompt (v2).

No ZIP is submitted.

