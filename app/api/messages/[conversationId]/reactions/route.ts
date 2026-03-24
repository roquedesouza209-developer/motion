import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { updateDb } from "@/lib/server/database";
import { mapMessageToDto } from "@/lib/server/format";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type ReactionBody = {
  messageId?: string;
  emoji?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReactionBody;

  try {
    body = (await request.json()) as ReactionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const messageId = body.messageId?.trim();
  const emoji = body.emoji?.trim();

  if (!messageId || !emoji || emoji.length > 8) {
    return NextResponse.json({ error: "Choose a valid reaction." }, { status: 400 });
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

    const message = db.messages.find(
      (candidate) =>
        candidate.id === messageId && candidate.conversationId === conversationId,
    );

    if (!message) {
      return { type: "message_missing" as const };
    }

    const existingReaction = (message.reactions ?? []).find(
      (reaction) => reaction.userId === user.id,
    );
    const nextReactions = (message.reactions ?? []).filter(
      (reaction) => reaction.userId !== user.id,
    );

    if (!existingReaction || existingReaction.emoji !== emoji) {
      nextReactions.push({ userId: user.id, emoji });
    }

    message.reactions = nextReactions;

    const recipientIds = conversation.participantIds.filter(
      (participantId) => participantId !== user.id,
    );

    return {
      type: "ok" as const,
      message: mapMessageToDto({
        message,
        currentUserId: user.id,
        recipientIds,
      }),
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "message_missing") {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ message: result.message });
}
