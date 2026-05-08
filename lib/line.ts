import { messagingApi } from "@line/bot-sdk";
import type { WebhookEvent, TextMessage } from "@line/bot-sdk";
import { fixEnglish, howToUse, cheerUp, type FixResult, type HowToUseResult } from "@/lib/claude";

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
function buildHelpFlexMessage(): any {
  const commands = [
    { cmd: "@Sweety <sentence>", desc: "Fix & improve your English sentence" },
    { cmd: "@Sweety /define <word>", desc: "Learn the meaning and usage of a word or phrase" },
    { cmd: "@Sweety /define --all <word>", desc: "Same as /define but also shows word etymology" },
    { cmd: "@Sweety /cheer @Someone", desc: "Send an upbeat encouragement to someone in the group" },
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
        contents: commands.flatMap((c, i) => [
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

export async function handleLineEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== "message" || event.message.type !== "text") return;
  if (!("replyToken" in event)) return;

  const message = event.message as TextMessage & { id: string; quotedMessageId?: string; mention?: { mentionees: { isSelf: boolean; index: number; length: number }[] } };
  const userMessage = message.text;

  cacheMessage(message.id, userMessage);

  const isMentioned = message.mention?.mentionees.some((m) => m.isSelf);
  if (!isMentioned) return;

  const mentionees = message.mention?.mentionees ?? [];
  const strippedText = mentionees
    .slice()
    .sort((a, b) => b.index - a.index)
    .reduce(
      (text, m) => text.slice(0, m.index) + text.slice(m.index + m.length),
      userMessage
    )
    .trim();
  const cmd = parseCommand(strippedText);

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
