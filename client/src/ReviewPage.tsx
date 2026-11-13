import { useCallback, useEffect, useState } from "react";
import { api, MAX_COMMENT_CHARS, type EvidenceLine, type ReviewItem } from "./api";
import { copy } from "./copy";
import { DemoBar } from "./DemoBar";

function Line({ l, isEvidence }: { l: EvidenceLine; isEvidence: boolean }) {
  return (
    <li className={isEvidence ? "context-line evidence-line" : "context-line"}>
      {isEvidence && <strong className="marker">{copy.review.evidenceMarker} </strong>}
      <span className="meta">
        {l.speakerName} · {copy.common.time(l.timestamp)}
      </span>{" "}
      <q>{l.text}</q>
    </li>
  );
}

function ReviewCard({ item, onDecided }: { item: ReviewItem; onDecided: () => void }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "upheld" | "overturned") {
    setBusy(true);
    setError(null);
    try {
      await api.decide(item.id, decision, comment.trim() || undefined);
      onDecided();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <dl className="facts">
        <dt>{copy.review.player}</dt>
        <dd>
          {item.playerName} ({item.playerId})
        </dd>
        <dt>{copy.review.dimension}</dt>
        <dd>{copy.dimensions[item.dimension]}</dd>
        <dt>{copy.review.match}</dt>
        <dd>
          {item.matchId} {item.matchDate && `(${item.matchDate})`}
        </dd>
        <dt>{copy.review.aiProposal}</dt>
        <dd>{copy.review.proposalValue(item.proposal?.score ?? null, item.proposal?.confidence ?? null)}</dd>
        <dt>{copy.review.aiSummary}</dt>
        <dd>{item.proposal?.aiSummary ?? copy.review.none}</dd>
        <dt>{copy.review.playerReason}</dt>
        <dd>{copy.challenge.reasons[item.reason] ?? item.reason}</dd>
        <dt>{copy.review.playerNote}</dt>
        <dd>{item.note ?? copy.review.noNote}</dd>
      </dl>

      <h3>{copy.review.evidenceHeading}</h3>
      {item.evidence.map((e) => (
        <ol key={e.line.messageId} className="context">
          {e.before.map((l) => (
            <Line key={l.messageId} l={l} isEvidence={false} />
          ))}
          <Line l={e.line} isEvidence />
          {e.after.map((l) => (
            <Line key={l.messageId} l={l} isEvidence={false} />
          ))}
        </ol>
      ))}

      <label htmlFor={`comment-${item.id}`}>{copy.review.commentLabel}</label>
      <textarea
        id={`comment-${item.id}`}
        rows={2}
        maxLength={MAX_COMMENT_CHARS}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="counter">{copy.challenge.counter(comment.length, MAX_COMMENT_CHARS)}</div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => decide("upheld")}>
          {busy ? copy.review.deciding : copy.review.uphold}
        </button>
        <button type="button" disabled={busy} onClick={() => decide("overturned")}>
          {busy ? copy.review.deciding : copy.review.overturn}
        </button>
        <a href={`/?player=${item.playerId}`}>{copy.demo.backToProfile}</a>
      </div>
    </section>
  );
}

export function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .pending()
      .then((x) => {
        setItems(x);
        setError(null);
      })
      .catch(() => setError(copy.common.loadError));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <DemoBar onReset={load}>
        <a href="/">{copy.demo.backToProfile}</a>
      </DemoBar>
      <main>
        <h1>{copy.review.title}</h1>
        <p>{copy.review.intro}</p>
        {error && <p className="error">{error}</p>}
        {items === null && !error && <p>{copy.common.loading}</p>}
        {items?.length === 0 && <p>{copy.review.empty}</p>}
        {items?.map((item) => (
          <ReviewCard key={item.id} item={item} onDecided={load} />
        ))}
      </main>
    </>
  );
}
