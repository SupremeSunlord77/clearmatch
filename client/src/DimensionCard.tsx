import { useState } from "react";
import type { DimensionView, LoweringMatch } from "./api";
import { ChallengeForm } from "./ChallengeForm";
import { copy } from "./copy";

function Summary({ d }: { d: DimensionView }) {
  return (
    <span className="summary">
      <strong>{copy.dimensions[d.dimension]}</strong>
      {d.score === null ? (
        <span>{copy.profile.noScore}</span>
      ) : (
        <>
          <span>{copy.common.outOf5(d.score)}</span>
          <span className={`band band-${d.band}`}>{copy.bands[d.band!]}</span>
        </>
      )}
      <span className="trend">{copy.trend[d.trend]}</span>
    </span>
  );
}

function Lowering({ m, playerId, dimension, onChanged }: { m: LoweringMatch; playerId: string; dimension: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const status = m.review?.status;
  return (
    <li className={`lowering ${m.counted ? "" : "not-counted"}`}>
      <div className="lowering-head">
        <span>{copy.profile.matchLabel(m.matchNumber, m.date)}</span>
        <span>{copy.profile.matchScore(m.score)}</span>
        {status && <span className={`badge badge-${status}`}>{copy.reviewState[status]}</span>}
      </div>
      {status === "upheld" && m.review?.reviewerComment && (
        <p className="reviewer-comment">
          <strong>{copy.reviewState.reviewerComment}:</strong> {m.review.reviewerComment}
        </p>
      )}
      <p className="small-heading">{copy.profile.evidenceHeading}</p>
      {m.evidence.length === 0 ? (
        <p>{copy.profile.noEvidence}</p>
      ) : (
        <ul className="evidence">
          {m.evidence.map((e) => (
            <li key={e.messageId}>
              <span className="meta">{copy.profile.evidenceLine(e.speakerName, m.matchNumber, copy.common.time(e.timestamp))}</span>
              <q>{e.text}</q>
            </li>
          ))}
        </ul>
      )}
      {m.aiSummary && (
        <p className="ai-summary">
          <strong>{copy.profile.aiSummaryLabel}:</strong> {m.aiSummary}
        </p>
      )}
      {m.canChallenge &&
        (open ? (
          <ChallengeForm
            playerId={playerId}
            dimension={dimension}
            matchId={m.matchId}
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false);
              onChanged();
            }}
          />
        ) : (
          <button type="button" onClick={() => setOpen(true)}>
            {copy.challenge.button}
          </button>
        ))}
    </li>
  );
}

export function DimensionCard({ d, playerId, onChanged }: { d: DimensionView; playerId: string; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(d.expanded);
  return (
    <section className="card">
      <div className="card-head">
        <Summary d={d} />
        <button type="button" className="link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? copy.profile.hideDetails : copy.profile.showDetails}
        </button>
      </div>
      {expanded && (
        <div className="card-body">
          {d.improvingAck && <p className="ack">{copy.profile.improvingAck}</p>}
          <h3>{copy.profile.loweringHeading}</h3>
          {d.loweringMatches.length === 0 ? (
            <p>{copy.profile.noLowering}</p>
          ) : (
            <ul className="lowering-list">
              {d.loweringMatches.map((m) => (
                <Lowering key={m.matchId} m={m} playerId={playerId} dimension={d.dimension} onChanged={onChanged} />
              ))}
            </ul>
          )}
          {d.underReviewCount > 0 && <p className="note">{copy.profile.underReview(d.underReviewCount)}</p>}
          {d.tips.length > 0 && (
            <>
              <h3>{copy.profile.tipsHeading}</h3>
              <ul>
                {d.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
