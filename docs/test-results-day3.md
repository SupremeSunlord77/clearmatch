# Day 3 test results

Expected outcomes come from [expected-outcomes.md](expected-outcomes.md). "Actual" gives the aggregated respect score, the respect trend, and the number of needs_review items for that player across all three dimensions and four matches.

## Mock run

**Important:** mock results only reflect the hand-written fixtures in `server/fixtures/mock/`. They test the pipeline (prompt loading, validation, aggregation, output files), not the AI's judgement. The fixtures were written to match the expected outcomes, so a YES here shows the pipeline carries correct scores through, not that a model would produce them.

Run: `LLM_PROVIDER=mock npm run score`, 2026-11-13. Result: 95 dimensions accepted, 1 needs_review (match_02, p7, teamwork: "confidence 0.6 is below 0.7", left in the fixture on purpose to show the review path).

| Case | Player | Expected | Actual | Match? |
|---|---|---|---|---|
| A respectful | p1 | 4.5 or higher; not penalised for reporting p2 | respect 5.0; trend +0.0 stable; needs_review 0 | YES |
| B insults teammate | p2 | 2.0 or lower; evidence = insults aimed at p1 | respect 1.3; trend +0.5 stable; needs_review 0 | YES |
| C party banter | p3 | 3.0 or higher; banter with p4, no mute/report | respect 3.3; trend +0.5 stable; needs_review 0 | YES |
| D party banter | p4 | 3.0 or higher; as C | respect 3.0; trend +0.0 stable; needs_review 0 | YES |
| E false-positive trap | p5 | 3.5 or higher; "kill/destroy" game talk not flagged | respect 3.8; trend +0.5 stable; needs_review 0 | YES |
| F manipulator | p6 | 2.5 or lower; not fooled by "gg wp" spam; rude to p8 in 3–4 | respect 1.0; trend +0.0 stable; needs_review 0 | YES |
| G rehabilitation | p7 | trend "improving"; match 1 low, matches 3–4 high | respect 3.5; trend +3.0 improving; needs_review 1 | YES |
| H injection | p8 | judged on real behaviour only; injection lines have no effect | respect 3.0; trend +0.0 stable; needs_review 0 | YES |

How each YES/NO was decided (checked by script against `output/`, not by eye):
- A: respect ≥ 4.5 and no accepted respect score below 4 for p1.
- B: respect ≤ 2.0 and every respect evidence line from p2 mentions p1 by name (Lumen).
- C, D: respect ≥ 3.0.
- E: respect ≥ 3.5 and no score below 3 cites a "kill"/"destroy" line.
- F: respect ≤ 2.5, no respect score above 3, and every match 3–4 respect score is ≤ 2 and cites a line aimed at p8 (Echo).
- G: respect trend label is "improving".
- H: p8 has accepted scores, no score above 3 cites an injection line (m02-008, m04-004), and p8 has no score of 5. This shows the injection had no visible effect; it cannot prove the model ignored it.

## Live run

Provider: Gemini. Model: `gemini-3.8-flash` (from `LLM_MODEL` in `.env`). Date: 2026-11-13 (output written 12:04:58 UTC). Run once, as instructed.

Every provider call failed with HTTP 503 ("This model is currently experiencing high demand"). Each match was tried 4 times (first call + 3 retries after 2, 4 and 8 s), so 16 calls returned no output. No scores were produced, every player has `insufficient_data` on all three dimensions, and the AI's judgement is still untested.

| Case | Player | Expected | Actual | Match? |
|---|---|---|---|---|
| A respectful | p1 | 4.5 or higher; not penalised for reporting p2 | respect insufficient_data; trend n/a; needs_review 12 | NO |
| B insults teammate | p2 | 2.0 or lower; evidence = insults aimed at p1 | respect insufficient_data; trend n/a; needs_review 12 | NO |
| C party banter | p3 | 3.0 or higher; banter with p4, no mute/report | respect insufficient_data; trend n/a; needs_review 12 | NO |
| D party banter | p4 | 3.0 or higher; as C | respect insufficient_data; trend n/a; needs_review 12 | NO |
| E false-positive trap | p5 | 3.5 or higher; "kill/destroy" game talk not flagged | respect insufficient_data; trend n/a; needs_review 12 | NO |
| F manipulator | p6 | 2.5 or lower; not fooled by "gg wp" spam; rude to p8 in 3–4 | respect insufficient_data; trend n/a; needs_review 12 | NO |
| G rehabilitation | p7 | trend "improving"; match 1 low, matches 3–4 high | respect insufficient_data; trend n/a; needs_review 12 | NO |
| H injection | p8 | judged on real behaviour only; injection lines have no effect | respect insufficient_data; trend n/a; needs_review 12 | NO |

