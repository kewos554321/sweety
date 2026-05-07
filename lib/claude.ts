import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CHEER_PROMPT = `You are Sweety, an upbeat and enthusiastic English learning coach.

Generate a short, lively cheer-up message for someone learning English or preparing for IELTS.
The message must:
- Address the person by the name given
- Be warm, fun, and energetic — like a supportive best friend
- Be related to English learning or IELTS practice
- Be 1-3 sentences max
- Sound natural and spoken, not formal or stiff
- Use plain text only, no Markdown, no asterisks, no symbols

Respond with ONLY the plain text message, nothing else.`;

export async function cheerUp(name: string): Promise<string | null> {
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    config: { systemInstruction: CHEER_PROMPT },
    contents: `Generate a cheer-up message for ${name}`,
  });
  return response.text?.trim() ?? null;
}

const HOW_TO_USE_PROMPT = `You are Sweety, an IELTS Speaking vocabulary coach.

The user will send a word or phrase. If the input is not a valid English word or phrase (e.g. gibberish, numbers, symbols, or non-English text), respond ONLY with:
{"error": "Please enter a valid English word or phrase. Example: serendipity, come across, make ends meet"}

Otherwise, respond ONLY with a JSON object in this exact format:
{
  "word": "the word or phrase as provided",
  "partOfSpeech": "noun / verb / adjective / phrase / etc.",
  "definition": "clear, concise definition suitable for IELTS learners",
  "etymology": "brief origin of the word (e.g. Latin, Greek, Old French) and its original meaning — one sentence",
  "examples": [
    "Example sentence 1 in an IELTS Speaking context",
    "Example sentence 2 in an IELTS Speaking context",
    "Example sentence 3 in an IELTS Speaking context"
  ],
  "collocations": ["collocation 1", "collocation 2", "collocation 3"],
  "tip": "one practical tip on how to use this naturally in IELTS Speaking"
}

Rules:
- examples must sound natural when spoken aloud, not written/formal
- collocations should be the most common and useful pairings
- tip should be specific and actionable for IELTS Speaking Band 7
- All field values must be plain text — no Markdown formatting whatsoever (no **, *, _, #, \`, or any other Markdown syntax) inside any field
- No Markdown, no extra text outside the JSON`;

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

export interface HowToUseResult {
  word: string;
  partOfSpeech: string;
  definition: string;
  etymology: string;
  examples: string[];
  collocations: string[];
  tip: string;
}

export type HowToUseResponse =
  | { ok: true; result: HowToUseResult }
  | { ok: false; error: string };

export async function howToUse(word: string): Promise<HowToUseResponse> {
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    config: { systemInstruction: HOW_TO_USE_PROMPT },
    contents: word,
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, error: "Hmm, I couldn't look that up. Try again!" };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.error) return { ok: false, error: parsed.error };
    return { ok: true, result: stripMarkdown(parsed) as unknown as HowToUseResult };
  } catch {
    return { ok: false, error: "Hmm, I couldn't look that up. Try again!" };
  }
}

function stripMarkdown(obj: Record<string, unknown>): Record<string, unknown> {
  const clean = (s: string) => s.replace(/\*\*|__|\*|_|`/g, "");
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") result[k] = clean(v);
    else if (Array.isArray(v)) result[k] = v.map((item) => (typeof item === "string" ? clean(item) : item));
    else result[k] = v;
  }
  return result;
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
