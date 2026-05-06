import { messagingApi } from "@line/bot-sdk";
import type { WebhookEvent, TextMessage } from "@line/bot-sdk";
import { fixEnglish, type FixResult } from "@/lib/claude";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFlexMessage(sentence: string, result: FixResult): any {
  const alternativesText = result.alternatives.join("\n");

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
              {
                type: "text",
                text: alternativesText,
                wrap: true,
                size: "sm",
                color: "#555555",
              },
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

  const message = event.message as TextMessage & { id: string; quotedMessageId?: string; mention?: { mentionees: { isSelf: boolean }[] } };
  const userMessage = message.text;

  cacheMessage(message.id, userMessage);

  const isMentioned = message.mention?.mentionees.some((m) => m.isSelf);
  if (!isMentioned) return;

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
    const directMatch = userMessage.replace(/@\S+/g, "").trim();
    if (directMatch) sentence = directMatch;
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
