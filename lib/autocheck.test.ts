import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FixResult } from "./claude";

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
// CASUAL — big errors only
// ---------------------------------------------------------------------------
describe("autoCheck at sensitivity: casual", () => {
  it("returns null when Gemini says no correction needed", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    const result = await autoCheck("I went to the store.", "casual");
    expect(result).toBeNull();
  });

  it("returns FixResult for subject-verb disagreement", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "She goes to school every day." })
    );
    const result = await autoCheck("She go to school every day.", "casual");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("She goes to school every day.");
    expect(result!.isCorrect).toBe(false);
  });

  it("returns FixResult for wrong tense", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "I studied last night." })
    );
    const result = await autoCheck("I study last night.", "casual");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("I studied last night.");
  });

  it("includes 'casual' in the prompt sent to Gemini", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    await autoCheck("Some sentence.", "casual");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain('"casual"');
  });
});

// ---------------------------------------------------------------------------
// STRICT — all errors including articles, prepositions, word choice
// ---------------------------------------------------------------------------
describe("autoCheck at sensitivity: strict", () => {
  it("returns null for a naturally fluent sentence", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    const result = await autoCheck("It's a fascinating topic that I feel strongly about.", "strict");
    expect(result).toBeNull();
  });

  it("returns FixResult for missing article", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "I saw an elephant at the zoo." })
    );
    const result = await autoCheck("I saw elephant at zoo.", "strict");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("I saw an elephant at the zoo.");
  });

  it("returns FixResult for preposition misuse", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({ fixed: "She arrived at the airport on time." })
    );
    const result = await autoCheck("She arrived to the airport in time.", "strict");
    expect(result).not.toBeNull();
    expect(result!.fixed).toBe("She arrived at the airport on time.");
  });

  it("returns FixResult with vocab upgrades for basic word choice", async () => {
    mockGenerateContent.mockResolvedValue(
      withCorrection({
        fixed: "The presentation was impressive.",
        vocab: [{ word: "good", upgrade: "impressive" }],
      })
    );
    const result = await autoCheck("The presentation was good.", "strict");
    expect(result).not.toBeNull();
    expect(result!.vocab).toContainEqual({ word: "good", upgrade: "impressive" });
  });

  it("includes 'strict' in the prompt sent to Gemini", async () => {
    mockGenerateContent.mockResolvedValue(noCorrection());
    await autoCheck("Some sentence.", "strict");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain('"strict"');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("autoCheck edge cases", () => {
  it("returns null when Gemini returns malformed JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "not json at all" });
    const result = await autoCheck("Some sentence.", "casual");
    expect(result).toBeNull();
  });

  it("returns null when Gemini response is empty", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });
    const result = await autoCheck("Some sentence.", "casual");
    expect(result).toBeNull();
  });

  it("returns null when needsCorrection is false even with correction fields present", async () => {
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
    const result = await autoCheck("I went to the store.", "casual");
    expect(result).toBeNull();
  });
});
