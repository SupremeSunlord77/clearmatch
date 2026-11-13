import { ApiError } from "@google/genai";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadMatches, loadPlayers } from "../src/data.js";
import type { LlmProvider } from "../src/llm/provider.js";
import { describeProviderError, isTemporaryError, RETRY_DELAYS_MS, withRetry } from "../src/llm/retry.js";
import { scoreOneMatch } from "../src/scoring/pipeline.js";

// Errors shaped like the real ones: the Gemini SDK's ApiError, and Node fetch timeouts.
const gemini = (status: number, message: string, statusText = "UNAVAILABLE") =>
  new ApiError({ status, message: JSON.stringify({ error: { code: status, message, status: statusText } }) });
const e503 = () => gemini(503, "This model is currently experiencing high demand.");
const e429 = () => gemini(429, "Resource has been exhausted.", "RESOURCE_EXHAUSTED");
const e400 = () => gemini(400, "Invalid argument.", "INVALID_ARGUMENT");
const timeout = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });

/** Fails with the given errors in order, then returns "ok". Records sleeps and log lines. */
function harness(errors: Error[]) {
  let calls = 0;
  const sleeps: number[] = [];
  const logs: string[] = [];
  const fn = async () => {
    calls++;
    if (calls <= errors.length) throw errors[calls - 1];
    return "ok";
  };
  const opts = { sleep: async (ms: number) => void sleeps.push(ms), log: (l: string) => void logs.push(l), label: "match_01" };
  return { fn, opts, sleeps, logs, calls: () => calls };
}

describe("retry on temporary errors", () => {
  test("delays are 2, 4 and 8 seconds", () => {
    assert.deepEqual(RETRY_DELAYS_MS, [2000, 4000, 8000]);
  });

  test("503, 429 and network timeouts are temporary; 400 and plain errors are not", () => {
    assert.equal(isTemporaryError(e503()), true);
    assert.equal(isTemporaryError(e429()), true);
    assert.equal(isTemporaryError(timeout()), true);
    assert.equal(isTemporaryError(Object.assign(new Error("x"), { name: "TimeoutError" })), true);
    assert.equal(isTemporaryError(e400()), false);
    assert.equal(isTemporaryError(new Error("boom")), false);
  });

  test("503 then success: one retry after 2 s, logged", async () => {
    const h = harness([e503()]);
    assert.equal(await withRetry(h.fn, h.opts), "ok");
    assert.equal(h.calls(), 2);
    assert.deepEqual(h.sleeps, [2000]);
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0], /match_01: temporary error \(503 This model is currently experiencing high demand\.\); retry 1\/3 in 2s/);
  });

  test("429 and timeout are retried with increasing waits", async () => {
    const h = harness([e429(), timeout()]);
    assert.equal(await withRetry(h.fn, h.opts), "ok");
    assert.deepEqual(h.sleeps, [2000, 4000]);
    assert.equal(h.logs.length, 2);
    assert.match(h.logs[1], /UND_ERR_CONNECT_TIMEOUT.*retry 2\/3 in 4s/);
  });

  test("gives up after the last wait and throws the last error", async () => {
    const h = harness([e503(), e503(), e503(), e503(), e503()]);
    await assert.rejects(withRetry(h.fn, h.opts), (err: unknown) => (err as ApiError).status === 503);
    assert.equal(h.calls(), 4); // first call + 3 retries
    assert.deepEqual(h.sleeps, [2000, 4000, 8000]);
    assert.equal(h.logs.length, 3);
  });

  test("no retry on other errors (400)", async () => {
    const h = harness([e400()]);
    await assert.rejects(withRetry(h.fn, h.opts), (err: unknown) => (err as ApiError).status === 400);
    assert.equal(h.calls(), 1);
    assert.deepEqual(h.sleeps, []);
    assert.deepEqual(h.logs, []);
  });
});

describe("provider failure reason", () => {
  const match = loadMatches().find((m) => m.id === "match_01")!;
  const players = loadPlayers();
  // Fake, key-shaped value built at runtime so no key-like string appears in the source.
  const FAKE_KEY = ["AI", "za", "FAKE".repeat(9)].join("");
  const failing = (err: Error): LlmProvider => ({ name: "test", model: null, scoreMatch: async () => { throw err; } });
  const quiet = { sleep: async () => {}, log: () => {}, secrets: [FAKE_KEY] };

  test("describes status and short message, not the raw JSON body", () => {
    assert.equal(describeProviderError(e503()), "503 This model is currently experiencing high demand.");
    assert.equal(describeProviderError(timeout()), "UND_ERR_CONNECT_TIMEOUT fetch failed");
  });

  test("never includes the key", () => {
    const leaky = gemini(400, `API key ${FAKE_KEY} not valid.`, "INVALID_ARGUMENT");
    const text = describeProviderError(leaky, [FAKE_KEY]);
    assert.ok(!text.includes(FAKE_KEY));
    assert.equal(text, "400 API key [redacted] not valid.");
    // Gemini-style keys are removed even if the caller forgets to pass the secret.
    assert.ok(!describeProviderError(leaky).includes(FAKE_KEY));
  });

  test("failed call → whole match needs_review with 'provider call failed' reason", async () => {
    const r = await scoreOneMatch(failing(e503()), match, players, quiet);
    const reason = "provider call failed: 503 This model is currently experiencing high demand.";
    assert.equal(r.responseRejected, true);
    assert.equal(r.responseReason, reason);
    assert.equal(r.rawResponse, null);
    assert.equal(r.dimensions.length, 24);
    assert.ok(r.dimensions.every((d) => d.status === "needs_review" && d.reasons[0] === reason));
    assert.ok(!JSON.stringify(r).includes("not valid JSON"));
  });

  test("key in a failed call's error never reaches the log entry", async () => {
    const r = await scoreOneMatch(failing(gemini(403, `Key ${FAKE_KEY} denied.`, "PERMISSION_DENIED")), match, players, quiet);
    assert.equal(r.responseReason, "provider call failed: 403 Key [redacted] denied.");
    assert.ok(!JSON.stringify(r).includes(FAKE_KEY));
  });

  test("temporary error then success → response is validated normally", async () => {
    let n = 0;
    const flaky: LlmProvider = {
      name: "test",
      model: null,
      scoreMatch: async () => {
        if (n++ === 0) throw e503();
        return JSON.stringify({ matchId: "match_02", players: [] }); // valid JSON, wrong match
      },
    };
    const r = await scoreOneMatch(flaky, match, players, quiet);
    assert.equal(n, 2);
    assert.equal(r.responseReason, "matchId mismatch: got match_02, expected match_01");
  });
});
