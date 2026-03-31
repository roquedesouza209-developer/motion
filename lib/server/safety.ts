import type { MotionDb } from "@/lib/server/types";

export function getBlockedUserIds(db: MotionDb, userId: string) {
  return new Set(
    db.blocks
      .filter((entry) => entry.blockerId === userId)
      .map((entry) => entry.blockedUserId),
  );
}

export function getUsersWhoBlockedIds(db: MotionDb, userId: string) {
  return new Set(
    db.blocks
      .filter((entry) => entry.blockedUserId === userId)
      .map((entry) => entry.blockerId),
  );
}

export function getMutedUserIds(db: MotionDb, userId: string) {
  return new Set(
    db.mutes
      .filter((entry) => entry.userId === userId)
      .map((entry) => entry.mutedUserId),
  );
}

export function isBlockedBetween(db: MotionDb, leftUserId: string, rightUserId: string) {
  return db.blocks.some(
    (entry) =>
      (entry.blockerId === leftUserId && entry.blockedUserId === rightUserId) ||
      (entry.blockerId === rightUserId && entry.blockedUserId === leftUserId),
  );
}

export function canMessageUser(db: MotionDb, senderId: string, targetId: string) {
  if (senderId === targetId) {
    return { allowed: true as const, reason: null };
  }

  if (isBlockedBetween(db, senderId, targetId)) {
    return { allowed: false as const, reason: "blocked" as const };
  }

  const target = db.users.find((user) => user.id === targetId);
  if (!target) {
    return { allowed: false as const, reason: "missing" as const };
  }

  if (!target.restrictedAccount) {
    return { allowed: true as const, reason: null };
  }

  const followsTarget = db.follows.some(
    (follow) => follow.followerId === senderId && follow.followingId === targetId,
  );

  if (!followsTarget) {
    return { allowed: false as const, reason: "restricted" as const };
  }

  return { allowed: true as const, reason: null };
}

export function canInteractWithPostAuthor(db: MotionDb, actorId: string, authorId: string) {
  if (actorId === authorId) {
    return { allowed: true as const, reason: null };
  }

  if (isBlockedBetween(db, actorId, authorId)) {
    return { allowed: false as const, reason: "blocked" as const };
  }

  return { allowed: true as const, reason: null };
}

export function isVisibleToViewer({
  db,
  viewerId,
  authorId,
  respectMute = false,
}: {
  db: MotionDb;
  viewerId: string | null;
  authorId: string;
  respectMute?: boolean;
}) {
  if (!viewerId || viewerId === authorId) {
    return true;
  }

  if (isBlockedBetween(db, viewerId, authorId)) {
    return false;
  }

  if (respectMute) {
    return !db.mutes.some(
      (entry) => entry.userId === viewerId && entry.mutedUserId === authorId,
    );
  }

  return true;
}
