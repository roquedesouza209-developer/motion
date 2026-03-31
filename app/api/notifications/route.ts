import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { readDb, type SqliteDatabaseHandle, withSqliteRead } from "@/lib/server/database";
import { formatRelativeTime } from "@/lib/server/format";
import { getMutedUserIds, isBlockedBetween } from "@/lib/server/safety";
import type {
  BlockRecord,
  CallSessionRecord,
  MotionDb,
  NotificationRecord,
  PostRecord,
  StoryRecord,
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

function getMutedUserIdsDirect(mutes: MotionDb["mutes"], userId: string) {
  return new Set(
    mutes.filter((entry) => entry.userId === userId).map((entry) => entry.mutedUserId),
  );
}

function isBlockedBetweenDirect(
  blocks: BlockRecord[],
  leftUserId: string,
  rightUserId: string,
) {
  return blocks.some(
    (entry) =>
      (entry.blockerId === leftUserId && entry.blockedUserId === rightUserId) ||
      (entry.blockerId === rightUserId && entry.blockedUserId === leftUserId),
  );
}

async function loadNotificationsDirect(sqliteDb: SqliteDatabaseHandle, currentUserId: string) {
  const notificationRows = sqliteDb
    .prepare("SELECT payload FROM notifications WHERE owner_id = ? ORDER BY sort_at DESC LIMIT 60")
    .all(currentUserId);
  const notifications = parsePayloadRows<NotificationRecord>(notificationRows);

  if (notifications.length === 0) {
    return { notifications: [] };
  }

  const mutedRows = sqliteDb
    .prepare("SELECT payload FROM mutes WHERE owner_id = ?")
    .all(currentUserId);
  const mutes = parsePayloadRows<MotionDb["mutes"][number]>(mutedRows);
  const mutedUserIds = getMutedUserIdsDirect(mutes, currentUserId);

  const blockRows = sqliteDb
    .prepare("SELECT payload FROM blocks WHERE owner_id = ? OR related_id = ?")
    .all(currentUserId, currentUserId);
  const blocks = parsePayloadRows<BlockRecord>(blockRows);

  const filteredNotifications = notifications.filter(
    (notification) =>
      !mutedUserIds.has(notification.actorId) &&
      !isBlockedBetweenDirect(blocks, currentUserId, notification.actorId),
  );

  const actorIds = Array.from(new Set(filteredNotifications.map((notification) => notification.actorId)));
  const postIds = Array.from(
    new Set(
      filteredNotifications
        .map((notification) => notification.postId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const storyIds = Array.from(
    new Set(
      filteredNotifications
        .map((notification) => notification.storyId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const callIds = Array.from(
    new Set(
      filteredNotifications
        .map((notification) => notification.callId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const usersById = new Map<string, UserRecord>();
  if (actorIds.length > 0) {
    const placeholders = actorIds.map(() => "?").join(", ");
    const actorRows = sqliteDb
      .prepare(`SELECT payload FROM users WHERE entity_key IN (${placeholders})`)
      .all(...actorIds);
    parsePayloadRows<UserRecord>(actorRows).forEach((actor) => {
      usersById.set(actor.id, actor);
    });
  }

  const postsById = new Map<string, PostRecord>();
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => "?").join(", ");
    const postRows = sqliteDb
      .prepare(`SELECT payload FROM posts WHERE entity_key IN (${placeholders})`)
      .all(...postIds);
    parsePayloadRows<PostRecord>(postRows).forEach((post) => {
      postsById.set(post.id, post);
    });
  }

  const storiesById = new Map<string, StoryRecord>();
  if (storyIds.length > 0) {
    const placeholders = storyIds.map(() => "?").join(", ");
    const storyRows = sqliteDb
      .prepare(`SELECT payload FROM stories WHERE entity_key IN (${placeholders})`)
      .all(...storyIds);
    parsePayloadRows<StoryRecord>(storyRows).forEach((story) => {
      storiesById.set(story.id, story);
    });
  }

  const callsById = new Map<string, CallSessionRecord>();
  if (callIds.length > 0) {
    const placeholders = callIds.map(() => "?").join(", ");
    const callRows = sqliteDb
      .prepare(`SELECT payload FROM call_sessions WHERE entity_key IN (${placeholders})`)
      .all(...callIds);
    parsePayloadRows<CallSessionRecord>(callRows).forEach((call) => {
      callsById.set(call.id, call);
    });
  }

  return {
    notifications: filteredNotifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 25)
      .map((notification) => {
        const actor = usersById.get(notification.actorId);
        const post = notification.postId ? postsById.get(notification.postId) : null;
        const story = notification.storyId ? storiesById.get(notification.storyId) : null;
        const call = notification.callId ? callsById.get(notification.callId) : null;

        return {
          id: notification.id,
          type: notification.type,
          createdAt: notification.createdAt,
          time: formatRelativeTime(notification.createdAt),
          callMode: notification.callMode ?? null,
          conversationId: notification.conversationId ?? call?.conversationId ?? null,
          emoji: notification.emoji ?? null,
          text: notification.text ?? null,
          actor: actor
            ? {
                id: actor.id,
                name: actor.name,
                handle: actor.handle,
                avatarGradient: actor.avatarGradient,
                avatarUrl: actor.avatarUrl,
              }
            : null,
          post: post
            ? {
                id: post.id,
                caption: post.caption,
                kind: post.kind,
              }
            : null,
          story: story
            ? {
                id: story.id,
                caption: story.caption,
              }
            : null,
        };
      })
      .filter((notification) => Boolean(notification.actor)),
  };
}

export async function GET(request: Request) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const directResult = await withSqliteRead((sqliteDb) =>
      loadNotificationsDirect(sqliteDb, currentUser.id),
    );

    if (directResult) {
      return NextResponse.json(directResult);
    }
  } catch {
    // Fall back to the compatibility path below.
  }

  const db = await readDb();
  const usersById = new Map(db.users.map((user) => [user.id, user]));
  const callsById = new Map(db.callSessions.map((call) => [call.id, call]));
  const mutedUserIds = getMutedUserIds(db, currentUser.id);

  const postsById = new Map(db.posts.map((post) => [post.id, post]));
  const storiesById = new Map(db.stories.map((story) => [story.id, story]));

  const notifications = db.notifications
    .filter(
      (notification) =>
        notification.userId === currentUser.id &&
        !mutedUserIds.has(notification.actorId) &&
        !isBlockedBetween(db, currentUser.id, notification.actorId),
    )
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 25)
    .map((notification) => {
      const actor = usersById.get(notification.actorId);
      const post = notification.postId ? postsById.get(notification.postId) : null;
      const story = notification.storyId
        ? storiesById.get(notification.storyId)
        : null;
      const call = notification.callId ? callsById.get(notification.callId) : null;
      return {
        id: notification.id,
        type: notification.type,
        createdAt: notification.createdAt,
        time: formatRelativeTime(notification.createdAt),
        callMode: notification.callMode ?? null,
        conversationId: notification.conversationId ?? call?.conversationId ?? null,
        emoji: notification.emoji ?? null,
        text: notification.text ?? null,
        actor: actor
          ? {
              id: actor.id,
              name: actor.name,
              handle: actor.handle,
              avatarGradient: actor.avatarGradient,
              avatarUrl: actor.avatarUrl,
            }
          : null,
        post: post
          ? {
              id: post.id,
              caption: post.caption,
              kind: post.kind,
            }
          : null,
        story: story
          ? {
              id: story.id,
              caption: story.caption,
            }
          : null,
      };
    })
    .filter((notification) => Boolean(notification.actor));

  return NextResponse.json({ notifications });
}
