# ClearMatch — Scope

Implemented
- An AI scores each player's behaviour profile (Respect, Teamwork, Communication) from their chat history, returning structured JSON: score, confidence, and the message IDs used as evidence.
- A validator checks the AI output. Invalid output, made-up message IDs, or low confidence go to human review instead of the player. Temporary provider errors are retried, and failures are recorded honestly.
- A private profile screen shows each score with a word label and trend, the matches that lowered it, the exact chat lines behind it, and a labelled AI summary. Low or declining scores open automatically; others stay collapsed.
- Each score comes with improvement tips written by the designer, and the profile explains in plain words how it is worked out, without showing the formula.
- A player can challenge one score in one match when that match scored 1 or 2. A reviewer upholds or overturns it: an overturned match no longer counts and the score is recalculated; an upheld decision is final and shows the reviewer's comment.
- A simple matchmaking rule forms lobbies from profiles and explains privately to the player why they were placed in their lobby. Challenge outcomes change the next lobby.
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