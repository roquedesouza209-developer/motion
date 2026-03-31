import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/server/auth";
import { readDb } from "@/lib/server/database";
import { isVisibleToViewer } from "@/lib/server/safety";

export async function GET(request: Request) {
    const currentUser = await getAuthUser(request);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.toLowerCase();

    const db = await readDb();

    let result = db.users.filter(
      (u) =>
        u.id !== currentUser?.id &&
        isVisibleToViewer({
          db,
          viewerId: currentUser?.id ?? null,
          authorId: u.id,
        }),
    );

    if (q) {
        result = result.filter(
            (u) =>
                u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q),
        );
    }

    const data = result.map((u) => ({
        id: u.id,
        name: u.name,
        handle: u.handle,
        accountType: u.accountType,
        avatarUrl: u.avatarUrl,
        avatarGradient: u.avatarGradient,
        coverTheme: u.coverTheme,
        coverImageUrl: u.coverImageUrl,
        profileAccent: u.profileAccent,
        bio: u.bio,
        restrictedAccount: Boolean(u.restrictedAccount),
    }));

    return NextResponse.json({ users: data });
}
