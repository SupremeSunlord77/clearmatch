import { useCallback, useEffect, useState } from "react";
import { api, type Player, type Profile } from "./api";
import { copy } from "./copy";
import { DemoBar } from "./DemoBar";
import { DimensionCard } from "./DimensionCard";

const DEFAULT_PLAYER = "p2"; // shows the low-score path first

export function ProfilePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState(() => new URLSearchParams(location.search).get("player") ?? DEFAULT_PLAYER);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.players().then(setPlayers).catch(() => setError(copy.common.loadError));
  }, []);

  const load = useCallback(() => {
    api
      .profile(playerId)
      .then((p) => {
        setProfile(p);
        setError(null);
      })
      .catch(() => setError(copy.common.loadError));
  }, [playerId]);

  useEffect(() => {
    load();
    history.replaceState(null, "", `/?player=${playerId}`);
  }, [load, playerId]);

  return (
    <>
      <DemoBar onReset={load}>
        <label>
          {copy.demo.switchPlayer}{" "}
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.id})
              </option>
            ))}
          </select>
        </label>
        <a href="/review">{copy.demo.openReviewer}</a>
      </DemoBar>

      <main>
        {error && <p className="error">{error}</p>}
        {!profile && !error && <p>{copy.common.loading}</p>}
        {profile && (
          <>
            <header className="profile-head">
              <h1>{copy.profile.title(profile.displayName)}</h1>
              <p className="private">{copy.profile.privateNote}</p>
            </header>
            {profile.dimensions.map((d) => (
              <DimensionCard key={`${profile.playerId}-${d.dimension}`} d={d} playerId={profile.playerId} onChanged={load} />
            ))}
            <details className="how">
              <summary>{copy.howItWorks.heading}</summary>
              <p>{profile.howItWorks}</p>
              <ul>
                {copy.howItWorks.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          </>
        )}
      </main>
    </>
  );
}
