// Retries provider calls on temporary errors, and turns errors into short, key-free reasons.

/** Waits before each retry. One first call + one retry per entry. */
export const RETRY_DELAYS_MS = [2000, 4000, 8000];

const TEMPORARY_STATUS = new Set([429, 503]);
const TIMEOUT_CODES = new Set([
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

type ErrorLike = { status?: unknown; code?: unknown; name?: unknown; message?: unknown; cause?: unknown };

const statusOf = (err: unknown): number | null => {
  const s = (err as ErrorLike)?.status;
  return typeof s === "number" ? s : null;
};

function isNetworkTimeout(err: unknown): boolean {
  const e = err as ErrorLike;
  if (e?.name === "TimeoutError") return true;
  for (const x of [e, e?.cause as ErrorLike]) {
    if (typeof x?.code === "string" && TIMEOUT_CODES.has(x.code)) return true;
  }
  return false;
}

/** 503, 429 or a network timeout. Everything else fails at once. */
export function isTemporaryError(err: unknown): boolean {
  const status = statusOf(err);
  return (status !== null && TEMPORARY_STATUS.has(status)) || isNetworkTimeout(err);
}

/** "<status> <short message>", with any secret removed. */
export function describeProviderError(err: unknown, secrets: string[] = []): string {
  const e = err as ErrorLike;
  let message = typeof e?.message === "string" ? e.message : String(err);
  // Gemini puts a JSON body in the message: {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}
  try {
    const body = JSON.parse(message);
    if (typeof body?.error?.message === "string") message = body.error.message;
  } catch {
    /* plain-text message */
  }
  const code = typeof (e?.cause as ErrorLike)?.code === "string" ? (e.cause as ErrorLike).code : e?.code;
  const label = statusOf(err) ?? (typeof code === "string" ? code : (typeof e?.name === "string" ? e.name : "error"));
  for (const s of secrets) if (s) message = message.split(s).join("[redacted]");
  message = message.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]").replace(/\s+/g, " ").trim();
  if (message.length > 160) message = message.slice(0, 157) + "...";
  return `${label} ${message}`;
}

export interface RetryOptions {
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  label?: string;
  secrets?: string[];
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? realSleep;
  const log = opts.log ?? console.log;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= delays.length || !isTemporaryError(err)) throw err;
      const wait = delays[attempt];
      log(
        `  ${opts.label ?? "provider"}: temporary error (${describeProviderError(err, opts.secrets)}); ` +
          `retry ${attempt + 1}/${delays.length} in ${wait / 1000}s`
      );
      await sleep(wait);
    }
  }
}
