import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import { updateDb } from "@/lib/server/database";
import type { SafetyReportTargetType } from "@/lib/server/types";

type CreateReportBody = {
  targetType?: SafetyReportTargetType;
  targetId?: string;
  targetUserId?: string;
  conversationId?: string;
  reason?: string;
  details?: string;
};

export async function POST(request: Request) {
  const currentUser = await getAuthUser(request);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateReportBody;

  try {
    body = (await request.json()) as CreateReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (
    body.targetType !== "account" &&
    body.targetType !== "post" &&
    body.targetType !== "message"
  ) {
    return NextResponse.json({ error: "Invalid report target." }, { status: 400 });
  }

  const targetType = body.targetType;

  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const details =
    typeof body.details === "string" && body.details.trim().length > 0
      ? body.details.trim()
      : undefined;

  if (!targetId) {
    return NextResponse.json({ error: "Target is required." }, { status: 400 });
  }

  if (reason.length < 3) {
    return NextResponse.json({ error: "Give a short reason for the report." }, { status: 400 });
  }

  if (reason.length > 120) {
    return NextResponse.json({ error: "Reason must be 120 characters or fewer." }, { status: 400 });
  }

  if (details && details.length > 500) {
    return NextResponse.json({ error: "Details must be 500 characters or fewer." }, { status: 400 });
  }

  const result = await updateDb((db) => {
    let targetUserId =
      typeof body.targetUserId === "string" && body.targetUserId.trim().length > 0
        ? body.targetUserId.trim()
        : undefined;
    let conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim().length > 0
        ? body.conversationId.trim()
        : undefined;

    if (body.targetType === "account") {
      const targetUser = db.users.find(
        (user) => user.id === targetId || user.handle.toLowerCase() === targetId.toLowerCase(),
      );
      if (!targetUser) {
        return { type: "missing" as const };
      }
      targetUserId = targetUser.id;
    }

    if (body.targetType === "post") {
      const post = db.posts.find((candidate) => candidate.id === targetId);
      if (!post) {
        return { type: "missing" as const };
      }
      targetUserId = post.userId;
    }

    if (body.targetType === "message") {
      const message = db.messages.find((candidate) => candidate.id === targetId);
      if (!message) {
        return { type: "missing" as const };
      }
      targetUserId = message.senderId;
      conversationId = message.conversationId;
    }

    db.safetyReports.unshift({
      id: createId("rpt"),
      reporterId: currentUser.id,
      targetType,
      targetId,
      targetUserId,
      conversationId,
      reason,
      details,
      status: "open",
      createdAt: new Date().toISOString(),
    });

    return { type: "ok" as const };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "That item could not be found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
