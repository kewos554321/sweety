import { messagingApi } from "@line/bot-sdk";
import type { WebhookEvent, TextMessage } from "@line/bot-sdk";
import { fixEnglish, howToUse, cheerUp, generateTopic, autoCheck, type FixResult, type HowToUseResult, type TopicResult } from "@/lib/claude";
import { getSettings, setSettings, type Sensitivity } from "@/lib/settings";

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
  const commands = [
    { cmd: "@Sweety <sentence>", desc: "Fix & improve your English sentence" },
    { cmd: "@Sweety /define <word>", desc: "Learn the meaning and usage of a word or phrase" },
    { cmd: "@Sweety /define --all <word>", desc: "Same as /define but also shows word etymology" },
    { cmd: "@Sweety /cheer @Someone", desc: "Send an upbeat encouragement to someone in the group" },
    { cmd: "@Sweety /topic", desc: "Get a full IELTS Speaking topic set (Part 1, 2 & 3)" },
  ];

  return {
    type: "flex",
    altText: "Sweety — Available Commands",
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
          { type: "text", text: "Here's what I can do!", color: "#EEE9FF", size: "sm" },
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
              { type: "text", text: "Trigger", weight: "bold", size: "sm", color: "#7B61FF" },
              { type: "text", text: "@Sweety  or  !sweety  or  !swt", size: "sm", color: "#555555", wrap: true },
            ],
          },
          { type: "separator" },
          ...commands.flatMap((c, i) => [
            ...(i > 0 ? [{ type: "separator" as const }] : []),
            {
              type: "box" as const,
              layout: "vertical" as const,
              spacing: "xs" as const,
              contents: [
                { type: "text" as const, text: c.cmd, weight: "bold" as const, size: "sm" as const, color: "#7B61FF", wrap: true },
                { type: "text" as const, text: c.desc, size: "sm" as const, color: "#555555", wrap: true },
              ],
            },
          ]),
        ],
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStatusFlexMessage(groupId: string): any {
  const { autoEnabled, sensitivity } = getSettings(groupId);
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
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              { type: "text", text: "@Sweety /auto on|off — toggle auto mode", size: "xs", color: "#9CA3AF", wrap: true },
              { type: "text", text: "@Sweety /auto sensitivity low|medium|high", size: "xs", color: "#9CA3AF", wrap: true },
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

const BANG_PREFIX_RE = /^!(sweety|swt)\s*/i;

export async function handleLineEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== "message" || event.message.type !== "text") return;
  if (!("replyToken" in event)) return;

  const message = event.message as TextMessage & { id: string; quotedMessageId?: string; mention?: { mentionees: { isSelf: boolean; index: number; length: number }[] } };
  const userMessage = message.text;

  cacheMessage(message.id, userMessage);

  const isMentioned = message.mention?.mentionees.some((m) => m.isSelf);
  const isBangTriggered = BANG_PREFIX_RE.test(userMessage);
  if (!isMentioned && !isBangTriggered) return;

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

  if (cmd?.command === "/help") {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [buildHelpFlexMessage()],
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
