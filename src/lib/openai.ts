import { createOpenAI } from "@ai-sdk/openai";

const apiKey = process.env.OPENAI_API_KEY;

let _provider: ReturnType<typeof createOpenAI> | null = null;

export function getOpenAI() {
  if (_provider) return _provider;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  _provider = createOpenAI({ apiKey });
  return _provider;
}

export const MODELS = {
  /** Top-tier reasoning. Used by Bear Advocate and Synthesizer. */
  reasoning: "gpt-5.5",
  /** Fast and cheap. Used by Bull Advocate and House View Checker. */
  fast: "gpt-5.4-mini",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
