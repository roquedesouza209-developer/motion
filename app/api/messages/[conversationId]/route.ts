import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import {
  type SqliteDatabaseHandle,
  updateDb,
  withSqliteWrite,
} from "@/lib/server/database";
import { isTypingActive, mapMessageToDto, resolvePresence } from "@/lib/server/format";
import { canMessageUser, isBlockedBetween } from "@/lib/server/safety";
import type {
  BlockRecord,
  ChatAttachment,
  ConversationRecord,
  MessageDto,
  MessageRecord,
  UserRecord,
} from "@/lib/server/types";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type SendBody = {
  text?: string;
  attachment?: ChatAttachment;
  replyToId?: string;
};

function parsePayloadRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows
    .map((row) => {
      if (typeof row.payload !== "string") {
        return null;
      }

      try {
        return JSON.parse(row.payload) as T;
      } catch {
        return null;
      }
    })
    .filter((value): value is T => value !== null);
}

function isBlockedForUser(blocks: BlockRecord[], currentUserId: string, otherUserId: string): boolean {
  return blocks.some(
    (block) =>
      (block.blockerId === currentUserId && block.blockedUserId === otherUserId) ||
      (block.blockerId === otherUserId && block.blockedUserId === currentUserId),
  );
}

async function loadConversationThreadDirect(
  sqliteDb: SqliteDatabaseHandle,
  currentUserId: string,
  conversationId: string,
) {
  const conversationRow = sqliteDb
    .prepare("SELECT payload FROM conversations WHERE entity_key = ?")
    .get(conversationId);

  if (typeof conversationRow?.payload !== "string") {
    return { type: "missing" as const };
  }

  let conversation: ConversationRecord;

  try {
    conversation = JSON.parse(conversationRow.payload) as ConversationRecord;
  } catch {
    return { type: "missing" as const };
  }

  if (!conversation.participantIds.includes(currentUserId)) {
    return { type: "forbidden" as const };
  }

  const otherUserIds = conversation.participantIds.filter((id) => id !== currentUserId);
  const blockRows = sqliteDb
    .prepare("SELECT payload FROM blocks WHERE owner_id = ? OR related_id = ?")
    .all(currentUserId, currentUserId);
  const blocks = parsePayloadRows<BlockRecord>(blockRows);

  if (otherUserIds.some((participantId) => isBlockedForUser(blocks, currentUserId, participantId))) {
    return { type: "blocked" as const };
  }

  const userIds = Array.from(new Set(conversation.participantIds));
  const userPlaceholders = userIds.map(() => "?").join(", ");
  const userRows = sqliteDb
    .prepare(`SELECT payload FROM users WHERE entity_key IN (${userPlaceholders})`)
    .all(...userIds);
  const usersById = new Map<string, UserRecord>();
  parsePayloadRows<UserRecord>(userRows).forEach((user) => {
    usersById.set(user.id, user);
  });

  const messageRows = sqliteDb
    .prepare("SELECT payload FROM messages WHERE related_id = ? ORDER BY sort_at ASC")
    .all(conversation.id);
  const messages = parsePayloadRows<MessageRecord>(messageRows);
  const messagesById = new Map<string, MessageRecord>();
  const changedMessages: MessageRecord[] = [];

  messages.forEach((message) => {
    if (message.senderId !== currentUserId) {
      const deliveredToIds = new Set(message.deliveredToIds ?? []);
      const readByIds = new Set(message.readByIds ?? []);
      let changed = false;

      if (!deliveredToIds.has(currentUserId)) {
        deliveredToIds.add(currentUserId);
        message.deliveredToIds = [...deliveredToIds];
        changed = true;
      }

      if (!readByIds.has(currentUserId)) {
        readByIds.add(currentUserId);
        message.readByIds = [...readByIds];
        changed = true;
      }

      if (changed) {
        changedMessages.push(message);
      }
    }

    messagesById.set(message.id, message);
  });

  if ((conversation.unreadCountByUserId[currentUserId] ?? 0) !== 0) {
    conversation.unreadCountByUserId[currentUserId] = 0;
    sqliteDb
      .prepare("UPDATE conversations SET payload = ?, sort_at = ? WHERE entity_key = ?")
      .run(JSON.stringify(conversation), conversation.updatedAt, conversation.id);
  }

  if (changedMessages.length > 0) {
    const updateMessage = sqliteDb.prepare("UPDATE messages SET payload = ? WHERE entity_key = ?");
    changedMessages.forEach((message) => {
      updateMessage.run(JSON.stringify(message), message.id);
    });
  }

  const otherUsers = otherUserIds
    .map((id) => usersById.get(id))
    .filter((candidate): candidate is UserRecord => Boolean(candidate));
  const otherUser = otherUsers[0];
  const isGroup = otherUserIds.length > 1;

  return {
    type: "ok" as const,
    conversation: {
      id: conversation.id,
      userId: otherUserIds[0] ?? currentUserId,
      name: isGroup
        ? `${otherUsers
            .slice(0, 2)
            .map((candidate) => candidate.name)
            .join(", ")}${otherUsers.length > 2 ? ` +${otherUsers.length - 2}` : ""}`
        : otherUser?.name ?? "Conversation",
      isGroup,
      memberCount: conversation.participantIds.length,
      pinned: (conversation.pinnedByUserIds ?? []).includes(currentUserId),
      status: isGroup ? "Away" : resolvePresence(otherUser),
      typing: otherUserIds.some((participantId) =>
        isTypingActive(conversation.typingByUserId?.[participantId]),
      ),
      chatWallpaper: conversation.chatWallpaper,
      chatWallpaperUrl: conversation.chatWallpaperUrl,
      chatWallpaperLight: conversation.chatWallpaperLight,
      chatWallpaperLightUrl: conversation.chatWallpaperLightUrl,
      chatWallpaperDark: conversation.chatWallpaperDark,
      chatWallpaperDarkUrl: conversation.chatWallpaperDarkUrl,
      chatWallpaperBlur: conversation.chatWallpaperBlur,
      chatWallpaperDim: conversation.chatWallpaperDim,
    },
    messages: messages.map<MessageDto>((message) =>
      mapMessageToDto({
        message,
        currentUserId,
        recipientIds: otherUserIds,
        usersById,
        messagesById,
      }),
    ),
  };
}

