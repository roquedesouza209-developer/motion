import { NextResponse } from "next/server";

import { normalizeInterests } from "@/lib/interests";
import { normalizeRandomChatCountry } from "@/lib/random-chat";
import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import { readDb, updateDb } from "@/lib/server/database";
import { mapRandomChatQueueToDto, mapRandomChatSessionToDto } from "@/lib/server/format";
import {
  canMatchRandomChatUsers,
  getActiveRandomChatSession,
  getUserRandomChatQueue,
} from "@/lib/server/random-chat";
import type { RandomChatQueueRecord, RandomChatSessionRecord } from "@/lib/server/types";

type JoinBody =
  | {
      action: "join";
      country?: string;
      preferredCountry?: string;
      preferredInterests?: unknown;
    }
  | {
      action: "leave";
    };

export async function GET(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));
  const queue = getUserRandomChatQueue(db.randomChatQueue, user.id);
  const session = getActiveRandomChatSession(db.randomChatSessions, user.id);

  return NextResponse.json({
    queue: queue ? mapRandomChatQueueToDto(queue) : null,
    session: session
      ? mapRandomChatSessionToDto({
          session,
          usersById,
          currentUserId: user.id,
        })
      : null,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: JoinBody;

  try {
    body = (await request.json()) as JoinBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const result = await updateDb((db) => {
    const usersById = new Map(db.users.map((candidate) => [candidate.id, candidate]));
    const currentUser = usersById.get(user.id);

    if (!currentUser) {
      return { type: "missing_user" as const };
    }

    const activeSession = getActiveRandomChatSession(db.randomChatSessions, user.id);

    if (body.action === "leave") {
      db.randomChatQueue = db.randomChatQueue.filter((entry) => entry.userId !== user.id);

      return {
        type: "ok" as const,
        queue: null,
        session: activeSession
          ? mapRandomChatSessionToDto({
              session: activeSession,
              usersById,
              currentUserId: user.id,
            })
          : null,
      };
    }

    if (activeSession) {
      return {
        type: "ok" as const,
        queue: null,
        session: mapRandomChatSessionToDto({
          session: activeSession,
          usersById,
          currentUserId: user.id,
        }),
      };
    }

    const now = new Date().toISOString();
    const country = normalizeRandomChatCountry(body.country);
    const preferredCountry = normalizeRandomChatCountry(body.preferredCountry);
    const preferredInterests = normalizeInterests(body.preferredInterests);
    const previousQueue = getUserRandomChatQueue(db.randomChatQueue, user.id);

    const myQueue: RandomChatQueueRecord = {
      id: previousQueue?.id ?? createId("rqc"),
      userId: user.id,
      country,
      preferredCountry,
      preferredInterests,
      createdAt: previousQueue?.createdAt ?? now,
      updatedAt: now,
    };

    db.randomChatQueue = db.randomChatQueue.filter((entry) => entry.userId !== user.id);

    const partnerQueue =
      [...db.randomChatQueue]
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        )
        .find((candidateQueue) => {
          const candidateUser = usersById.get(candidateQueue.userId);

          if (!candidateUser) {
            return false;
          }

          if (getActiveRandomChatSession(db.randomChatSessions, candidateUser.id)) {
            return false;
          }

          return canMatchRandomChatUsers({
            currentUser,
            currentQueue: myQueue,
            candidateUser,
            candidateQueue,
            blocks: db.blocks,
            reports: db.randomChatReports,
          });
        }) ?? null;

    if (!partnerQueue) {
      db.randomChatQueue.unshift(myQueue);

      return {
        type: "ok" as const,
        queue: mapRandomChatQueueToDto(myQueue),
        session: null,
      };
    }

    const partnerUser = usersById.get(partnerQueue.userId);

    if (!partnerUser) {
      db.randomChatQueue.unshift(myQueue);

      return {
        type: "ok" as const,
        queue: mapRandomChatQueueToDto(myQueue),
        session: null,
      };
    }

    const session: RandomChatSessionRecord = {
      id: createId("rnd"),
      initiatorId: user.id,
      participantIds: [user.id, partnerUser.id],
      participants: [
        {
          userId: user.id,
          country: myQueue.country,
          interests: currentUser.interests ?? [],
          joinedAt: now,
          audioEnabled: true,
          videoEnabled: true,
        },
        {
          userId: partnerUser.id,
          country: partnerQueue.country,
          interests: partnerUser.interests ?? [],
          audioEnabled: true,
          videoEnabled: true,
        },
      ],
      signals: [],
      status: "connecting",
      createdAt: now,
      matchedAt: now,
      updatedAt: now,
    };

    db.randomChatQueue = db.randomChatQueue.filter(
      (entry) => entry.userId !== partnerQueue.userId,
    );
    db.randomChatSessions.unshift(session);

    return {
      type: "ok" as const,
      queue: null,
      session: mapRandomChatSessionToDto({
        session,
        usersById,
        currentUserId: user.id,
      }),
    };
  });

  if (result.type === "missing_user") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    queue: result.queue,
    session: result.session,
  });
}
