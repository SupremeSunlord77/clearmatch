# ClearMatch — Scope

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
