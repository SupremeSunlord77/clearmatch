// Mock provider: returns a stored fixture for the match. Needs no API key.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../data.js";
import type { LlmProvider } from "./provider.js";

export const MOCK_FIXTURE_DIR = path.join(REPO_ROOT, "server", "fixtures", "mock");

export function createMockProvider(): LlmProvider {
  return {
    name: "mock",
    model: null,
    async scoreMatch({ matchId }) {
      return fs.readFileSync(path.join(MOCK_FIXTURE_DIR, `${matchId}.json`), "utf8");
    },
  };
}
