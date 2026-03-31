import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { readDb } from "@/lib/server/database";
import { isBlockedBetween } from "@/lib/server/safety";

type FollowListType = "followers" | "following";

export async function GET(request: Request) {
  const currentUser = await getAuthUser(request);
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const listType = searchParams.get("list") as FollowListType | null;

  if (!currentUser && !userIdParam) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  const normalizedKey = userIdParam?.trim().toLowerCase() ?? "";
  const targetUser = userIdParam
    ? db.users.find(
        (user) =>
          user.id === userIdParam ||
          user.handle.toLowerCase() === normalizedKey,
      )
    : currentUser ?? null;

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const userId = targetUser.id;

  const followerIds = db.follows
    .filter((follow) => follow.followingId === userId)
    .map((follow) => follow.followerId);
  const followingIds = db.follows
    .filter((follow) => follow.followerId === userId)
    .map((follow) => follow.followingId);
  const followerCount = followerIds.length;
  const followingCount = followingIds.length;
  const isFollowing =
    currentUser != null &&
    userId !== currentUser.id &&
    db.follows.some(
      (follow) =>
        follow.followerId === currentUser.id && follow.followingId === userId,
    );

  if (listType === "followers" || listType === "following") {
    const ids = listType === "followers" ? followerIds : followingIds;
    const users = ids
      .map((id) => db.users.find((user) => user.id === id))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .filter(
        (user) =>
          !currentUser || !isBlockedBetween(db, currentUser.id, user.id),
      )
      .map((user) => ({
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatarUrl: user.avatarUrl,
        avatarGradient: user.avatarGradient,
      }));

    return NextResponse.json({
      users,
      followerCount,
      followingCount,
      isFollowing,
    });
  }

  return NextResponse.json({
    followerCount,
    followingCount,
    isFollowing,
  });
}
