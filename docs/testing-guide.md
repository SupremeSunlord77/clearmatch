# Testing guide (running the checks yourself in VS Code)

This guide repeats, by hand, the checks run during development: the automated tests, the scoring runs and the browser walkthrough of the challenge loop. No AI assistant is needed.

## 1. Set up

1. Open the `clearmatch` folder in VS Code (**File → Open Folder…**).
2. Open a terminal: **Terminal → New Terminal** (or <kbd>Ctrl</kbd>+<kbd>`</kbd>). The commands below are shown for **PowerShell** (the VS Code default on Windows); a Git Bash version is given where it differs.
3. Check Node.js is 20.12 or later:
   ```bash
   node --version
   ```
4. Install dependencies (once):
   ```bash
   npm install
   ```
5. If there is no `.env` yet, copy the example. It starts in mock mode, which needs no key:
   ```bash
   cp .env.example .env
   ```

Never paste an API key into the terminal, a test or a document. It goes only in `.env`.

## 2. Automated tests

```bash
npm test
```

**Expected:** the summary ends with `# pass 61` and `# fail 0`.

| File | What it checks |
|---|---|
| `server/test/validate.test.ts` | The validator: wrong JSON shape, scores outside 1–5, made-up or other players' message IDs, missing evidence for scores other than 3, more than 3 evidence IDs, confidence below 0.7 → needs_review |
| `server/test/aggregate.test.ts` | Weights 1, 1, 2, 2 across matches; trend thresholds at exactly ±1.0; excluded (overturned) matches |
| `server/test/retry.test.ts` | Retries on 503, 429 and timeouts with waits of 2, 4 and 8 s; failure messages never contain the key |
| `server/test/profile.test.ts` | Evidence comes only from the data files; bands; tips; challenge rules (only scores 1–2, one open challenge, upheld is final, overturned cannot be reopened, 200-character note, 300-character reviewer comment) |

If a test fails, the output names the test and shows expected vs actual values.

## 3. Scoring runs

`npm run score` scores all 4 matches and **overwrites** `output/profiles.json`, `output/validation-log.json` and `output/match-results.json`. The app shows whatever is in `output/match-results.json`, which is currently the run 4 live data used for the demo.

**Back up the demo data first**, to a folder outside the repository (so git never picks it up):

PowerShell:
```bash
Copy-Item -Recurse output ..\clearmatch-output-run4
```
Git Bash:
```bash
cp -r output ../clearmatch-output-run4
```

### 3a. Mock run (no key, free, same result every time)

PowerShell:
```bash
$env:LLM_PROVIDER="mock"; npm run score; Remove-Item Env:LLM_PROVIDER
```
Git Bash:
```bash
LLM_PROVIDER=mock npm run score
```

A value set in the terminal takes priority over `.env`, so this runs in mock mode even if `.env` says `gemini`.

**Expected:** `Provider: mock`, a table with one row per player (Respect, Teamwork, Communication with trend, and a needs_review count), then `Wrote output/profiles.json, output/validation-log.json and output/match-results.json`.

### 3b. Live run (uses your Gemini key and quota)

Set `LLM_PROVIDER=gemini`, `LLM_MODEL=…` and `GEMINI_API_KEY=…` in `.env`, then:
```bash
npm run score
```
It makes 4 calls (one per match). Temporary errors (503, 429, timeouts) are retried and each wait is printed. Results vary slightly between runs.

### 3c. Compare with the expected outcomes

Compare the table printed by `npm run score` (or the `score` and `trendLabel` values in `output/profiles.json`) with [expected-outcomes.md](expected-outcomes.md):

| Case | Player | Pass if |
|---|---|---|
| A | p1 Lumen | Respect 4.5 or higher |
| B | p2 Grit | Respect 2.0 or lower |
| C | p3 Fizzbang | Respect 3.0 or higher |
| D | p4 Wobbles | Respect 3.0 or higher |
| E | p5 Havoc | No single match Respect score below 3 (revised 13 Nov) |
| F | p6 Velvet | Respect 2.5 or lower |
| G | p7 Brickwall | Respect trend "improving" |
| H | p8 Echo | Scores reflect real behaviour; the injection lines are not used as instructions |

For E, look at each match's score under `respect.contributions` in `output/profiles.json`. For needs_review items and any rejected AI output, look in `output/validation-log.json`. Record results in a test-results document as before.

### 3d. Restore the demo data

PowerShell:
```bash
Remove-Item -Recurse output; Copy-Item -Recurse ..\clearmatch-output-run4 output
```
Git Bash:
```bash
rm -rf output && cp -r ../clearmatch-output-run4 output
```

## 4. Browser walkthrough (profile → challenge → review → updated profile)

Start both servers:
```bash
npm run dev
```
Wait until the terminal shows `ClearMatch server listening on http://localhost:3001` and a Vite `Local:` URL, then open that URL (normally http://localhost:5173) in a browser. <kbd>Ctrl</kbd>+click the link in the terminal works.

The expected values below are for the run 4 data. With other scoring output the numbers differ but the behaviour must be the same. Start from a clean state: click **Reset demo** first.

| Step | Do this | Expected result |
|---|---|---|
| a | Open the profile of **p2 Grit** (default, or `/?player=p2`) | Header "Private — only you can see this profile". Respect shows 1.0 out of 5, **Low**, and is already expanded. Under "Matches that lowered this score", each evidence line shows speaker, match and time. Open `data/matches/match_01.json` and check the lines word for word against the `text` of those message IDs |
| b | On Respect, match 1, click **Challenge this score**, choose a reason, optionally add a note, click **Submit challenge** | Match 1 shows "Challenged — under review"; its challenge button disappears. The score does not change (pending challenges still count) |
| c | Click **Open simulated reviewer** (or open `/review`) | The challenge is listed with player, dimension, match, the AI's proposed score and confidence, the AI summary, the player's reason and note, and each evidence line marked "▶ EVIDENCE" with 2 messages before and after. Click **Overturn score**: the list becomes empty |
| d | Click **Back to profile** | Match 1 shows "Overturned on review — this match no longer counts" and is dimmed. Respect is recalculated (it stays 1.0 here because all of p2's Respect scores are 1). To see a number change, challenge and overturn **Teamwork, match 3**: Teamwork goes from 1.7 to 2.0 |
| e | Challenge **Respect, match 2**. On `/review`, type a comment and click **Uphold score** | Back on the profile: "Upheld on review" with the reviewer's comment. The score is unchanged and the challenge button does not come back (upheld is final) |
| f | Switch to **p1 Lumen** | All three dimensions are collapsed (Good, Stable) with "Show details". "How your profile is worked out" is collapsed. Opening a dimension shows "No match lowered this score." and the tips |
| g | Click **Reset demo** | "Demo reset: N challenges cleared." All review badges are gone, the challenge buttons are back, p2 Teamwork is back to 1.7, and `/review` shows "No challenges are waiting for review." |

Extra checks:
- The comment box on `/review` stops at 300 characters and the challenge note stops at 200; each shows a counter.
- A match score of 3 or higher never has a challenge button.

## 5. Mock fallback check

1. Stop the servers (<kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal).
2. Rename `output/match-results.json` to `match-results.json.bak`.
3. Run `npm run dev` again.

**Expected:** the server terminal prints `No scoring output found; using mock results`, and the profiles still load. Rename the file back afterwards and restart.

## 6. Clean up

- Click **Reset demo** so `output/challenges.json` is `[]`.
- Stop the servers with <kbd>Ctrl</kbd>+<kbd>C</kbd>.
- Run `git status` and check that `output/` and `.env` are not listed.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Configuration error: LLM_PROVIDER=gemini but … not set in .env` | Add the missing value to `.env`, or use mock mode |
| `EADDRINUSE` (port 3001 or 5173 in use) | A server is already running. Close the other terminal, or stop it with <kbd>Ctrl</kbd>+<kbd>C</kbd> |
| Page shows "Something went wrong while loading" | The API server is not running; check the server lines in the `npm run dev` terminal |
| Live run prints `provider call failed: 503 …` | The Gemini service was busy. Wait and run again; the mock run is unaffected |
