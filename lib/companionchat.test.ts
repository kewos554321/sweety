import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatTurn } from "./chatSession";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

const { companionChat } = await import("./claude");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("companionChat", () => {
  const agent = { name: "小兔兔", personality: "活潑愛開玩笑,常常用兔子相關的梗" };

  it("returns the trimmed, markdown-stripped reply text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "  **哈囉**~今天過得好嗎? \n" });
    const result = await companionChat(agent, [], []);
    expect(result).toBe("哈囉~今天過得好嗎?");
  });

  it("returns null when Gemini returns an empty response", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });
    const result = await companionChat(agent, [], []);
    expect(result).toBeNull();
  });

  it("returns null when response.text is undefined", async () => {
    mockGenerateContent.mockResolvedValue({});
    const result = await companionChat(agent, [], []);
    expect(result).toBeNull();
  });

  it("includes the agent's name and personality in the system prompt", async () => {
    mockGenerateContent.mockResolvedValue({ text: "嗨!" });
    await companionChat(agent, [], []);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain("小兔兔");
    expect(callArgs.config.systemInstruction).toContain("活潑愛開玩笑");
  });

  it("mentions other companions in the system prompt", async () => {
    mockGenerateContent.mockResolvedValue({ text: "嗨!" });
    await companionChat(agent, ["小明"], []);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toContain("小明");
  });

  it("includes the conversation history in the prompt contents", async () => {
    mockGenerateContent.mockResolvedValue({ text: "嗨!" });
    const history: ChatTurn[] = [
      { speaker: "User", text: "大家好" },
      { speaker: "小明", text: "哈囉!" },
    ];
    await companionChat(agent, ["小明"], history);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain("User: 大家好");
    expect(callArgs.contents).toContain("小明: 哈囉!");
  });

  it("uses gemini-2.5-flash", async () => {
    mockGenerateContent.mockResolvedValue({ text: "嗨!" });
    await companionChat(agent, [], []);
    expect(mockGenerateContent.mock.calls[0][0].model).toBe("gemini-2.5-flash");
  });
});
