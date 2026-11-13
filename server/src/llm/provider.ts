// A provider takes one match's prompt and returns the model's raw text.
// The text is NOT trusted: the validator always checks it.

export interface ScoringRequest {
  matchId: string;
  prompt: string;
}

export interface LlmProvider {
  name: string;
  model: string | null;
  scoreMatch(req: ScoringRequest): Promise<string>;
}
