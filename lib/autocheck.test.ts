import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FixResult } from "./claude";

// vi.hoisted ensures mockGenerateContent is available inside vi.mock factory
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

const { autoCheck } = await import("./claude");

function makeGeminiResponse(payload: object) {
  return { text: JSON.stringify(payload) };
}

function noCorrection() {
  return makeGeminiResponse({ needsCorrection: false });
}

function withCorrection(partial: Partial<FixResult> = {}) {
  return makeGeminiResponse({
    needsCorrection: true,
    fixed: partial.fixed ?? "Corrected sentence.",
    isCorrect: false,
    alternatives: partial.alternatives ?? ["Alternative A.", "Alternative B."],
    vocab: partial.vocab ?? [],
    tip: partial.tip ?? "A useful tip.",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// LOW sensitivity — only serious errors
// ---------------------------------------------------------------------------
describe("autoCheck at sensitivity: low", () => {
  it("returns null when Gemini says no correction needed", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    const result = await autoCheck("I went to the store.", "low");
    expect(result).toBeNull();
  });

  it("returns FixResult for serious subject-verb error", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "She goes to school every day." })
    );
    // "She go to school every day." — subject-verb disagreement
    const result = await autoCheck("She go to school every day.", "low");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("She goes to school every day.");
    expect(result!.isCorrect).toBe(false);
  });

  it("returns FixResult for serious tense error", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "I studied last night." })
    );
    // "I study last night." — wrong tense
    const result = await autoCheck("I study last night.", "low");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("I studied last night.");
  });

  it("includes the word 'low' in the prompt sent to Gemini", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    await autoCheck("Some sentence.", "low");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain('"low"');
  });
});

// ---------------------------------------------------------------------------
// MEDIUM sensitivity — low errors + articles + prepositions
// ---------------------------------------------------------------------------
describe("autoCheck at sensitivity: medium", () => {
  it("returns null for a correct sentence", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    const result = await autoCheck("I have been living here for three years.", "medium");
    expect(result).toBeNull();
  });

  it("returns FixResult for missing article", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "I saw an elephant at the zoo." })
    );
    // "I saw elephant at zoo." — missing articles
    const result = await autoCheck("I saw elephant at zoo.", "medium");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("I saw an elephant at the zoo.");
  });

  it("returns FixResult for preposition misuse", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "She arrived at the airport on time." })
    );
    // "She arrived to the airport in time." — wrong prepositions
    const result = await autoCheck("She arrived to the airport in time.", "medium");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("She arrived at the airport on time.");
  });

  it("includes the word 'medium' in the prompt sent to Gemini", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    await autoCheck("Some sentence.", "medium");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain('"medium"');
  });
});

// ---------------------------------------------------------------------------
// HIGH sensitivity — medium errors + unnatural phrasing + word choice
// ---------------------------------------------------------------------------
describe("autoCheck at sensitivity: high", () => {
  it("returns null for a naturally fluent sentence", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    const result = await autoCheck("It's a fascinating topic that I feel strongly about.", "high");
    expect(result).toBeNull();
  });

  it("returns FixResult with vocab upgrades for basic word choice", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({
        fixed: "The presentation was impressive.",
        vocab: [{ word: "good", upgrade: "impressive" }],
      })
    );
    // "The presentation was good." — basic word choice flagged at high
    const result = await autoCheck("The presentation was good.", "high");
    expect(result).not.toBeNull();
    expect(result!.vocab).toContainEqual({ word: "good", upgrade: "impressive" });
  });

  it("returns FixResult for unnatural phrasing", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "I think technology has a huge impact on our lives." })
    );
    // "I think technology has big impact to our lives." — unnatural + preposition
    const result = await autoCheck("I think technology has big impact to our lives.", "high");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("I think technology has a huge impact on our lives.");
  });

  it("includes the word 'high' in the prompt sent to Gemini", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    await autoCheck("Some sentence.", "high");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain('"high"');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("autoCheck edge cases", () => {
  it("returns null when Gemini returns malformed JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "not json at all" });
    const result = await autoCheck("Some sentence.", "medium");
    expect(result).toBeNull();
  });

  it("returns null when Gemini response is empty", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });
    const result = await autoCheck("Some sentence.", "medium");
    expect(result).toBeNull();
  });

  it("returns null when needsCorrection is false even with correction fields present", async () => {
    // Gemini might return both needsCorrection:false and correction fields — should still be null
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        needsCorrection: false,
        fixed: "Should be ignored.",
        isCorrect: false,
        alternatives: [],
        vocab: [],
        tip: "Should be ignored.",
      })
    );
    const result = await autoCheck("I went to the store.", "low");
    expect(result).toBeNull();
  });
});
