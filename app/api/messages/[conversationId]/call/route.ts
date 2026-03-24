import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import { readDb, updateDb } from "@/lib/server/database";
import { mapCallSessionToDto } from "@/lib/server/format";
import type {
  CallMode,
  CallSessionRecord,
  CallSignalType,
  MessageRecord,
} from "@/lib/server/types";
import type { RouteContext } from "@/lib/server/route-context";

const ACTIVE_CALL_STATUSES = new Set(["ringing", "connecting", "active"]);

function appendCallHistoryMessage({
  conversation,
  messages,
  callId,
  mode,
  senderId,
  text,
  event,
  durationMs,
  createdAt,
}: {
  conversation: {
    id: string;
    participantIds: string[];
    unreadCountByUserId: Record<string, number>;
    updatedAt: string;
  };
  messages: MessageRecord[];
  callId: string;
  mode: CallMode;
  senderId: string;
  text: string;
  event: "started" | "accepted" | "declined" | "ended" | "missed";
  durationMs?: number;
  createdAt: string;
}) {
  if (messages.some((message) => message.callId === callId && message.callEvent === event)) {
    return;
  }

  messages.push({
    id: createId("msg"),
    conversationId: conversation.id,
    senderId,
    text,
    systemType: "call",
    callId,
    callMode: mode,
    callEvent: event,
    callDurationMs:
      typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0
        ? Math.round(durationMs)
        : undefined,
    reactions: [],
    deliveredToIds: [],
    readByIds: [],
    createdAt,
  });
  conversation.updatedAt = createdAt;

  for (const participantId of conversation.participantIds) {
    if (participantId === senderId) {
      conversation.unreadCountByUserId[participantId] = 0;
    } else {
      conversation.unreadCountByUserId[participantId] =
        (conversation.unreadCountByUserId[participantId] ?? 0) + 1;
    }
  }
}

type CallBody =
  | {
      action: "start";
      mode?: CallMode;
      participantIds?: string[];
    }
  | {
      action: "accept" | "decline" | "end";
      callId?: string;
    }
  | {
      action: "signal";
      callId?: string;
      signalType?: CallSignalType;
      payload?: unknown;
      toUserId?: string;
    }
  | {
      action: "media";
      callId?: string;
      audioEnabled?: boolean;
      videoEnabled?: boolean;
      screenSharing?: boolean;
      recording?: boolean;
    };

function normalizeParticipantIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input.filter((value): value is string => typeof value === "string"))];
}

function sameParticipantSet(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((value, index) => value === bSorted[index]);
}

function getActiveConversationCall(
  calls: CallSessionRecord[],
  conversationId: string,
  userId: string,
) {
  return (
    [...calls]
      .filter(
        (candidate) =>
          candidate.conversationId === conversationId &&
          candidate.participantIds.includes(userId) &&
          ACTIVE_CALL_STATUSES.has(candidate.status) &&
          !candidate.endedAt,
      )
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0] ?? null
  );
}

export async function GET(request: Request, context: RouteContext<{ conversationId: string }>) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await context.params;
  const db = await readDb();
  const conversation = db.conversations.find((candidate) => candidate.id === conversationId);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (!conversation.participantIds.includes(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = getActiveConversationCall(db.callSessions, conversationId, user.id);
  const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));

  return NextResponse.json({
    session: session ? mapCallSessionToDto({ session, usersById, currentUserId: user.id }) : null,
  });
}

