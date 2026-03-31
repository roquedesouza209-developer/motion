import { NextResponse } from "next/server";

import { createId, verifyPassword } from "@/lib/server/crypto";
import { readDb, updateDb } from "@/lib/server/database";
import type { PublicUser, UserRecord } from "@/lib/server/types";

export const SESSION_COOKIE_NAME = "motion_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function parseCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookieParts = cookieHeader.split(";").map((part) => part.trim());
  const target = cookieParts.find((part) => part.startsWith(`${cookieName}=`));

  if (!target) {
    return null;
  }

  const [, rawValue] = target.split("=");
  return rawValue ? decodeURIComponent(rawValue) : null;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    role: user.role,
    accountType: user.accountType,
    email: user.email,
    avatarGradient: user.avatarGradient,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    coverTheme: user.coverTheme,
    coverImageUrl: user.coverImageUrl,
    profileAccent: user.profileAccent,
    onboardingCompleted: user.onboardingCompleted,
    interests: user.interests,
    chatWallpaper: user.chatWallpaper,
    feedVisibility: user.feedVisibility,
    hiddenFromIds: user.hiddenFromIds,
  };
}

export function getSessionIdFromRequest(request: Request): string | null {
  return parseCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
}

export async function getAuthUser(request: Request): Promise<UserRecord | null> {
  const sessionId = getSessionIdFromRequest(request);

  if (!sessionId) {
    return null;
  }

  const db = await readDb();
  const session = db.sessions.find((candidate) => candidate.id === sessionId);

  if (!session) {
    return null;
  }

  return db.users.find((candidate) => candidate.id === session.userId) ?? null;
}

export async function authenticateUser({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<UserRecord | null> {
  const db = await readDb();
  const normalizedEmail = email.trim().toLowerCase();
  const handleMatch = db.users.find(
    (candidate) => candidate.handle.toLowerCase() === normalizedEmail,
  );

  if (handleMatch) {
    const isValid = verifyPassword({
      candidate: password,
      passwordHash: handleMatch.passwordHash,
      passwordSalt: handleMatch.passwordSalt,
    });
    return isValid ? handleMatch : null;
  }

  const emailMatches = db.users.filter(
    (candidate) => candidate.email.toLowerCase() === normalizedEmail,
  );

  if (emailMatches.length === 0) {
    return null;
  }

  const matchingPasswords = emailMatches.filter((candidate) =>
    verifyPassword({
      candidate: password,
      passwordHash: candidate.passwordHash,
      passwordSalt: candidate.passwordSalt,
    }),
  );

  if (matchingPasswords.length === 0) {
    return null;
  }

  return matchingPasswords[matchingPasswords.length - 1] ?? null;
}

export async function hasDuplicateEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const db = await readDb();
  const matches = db.users.filter(
    (candidate) => candidate.email.toLowerCase() === normalized,
  );
  return matches.length > 1;
}

export async function createSession(userId: string): Promise<string> {
  return updateDb((db) => {
    const sessionId = createId("ses");

    db.sessions.push({
      id: sessionId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });

    return sessionId;
  });
}

export async function revokeSession(sessionId: string): Promise<void> {
  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.id !== sessionId);
  });
}

export function attachSessionCookie(
  response: NextResponse,
  sessionId: string,
): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
