import type { LlmConfig } from "../config.js";
import { createGeminiProvider } from "./gemini.js";
import { createMockProvider } from "./mock.js";
import type { LlmProvider } from "./provider.js";

export function createProvider(cfg: LlmConfig): LlmProvider {
  if (cfg.provider === "gemini") return createGeminiProvider(cfg.apiKey!, cfg.model!);
  return createMockProvider();
}
