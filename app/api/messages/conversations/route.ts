import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { type SqliteDatabaseHandle, updateDb, withSqliteWrite } from "@/lib/server/database";
import {
  formatRelativeTime,
  isTypingActive,
  resolvePresence,
  summarizeConversationMessage,
} from "@/lib/server/format";
import { isBlockedBetween } from "@/lib/server/safety";
import type {
  BlockRecord,
  ConversationDto,
  ConversationRecord,
  MessageRecord,
  UserRecord,
} from "@/lib/server/types";

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

async function loadConversationDtosDirect(
  sqliteDb: SqliteDatabaseHandle,
  currentUserId: string,
): Promise<{ conversations: ConversationDto[] }> {
  const conversationRows = sqliteDb
    .prepare(
      "SELECT DISTINCT c.payload FROM conversations c JOIN json_each(c.payload, '$.participantIds') participants ON participants.value = ? ORDER BY c.sort_at DESC",
    )
    .all(currentUserId);
  const allConversations = parsePayloadRows<ConversationRecord>(conversationRows);

  const blockRows = sqliteDb
    .prepare("SELECT payload FROM blocks WHERE owner_id = ? OR related_id = ?")
    .all(currentUserId, currentUserId);
  const blocks = parsePayloadRows<BlockRecord>(blockRows);

  const conversations = allConversations.filter((conversation) =>
    conversation.participantIds
      .filter((participantId) => participantId !== currentUserId)
      .every((participantId) => !isBlockedForUser(blocks, currentUserId, participantId)),
  );

  if (conversations.length === 0) {
    return { conversations: [] };
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const messagePlaceholders = conversationIds.map(() => "?").join(", ");
  const messageRows = sqliteDb
    .prepare(
      `SELECT payload FROM messages WHERE related_id IN (${messagePlaceholders}) ORDER BY sort_at ASC`,
    )
    .all(...conversationIds);
  const messages = parsePayloadRows<MessageRecord>(messageRows);
  const messagesByConversation = new Map<string, MessageRecord[]>();
  const changedMessages: MessageRecord[] = [];

  for (const message of messages) {
    const current = messagesByConversation.get(message.conversationId) ?? [];
    current.push(message);
    messagesByConversation.set(message.conversationId, current);

    if (message.senderId !== currentUserId) {
      const deliveredToIds = new Set(message.deliveredToIds ?? []);
      if (!deliveredToIds.has(currentUserId)) {
        deliveredToIds.add(currentUserId);
        message.deliveredToIds = [...deliveredToIds];
        changedMessages.push(message);
      }
    }
  }

  if (changedMessages.length > 0) {
    const updateMessage = sqliteDb.prepare("UPDATE messages SET payload = ? WHERE entity_key = ?");
    changedMessages.forEach((message) => {
      updateMessage.run(JSON.stringify(message), message.id);
    });
  }

  const participantIds = Array.from(
    new Set(
      conversations.flatMap((conversation) =>
        conversation.participantIds.filter((participantId) => participantId !== currentUserId),
      ),
    ),
  );
  const usersById = new Map<string, UserRecord>();

  if (participantIds.length > 0) {
    const userPlaceholders = participantIds.map(() => "?").join(", ");
    const userRows = sqliteDb
      .prepare(`SELECT payload FROM users WHERE entity_key IN (${userPlaceholders})`)
      .all(...participantIds);
    parsePayloadRows<UserRecord>(userRows).forEach((user) => {
      usersById.set(user.id, user);
    });
  }

  const dtos = conversations
    .map<ConversationDto>((conversation) => {
      const otherUserIds = conversation.participantIds.filter((id) => id !== currentUserId);
      const otherUsers = otherUserIds
        .map((id) => usersById.get(id))
        .filter((candidate): candidate is UserRecord => Boolean(candidate));
      const otherUserId = otherUserIds[0] ?? currentUserId;
      const otherUser = usersById.get(otherUserId);
      const isGroup = otherUserIds.length > 1;
      const conversationName = isGroup
        ? `${otherUsers
            .slice(0, 2)
            .map((candidate) => candidate.name)
            .join(", ")}${otherUsers.length > 2 ? ` +${otherUsers.length - 2}` : ""}`
        : otherUser?.name ?? "Conversation";
      const history =
        messagesByConversation.get(conversation.id)?.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ) ?? [];
      const callHistory = history.filter((message) => message.systemType === "call");
      const recordingHistory = history.filter((message) =>
        message.attachment?.name?.startsWith("motion-call-recording-"),
      );
      const lastCall = callHistory.at(-1);
      const directionalCalls = callHistory.filter(
        (message) => message.callEvent === "started" || message.callEvent === "missed",
      );
      const pinned = (conversation.pinnedByUserIds ?? []).includes(currentUserId);
      const missedCallCount = callHistory.filter(
        (message) =>
          message.callEvent === "missed" && !(message.readByIds ?? []).includes(currentUserId),
      ).length;
      const lastMessage = history.at(-1);
      const typing = otherUserIds.some((participantId) =>
        isTypingActive(conversation.typingByUserId?.[participantId]),
      );

      return {
        id: conversation.id,
        userId: otherUserId,
        name: conversationName,
        isGroup,
        memberCount: conversation.participantIds.length,
        pinned,
        status: isGroup ? "Away" : resolvePresence(otherUser),
        unread: conversation.unreadCountByUserId[currentUserId] ?? 0,
        time: formatRelativeTime(lastMessage?.createdAt ?? conversation.updatedAt),
        lastMessage: summarizeConversationMessage({
          message: lastMessage,
          currentUserId,
          otherTyping: typing,
        }),
        typing,
        chatWallpaper: conversation.chatWallpaper,
        chatWallpaperUrl: conversation.chatWallpaperUrl,
        chatWallpaperLight: conversation.chatWallpaperLight,
        chatWallpaperLightUrl: conversation.chatWallpaperLightUrl,
        chatWallpaperDark: conversation.chatWallpaperDark,
        chatWallpaperDarkUrl: conversation.chatWallpaperDarkUrl,
        chatWallpaperBlur: conversation.chatWallpaperBlur,
        chatWallpaperDim: conversation.chatWallpaperDim,
        missedCallCount,
        hasRecordingHistory: recordingHistory.length > 0,
        recordingCount: recordingHistory.length,
        hasVoiceCallHistory: callHistory.some((message) => message.callMode === "voice"),
        hasVideoCallHistory: callHistory.some((message) => message.callMode === "video"),
        hasIncomingCallHistory: directionalCalls.some(
          (message) => message.senderId !== currentUserId,
        ),
        hasOutgoingCallHistory: directionalCalls.some(
          (message) => message.senderId === currentUserId,
        ),
        lastCallMode: lastCall?.callMode,
        lastCallEvent: lastCall?.callEvent,
      };
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      const aConversation = conversations.find((candidate) => candidate.id === a.id);
      const bConversation = conversations.find((candidate) => candidate.id === b.id);
      return (
        new Date(bConversation?.updatedAt ?? 0).getTime() -
        new Date(aConversation?.updatedAt ?? 0).getTime()
      );
    });

  return { conversations: dtos };
}

