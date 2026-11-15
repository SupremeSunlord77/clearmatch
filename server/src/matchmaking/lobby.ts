// Behaviour-aware lobby (M1–M4). Deterministic, computed in code; the LLM is never involved.
//
// M1: the lobby is the next match for all 8 players, two teams of 4. With 8 players,
//     "matching" means choosing the team split.
// M9: each dimension has ONE role.
//   - Respect decides grouping (protection): constraint (3) spreads Low-Respect players.
//   - Teamwork decides balance (fairness): the chosen split minimises the Teamwork gap (M3c).
//   - Communication is NOT used: in current results it overlaps with Respect and would punish
//     the same messages twice. Chat restriction is planned instead. LobbyPlayer has no
//     Communication field on purpose.

export type RespectBand = "low" | "neutral" | "good";

export interface LobbyPlayer {
  id: string;
  displayName: string;
  partyGroup: string | null;
  respectBand: RespectBand; // M3e: no counted Respect score → "neutral"
  teamwork: number; // counted Teamwork score (see inputs.ts for players with none)
}

/** One mute or report in the last 4 matches: `by` muted or reported `target`. */
export interface Separation {
  by: string;
  target: string;
}

/** Constraints that may be relaxed, in relaxation order (M3d). Party (1) is never relaxed. */
export type RelaxableConstraint = "low_respect_per_team" | "reported_apart";
export const RELAXATION_ORDER: RelaxableConstraint[] = ["low_respect_per_team", "reported_apart"];

export interface Split {
  A: string[]; // the team holding the alphabetically first player id; both teams sorted
  B: string[];
}

export interface LobbyResult {
  teams: Split;
  relaxed: RelaxableConstraint[];
}

export type ReasonCode =
  | "party_together"
  | "protected_from_reports"
  | "kept_apart_from_targets"
  | "low_respect_spread"
  | "own_respect_low"
  | "balanced_teamwork"
  | "constraint_relaxed";

const MAX_LOW_PER_TEAM = 1;
const EPSILON = 1e-9;

/** M3a: every distinct split of the players into two equal teams (35 for 8 players), each exactly once. */
export function enumerateSplits(ids: string[]): Split[] {
  const sorted = [...ids].sort();
  if (sorted.length % 2 !== 0) throw new Error("need an even number of players");
  const size = sorted.length / 2;
  const [first, ...rest] = sorted;
  const splits: Split[] = [];
  // Fixing the first player in team A avoids counting each split twice (A/B swapped).
  const choose = (start: number, picked: string[]) => {
    if (picked.length === size - 1) {
      const A = [first, ...picked];
      splits.push({ A, B: sorted.filter((id) => !A.includes(id)) });
      return;
    }
    for (let i = start; i < rest.length; i++) choose(i + 1, [...picked, rest[i]]);
  };
  choose(0, []);
  return splits;
}

const sameTeam = (split: Split, a: string, b: string) => split.A.includes(a) === split.A.includes(b);

const inSameParty = (players: Map<string, LobbyPlayer>, a: string, b: string) => {
  const pa = players.get(a)?.partyGroup;
  return pa != null && pa === players.get(b)?.partyGroup;
};

/**
 * M3b(2) pairs to keep apart. EXCEPTION: a past mute or report between two players who are in the
 * same party NOW does not apply. They chose to play together. This is not a relaxation.
 */
export function activeSeparations(players: LobbyPlayer[], separations: Separation[]): Separation[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return separations.filter((s) => byId.has(s.by) && byId.has(s.target) && s.by !== s.target && !inSameParty(byId, s.by, s.target));
}

/** (1) Party members are on the same team. Never relaxed. */
function partyOk(split: Split, players: LobbyPlayer[]): boolean {
  const byId = new Map(players.map((p) => [p.id, p]));
  return players.every((p) => players.every((q) => !inSameParty(byId, p.id, q.id) || sameTeam(split, p.id, q.id)));
}

/** (2) Nobody shares a team with someone they muted or reported (protects targets). */
function reportedApartOk(split: Split, seps: Separation[]): boolean {
  return seps.every((s) => !sameTeam(split, s.by, s.target));
}