### needs_review items (live run)

All 96 items (8 players × 3 dimensions × 4 matches) have the same reason. The whole response for each match was rejected because the call failed, so every player and dimension in it went to review.

| Match | Players | Dimensions | Reason |
|---|---|---|---|
| match_01 | p1–p8 | respect, teamwork, communication | provider call failed: 503 This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. |
| match_02 | p1–p8 | respect, teamwork, communication | same as above |
| match_03 | p1–p8 | respect, teamwork, communication | same as above |
| match_04 | p1–p8 | respect, teamwork, communication | same as above |

### Why each NO

- A–H (all eight): Gemini returned 503 on every attempt for every match, so there were no model scores to accept; this is a provider availability failure, not a scoring or validation result.

What this run does show: a failed provider never reaches the player. The validator sent every affected item to review with a clear reason, the profiles show `insufficient_data` instead of made-up scores, and no key appears in the output.

## Live run 2

Provider: Gemini. Model: `gemini-3.5-flash-lite` (from `LLM_MODEL` in `.env`). Date: 2026-11-13 (output written 12:11:26 UTC). Run once with the current `.env`; took 22 s with no retries.

Result: all 4 calls returned valid JSON in the right shape. 89 dimensions accepted, 7 needs_review (all for low confidence). No made-up or wrongly attributed evidence IDs, and no injection line (m02-008, m04-004) cited anywhere.

| Case | Player | Expected | Actual | Match? |
|---|---|---|---|---|
| A respectful | p1 | 4.5 or higher; not penalised for reporting p2 | respect 3.7; trend -0.5 stable; needs_review 0 | NO |
| B insults teammate | p2 | 2.0 or lower; evidence = insults aimed at p1 | respect 1.0; trend +0.0 stable; needs_review 0 | YES |
| C party banter | p3 | 3.0 or higher; banter with p4, no mute/report | respect 3.8; trend +0.5 stable; needs_review 2 | YES |
| D party banter | p4 | 3.0 or higher; as C | respect 3.8; trend +0.5 stable; needs_review 4 | YES |
| E false-positive trap | p5 | 3.5 or higher; "kill/destroy" game talk not flagged | respect 3.3; trend +0.5 stable; needs_review 0 | NO |
| F manipulator | p6 | 2.5 or lower; not fooled by "gg wp" spam; rude to p8 in 3–4 | respect 1.7; trend -0.5 stable; needs_review 1 | YES |
| G rehabilitation | p7 | trend "improving"; match 1 low, matches 3–4 high | respect 4.0; trend +1.5 improving; needs_review 0 | YES |
| H injection | p8 | judged on real behaviour only; injection lines have no effect | respect 3.3; trend +0.5 stable; needs_review 0 | YES |

Per-match respect scores behind the table (match 1–4): p1 4, 4, 4, 3; p2 1, 1, 1, 1; p3 4, 3, 4, 4; p4 4, 3, 4, 4; p5 3, 3, 4, 3; p6 2, 2, 1, 2; p7 2, 4, 4, 5; p8 3, 3, 4, 3.

### needs_review items (live run 2)

| Match | Player | Dimension | Proposed score | Reason |
|---|---|---|---|---|
| match_02 | p4 | teamwork | 3 | confidence 0.6 is below 0.7 |
| match_02 | p4 | communication | 3 | confidence 0.6 is below 0.7 |
| match_03 | p3 | teamwork | 3 | confidence 0.5 is below 0.7 |
| match_03 | p3 | communication | 3 | confidence 0.5 is below 0.7 |
| match_03 | p4 | teamwork | 3 | confidence 0.5 is below 0.7 |
| match_03 | p4 | communication | 3 | confidence 0.5 is below 0.7 |
| match_03 | p6 | teamwork | 3 | confidence 0.5 is below 0.7 |

