// Scores one match: build prompt → call provider (with retry) → validate.
import type { MatchData, PlayerInfo } from "../data.js";
import type { LlmProvider } from "../llm/provider.js";
import { describeProviderError, withRetry, type RetryOptions } from "../llm/retry.js";
import { buildScoringPrompt } from "./prompt.js";
import type { MatchValidationResult } from "./types.js";
import { rejectAll, validateResponse } from "./validate.js";

export type MatchLogEntry = MatchValidationResult & { rawResponse: string | null };

export async function scoreOneMatch(
  provider: LlmProvider,
  match: MatchData,
  players: PlayerInfo[],
  retry: RetryOptions = {}
): Promise<MatchLogEntry> {
  const prompt = buildScoringPrompt(match, players);
  let raw: string;
  try {
    raw = await withRetry(() => provider.scoreMatch({ matchId: match.id, prompt }), { label: match.id, ...retry });
  } catch (err) {
    // The call failed, so there is no model output to validate: the whole match goes to review.
    const reason = `provider call failed: ${describeProviderError(err, retry.secrets)}`;
    return { ...rejectAll(match, reason), rawResponse: null };
  }
  return { ...validateResponse(raw, match), rawResponse: raw };
}
