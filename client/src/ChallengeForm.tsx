import { useState, type FormEvent } from "react";
import { api, CHALLENGE_REASONS, MAX_NOTE_CHARS } from "./api";
import { copy } from "./copy";

interface Props {
  playerId: string;
  dimension: string;
  matchId: string;
  onDone: () => void;
  onCancel: () => void;
}

export function ChallengeForm({ playerId, dimension, matchId, onDone, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `${dimension}-${matchId}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError(copy.challenge.needReason);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.challenge({ playerId, dimension, matchId, reason, note: note.trim() || undefined });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="challenge-form" onSubmit={submit}>
      <h4>{copy.challenge.heading}</h4>
      <label htmlFor={`reason-${id}`}>{copy.challenge.reasonLabel}</label>
      <select id={`reason-${id}`} value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">{copy.challenge.reasonPlaceholder}</option>
        {CHALLENGE_REASONS.map((r) => (
          <option key={r} value={r}>
            {copy.challenge.reasons[r]}
          </option>
        ))}
      </select>
      <label htmlFor={`note-${id}`}>{copy.challenge.noteLabel}</label>
      <textarea
        id={`note-${id}`}
        rows={3}
        maxLength={MAX_NOTE_CHARS}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="counter">{copy.challenge.counter(note.length, MAX_NOTE_CHARS)}</div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? copy.challenge.sending : copy.challenge.submit}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          {copy.challenge.cancel}
        </button>
      </div>
    </form>
  );
}
