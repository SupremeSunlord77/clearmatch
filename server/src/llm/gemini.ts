// Gemini provider using the official @google/genai SDK in JSON output mode.
import { GoogleGenAI } from "@google/genai";
import type { LlmProvider } from "./provider.js";

export function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: "gemini",
    model,
    async scoreMatch({ prompt }) {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0 },
      });
      return res.text ?? "";
    },
  };
}