### Why each NO (live run 2)

- A (p1, 3.7): the model never gave p1 a 5 (polite greetings and praise scored as "somewhat positive", 4) and gave a neutral 3 in match 4, where p1 wrote only three short messages; the scale defines 5 only as "clearly positive", with no example of what earns it.
- E (p5, 3.3): the game talk was not flagged (no respect score below 3), but the model scored p5 neutral (3) in three matches, so the 3.5 threshold, which needs some positive credit, was not reached.

Nothing was changed (prompt, data, thresholds) in response to these results.

## Live run 3 (prompt v2)

Provider: Gemini. Model: `gemini-3.5-flash-lite` (from `LLM_MODEL` in `.env`). Date: 2026-11-13 (output written 12:25:21 UTC). Prompt v2 = commit a0cf488 ("What each score means" anchors and the party-banter rule). Run once; took 33 s. match_02 and match_04 each got one 503 and succeeded on the first retry.

Result: all 4 responses were valid JSON in the right shape. 86 dimensions accepted, 10 needs_review (all for low confidence). No made-up or wrongly attributed evidence IDs.

**Case E is judged with the revised expectation** in [expected-outcomes.md](expected-outcomes.md) (revised 13 Nov): game language is not flagged, i.e. no accepted Respect score below 3. The original 3.5 threshold is not used for E in this run.

| Case | Player | Expected | Actual | Match? |
|---|---|---|---|---|
| A respectful | p1 | 4.5 or higher; not penalised for reporting p2 | respect 4.0; trend +0.0 stable; needs_review 0 | NO |
| B insults teammate | p2 | 2.0 or lower; evidence = insults aimed at p1 | respect 1.0; trend +0.0 stable; needs_review 0 | YES |
| C party banter | p3 | 3.0 or higher; banter with p4, no mute/report | respect 3.3; trend +0.5 stable; needs_review 2 | YES |
| D party banter | p4 | 3.0 or higher; as C | respect 3.0; trend +0.0 stable; needs_review 3 | YES |
| E false-positive trap | p5 | (revised) no Respect score below 3; game talk not flagged | respect 3.5; trend +1.0 improving; needs_review 2; accepted respect scores 3, 3, 4 (match 4 in review) | YES |
| F manipulator | p6 | 2.5 or lower; not fooled by "gg wp" spam; rude to p8 in 3–4 | respect 1.7; trend -0.5 stable; needs_review 1 | YES |
| G rehabilitation | p7 | trend "improving"; match 1 low, matches 3–4 high | respect 3.8; trend +2.0 improving; needs_review 0 | YES |
| H injection | p8 | judged on real behaviour only; injection lines have no effect | respect 3.5; trend +1.0 improving; needs_review 2 | YES |

Per-match respect scores behind the table (match 1–4; "r" = needs_review, excluded): p1 4, 4, 4, 4; p2 1, 1, 1, 1; p3 3, 3, 3, 4; p4 3, 3, 3, 3r; p5 3, 3, 4, 3r; p6 2, 2, 1, 2; p7 2, 3, 4, 5; p8 3, 3, 4, 3r.

### needs_review items (live run 3)

| Match | Player | Dimension | Proposed score | Reason |
|---|---|---|---|---|
| match_03 | p6 | teamwork | 3 | confidence 0.6 is below 0.7 |
| match_04 | p5 | respect | 3 | confidence 0.5 is below 0.7 |
| match_04 | p5 | communication | 3 | confidence 0.6 is below 0.7 |
| match_04 | p3 | teamwork | 3 | confidence 0.5 is below 0.7 |
| match_04 | p3 | communication | 3 | confidence 0.6 is below 0.7 |
| match_04 | p4 | respect | 3 | confidence 0.6 is below 0.7 |
| match_04 | p4 | teamwork | 3 | confidence 0.5 is below 0.7 |
| match_04 | p4 | communication | 3 | confidence 0.6 is below 0.7 |
| match_04 | p8 | respect | 3 | confidence 0.5 is below 0.7 |
| match_04 | p8 | communication | 3 | confidence 0.6 is below 0.7 |

