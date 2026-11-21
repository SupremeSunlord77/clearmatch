# Decision matrix (11 Nov 2026)

Used on 11 Nov to choose the project direction from four options. Each criterion is scored 1–3. The weighted total counts criteria 3 and 4 twice, because build time was the main risk. This file was added to the repository on 21 Nov, copied unchanged from my planning notes; the decision itself is recorded in [development-log.md](development-log.md) (commit 164d258).

| Criterion | A: Moderation loop | B: ClearMatch | C: ClearMatch + coach | D: In-the-moment nudge |
|---|---|---|---|---|
| 1. Solves the A1 problem | 3: shows why a penalty happened | 3: makes hidden profiling visible | 3: also teaches | 1: prevents, doesn't explain |
| 2. Evidence support | 3: Holland, Ma; LoL reform cards | 3: Kizilcec, Lai, Lyons, Vrettis, Bongaards; Valve, Overwatch, Xbox | 2: little evidence for the coach | 2: Kordyaka & Kruse; little game-specific evidence |
| 3. Buildable by Sat 14 Nov | 3: one screen plus challenge | 2: profile, evidence, lobby, loop | 1: chatbot adds risk | 3: simple pre-send check |
| 4. Clear interaction | 3: verdict, challenge, outcome | 3: profile, lobby, challenge, updated lobby | 3: plus conversation | 2: single prompt-and-response |
| 5. All 4 L02 properties | 3 | 3 (if the loop is built) | 3 | 3 |
| 6. Novelty | 1: LoL since 2015 | 3: no system shows evidence and allows challenges | 3 | 1: "Are you sure?" prompts already exist |
| **Total** | **16** | **17** | **15** | **12** |
| **Weighted total** | **22** | **22** | **19** | **17** |

**Result.** ClearMatch wins unweighted; ClearMatch and A tie when build risk and interaction are weighted. The trade-off is safety (A) against novelty and continuity with A1 (ClearMatch). I chose ClearMatch because it contains A's core (evidence plus challenge): if matchmaking slipped, the lobby could be simulated and a working evidence-and-challenge system would remain. An optional seventh criterion, continuity with A1's contribution, scored ClearMatch 3 and A 2.

**What happened.** The full loop was built, including matchmaking, so the fallback was not needed. The coach (option C) stayed planned.
