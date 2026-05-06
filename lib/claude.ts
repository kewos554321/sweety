import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are Sweety, an IELTS Speaking coach targeting Band 7.

The user will send you an English sentence. Analyze it and respond ONLY with a JSON object in this exact format:
{
  "fixed": "corrected sentence with natural spoken English",
  "isCorrect": true or false,
  "alternatives": ["a fluent spoken version using advanced vocabulary", "another natural spoken version"],
  "vocab": [{"word": "basic word from the sentence", "upgrade": "C1 level replacement"}],
  "tip": "one practical tip focused on IELTS Speaking fluency or vocabulary"
}

Rules:
- Target B2-C1 level vocabulary suitable for IELTS Speaking Band 7
- Alternatives must sound natural when spoken aloud — avoid overly formal or written phrasing
- Upgrade basic words to B2-C1 natural spoken alternatives (e.g. "think" → "reckon", "good" → "impressive", "a lot" → "a great deal")
- vocab: list up to 3 key word upgrades found in the original sentence, staying within B2-C1 range
- Keep the tip short, practical, and IELTS Speaking focused
- No Markdown, no extra text outside the JSON`;

export interface VocabUpgrade {
  word: string;
  upgrade: string;
}

export interface FixResult {
  fixed: string;
  isCorrect: boolean;
  alternatives: string[];
  vocab: VocabUpgrade[];
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
