import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { updateDb } from "@/lib/server/database";
import { canMessageUser, getMutedUserIds, isBlockedBetween } from "@/lib/server/safety";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type SafetyActionBody = {
  action?: "block" | "mute";
  value?: boolean;
};

function resolveTargetId(targetKey: string, ids: { id: string; handle: string }[]) {
  const normalized = targetKey.trim().toLowerCase();
  return ids.find(
    (entry) => entry.id === targetKey || entry.handle.toLowerCase() === normalized,
  );
}

export async function GET(request: Request, context: RouteContext) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  const result = await updateDb((db) => {
    const target = resolveTargetId(
      userId,
      db.users.map((user) => ({ id: user.id, handle: user.handle })),
    );

    if (!target) {
      return { type: "missing" as const };
    }

    if (target.id === currentUser.id) {
      return { type: "self" as const };
    }

    const mutedIds = getMutedUserIds(db, currentUser.id);
    const targetUser = db.users.find((user) => user.id === target.id);
    const canMessage = canMessageUser(db, currentUser.id, target.id);

    return {
      type: "ok" as const,
      blocked: isBlockedBetween(db, currentUser.id, target.id),
      muted: mutedIds.has(target.id),
      restrictedAccount: Boolean(targetUser?.restrictedAccount),
      canMessage: canMessage.allowed,
      messageGateReason: canMessage.reason,
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (result.type === "self") {
    return NextResponse.json(
      {
        blocked: false,
        muted: false,
        restrictedAccount: false,
        canMessage: true,
        messageGateReason: null,
      },
    );
  }

  return NextResponse.json(result);
}

export async function POST(request: Request, context: RouteContext) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SafetyActionBody;

  try {
    body = (await request.json()) as SafetyActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (body.action !== "block" && body.action !== "mute") {
    return NextResponse.json({ error: "Invalid safety action." }, { status: 400 });
  }

  const { userId } = await context.params;

  const result = await updateDb((db) => {
    const target = resolveTargetId(
      userId,
      db.users.map((user) => ({ id: user.id, handle: user.handle })),
    );

    if (!target) {
      return { type: "missing" as const };
    }

    if (target.id === currentUser.id) {
      return { type: "self" as const };
    }

    const now = new Date().toISOString();

    if (body.action === "block") {
      const existingIndex = db.blocks.findIndex(
        (entry) =>
          entry.blockerId === currentUser.id && entry.blockedUserId === target.id,
      );
      const nextValue =
        typeof body.value === "boolean" ? body.value : existingIndex === -1;

      if (nextValue) {
        if (existingIndex === -1) {
          db.blocks.push({
            blockerId: currentUser.id,
            blockedUserId: target.id,
            createdAt: now,
          });
        }
        db.follows = db.follows.filter(
          (follow) =>
            !(
              (follow.followerId === currentUser.id && follow.followingId === target.id) ||
              (follow.followerId === target.id && follow.followingId === currentUser.id)
            ),
        );
      } else if (existingIndex >= 0) {
        db.blocks.splice(existingIndex, 1);
      }
    } else {
      const existingIndex = db.mutes.findIndex(
        (entry) => entry.userId === currentUser.id && entry.mutedUserId === target.id,
      );
      const nextValue =
        typeof body.value === "boolean" ? body.value : existingIndex === -1;

      if (nextValue && existingIndex === -1) {
        db.mutes.push({
          userId: currentUser.id,
          mutedUserId: target.id,
          createdAt: now,
        });
      } else if (!nextValue && existingIndex >= 0) {
        db.mutes.splice(existingIndex, 1);
      }
    }

    const targetUser = db.users.find((user) => user.id === target.id);
    const canMessage = canMessageUser(db, currentUser.id, target.id);

    return {
      type: "ok" as const,
      blocked: isBlockedBetween(db, currentUser.id, target.id),
      muted: getMutedUserIds(db, currentUser.id).has(target.id),
      restrictedAccount: Boolean(targetUser?.restrictedAccount),
      canMessage: canMessage.allowed,
      messageGateReason: canMessage.reason,
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (result.type === "self") {
    return NextResponse.json({ error: "You cannot update safety controls for yourself." }, { status: 400 });
  }

  return NextResponse.json(result);
}