export async function GET(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await context.params;

  try {
    const directResult = await withSqliteWrite((sqliteDb) =>
      loadConversationThreadDirect(sqliteDb, user.id, conversationId),
    );

    if (directResult) {
      if (directResult.type === "missing") {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }

      if (directResult.type === "forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (directResult.type === "blocked") {
        return NextResponse.json(
          { error: "This conversation is unavailable because one of you is blocked." },
          { status: 403 },
        );
      }

      return NextResponse.json(directResult);
    }
  } catch {
    // Fall back to the compatibility path below.
  }

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
    if (otherUserIds.some((participantId) => isBlockedBetween(db, user.id, participantId))) {
      return { type: "blocked" as const };
    }
    const otherUserId = otherUserIds[0] ?? user.id;
    const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));
    const messagesById = new Map(
      db.messages
        .filter((message) => message.conversationId === conversation.id)
        .map((message) => [message.id, message]),
    );
    const otherUsers = otherUserIds
      .map((id) => usersById.get(id))
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
          usersById,
          messagesById,
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
          pinned: (conversation.pinnedByUserIds ?? []).includes(user.id),
          status: isGroup ? "Away" : resolvePresence(otherUser),
            typing: otherUserIds.some((participantId) =>
              isTypingActive(conversation.typingByUserId?.[participantId]),
           ),
           chatWallpaper: conversation.chatWallpaper,
           chatWallpaperUrl: conversation.chatWallpaperUrl,
           chatWallpaperLight: conversation.chatWallpaperLight,
           chatWallpaperLightUrl: conversation.chatWallpaperLightUrl,
           chatWallpaperDark: conversation.chatWallpaperDark,
           chatWallpaperDarkUrl: conversation.chatWallpaperDarkUrl,
           chatWallpaperBlur: conversation.chatWallpaperBlur,
           chatWallpaperDim: conversation.chatWallpaperDim,
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

  if (result.type === "blocked") {
    return NextResponse.json(
      { error: "This conversation is unavailable because one of you is blocked." },
      { status: 403 },
    );
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
  const replyToId = typeof body.replyToId === "string" ? body.replyToId.trim() : "";

  const hasAttachment =
    attachment &&
    typeof attachment.url === "string" &&
    (attachment.type === "image" ||
      attachment.type === "audio" ||
      attachment.type === "video");

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
    if (otherUserIds.some((participantId) => isBlockedBetween(db, user.id, participantId))) {
      return { type: "blocked" as const };
    }
    if (otherUserIds.length === 1) {
      const permission = canMessageUser(db, user.id, otherUserIds[0]);
      if (!permission.allowed) {
        return { type: permission.reason === "restricted" ? "restricted" as const : "blocked" as const };
      }
    }
    const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));
    const now = new Date().toISOString();
    const replySource =
      replyToId.length > 0
        ? db.messages.find(
            (candidate) =>
              candidate.id === replyToId && candidate.conversationId === conversation.id,
          )
        : undefined;

    if (replyToId.length > 0 && !replySource) {
      return { type: "reply_missing" as const };
    }

    const messagesById = new Map<string, MessageRecord>();
    if (replySource) {
      messagesById.set(replySource.id, replySource);
    }

    const message = {
      id: createId("msg"),
      conversationId: conversation.id,
      senderId: user.id,
      text,
      replyToId: replySource?.id,
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
    messagesById.set(message.id, message);

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
          usersById,
          messagesById,
        }),
      };
  });

  if (result.type === "reply_missing") {
    return NextResponse.json({ error: "Reply target not found." }, { status: 404 });
  }

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (result.type === "blocked") {
    return NextResponse.json(
      { error: "This conversation is unavailable because one of you is blocked." },
      { status: 403 },
    );
  }

  if (result.type === "restricted") {
    return NextResponse.json(
      { error: "This account only allows messages from followers." },
      { status: 403 },
    );
  }

  return NextResponse.json(result.message, { status: 201 });
}