export async function POST(
  request: Request,
  context: RouteContext<{ conversationId: string }>,
) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CallBody;

  try {
    body = (await request.json()) as CallBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { conversationId } = await context.params;

  const result = await updateDb((db) => {
    const conversation = db.conversations.find((candidate) => candidate.id === conversationId);

    if (!conversation) {
      return { type: "missing" as const };
    }

    if (!conversation.participantIds.includes(user.id)) {
      return { type: "forbidden" as const };
    }

    const now = new Date().toISOString();
    const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));

    if (body.action === "start") {
      const mode = body.mode === "voice" || body.mode === "video" ? body.mode : "video";
      const requestedParticipantIds = normalizeParticipantIds(body.participantIds).filter(
        (participantId) => participantId !== user.id && usersById.has(participantId),
      );
      const targetParticipantIds = [
        ...new Set([...conversation.participantIds, ...requestedParticipantIds]),
      ];
      let targetConversation = conversation;

      if (!sameParticipantSet(targetConversation.participantIds, targetParticipantIds)) {
        targetConversation =
          db.conversations.find((candidate) =>
            sameParticipantSet(candidate.participantIds, targetParticipantIds),
          ) ?? {
            id: createId("convo"),
            participantIds: targetParticipantIds,
            unreadCountByUserId: Object.fromEntries(
              targetParticipantIds.map((participantId) => [participantId, 0]),
            ),
            typingByUserId: {},
            updatedAt: now,
          };

        if (!db.conversations.some((candidate) => candidate.id === targetConversation.id)) {
          db.conversations.unshift(targetConversation);
        }
      }

      const activeConversationCall = getActiveConversationCall(
        db.callSessions,
        targetConversation.id,
        user.id,
      );

      if (activeConversationCall) {
        return {
          type: "ok" as const,
          session: mapCallSessionToDto({
            session: activeConversationCall,
            usersById,
            currentUserId: user.id,
          }),
        };
      }

      const blockingCall = db.callSessions.find(
        (candidate) =>
          ACTIVE_CALL_STATUSES.has(candidate.status) &&
          !candidate.endedAt &&
          candidate.conversationId !== targetConversation.id &&
          candidate.participantIds.some((participantId) =>
            targetParticipantIds.includes(participantId),
          ),
      );

      if (blockingCall) {
        return { type: "busy" as const };
      }

      const session: CallSessionRecord = {
        id: createId("call"),
        conversationId: targetConversation.id,
        initiatorId: user.id,
        participantIds: targetParticipantIds,
        mode,
        status: "ringing",
        participants: targetParticipantIds.map((participantId) => ({
          userId: participantId,
          joinedAt: participantId === user.id ? now : undefined,
          audioEnabled: true,
          videoEnabled: mode === "video",
          screenSharing: false,
          recording: false,
        })),
        signals: [],
        createdAt: now,
        updatedAt: now,
      };

      db.callSessions.unshift(session);
      appendCallHistoryMessage({
        conversation: targetConversation,
        messages: db.messages,
        callId: session.id,
        mode,
        senderId: user.id,
        text:
          targetParticipantIds.length > 2
            ? `${mode === "video" ? "Group video" : "Group voice"} call started`
            : `${mode === "video" ? "Video" : "Voice"} call started`,
        event: "started",
        createdAt: now,
      });

      return {
        type: "ok" as const,
        session: mapCallSessionToDto({
          session,
          usersById,
          currentUserId: user.id,
        }),
      };
    }

    const targetCall = db.callSessions.find(
      (candidate) =>
        candidate.id === body.callId &&
        candidate.conversationId === conversationId &&
        candidate.participantIds.includes(user.id),
    );

    if (!targetCall) {
      return { type: "missing_call" as const };
    }

    if (body.action === "accept") {
      targetCall.status = "connecting";
      targetCall.updatedAt = now;
      targetCall.answeredAt = targetCall.answeredAt ?? now;
      targetCall.participants = targetCall.participants.map((participant) =>
        participant.userId === user.id
          ? {
              ...participant,
              joinedAt: participant.joinedAt ?? now,
            }
          : participant,
      );
      appendCallHistoryMessage({
        conversation,
        messages: db.messages,
        callId: targetCall.id,
        mode: targetCall.mode,
        senderId: user.id,
        text: "Call connected",
        event: "accepted",
        createdAt: now,
      });
    } else if (body.action === "decline") {
      targetCall.status = "declined";
      targetCall.updatedAt = now;
      targetCall.endedAt = now;
      targetCall.endedById = user.id;
      appendCallHistoryMessage({
        conversation,
        messages: db.messages,
        callId: targetCall.id,
        mode: targetCall.mode,
        senderId: user.id,
        text: "Call declined",
        event: "declined",
        createdAt: now,
      });
    } else if (body.action === "end") {
      targetCall.status = "ended";
      targetCall.updatedAt = now;
      targetCall.endedAt = now;
      targetCall.endedById = user.id;
      appendCallHistoryMessage({
        conversation,
        messages: db.messages,
        callId: targetCall.id,
        mode: targetCall.mode,
        senderId: user.id,
        text: "Call ended",
        event: "ended",
        durationMs: targetCall.answeredAt
          ? Math.max(0, new Date(now).getTime() - new Date(targetCall.answeredAt).getTime())
          : undefined,
        createdAt: now,
      });
    } else if (body.action === "signal") {
      if (
        typeof body.toUserId !== "string" ||
        !targetCall.participantIds.includes(body.toUserId) ||
        body.toUserId === user.id
      ) {
        return { type: "invalid_signal_target" as const };
      }

      if (
        body.signalType !== "offer" &&
        body.signalType !== "answer" &&
        body.signalType !== "ice"
      ) {
        return { type: "invalid_signal_type" as const };
      }

      targetCall.signals.push({
        id: createId("sig"),
        fromUserId: user.id,
        toUserId: body.toUserId,
        type: body.signalType,
        payload: body.payload,
        createdAt: now,
      });
      targetCall.updatedAt = now;

      if (body.signalType === "answer") {
        targetCall.status = "active";
        targetCall.answeredAt = targetCall.answeredAt ?? now;
      }
    } else if (body.action === "media") {
      targetCall.participants = targetCall.participants.map((participant) =>
        participant.userId === user.id
          ? {
              ...participant,
              audioEnabled:
                typeof body.audioEnabled === "boolean"
                  ? body.audioEnabled
                  : participant.audioEnabled,
              videoEnabled:
                typeof body.videoEnabled === "boolean"
                  ? body.videoEnabled
                  : participant.videoEnabled,
              screenSharing:
                typeof body.screenSharing === "boolean"
                  ? body.screenSharing
                  : participant.screenSharing,
              recording:
                typeof body.recording === "boolean"
                  ? body.recording
                  : participant.recording,
            }
          : participant,
      );
      targetCall.updatedAt = now;
    }

    return {
      type: "ok" as const,
      session: mapCallSessionToDto({
        session: targetCall,
        usersById,
        currentUserId: user.id,
      }),
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (result.type === "busy") {
    return NextResponse.json(
      { error: "One of these users is already on another call." },
      { status: 409 },
    );
  }

  if (result.type === "missing_call") {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  if (result.type === "invalid_signal_target") {
    return NextResponse.json({ error: "Invalid signal target." }, { status: 400 });
  }

  if (result.type === "invalid_signal_type") {
    return NextResponse.json({ error: "Invalid signal type." }, { status: 400 });
  }

  return NextResponse.json({ session: result.session });
}
