// ALL user-facing wording lives here (D9). Edit freely; keep a neutral, non-shaming tone.
// Meaning is never shown by colour alone: every state has a text label below.

export const copy = {
  appName: "ClearMatch",

  demo: {
    label: "Demo control",
    switchPlayer: "View profile of",
    openReviewer: "Open simulated reviewer",
    backToProfile: "Back to profile",
    reset: "Reset demo",
    resetting: "Resetting…",
    resetDone: (n: number) => `Demo reset: ${n} challenge${n === 1 ? "" : "s"} cleared.`,
  },

  common: {
    loading: "Loading…",
    loadError: "Something went wrong while loading. Please try again.",
    outOf5: (score: number) => `${score.toFixed(1)} out of 5`,
    time: (iso: string) => iso.slice(11, 16), // HH:MM from the match log
  },

  profile: {
    title: (name: string) => `${name}'s behaviour profile`,
    privateNote: "Private — only you can see this profile",
    noScore: "No counted score yet",
    showDetails: "Show details",
    hideDetails: "Hide details",
    loweringHeading: "Matches that lowered this score",
    noLowering: "No match lowered this score.",
    matchLabel: (n: number, date: string) => `Match ${n} (${date})`,
    matchScore: (score: number) => `Match score: ${score} out of 5`,
    evidenceHeading: "What was said (exact chat lines)",
    evidenceLine: (speaker: string, matchNumber: number, time: string) => `${speaker} · Match ${matchNumber} · ${time}`,
    noEvidence: "No chat lines were recorded for this score.",
    aiSummaryLabel: "AI summary",
    underReview: (n: number) =>
      n === 1
        ? "1 match score is with a person for review and is not counted yet."
        : `${n} match scores are with a person for review and are not counted yet.`,
    tipsHeading: "Ideas to try",
    improvingAck: "Your recent matches show improvement here. Nice work.",
  },

  dimensions: {
    respect: "Respect",
    teamwork: "Teamwork",
    communication: "Communication",
  } as Record<string, string>,

  bands: {
    low: "Low",
    neutral: "Neutral",
    good: "Good",
  } as Record<string, string>,

  trend: {
    improving: "Improving",
    stable: "Stable",
    declining: "Declining",
    not_enough_data: "Not enough data",
  } as Record<string, string>,

  reviewState: {
    pending: "Challenged — under review",
    upheld: "Upheld on review",
    overturned: "Overturned on review — this match no longer counts",
    reviewerComment: "Reviewer's comment",
  } as Record<string, string>,

  challenge: {
    button: "Challenge this score",
    heading: "Challenge this match score",
    reasonLabel: "Why do you think this score is wrong?",
    reasonPlaceholder: "Choose a reason",
    reasons: {
      misread_banter: "It was friendly banter that was misread",
      game_language: "It was game language, not abuse",
      missing_context: "Important context is missing",
      not_me: "This wasn't me",
      other: "Something else",
    } as Record<string, string>,
    noteLabel: "Anything else the reviewer should know? (optional)",
    counter: (n: number, max: number) => `${n} / ${max} characters`,
    submit: "Submit challenge",
    sending: "Sending…",
    cancel: "Cancel",
    needReason: "Please choose a reason.",
  },

  howItWorks: {
    heading: "How your profile is worked out",
    points: [
      "We look at your chat across your last 4 matches.",
      "Recent matches count more than older ones.",
      "When the AI is unsure, a person checks before anything counts.",
      "If a match gave you a low score, you can challenge it and a person will review it.",
    ],
  },

  review: {
    title: "Simulated reviewer — Demo control",
    intro: "Pending challenges from players. Read the evidence in context, then uphold or overturn the match score.",
    empty: "No challenges are waiting for review.",
    player: "Player",
    dimension: "Dimension",
    match: "Match",
    aiProposal: "AI's proposed score",
    proposalValue: (score: number | null, confidence: number | null) =>
      `${score ?? "none"} out of 5, confidence ${confidence === null ? "unknown" : confidence.toFixed(2)}`,
    none: "none",
    aiSummary: "AI summary",
    evidenceHeading: "Evidence lines with 2 messages before and after",
    evidenceMarker: "▶ EVIDENCE",
    playerReason: "Player's reason",
    playerNote: "Player's note",
    noNote: "(no note)",
    commentLabel: "Comment for the player (optional)",
    uphold: "Uphold score",
    overturn: "Overturn score",
    deciding: "Saving…",
  },
};
