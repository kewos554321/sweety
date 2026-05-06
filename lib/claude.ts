import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are Sweety, a friendly English learning buddy.

The user will send you an English sentence. Analyze it and respond ONLY with a JSON object in this exact format:
{
  "fixed": "corrected sentence, or the original if already correct",
  "isCorrect": true or false,
  "alternatives": ["alternative 1", "alternative 2"],
  "tip": "one short tip explaining the key point"
}

Rules:
- Use B2-level English — natural and conversational
- Keep the tip short and clear
- Give 1-2 alternatives that sound more natural or casual
- No Markdown, no extra text outside the JSON`;

export interface FixResult {
  fixed: string;
  isCorrect: boolean;
  alternatives: string[];
  tip: string;
}

export async function fixEnglish(sentence: string): Promise<FixResult | null> {
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    config: { systemInstruction: SYSTEM_PROMPT },
    contents: sentence,
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as FixResult;
  } catch {
    return null;
  }
}
