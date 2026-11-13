// Reads LLM settings from the repo's .env (if present). Never prints key values.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./data.js";

export type ProviderName = "mock" | "gemini";

export interface LlmConfig {
  provider: ProviderName;
  model: string | null; // from LLM_MODEL only; never hardcoded
  apiKey: string | null;
}

/** Returns the config, or an error message explaining what is missing. */
export function loadLlmConfig(): LlmConfig | { error: string } {
  const envPath = path.join(REPO_ROOT, ".env");
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

  const provider = (process.env.LLM_PROVIDER || "mock").trim().toLowerCase();
  if (provider === "mock") return { provider: "mock", model: null, apiKey: null };

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || null;
    const model = process.env.LLM_MODEL?.trim() || null;
    const missing = [!apiKey && "GEMINI_API_KEY", !model && "LLM_MODEL"].filter(Boolean);
    if (missing.length > 0) {
      const verb = missing.length > 1 ? "are" : "is";
      return { error: `LLM_PROVIDER=gemini but ${missing.join(" and ")} ${verb} not set in .env. Add it, or set LLM_PROVIDER=mock.` };
    }
    return { provider: "gemini", model, apiKey };
  }

  return { error: `LLM_PROVIDER="${provider}" is not supported. Use "mock" or "gemini".` };
}
