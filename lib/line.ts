import { messagingApi } from "@line/bot-sdk";
import type { WebhookEvent, TextMessage } from "@line/bot-sdk";
import { fixEnglish, howToUse, cheerUp, generateTopic, autoCheck, companionChat, type FixResult, type HowToUseResult, type TopicResult } from "@/lib/claude";
import { getSettings, setSettings, getDebugText, logAutoEvent, type Sensitivity, type AutoFormat } from "@/lib/settings";
import { listCompanions, createCompanion, deleteCompanion, MAX_ACTIVE_AGENTS } from "@/lib/companions";
import { startSession, endSession, getSession, appendTurn, type ChatSession } from "@/lib/chatSession";
import type { Companion } from "@/db/schema";

function validateHowToUseInput(args: string): string | null {
  if (args.length > 60) return 'That\'s a bit too long. Please enter a single word or short phrase.\nExample: @Sweety /define come across';
  if (!/^[a-zA-Z\s'\-]+$/.test(args)) return 'Please enter an English word or phrase.\nExample: @Sweety /define serendipity';
  return null;
}

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const messageCache = new Map<string, string>();

function cacheMessage(id: string, text: string) {
  if (messageCache.size >= 200) {
    const firstKey = messageCache.keys().next().value;
    if (firstKey) messageCache.delete(firstKey);
  }
  messageCache.set(id, text);
}

function parseCommand(text: string): { command: string; args: string } | null {
  if (!text.startsWith("/")) return null;
  const spaceIdx = text.indexOf(" ");
  if (spaceIdx === -1) return { command: text.toLowerCase(), args: "" };
  return {
    command: text.slice(0, spaceIdx).toLowerCase(),
    args: text.slice(spaceIdx + 1).trim(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTopicFlexMessage(result: TopicResult): any {
  const bubble = (label: string, color: string, contents: unknown[]) => ({
    type: "bubble",
    styles: { header: { backgroundColor: color } },
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "Sweety ✨", color: "#FFFFFF", weight: "bold", size: "md" },
        { type: "text", text: label, color: "#EEE9FF", size: "sm", wrap: true },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents,
    },
  });

  const part1 = bubble("Part 1 — Personal Questions", "#7B61FF", [
    {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        { type: "text", text: `Topic: ${result.part1.topic}`, weight: "bold", size: "sm", color: "#7B61FF", wrap: true },
        ...result.part1.questions.map((q) => ({
          type: "text" as const,
          text: `• ${q}`,
          wrap: true,
          size: "sm" as const,
          color: "#555555",
          margin: "sm" as const,
        })),
      ],
    },
  ]);

  const part2 = bubble("Part 2 — Long Turn (Cue Card)", "#5B4FCF", [
    {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        { type: "text", text: result.part2.prompt, weight: "bold", size: "sm", color: "#5B4FCF", wrap: true },
        { type: "text", text: "You should say:", size: "sm", color: "#888888", margin: "md" },
        ...result.part2.bullets.map((b) => ({
          type: "text" as const,
          text: `• ${b}`,
          wrap: true,
          size: "sm" as const,
          color: "#555555",
          margin: "xs" as const,
        })),
        { type: "text", text: result.part2.closing, wrap: true, size: "sm", color: "#555555", margin: "md" },
      ],
    },
  ]);

  const part3 = bubble("Part 3 — Discussion", "#4A3FBF", [
    {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        { type: "text", text: `Topic: ${result.part3.topic}`, weight: "bold", size: "sm", color: "#4A3FBF", wrap: true },
        ...result.part3.questions.map((q) => ({
          type: "text" as const,
          text: `• ${q}`,
          wrap: true,
          size: "sm" as const,
          color: "#555555",
          margin: "sm" as const,
        })),
      ],
    },
  ]);

  return {
    type: "flex",
    altText: `IELTS Speaking Topic: ${result.part2.prompt}`,
    contents: {
      type: "carousel",
      contents: [part1, part2, part3],
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHelpFlexMessage(): any {
  const makeBubble = (color: string, subtitle: string, bodyContents: unknown[]) => ({
    type: "bubble",
    styles: { header: { backgroundColor: color } },
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "Sweety ✨", color: "#FFFFFF", weight: "bold", size: "md" },
        { type: "text", text: subtitle, color: "#EEE9FF", size: "sm" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: bodyContents,
    },
  });

  const cmdBox = (cmd: string, desc: string) => ({
    type: "box" as const,
    layout: "vertical" as const,
    spacing: "xs" as const,
    contents: [
      { type: "text" as const, text: cmd, weight: "bold" as const, size: "sm" as const, color: "#7B61FF", wrap: true },
      { type: "text" as const, text: desc, size: "sm" as const, color: "#555555", wrap: true },
    ],
  });

  const sep = { type: "separator" as const };

  const grammar = makeBubble("#7B61FF", "Grammar Tools", [
    {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        { type: "text", text: "Trigger", weight: "bold", size: "sm", color: "#7B61FF" },
        { type: "text", text: "@Sweety  or  !sweety  or  !swt", size: "sm", color: "#555555", wrap: true },
      ],
    },
    sep,
    cmdBox("@Sweety <sentence>", "Fix & improve your English sentence"),
    sep,
    cmdBox("@Sweety /define <word>", "Word meaning & usage"),
    sep,
    cmdBox("@Sweety /define --all <word>", "Same as /define + etymology"),
  ]);

  const speaking = makeBubble("#5B4FCF", "Speaking Practice", [
    cmdBox("@Sweety /topic", "Get a full IELTS Speaking topic set (Part 1, 2 & 3)"),
    sep,
    cmdBox("@Sweety /cheer @Someone", "Send an upbeat encouragement to someone in the group"),
  ]);

  const settings = makeBubble("#4A3FBF", "Group Settings", [
    cmdBox("@Sweety /auto on|off", "Toggle auto grammar checking for this group"),
    sep,
    cmdBox("@Sweety /auto sensitivity casual|strict", "Adjust correction sensitivity (default: casual)"),
    sep,
    cmdBox("@Sweety /auto format fix|try|both", "Choose reply content: Fix only, Try only, or both (default: both)"),
    sep,
    cmdBox("@Sweety /status", "View current group settings"),
    sep,
    {
      type: "text" as const,
      text: "casual: big errors only · strict: articles, prepositions & word choice",
      size: "xs" as const,
      color: "#9CA3AF",
      wrap: true,
    },
  ]);

  return {
    type: "flex",
    altText: "Sweety — Available Commands",
    contents: {
      type: "carousel",
      contents: [grammar, speaking, settings],
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildStatusFlexMessage(groupId: string): Promise<any> {
  const { autoEnabled, sensitivity, autoFormat } = await getSettings(groupId);
  return {
    type: "flex",
    altText: "Sweety — Group Settings",
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#7B61FF" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "Sweety ✨", color: "#FFFFFF", weight: "bold", size: "md" },
          { type: "text", text: "Group Settings", color: "#EEE9FF", size: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "⚡ Auto Mode", weight: "bold", size: "sm", flex: 3 },
              {
                type: "text",
                text: autoEnabled ? "ON" : "OFF",
                size: "sm",
                color: autoEnabled ? "#22C55E" : "#9CA3AF",
                weight: "bold",
                flex: 1,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "🎯 Sensitivity", weight: "bold", size: "sm", flex: 3 },
              { type: "text", text: sensitivity, size: "sm", color: "#555555", flex: 1 },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "💬 Reply Format", weight: "bold", size: "sm", flex: 3 },
              { type: "text", text: autoFormat, size: "sm", color: "#555555", flex: 1 },
            ],
          },
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              { type: "text", text: "@Sweety /auto on|off — toggle auto mode", size: "xs", color: "#9CA3AF", wrap: true },
              { type: "text", text: "@Sweety /auto sensitivity casual|strict", size: "xs", color: "#9CA3AF", wrap: true },
              { type: "text", text: "@Sweety /auto format fix|try|both", size: "xs", color: "#9CA3AF", wrap: true },
            ],
          },
        ],
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHowToUseFlexMessage(result: HowToUseResult, showAll = false): any {
  return {
    type: "flex",
    altText: `How to use: ${result.word}`,
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#7B61FF" },
      },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "Sweety ✨", color: "#FFFFFF", weight: "bold", size: "md" },
          { type: "text", text: `${result.word}  ·  ${result.partOfSpeech}`, color: "#EEE9FF", size: "sm", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              { type: "text", text: "📖 Definition", weight: "bold", color: "#7B61FF", size: "sm" },
              { type: "text", text: result.definition, wrap: true, size: "sm", color: "#555555" },
            ],
          },
          ...(showAll ? [
            { type: "separator" as const },
            {
              type: "box" as const,
              layout: "vertical" as const,
              spacing: "xs" as const,
              contents: [
                { type: "text" as const, text: "🌱 Etymology", weight: "bold" as const, color: "#7B61FF", size: "sm" as const },
                { type: "text" as const, text: result.etymology, wrap: true, size: "sm" as const, color: "#555555" },
              ],
            },
          ] : []),
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              { type: "text", text: "💬 Examples", weight: "bold", color: "#7B61FF", size: "sm" },
              ...result.examples.map((ex) => ({
                type: "text" as const,
                text: `• ${ex}`,
                wrap: true,
                size: "sm" as const,
                color: "#555555",
                margin: "sm" as const,
              })),
            ],
          },
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              { type: "text", text: "🔗 Collocations", weight: "bold", color: "#7B61FF", size: "sm" },
              ...result.collocations.map((col) => ({
                type: "text" as const,
                text: col,
                wrap: true,
                size: "sm" as const,
                color: "#555555",
                margin: "xs" as const,
              })),
            ],
          },
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              { type: "text", text: "💡 IELTS Tip", weight: "bold", color: "#7B61FF", size: "sm" },
              { type: "text", text: result.tip, wrap: true, size: "sm", color: "#555555" },
            ],
          },
        ],
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFlexMessage(sentence: string, result: FixResult): any {
  
  return {
    type: "flex",
    altText: result.isCorrect ? "Looks great!" : `Fixed: ${result.fixed}`,
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#7B61FF" },
      },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "Sweety ✨",
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
          },
          {
            type: "text",
            text: `"${sentence}"`,
            color: "#EEE9FF",
            size: "sm",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: result.isCorrect ? "✅ Looks great!" : "✏️ Fixed",
                weight: "bold",
                color: result.isCorrect ? "#22C55E" : "#7B61FF",
                size: "sm",
              },
              ...(result.isCorrect
                ? []
                : [
                    {
                      type: "text" as const,
                      text: result.fixed,
                      wrap: true,
                      size: "sm" as const,
                    },
                  ]),
            ],
          },
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "💬 More natural",
                weight: "bold",
                color: "#7B61FF",
                size: "sm",
              },
              ...result.alternatives.map((alt) => ({
                type: "text" as const,
                text: alt,
                wrap: true,
                size: "sm" as const,
                color: "#555555",
                margin: "sm" as const,
              })),
            ],
          },
          ...(result.vocab?.length
            ? [
                { type: "separator" as const },
                {
                  type: "box" as const,
                  layout: "vertical" as const,
                  spacing: "xs" as const,
                  contents: [
                    {
                      type: "text" as const,
                      text: "📚 Vocab Upgrade",
                      weight: "bold" as const,
                      color: "#7B61FF",
                      size: "sm" as const,
                    },
                    ...result.vocab.map((v) => ({
                      type: "text" as const,
                      text: `${v.word}  →  ${v.upgrade}`,
                      wrap: true,
                      size: "sm" as const,
                      color: "#555555",
                    })),
                  ],
                },
              ]
            : []),
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "💡 Tip",
                weight: "bold",
                color: "#7B61FF",
                size: "sm",
              },
              {
                type: "text",
                text: result.tip,
                wrap: true,
                size: "sm",
                color: "#555555",
              },
            ],
          },
        ],
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAutoTextMessage(result: FixResult, quoteToken: string, format: AutoFormat): any {
  const lines: string[] = [];
  if (format === "fix" || format === "both") lines.push(`Fix: ${result.fixed}`);
  if ((format === "try" || format === "both") && result.alternatives[0]) lines.push(`Try: ${result.alternatives[0]}`);
  return { type: "text", text: lines.join("\n"), quoteToken };
}

