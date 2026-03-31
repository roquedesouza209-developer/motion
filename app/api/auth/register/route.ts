import { NextResponse } from "next/server";

import { DEFAULT_CHAT_WALLPAPER } from "@/lib/chat-wallpapers";
import { normalizeInterests } from "@/lib/interests";
import { DEFAULT_PROFILE_ACCENT, DEFAULT_PROFILE_COVER } from "@/lib/profile-styles";
import { attachSessionCookie, toPublicUser, SESSION_MAX_AGE_SECONDS } from "@/lib/server/auth";
import { createId, createPasswordHash } from "@/lib/server/crypto";
import { updateDb } from "@/lib/server/database";
import type { UserRecord } from "@/lib/server/types";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #ff8f6b, #ff5f6d)",
  "linear-gradient(135deg, #00a3a3, #00b1ff)",
  "linear-gradient(135deg, #ffc048, #ff6b6b)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #ff9a9e, #fbc2eb)",
];

type RegisterBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  handle?: string;
  password?: string;
  interests?: string[];
};

function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

function isValidHandle(handle: string): boolean {
  return /^[a-z0-9._]{3,20}$/.test(handle);
}

export async function POST(request: Request) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();
  const email = body.email?.trim().toLowerCase() ?? "";
  const handleInput = body.handle?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const interests = normalizeInterests(body.interests);

  if (firstName.length < 1 || lastName.length < 1) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!handleInput) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  if (!isValidHandle(handleInput)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters (letters, numbers, . or _)." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const result = await updateDb((db) => {
    const handleExists = db.users.some(
      (candidate) => candidate.handle.toLowerCase() === handleInput,
    );

    if (handleExists) {
      return { error: "handle" } as const;
    }

    const { hash, salt } = createPasswordHash(password);
    const newUser: UserRecord = {
      id: createId("usr"),
      name,
      handle: handleInput,
      role: "Member",
      accountType: "public",
      email,
      passwordHash: hash,
      passwordSalt: salt,
      avatarGradient: AVATAR_GRADIENTS[db.users.length % AVATAR_GRADIENTS.length],
      coverTheme: DEFAULT_PROFILE_COVER,
      profileAccent: DEFAULT_PROFILE_ACCENT,
      onboardingCompleted: false,
      restrictedAccount: false,
      interests,
      chatWallpaper: DEFAULT_CHAT_WALLPAPER,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    const sessionId = createId("ses");
    db.sessions.push({
      id: sessionId,
      userId: newUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });

    return { user: newUser, sessionId };
  });

  if (!result) {
    return NextResponse.json({ error: "Registration failed." }, { status: 400 });
  }

  if ("error" in result) {
    return NextResponse.json(
      {
        error: "That username is already taken.",
      },
      { status: 409 },
    );
  }

  const response = NextResponse.json({ user: toPublicUser(result.user) });
  attachSessionCookie(response, result.sessionId);
  return response;
}
