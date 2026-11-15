import { useCallback, useEffect, useState } from "react";
import { api, type Lobby, type LobbyMember } from "./api";
import { copy } from "./copy";
import { DemoBar } from "./DemoBar";

function Team({ name, members, yours }: { name: "A" | "B"; members: LobbyMember[]; yours: boolean }) {
  return (
    <section className={`card team ${yours ? "team-yours" : ""}`}>
      <h2>{copy.lobby.team(name)}</h2>
      <ul>
        {members.map((m) => (
          <li key={m.displayName}>
            {m.you ? <strong>{m.displayName}</strong> : m.displayName}
            {m.you && <span className="marker"> {copy.lobby.you}</span>}
            {m.yourParty && <span className="marker"> {copy.lobby.yourParty}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** M4–M6: the viewer's next match, recomputed from current profiles on every load. */
export function LobbyPage() {
  const playerId = new URLSearchParams(location.search).get("player") ?? "p2";
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .lobby(playerId)
      .then((l) => {
        setLobby(l);
        setError(null);
      })
      .catch(() => setError(copy.common.loadError));
  }, [playerId]);

  useEffect(load, [load]);

  const profileHref = `/?player=${encodeURIComponent(playerId)}`;

  return (
    <>
      <DemoBar onChanged={load}>
        <a href="/review">{copy.demo.openReviewer}</a>
      </DemoBar>
      <main>
        <h1>{copy.lobby.title}</h1>
        <p className="private">{copy.lobby.privateNote}</p>
        {error && <p className="error">{error}</p>}
        {!lobby && !error && <p>{copy.common.loading}</p>}
        {lobby && (
          <>
            <div className="teams">
              <Team name="A" members={lobby.teams.A} yours={lobby.yourTeam === "A"} />
              <Team name="B" members={lobby.teams.B} yours={lobby.yourTeam === "B"} />
            </div>
            <h2>{copy.lobby.whyHeading}</h2>
            <ul className="reasons">
              {lobby.reasons.map((r) => (
                <li key={r}>
                  {r === "party_together" ? copy.lobby.reasons.party_together(lobby.partyMemberNames) : copy.lobby.reasons[r]}
                </li>
              ))}
            </ul>
            <p className="note">{copy.lobby.changeNote}</p>
          </>
        )}
        <p>
          <a href={profileHref}>{copy.demo.backToProfile}</a>
        </p>
      </main>
    </>
  );
}
