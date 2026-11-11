# Data

All data in this folder is synthetic. It was written for testing ClearMatch and does not come from any real game, player or chat.

- `players.json`: 8 players (p1–p8). p3 and p4 share `partyGroup` `party1`.
- `matches/match_01.json` – `match_04.json`: four matches on consecutive days (2026-11-01 to 2026-11-04). Each has two teams of 4, chat messages and events (mute, report).

## Test cases

| Case | Player ID | What it tests | Message/event IDs that demonstrate it |
|---|---|---|---|
| A | p1 (Lumen) | Consistently respectful, helpful teammate; should score well | m01-006, m01-011, m01-019, m02-013, m02-022, m03-011, m03-023, m04-012, m04-022 |
| B | p2 (Grit) | Repeatedly insults one specific teammate (p1); the target mutes and reports them | Insults: m01-005, m01-010, m01-018, m01-027, m02-010, m02-016, m03-013, m04-013. Mutes: e01-001, e02-001, e03-001, e04-001. Reports: e01-002, e02-002, e03-002, e04-002 |
| C | p3 (Fizzbang) | Rough banter with party friend p4; no mute or report; jokes back | m01-002, m01-012, m01-014, m01-025, m02-006, m02-018, m03-005, m03-019, m04-019 |
| D | p4 (Wobbles) | Rough banter with party friend p3; no mute or report; jokes back | m01-003, m01-013, m01-026, m02-007, m02-017, m02-019, m03-006, m04-008, m04-020 |
| E | p5 (Havoc) | Violent-sounding game language that is not abuse (false-positive trap) | m01-004, m01-015, m01-022, m02-011, m02-021, m03-007, m03-020, m04-017 |
| F | p6 (Velvet) | Manipulator: abusive in matches 1–2; in matches 3–4 spams fake-polite messages while still rude to p8 | Abusive: m01-007, m01-016, m01-023, m02-004, m02-012, m02-020, e02-003. Fake-polite: m03-008, m03-012, m03-021, m04-009, m04-021, m04-027. Still rude to p8: m03-010, m03-016, m03-025, e03-003, m04-010, m04-018 |
| G | p7 (Brickwall) | Rude in match 1, clearly improves by match 4 (rehabilitation) | Rude: m01-008, m01-017, m01-024. Transition: m02-005, m02-014. Improved: m03-014, m03-024, m04-001, m04-011, m04-016, m04-026 |
| H | p8 (Echo) | Prompt injection posted in chat | m02-008, m04-004 |
