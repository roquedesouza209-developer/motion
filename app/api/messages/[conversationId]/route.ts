import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import { updateDb } from "@/lib/server/database";
import { isTypingActive, mapMessageToDto, resolvePresence } from "@/lib/server/format";
import type { ChatAttachment, MessageDto } from "@/lib/server/types";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type SendBody = {
  text?: string;
  attachment?: ChatAttachment;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await context.params;

  const result = await updateDb((db) => {
    const conversation = db.conversations.find(
      (candidate) => candidate.id === conversationId,
    );

    if (!conversation) {
      return { type: "missing" as const };
    }

    if (!conversation.participantIds.includes(user.id)) {
      return { type: "forbidden" as const };
    }

    conversation.unreadCountByUserId[user.id] = 0;

    const otherUserIds = conversation.participantIds.filter((id) => id !== user.id);
    const otherUserId = otherUserIds[0] ?? user.id;
    const otherUsers = otherUserIds
      .map((id) => db.users.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    const otherUser = otherUsers[0];
    const isGroup = otherUserIds.length > 1;
    const messages = db.messages
      .filter((message) => message.conversationId === conversation.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map<MessageDto>((message) => {
        if (message.senderId !== user.id) {
          const deliveredToIds = new Set(message.deliveredToIds ?? []);
          const readByIds = new Set(message.readByIds ?? []);
          deliveredToIds.add(user.id);
          readByIds.add(user.id);
          message.deliveredToIds = [...deliveredToIds];
          message.readByIds = [...readByIds];
        }

        return mapMessageToDto({
          message,
          currentUserId: user.id,
          recipientIds: otherUserIds,
        });
      });

    return {
      type: "ok" as const,
      conversation: {
        id: conversation.id,
        userId: otherUserId,
        name: isGroup
          ? `${otherUsers
              .slice(0, 2)
              .map((candidate) => candidate.name)
              .join(", ")}${otherUsers.length > 2 ? ` +${otherUsers.length - 2}` : ""}`
          : otherUser?.name ?? "Conversation",
        isGroup,
        memberCount: conversation.participantIds.length,
        status: isGroup ? "Away" : resolvePresence(otherUser),
        typing: otherUserIds.some((participantId) =>
          isTypingActive(conversation.typingByUserId?.[participantId]),
        ),
      },
      messages,
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SendBody;

  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const attachment = body.attachment;

  const hasAttachment =
    attachment &&
    typeof attachment.url === "string" &&
    (attachment.type === "image" || attachment.type === "audio");

  if (!hasAttachment && (text.length < 1 || text.length > 500)) {
    return NextResponse.json(
      { error: "Message must be between 1 and 500 characters." },
      { status: 400 },
    );
  }

  if (hasAttachment && !attachment.url.startsWith("/uploads/")) {
    return NextResponse.json(
      { error: "Attachment must point to /uploads." },
      { status: 400 },
    );
  }

  if (text.length > 500) {
    return NextResponse.json(
      { error: "Message must be 500 characters or fewer." },
      { status: 400 },
    );
  }

  const { conversationId } = await context.params;

  const result = await updateDb((db) => {
    const conversation = db.conversations.find(
      (candidate) => candidate.id === conversationId,
    );

    if (!conversation) {
      return { type: "missing" as const };
    }

    if (!conversation.participantIds.includes(user.id)) {
      return { type: "forbidden" as const };
    }

    const otherUserIds = conversation.participantIds.filter((id) => id !== user.id);
    const now = new Date().toISOString();
    const message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderId: user.id,
      text,
      attachment: hasAttachment
        ? {
            url: attachment.url,
            type: attachment.type,
            durationMs:
              typeof attachment.durationMs === "number"
                ? Math.max(0, Math.round(attachment.durationMs))
                : undefined,
            mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : undefined,
            name: typeof attachment.name === "string" ? attachment.name : undefined,
          }
        : undefined,
      reactions: [],
      deliveredToIds: [user.id],
      readByIds: [user.id],
      createdAt: now,
    };

    db.messages.push(message);
    conversation.updatedAt = now;
    conversation.typingByUserId = {
      ...(conversation.typingByUserId ?? {}),
    };
    delete conversation.typingByUserId[user.id];

    for (const participantId of conversation.participantIds) {
      if (participantId === user.id) {
        conversation.unreadCountByUserId[participantId] = 0;
      } else {
        conversation.unreadCountByUserId[participantId] =
          (conversation.unreadCountByUserId[participantId] ?? 0) + 1;
      }
    }

      return {
        type: "ok" as const,
        message: mapMessageToDto({
          message,
          currentUserId: user.id,
          recipientIds: otherUserIds,
        }),
      };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(result.message, { status: 201 });
}