export async function GET(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const directResult = await withSqliteWrite((sqliteDb) =>
      loadConversationDtosDirect(sqliteDb, user.id),
    );

    if (directResult) {
      return NextResponse.json(directResult);
    }
  } catch {
    // Fall back to the compatibility path below.
  }

  const result = await updateDb((db) => {
    const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));
    const messagesByConversation = new Map<string, typeof db.messages>();

    for (const message of db.messages) {
      const current = messagesByConversation.get(message.conversationId) ?? [];
      current.push(message);
      messagesByConversation.set(message.conversationId, current);
    }

    const conversations: ConversationDto[] = db.conversations
      .filter(
        (conversation) =>
          conversation.participantIds.includes(user.id) &&
          !conversation.participantIds
            .filter((id) => id !== user.id)
            .some((participantId) => isBlockedBetween(db, user.id, participantId)),
      )
      .map((conversation) => {
        const otherUserIds = conversation.participantIds.filter((id) => id !== user.id);
        const otherUsers = otherUserIds
          .map((id) => usersById.get(id))
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
        const otherUserId = otherUserIds[0] ?? user.id;
        const otherUser = usersById.get(otherUserId);
        const isGroup = otherUserIds.length > 1;
        const conversationName = isGroup
          ? `${otherUsers
              .slice(0, 2)
              .map((candidate) => candidate.name)
              .join(", ")}${otherUsers.length > 2 ? ` +${otherUsers.length - 2}` : ""}`
          : otherUser?.name ?? "Conversation";
        const history = (messagesByConversation.get(conversation.id) ?? [])
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const callHistory = history.filter((message) => message.systemType === "call");
        const recordingHistory = history.filter((message) =>
          message.attachment?.name?.startsWith("motion-call-recording-"),
        );
        const lastCall = callHistory.at(-1);
        const directionalCalls = callHistory.filter(
          (message) =>
            message.callEvent === "started" || message.callEvent === "missed",
        );
        const pinned = (conversation.pinnedByUserIds ?? []).includes(user.id);
        const missedCallCount = callHistory.filter(
          (message) =>
            message.callEvent === "missed" && !(message.readByIds ?? []).includes(user.id),
        ).length;

        history.forEach((message) => {
          if (message.senderId === user.id) {
            return;
          }

          const deliveredToIds = new Set(message.deliveredToIds ?? []);
          deliveredToIds.add(user.id);
          message.deliveredToIds = [...deliveredToIds];
        });

        const lastMessage = history.at(-1);
        const typing = otherUserIds.some((participantId) =>
          isTypingActive(conversation.typingByUserId?.[participantId]),
        );

        return {
          id: conversation.id,
          userId: otherUserId,
          name: conversationName,
          isGroup,
          memberCount: conversation.participantIds.length,
          pinned,
          status: isGroup ? "Away" : resolvePresence(otherUser),
          unread: conversation.unreadCountByUserId[user.id] ?? 0,
          time: formatRelativeTime(lastMessage?.createdAt ?? conversation.updatedAt),
          lastMessage: summarizeConversationMessage({
            message: lastMessage,
            currentUserId: user.id,
            otherTyping: typing,
          }),
          typing,
          chatWallpaper: conversation.chatWallpaper,
          chatWallpaperUrl: conversation.chatWallpaperUrl,
          chatWallpaperLight: conversation.chatWallpaperLight,
          chatWallpaperLightUrl: conversation.chatWallpaperLightUrl,
          chatWallpaperDark: conversation.chatWallpaperDark,
          chatWallpaperDarkUrl: conversation.chatWallpaperDarkUrl,
          chatWallpaperBlur: conversation.chatWallpaperBlur,
          chatWallpaperDim: conversation.chatWallpaperDim,
          missedCallCount,
          hasRecordingHistory: recordingHistory.length > 0,
          recordingCount: recordingHistory.length,
          hasVoiceCallHistory: callHistory.some((message) => message.callMode === "voice"),
          hasVideoCallHistory: callHistory.some((message) => message.callMode === "video"),
          hasIncomingCallHistory: directionalCalls.some(
            (message) => message.senderId !== user.id,
          ),
          hasOutgoingCallHistory: directionalCalls.some(
            (message) => message.senderId === user.id,
          ),
          lastCallMode: lastCall?.callMode,
          lastCallEvent: lastCall?.callEvent,
        };
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        const aConversation = db.conversations.find((candidate) => candidate.id === a.id);
        const bConversation = db.conversations.find((candidate) => candidate.id === b.id);
        return (
          new Date(bConversation?.updatedAt ?? 0).getTime() -
          new Date(aConversation?.updatedAt ?? 0).getTime()
        );
      });

    return { conversations };
  });

  return NextResponse.json(result);
}