function buildCompanionMessages(replies: { avatar: string; name: string; text: string }[]): TextMessage[] {
  return replies.map((r) => ({ type: "text", text: `${r.avatar} ${r.name}: ${r.text}` }));
}

async function handleCompanionMessage(
  replyToken: string,
  groupId: string,
  userId: string,
  userMessage: string,
  session: ChatSession
): Promise<void> {
  appendTurn(groupId, userId, { speaker: "User", text: userMessage });

  const replies: { avatar: string; name: string; text: string }[] = [];

  for (const agent of session.agents) {
    const otherNames = session.agents.filter((a) => a.name !== agent.name).map((a) => a.name);
    const reply = await companionChat(agent, otherNames, session.history);
    if (reply) {
      appendTurn(groupId, userId, { speaker: agent.name, text: reply });
      replies.push({ avatar: agent.avatar, name: agent.name, text: reply });
    }
  }

  if (replies.length === 0) return;

  await lineClient.replyMessage({
    replyToken,
    messages: buildCompanionMessages(replies),
  });
}

const BANG_PREFIX_RE = /^!(sweety|swt)\s*/i;

export async function handleLineEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== "message" || event.message.type !== "text") return;
  if (!("replyToken" in event)) return;

  const message = event.message as TextMessage & { id: string; quoteToken: string; quotedMessageId?: string; mention?: { mentionees: { isSelf: boolean; index: number; length: number }[] } };
  const userMessage = message.text;

  cacheMessage(message.id, userMessage);

  const isMentioned = message.mention?.mentionees.some((m) => m.isSelf);
  const isBangTriggered = BANG_PREFIX_RE.test(userMessage);

  if (!isMentioned && !isBangTriggered) {
    if (
      event.source.type === "group" &&
      !userMessage.startsWith("/") &&
      userMessage.trim().length > 0
    ) {
      const groupId = event.source.groupId;
      const senderId = event.source.userId;
      const session = senderId ? getSession(groupId, senderId) : undefined;

      if (session && senderId) {
        await handleCompanionMessage(event.replyToken, groupId, senderId, userMessage, session);
        return;
      }

      const { autoEnabled, sensitivity, autoFormat } = await getSettings(groupId);
      if (!autoEnabled) {
        logAutoEvent(`skip: auto off — "${userMessage.slice(0, 30)}"`);
      } else {
        logAutoEvent(`checking: "${userMessage.slice(0, 30)}"`);
        const result = await autoCheck(userMessage, sensitivity);
        if (result) {
          logAutoEvent(`reply: fixed="${result.fixed.slice(0, 30)}"`);
          await lineClient.replyMessage({
            replyToken: event.replyToken,
            messages: [buildAutoTextMessage(result, message.quoteToken, autoFormat)],
          });
        } else {
          logAutoEvent(`no correction needed`);
        }
      }
    }
    return;
  }

  const mentionees = message.mention?.mentionees ?? [];
  const strippedText = isBangTriggered
    ? userMessage.replace(BANG_PREFIX_RE, "").trim()
    : mentionees
        .slice()
        .sort((a, b) => b.index - a.index)
        .reduce(
          (text, m) => text.slice(0, m.index) + text.slice(m.index + m.length),
          userMessage
        )
        .trim();
  const cmd = parseCommand(strippedText);
  const lineUserId = event.source.userId;

  if (cmd?.command === "/topic") {
    const topic = await generateTopic();
    if (!topic) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "Hmm, couldn't generate a topic right now. Try again!" }],
      });
      return;
    }
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [buildTopicFlexMessage(topic)],
    });
    return;
  }

  if (cmd?.command === "/cheer") {
    const target = mentionees.find((m) => !m.isSelf);
    if (!target) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "Oops! Who am I cheering for? 😄 Tag someone like this:\n@Sweety /cheer @John" }],
      });
      return;
    }
    const targetName = userMessage.slice(target.index + 1, target.index + target.length);
    const cheer = await cheerUp(targetName);
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: cheer ?? `Hey ${targetName}, you're doing amazing — keep it up! 💪` }],
    });
    return;
  }

  if (cmd?.command === "/debug") {
    const groupId = event.source.type === "group" ? event.source.groupId : "dm";
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: await getDebugText(groupId) }],
    });
    return;
  }

  if (cmd?.command === "/help") {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [buildHelpFlexMessage()],
    });
    return;
  }

  if (cmd?.command === "/status") {
    const groupId = event.source.type === "group" ? event.source.groupId : "dm";
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [await buildStatusFlexMessage(groupId)],
    });
    return;
  }

  if (cmd?.command === "/auto") {
    if (event.source.type !== "group") {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "Auto mode is only available in group chats." }],
      });
      return;
    }
    const groupId = event.source.groupId;
    const args = cmd.args.trim().toLowerCase();

    if (args === "on") {
      await setSettings(groupId, { autoEnabled: true });
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ Auto mode ON! I'll quietly correct grammar errors in this group." }],
      });
      return;
    }

    if (args === "off") {
      await setSettings(groupId, { autoEnabled: false });
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "⏸️ Auto mode OFF. I'll only respond when you mention me." }],
      });
      return;
    }

    const sensitivityMatch = args.match(/^sensitivity\s+(casual|strict)$/);
    if (sensitivityMatch) {
      const level = sensitivityMatch[1] as Sensitivity;
      await setSettings(groupId, { sensitivity: level });
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: level === "strict" ? "🎯 Strict mode — I'll flag articles, prepositions, and word choice too." : "🎯 Casual mode — I'll only flag big errors." }],
      });
      return;
    }

    const formatMatch = args.match(/^format\s+(fix|try|both)$/);
    if (formatMatch) {
      const fmt = formatMatch[1] as AutoFormat;
      await setSettings(groupId, { autoFormat: fmt });
      const desc = fmt === "fix" ? "Fix only." : fmt === "try" ? "Try only." : "Fix + Try.";
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `Reply format set to: ${desc}` }],
      });
      return;
    }

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "text",
        text: "Usage:\n@Sweety /auto on\n@Sweety /auto off\n@Sweety /auto sensitivity casual|strict\n@Sweety /auto format fix|try|both",
      }],
    });
    return;
  }

  if (cmd?.command === "/agent") {
    if (!lineUserId) return;

    const subMatch = cmd.args.match(/^(\S+)\s*([\s\S]*)$/);
    const sub = subMatch?.[1]?.toLowerCase() ?? "";
    const rest = subMatch?.[2] ?? "";

    if (sub === "create") {
      const parts = rest.split("|");
      const name = (parts[0] ?? "").trim();
      const personality = (parts[1] ?? "").trim();

      if (parts.length !== 2 || !name || !personality) {
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "請用「|」分隔名字和個性,例如:\n@Sweety /agent create 小兔兔 | 活潑愛開玩笑" }],
        });
        return;
      }

      const result = await createCompanion(lineUserId, name, personality);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: result.ok ? `✅ 已新增 ${result.companion.avatar} ${result.companion.name}` : result.error }],
      });
      return;
    }

    if (sub === "list") {
      const myCompanions = await listCompanions(lineUserId);
      const text = myCompanions.length === 0
        ? "你還沒有註冊任何夥伴,試試 @Sweety /agent create 名字 | 個性"
        : myCompanions.map((c) => `${c.avatar} ${c.name} - ${c.personality}`).join("\n");
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text }],
      });
      return;
    }

    if (sub === "delete") {
      const name = rest.trim();
      const deleted = await deleteCompanion(lineUserId, name);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: deleted ? `🗑️ 已刪除 ${name}` : `找不到名字叫「${name}」的夥伴` }],
      });
      return;
    }

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "text",
        text: "Usage:\n@Sweety /agent create <name> | <personality>\n@Sweety /agent list\n@Sweety /agent delete <name>",
      }],
    });
    return;
  }

  if (cmd?.command === "/chat") {
    if (event.source.type !== "group") {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "陪聊功能僅限群組使用" }],
      });
      return;
    }
    if (!lineUserId) return;

    const groupId = event.source.groupId;
    const args = cmd.args.trim();

    if (args.toLowerCase() === "off") {
      const ended = endSession(groupId, lineUserId);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: ended ? "👋 陪聊結束,有需要再 @Sweety /chat 找夥伴聊天" : "目前沒有進行中的陪聊" }],
      });
      return;
    }

    const myCompanions = await listCompanions(lineUserId);
    const companionList = myCompanions.length > 0
      ? myCompanions.map((c) => `${c.avatar} ${c.name}`).join("、")
      : "你還沒有註冊任何夥伴,先用 @Sweety /agent create 建立一個吧";

    const requestedNames = args
      ? [...new Set(args.split(",").map((n) => n.trim()).filter((n) => n.length > 0))]
      : [];

    if (requestedNames.length === 0) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `Usage: @Sweety /chat <name1>,<name2>\n你已註冊的夥伴:${companionList}` }],
      });
      return;
    }

    if (requestedNames.length > MAX_ACTIVE_AGENTS) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "一次最多只能找 3 個夥伴一起聊" }],
      });
      return;
    }

    const notFound = requestedNames.filter((name) => !myCompanions.some((c) => c.name === name));
    if (notFound.length > 0) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `找不到夥伴:${notFound.join("、")}。你已註冊的夥伴:${companionList}` }],
      });
      return;
    }

    const agents = requestedNames
      .map((name) => myCompanions.find((c) => c.name === name))
      .filter((c): c is Companion => c !== undefined);

    startSession(groupId, lineUserId, agents);
    const names = agents.map((a) => `${a.avatar} ${a.name}`).join("、");
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `${names} 加入聊天啦!直接打字就能跟他們聊,想結束輸入 @Sweety /chat off` }],
    });
    return;
  }

  if (cmd?.command === "/define") {
    const showAll = cmd.args.startsWith("--all");
    const word = showAll ? cmd.args.replace(/^--all\s*/, "") : cmd.args;

    if (!word) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "Please provide a word or phrase.\nExample: @Sweety /define serendipity\nFor full details: @Sweety /define --all serendipity" }],
      });
      return;
    }
    const validationError = validateHowToUseInput(word);
    if (validationError) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: validationError }],
      });
      return;
    }
    const response = await howToUse(word);
    if (!response.ok) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: response.error }],
      });
      return;
    }
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [buildHowToUseFlexMessage(response.result, showAll)],
    });
    return;
  }

  let sentence: string | null = null;

  if (message.quotedMessageId) {
    sentence = messageCache.get(message.quotedMessageId) ?? null;
    if (!sentence) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "Sorry, I can't find that message anymore. Try tagging me directly: @Sweety your sentence" }],
      });
      return;
    }
  } else {
    if (strippedText) sentence = strippedText;
  }

  if (!sentence) return;

  const result = await fixEnglish(sentence);

  if (!result) {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "Hmm, I couldn't process that. Try again!" }],
    });
    return;
  }

  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [buildFlexMessage(sentence, result)],
  });
}