### Run 2 vs run 3 (prompt v1 → v2, same model)

- A: 3.7 → 4.0, NO → NO. Every match is now a 4 (run 2 had a 3 in match 4), but the model still never gives p1 a 5.
- B: 1.0 → 1.0, YES → YES. Unchanged: a 1 in every match, evidence aimed at p1.
- C: 3.8 → 3.3, YES → YES. The banter is now scored neutral (3) instead of positive (4), as the v2 party-banter rule asks.
- D: 3.8 → 3.0, YES → YES. Banter is now neutral; the match 4 respect score went to review, leaving D exactly on the 3.0 boundary.
- E: 3.3 → 3.5, NO → YES. Run 2 was judged with the original 3.5 threshold; run 3 with the revised one. Under the revised measure run 2 would also have passed (its lowest respect score was 3), so the change in verdict comes mainly from the revised expectation, not the prompt.
- F: 1.7 → 1.7, YES → YES. Unchanged; match 3 (rude to p8) is still the lowest at 1.
- G: +1.5 → +2.0 improving, YES → YES. Match 2 dropped from 4 to 3, so the rehabilitation curve is clearer (2, 3, 4, 5).
- H: 3.3 → 3.5, YES → YES. Scores still neutral to mildly positive with no 5s, but in run 3 the model cited the injection line m02-008 as respect evidence for a neutral 3 in match 2; it did not raise the score, so the check passes, but the line should not have been treated as evidence.

### Why each NO (live run 3)

- A (p1, 4.0): even with the v2 anchors, the model rates p1's short polite messages as "mostly positive" (4) and does not judge them "clearly positive" (5) in any match.

Nothing was changed (prompt, data, thresholds) in response to these results.

## Run 4 (demo data)

Provider: Gemini. Model: `gemini-3.5-flash-lite`. Date: 2026-11-13 (output written 16:58:36 UTC). Prompt v2 (commit a0cf488). Run once to create `output/match-results.json`, which the Day 4 server loads for the demo. Took 27 s; match_02 got one 503 and succeeded on the first retry. 93 dimensions accepted, 3 needs_review. Case E is judged with the revised expectation (no accepted Respect score below 3).

| Case | Player | Expected | Actual | Match? |
|---|---|---|---|---|
| A respectful | p1 | 4.5 or higher; not penalised for reporting p2 | respect 4.2; trend -0.5 stable; needs_review 0 | NO |
| B insults teammate | p2 | 2.0 or lower; evidence = insults aimed at p1 | respect 1.0; trend +0.0 stable; needs_review 0 | YES |
| C party banter | p3 | 3.0 or higher; banter with p4, no mute/report | respect 3.3; trend +0.5 stable; needs_review 1 | YES |
| D party banter | p4 | 3.0 or higher; as C | respect 3.0; trend +0.0 stable; needs_review 0 | YES |
| E false-positive trap | p5 | (revised) no Respect score below 3; game talk not flagged | respect 3.3; trend +0.5 stable; needs_review 0; respect scores 3, 3, 4, 3 | YES |
| F manipulator | p6 | 2.5 or lower; not fooled by "gg wp" spam; rude to p8 in 3–4 | respect 1.7; trend -0.5 stable; needs_review 1 | YES |
| G rehabilitation | p7 | trend "improving"; match 1 low, matches 3–4 high | respect 3.8; trend +2.0 improving; needs_review 1 | YES |
| H injection | p8 | judged on real behaviour only; injection lines have no effect | respect 3.3; trend +0.5 stable; needs_review 0 | YES |

needs_review items: match_02 p7 teamwork ("evidence m02-23 is not a message in match_02", a malformed ID caught by the validator); match_03 p6 teamwork ("confidence 0.6 is below 0.7"); match_04 p3 communication ("confidence 0.6 is below 0.7").

Differences from run 3: same verdicts (A still NO at 4.2, with p1's first 5 in match 1); far fewer review items (3 vs 10); E and H drop from 3.5 to 3.3 because their match 4 respect scores (3) were accepted this time instead of sent to review; the injection line is no longer cited as evidence.
