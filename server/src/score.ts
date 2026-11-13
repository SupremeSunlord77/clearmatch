// npm run score: score all matches → validate → aggregate → write output/.
import fs from "node:fs";
import path from "node:path";
import { loadLlmConfig } from "./config.js";
import { loadMatches, loadPlayers, REPO_ROOT } from "./data.js";
import { createProvider } from "./llm/index.js";
import { buildProfiles } from "./scoring/aggregate.js";
import { scoreOneMatch, type MatchLogEntry } from "./scoring/pipeline.js";
import { MATCH_RESULTS_PATH, toMatchResults } from "./scoring/results.js";

const cfg = loadLlmConfig();
if ("error" in cfg) {
  console.error(`Configuration error: ${cfg.error}`);
  process.exit(1);
}
const provider = createProvider(cfg);
const players = loadPlayers();
const matches = loadMatches();
console.log(`Provider: ${provider.name}${provider.model ? ` (model ${provider.model})` : ""}`);

const log: MatchLogEntry[] = [];
for (const match of matches) {
  const result = await scoreOneMatch(provider, match, players, { secrets: [cfg.apiKey ?? ""] });
  log.push(result);
  const review = result.dimensions.filter((d) => d.status === "needs_review").length;
  console.log(
    `  ${match.id}: ${result.dimensions.length - review} accepted, ${review} needs_review` +
      (result.responseRejected ? ` (whole response rejected: ${result.responseReason})` : "")
  );
}

const profiles = buildProfiles(players, matches, log);
const outDir = path.join(REPO_ROOT, "output");
fs.mkdirSync(outDir, { recursive: true });
const meta = { generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model };
fs.writeFileSync(path.join(outDir, "profiles.json"), JSON.stringify({ ...meta, profiles }, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "validation-log.json"), JSON.stringify({ ...meta, matches: log }, null, 2) + "\n");
fs.writeFileSync(MATCH_RESULTS_PATH, JSON.stringify(toMatchResults(log, matches, meta), null, 2) + "\n");

console.log("\nPlayer        Respect (trend)        Teamwork (trend)       Communication (trend)  needs_review");
for (const p of profiles) {
  const cell = (d: (typeof p)["respect"]) =>
    (d.status === "ok" ? `${d.score!.toFixed(1)} (${d.trend === null ? "n/a" : `${d.trend >= 0 ? "+" : ""}${d.trend.toFixed(1)} ${d.trendLabel}`})` : "insufficient_data").padEnd(23);
  const reviews = p.respect.needsReviewCount + p.teamwork.needsReviewCount + p.communication.needsReviewCount;
  console.log(`${`${p.playerId} ${p.displayName}`.padEnd(14)}${cell(p.respect)}${cell(p.teamwork)}${cell(p.communication)}${reviews}`);
}
console.log(`\nWrote output/profiles.json, output/validation-log.json and output/match-results.json`);