/**
 * (3) At most one Low-Respect player per team. Spreading Low-Respect players avoids "toxic teams"
 * and echo chambers; concentrating them would need a much larger player pool. A deliberate trade-off.
 */
function lowRespectOk(split: Split, players: LobbyPlayer[]): boolean {
  const low = (team: string[]) => team.filter((id) => players.find((p) => p.id === id)?.respectBand === "low").length;
  return low(split.A) <= MAX_LOW_PER_TEAM && low(split.B) <= MAX_LOW_PER_TEAM;
}

export function teamworkGap(split: Split, players: LobbyPlayer[]): number {
  const avg = (team: string[]) => team.reduce((a, id) => a + (players.find((p) => p.id === id)?.teamwork ?? 0), 0) / team.length;
  return Math.abs(avg(split.A) - avg(split.B));
}

const splitKey = (s: Split) => s.A.join(",");

/** M3c: smallest Teamwork gap; tie-break: lowest lexicographic split (repeatable). */
function best(splits: Split[], players: LobbyPlayer[]): Split {
  return [...splits].sort((x, y) => {
    const d = teamworkGap(x, players) - teamworkGap(y, players);
    if (Math.abs(d) > EPSILON) return d;
    return splitKey(x).localeCompare(splitKey(y));
  })[0];
}

/** M3: choose the split. Relax (3) first, then also (2), and record what was relaxed. */
export function computeLobby(players: LobbyPlayer[], separations: Separation[]): LobbyResult {
  const seps = activeSeparations(players, separations);
  const all = enumerateSplits(players.map((p) => p.id)).filter((s) => partyOk(s, players));
  if (all.length === 0) throw new Error("no split keeps every party together (a party is larger than a team)");

  for (let n = 0; n <= RELAXATION_ORDER.length; n++) {
    const relaxed = RELAXATION_ORDER.slice(0, n);
    const valid = all.filter(
      (s) =>
        (relaxed.includes("reported_apart") || reportedApartOk(s, seps)) &&
        (relaxed.includes("low_respect_per_team") || lowRespectOk(s, players))
    );
    if (valid.length > 0) return { teams: best(valid, players), relaxed };
  }
  throw new Error("unreachable: with every relaxable constraint relaxed, a party-valid split exists");
}

/**
 * M4: reasons for ONE viewing player, as codes. Each reason states a fact about the chosen lobby
 * from the viewer's own position. Reasons never name or score other players (party members are the
 * viewer's own and are shown separately).
 */
export function reasonsFor(viewerId: string, lobby: LobbyResult, players: LobbyPlayer[], separations: Separation[]): ReasonCode[] {
  const viewer = players.find((p) => p.id === viewerId);
  if (!viewer) return [];
  const seps = activeSeparations(players, separations); // ignores current party members (M3b(2))
  const t = lobby.teams;
  const reasons: ReasonCode[] = [];

  const party = players.filter((p) => p.id !== viewerId && viewer.partyGroup != null && p.partyGroup === viewer.partyGroup);
  if (party.length > 0 && party.every((p) => sameTeam(t, viewerId, p.id))) reasons.push("party_together");

  const targets = [...new Set(seps.filter((s) => s.by === viewerId).map((s) => s.target))];
  if (targets.length > 0 && targets.every((id) => !sameTeam(t, viewerId, id))) reasons.push("protected_from_reports");

  const reporters = [...new Set(seps.filter((s) => s.target === viewerId).map((s) => s.by))];
  if (reporters.length > 0 && reporters.every((id) => !sameTeam(t, viewerId, id))) reasons.push("kept_apart_from_targets");

  // About the VIEWER's own Respect only. If (3) held, teams were arranged to spread Low-Respect players;
  // if (3) had to be relaxed, the viewer is still told their own Respect is Low (wording in copy.ts).
  if (viewer.respectBand === "low") {
    reasons.push(lobby.relaxed.includes("low_respect_per_team") ? "own_respect_low" : "low_respect_spread");
  }

  reasons.push("balanced_teamwork");
  if (lobby.relaxed.length > 0) reasons.push("constraint_relaxed");
  return reasons;
}
