import { NextResponse } from "next/server";

import { normalizeInterests } from "@/lib/interests";
import { getAuthUser, toPublicUser } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/database";

type CompleteOnboardingBody = {
  interests?: string[];
  followUserIds?: string[];
  bio?: string;
  avatarUrl?: string;
};

function normalizeFollowIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export async function GET(request: Request) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  const followerCounts = new Map<string, number>();

  db.follows.forEach((follow) => {
    followerCounts.set(
      follow.followingId,
      (followerCounts.get(follow.followingId) ?? 0) + 1,
    );
  });

  const creators = db.users
    .filter((candidate) => candidate.id !== currentUser.id)
    .map((candidate) => {
      const sharedInterests = (candidate.interests ?? []).filter((interest) =>
        (currentUser.interests ?? []).includes(interest),
      );

      return {
        id: candidate.id,
        name: candidate.name,
        handle: candidate.handle,
        role: candidate.role,
        accountType: candidate.accountType,
        avatarUrl: candidate.avatarUrl,
        avatarGradient: candidate.avatarGradient,
        bio: candidate.bio,
        interests: candidate.interests ?? [],
        followerCount: followerCounts.get(candidate.id) ?? 0,
        sharedInterests,
      };
    })
    .sort((a, b) => {
      if (a.accountType !== b.accountType) {
        return a.accountType === "creator" ? -1 : 1;
      }

      if (b.sharedInterests.length !== a.sharedInterests.length) {
        return b.sharedInterests.length - a.sharedInterests.length;
      }

      return b.followerCount - a.followerCount;
    })
    .slice(0, 8);

  return NextResponse.json({ creators });
}

export async function POST(request: Request) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CompleteOnboardingBody;

  try {
    body = (await request.json()) as CompleteOnboardingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const interests = normalizeInterests(body.interests);
  const followUserIds = normalizeFollowIds(body.followUserIds);
  const bio = body.bio !== undefined ? body.bio.trim() : undefined;
  const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl.trim() : undefined;

  if (interests.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one interest to personalize your feed." },
      { status: 400 },
    );
  }

  if (bio !== undefined && bio.length > 160) {
    return NextResponse.json(
      { error: "Bio must be 160 characters or fewer." },
      { status: 400 },
    );
  }

  if (avatarUrl !== undefined && avatarUrl !== "" && !avatarUrl.startsWith("/uploads/")) {
    return NextResponse.json(
      { error: "Profile photo must point to /uploads." },
      { status: 400 },
    );
  }

  const result = await updateDb((db) => {
    const user = db.users.find((candidate) => candidate.id === currentUser.id);

    if (!user) {
      return { type: "missing" as const };
    }

    const allowedFollowIds = new Set(
      db.users
        .filter((candidate) => candidate.id !== currentUser.id)
        .map((candidate) => candidate.id),
    );

    const nextFollowIds = [...new Set(followUserIds)].filter((id) => allowedFollowIds.has(id));

    user.interests = interests;
    user.bio = bio !== undefined ? bio : user.bio;
    user.avatarUrl = avatarUrl !== undefined ? avatarUrl || undefined : user.avatarUrl;
    user.onboardingCompleted = true;

    nextFollowIds.forEach((followingId) => {
      const exists = db.follows.some(
        (follow) =>
          follow.followerId === currentUser.id && follow.followingId === followingId,
      );

      if (!exists) {
        db.follows.push({
          followerId: currentUser.id,
          followingId,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return {
      type: "updated" as const,
      user: toPublicUser(user),
      followingIds: db.follows
        .filter((follow) => follow.followerId === currentUser.id)
        .map((follow) => follow.followingId),
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    user: result.user,
    followingIds: result.followingIds,
  });
}
