// M2 and M6: lobby inputs come from the SAME counted profile data as the profile page, so overturned
// challenges and demo overrides are respected. Recomputed on every request, never cached.
import type { MatchData, PlayerInfo } from "../data.js";
import { overturnedExclusions } from "../profile/build.js";
import type { Challenge } from "../profile/challenges.js";
import { bandFor } from "../profile/guidance.js";
import { buildProfiles } from "../scoring/aggregate.js";
import { toValidationResults, type MatchResultsFile } from "../scoring/results.js";
import { computeLobby, reasonsFor, type LobbyPlayer, type ReasonCode, type Separation } from "./lobby.js";

/** Teamwork used for balance when a player has no counted Teamwork score (mid-scale, like M3e). */
export const NEUTRAL_TEAMWORK = 3;
const RECENT_MATCHES = 4;

export interface LobbyDeps {
  players: PlayerInfo[];
  matches: MatchData[];
  results: MatchResultsFile; // with any demo overrides already applied
  challenges: Challenge[];
}

/** Counted Respect band and Teamwork score per player. Communication is deliberately not read (M9). */
export function lobbyPlayers(d: LobbyDeps): LobbyPlayer[] {
  const profiles = buildProfiles(d.players, d.matches, toValidationResults(d.results), overturnedExclusions(d.challenges));
  return d.players.map((p) => {
    const prof = profiles.find((x) => x.playerId === p.id)!;
    return {
      id: p.id,
      displayName: p.displayName,
      partyGroup: p.partyGroup,
      respectBand: prof.respect.score === null ? "neutral" : bandFor(prof.respect.score),
      teamwork: prof.teamwork.score ?? NEUTRAL_TEAMWORK,
    };
  });
}

/** Mutes and reports from the last 4 matches (who muted or reported whom). */
export function recentSeparations(matches: MatchData[]): Separation[] {
  return [...matches]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-RECENT_MATCHES)
    .flatMap((m) => m.events)
    .filter((e) => e.type === "mute" || e.type === "report")
    .map((e) => ({ by: e.byPlayerId, target: e.targetPlayerId }));
}

export interface LobbyMember {
  displayName: string;
  you: boolean;
  yourParty: boolean; // only the viewer's own party members are marked
}

/** What one player sees (M4, M5): names only, their own reasons, nothing about anyone else's scores or reports. */
export interface LobbyView {
  playerId: string;
  yourTeam: "A" | "B";
  teams: { A: LobbyMember[]; B: LobbyMember[] };
  reasons: ReasonCode[];
  partyMemberNames: string[]; // viewer's own party members, for the "party_together" reason
}

export function buildLobbyView(viewerId: string, d: LobbyDeps): LobbyView | null {
  const viewer = d.players.find((p) => p.id === viewerId);
  if (!viewer) return null;
  const players = lobbyPlayers(d);
  const separations = recentSeparations(d.matches);
  const lobby = computeLobby(players, separations);

  const isParty = (id: string) => id !== viewerId && viewer.partyGroup != null && d.players.find((p) => p.id === id)?.partyGroup === viewer.partyGroup;
  const member = (id: string): LobbyMember => ({
    displayName: d.players.find((p) => p.id === id)!.displayName,
    you: id === viewerId,
    yourParty: isParty(id),
  });

  return {
    playerId: viewerId,
    yourTeam: lobby.teams.A.includes(viewerId) ? "A" : "B",
    teams: { A: lobby.teams.A.map(member), B: lobby.teams.B.map(member) },
    reasons: reasonsFor(viewerId, lobby, players, separations),
    partyMemberNames: d.players.filter((p) => isParty(p.id)).map((p) => p.displayName),
  };
}
