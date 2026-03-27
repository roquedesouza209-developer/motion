import { NextResponse } from "next/server";

import { isChatWallpaper } from "@/lib/chat-wallpapers";
import { getAuthUser } from "@/lib/server/auth";
import { updateDb } from "@/lib/server/database";
import { deleteUploadedMedia, storeUploadedMedia } from "@/lib/server/media";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type PatchBody = {
  wallpaper?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { conversationId } = await context.params;
  const wallpaper = body.wallpaper;

  const result = await updateDb((db) => {
    const conversation = db.conversations.find((candidate) => candidate.id === conversationId);

    if (!conversation) {
      return { type: "missing" as const };
    }

    if (!conversation.participantIds.includes(user.id)) {
      return { type: "forbidden" as const };
    }

    const previousCustomUrl =
      conversation.chatWallpaper === "custom" ? conversation.chatWallpaperUrl : undefined;

    if (wallpaper === null || wallpaper === "default" || wallpaper === "") {
      conversation.chatWallpaper = undefined;
      conversation.chatWallpaperUrl = undefined;
      return {
        type: "ok" as const,
        conversation: {
          id: conversation.id,
          chatWallpaper: conversation.chatWallpaper,
          chatWallpaperUrl: conversation.chatWallpaperUrl,
        },
        previousCustomUrl,
      };
    }

    if (!isChatWallpaper(wallpaper)) {
      return { type: "invalid" as const };
    }

    conversation.chatWallpaper = wallpaper;
    conversation.chatWallpaperUrl = undefined;

    return {
      type: "ok" as const,
      conversation: {
        id: conversation.id,
        chatWallpaper: conversation.chatWallpaper,
        chatWallpaperUrl: conversation.chatWallpaperUrl,
      },
      previousCustomUrl,
    };
  });

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (result.type === "invalid") {
    return NextResponse.json({ error: "Invalid wallpaper." }, { status: 400 });
  }

  if (result.previousCustomUrl) {
    try {
      await deleteUploadedMedia(result.previousCustomUrl);
    } catch {
      // Best effort cleanup for old custom wallpapers.
    }
  }

  return NextResponse.json({ conversation: result.conversation });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an image wallpaper file." }, { status: 400 });
  }

  let uploadedMedia:
    | {
        mediaUrl: string;
        mediaType: "image" | "video";
      }
    | undefined;

  try {
    uploadedMedia = await storeUploadedMedia({ file });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload wallpaper." },
      { status: 400 },
    );
  }

  if (uploadedMedia.mediaType !== "image") {
    try {
      await deleteUploadedMedia(uploadedMedia.mediaUrl);
    } catch {
      // Ignore cleanup failures for invalid uploads.
    }
    return NextResponse.json({ error: "Wallpapers must be image files." }, { status: 400 });
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

    const previousCustomUrl =
      conversation.chatWallpaper === "custom" ? conversation.chatWallpaperUrl : undefined;

    conversation.chatWallpaper = "custom";
    conversation.chatWallpaperUrl = uploadedMedia.mediaUrl;

    return {
      type: "ok" as const,
      conversation: {
        id: conversation.id,
        chatWallpaper: conversation.chatWallpaper,
        chatWallpaperUrl: conversation.chatWallpaperUrl,
      },
      previousCustomUrl,
    };
  });

  if (result.type === "missing" || result.type === "forbidden") {
    try {
      await deleteUploadedMedia(uploadedMedia.mediaUrl);
    } catch {
      // Ignore cleanup failures if the conversation update could not complete.
    }
  }

  if (result.type === "missing") {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (result.type === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (result.previousCustomUrl && result.previousCustomUrl !== uploadedMedia.mediaUrl) {
    try {
      await deleteUploadedMedia(result.previousCustomUrl);
    } catch {
      // Best effort cleanup for old custom wallpapers.
    }
  }

  return NextResponse.json({ conversation: result.conversation }, { status: 201 });
}
