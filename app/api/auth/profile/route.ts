import { NextResponse } from "next/server";

import { isChatWallpaper } from "@/lib/chat-wallpapers";
import { normalizeInterests } from "@/lib/interests";
import { isProfileAccent, isProfileCoverTheme } from "@/lib/profile-styles";
import { getAuthUser, toPublicUser } from "@/lib/server/auth";
import { updateDb } from "@/lib/server/database";

type UpdateProfileBody = {
    name?: string;
    handle?: string;
    bio?: string;
    avatarUrl?: string;
    accountType?: string;
    feedVisibility?: string;
    hiddenFromIds?: string[];
    restrictedAccount?: boolean;
    interests?: string[];
    chatWallpaper?: string;
    coverTheme?: string;
    coverImageUrl?: string;
    profileAccent?: string;
};

export async function PATCH(request: Request) {
    const user = await getAuthUser(request);

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: UpdateProfileBody;

    try {
        body = (await request.json()) as UpdateProfileBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const name = body.name?.trim();
    const handle = body.handle?.trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
    const bio = body.bio !== undefined ? body.bio.trim() : undefined;
    const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl.trim() : undefined;
    const accountType = body.accountType;
    const feedVisibility = body.feedVisibility;
    const hiddenFromIds = body.hiddenFromIds;
    const restrictedAccount = body.restrictedAccount;
    const interests = body.interests !== undefined ? normalizeInterests(body.interests) : undefined;
    const chatWallpaper = body.chatWallpaper;
    const coverTheme = body.coverTheme;
    const coverImageUrl = body.coverImageUrl !== undefined ? body.coverImageUrl.trim() : undefined;
    const profileAccent = body.profileAccent;

    if (name !== undefined && name.length < 2) {
        return NextResponse.json(
            { error: "Name must be at least 2 characters." },
            { status: 400 },
        );
    }

    if (handle !== undefined && handle.length < 2) {
        return NextResponse.json(
            { error: "Username must be at least 2 characters." },
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
            { error: "Avatar must point to /uploads." },
            { status: 400 },
        );
    }

    if (coverImageUrl !== undefined && coverImageUrl !== "" && !coverImageUrl.startsWith("/uploads/")) {
        return NextResponse.json(
            { error: "Cover image must point to /uploads." },
            { status: 400 },
        );
    }

    const result = await updateDb((db) => {
        const userRecord = db.users.find((u) => u.id === user.id);

        if (!userRecord) {
            return { type: "missing" as const };
        }

        if (handle !== undefined && handle !== userRecord.handle) {
            const taken = db.users.some(
                (u) => u.id !== user.id && u.handle.toLowerCase() === handle,
            );

            if (taken) {
                return { type: "handle_taken" as const };
            }

            userRecord.handle = handle;
        }

        if (name !== undefined) {
            userRecord.name = name;
        }

        if (bio !== undefined) {
            userRecord.bio = bio;
        }

        if (avatarUrl !== undefined) {
            userRecord.avatarUrl = avatarUrl || undefined;
        }

        if (accountType !== undefined) {
            if (accountType === "creator" && userRecord.accountType !== "creator") {
                userRecord.accountType = "creator";
            } else if (accountType === "public" && userRecord.accountType === "creator") {
                return { type: "creator_locked" as const };
            } else if (accountType === "public" || accountType === "creator") {
                userRecord.accountType = accountType;
            }
        }

        if (feedVisibility !== undefined && ["everyone", "followers", "non_followers", "custom"].includes(feedVisibility)) {
            userRecord.feedVisibility = feedVisibility as "everyone" | "followers" | "non_followers" | "custom";
        }

        if (Array.isArray(hiddenFromIds)) {
            userRecord.hiddenFromIds = hiddenFromIds.filter((id) => typeof id === "string");
        }

        if (restrictedAccount !== undefined) {
            userRecord.restrictedAccount = Boolean(restrictedAccount);
        }

        if (interests !== undefined) {
            userRecord.interests = interests;
        }

        if (chatWallpaper !== undefined) {
            if (!isChatWallpaper(chatWallpaper)) {
                return { type: "invalid_wallpaper" as const };
            }
            userRecord.chatWallpaper = chatWallpaper;
        }

        if (coverTheme !== undefined) {
            if (!isProfileCoverTheme(coverTheme)) {
                return { type: "invalid_cover_theme" as const };
            }
            userRecord.coverTheme = coverTheme;
        }

        if (coverImageUrl !== undefined) {
            userRecord.coverImageUrl = coverImageUrl || undefined;
        }

        if (profileAccent !== undefined) {
            if (!isProfileAccent(profileAccent)) {
                return { type: "invalid_profile_accent" as const };
            }
            userRecord.profileAccent = profileAccent;
        }

        return { type: "updated" as const, user: toPublicUser(userRecord) };
    });

    if (result.type === "missing") {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (result.type === "handle_taken") {
        return NextResponse.json(
            { error: "Username is already taken." },
            { status: 409 },
        );
    }

    if (result.type === "creator_locked") {
        return NextResponse.json(
            { error: "Creator accounts cannot switch back to Public." },
            { status: 400 },
        );
    }

    if (result.type === "invalid_wallpaper") {
        return NextResponse.json(
            { error: "Invalid chat wallpaper." },
            { status: 400 },
        );
    }

    if (result.type === "invalid_cover_theme") {
        return NextResponse.json(
            { error: "Invalid cover theme." },
            { status: 400 },
        );
    }

    if (result.type === "invalid_profile_accent") {
        return NextResponse.json(
            { error: "Invalid profile accent." },
            { status: 400 },
        );
    }

    return NextResponse.json({ user: result.user });
}
