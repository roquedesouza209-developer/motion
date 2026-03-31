import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import { updateDb } from "@/lib/server/database";
import { isBlockedBetween } from "@/lib/server/safety";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;
  const targetKey = userId;

  if (!targetKey) {
    return NextResponse.json({ error: "User is required." }, { status: 400 });
  }

  const result = await updateDb((db) => {
    const normalizedKey = targetKey.trim().toLowerCase();
    const targetUser = db.users.find(
      (user) =>
        user.id === targetKey || user.handle.toLowerCase() === normalizedKey,
    );

    if (!targetUser) {
      return { error: "not_found" } as const;
    }

    if (targetUser.id === currentUser.id) {
      return { error: "self" } as const;
    }

    if (isBlockedBetween(db, currentUser.id, targetUser.id)) {
      return { error: "blocked" } as const;
    }

    const targetId = targetUser.id;
    const existingIndex = db.follows.findIndex(
      (follow) =>
        follow.followerId === currentUser.id && follow.followingId === targetId,
    );

    let following = false;
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      db.follows.splice(existingIndex, 1);
      following = false;
    } else {
      db.follows.push({
        followerId: currentUser.id,
        followingId: targetId,
        createdAt: now,
      });
      following = true;
      db.notifications.push({
        id: createId("not"),
        userId: targetId,
        actorId: currentUser.id,
        type: "follow",
        createdAt: now,
      });
    }

    const followerCount = db.follows.filter(
      (follow) => follow.followingId === targetId,
    ).length;
    const followingCount = db.follows.filter(
      (follow) => follow.followerId === targetId,
    ).length;

    return { following, followerCount, followingCount };
  });

  if ("error" in result) {
    if (result.error === "self") {
      return NextResponse.json({ error: "Cannot follow yourself." }, { status: 400 });
    }
    if (result.error === "blocked") {
      return NextResponse.json(
        { error: "You cannot follow an account while one of you is blocked." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
