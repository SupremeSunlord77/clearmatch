// D6: improvement tips written by the project owner in data/guidance.json.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../data.js";
import { DIMENSIONS, type Dimension } from "../scoring/types.js";

export type Band = "low" | "neutral" | "good";
export const MAX_TIPS = 2;

export type Guidance = Record<Dimension, Record<Band, string[]>> & { howItWorks: string };

export const GUIDANCE_PATH = path.join(REPO_ROOT, "data", "guidance.json");

export function loadGuidance(file = GUIDANCE_PATH): Guidance {
  const g = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const d of DIMENSIONS) {
    for (const b of ["low", "neutral", "good"] as const) {
      if (!Array.isArray(g?.[d]?.[b])) throw new Error(`${file}: "${d}.${b}" must be an array of tips`);
    }
  }
  if (typeof g.howItWorks !== "string") throw new Error(`${file}: "howItWorks" must be a string`);
  return g as Guidance;
}

/** D3 bands: low < 2.5, neutral 2.5–3.4, good ≥ 3.5. */
export function bandFor(score: number): Band {
  if (score < 2.5) return "low";
  if (score < 3.5) return "neutral";
  return "good";
}

/** Up to 2 tips for the band; none when there is no counted score. */
export function tipsFor(guidance: Guidance, dim: Dimension, band: Band | null): string[] {
  if (band === null) return [];
  return guidance[dim][band].slice(0, MAX_TIPS);
}
