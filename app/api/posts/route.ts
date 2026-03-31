import { NextResponse } from "next/server";

import { normalizeInterest, normalizeInterests } from "@/lib/interests";
import { getAuthUser } from "@/lib/server/auth";
import { createId } from "@/lib/server/crypto";
import { readDb, type SqliteDatabaseHandle, updateDb, withSqliteRead } from "@/lib/server/database";
import { isPostReleased, mapPostToDto } from "@/lib/server/format";
import { rankDiscoverPosts, rankDiscoverPostsFromCollections } from "@/lib/server/ranking";
import { isVisibleToViewer } from "@/lib/server/safety";
import type {
  BlockRecord,
  ConversationRecord,
  FeedScope,
  FollowRecord,
  ImmersiveHotspot,
  MediaItem,
  MuteRecord,
  PostKind,
  PostRecord,
  UserRecord,
} from "@/lib/server/types";
import { extractHashtags, normalizeHashtag } from "@/lib/hashtags";

type CreatePostBody = {
  kind?: PostKind;
  caption?: string;
  location?: string;
  scope?: FeedScope;
  gradient?: string;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  immersiveVideo?: boolean;
  visibleAt?: string;
  coAuthorHandle?: string;
  interests?: string[];
};

const DEFAULT_POST_GRADIENTS = [
  "linear-gradient(145deg, #f6d365, #fda085)",
  "linear-gradient(145deg, #96fbc4, #f9f586)",
  "linear-gradient(145deg, #84fab0, #8fd3f4)",
  "linear-gradient(145deg, #fbc2eb, #a6c1ee)",
];

function normalizeScope(input: string | null): FeedScope | "bin" | "archive" | "scheduled" {
  if (input === "following") {
    return "following";
  }

  if (input === "bin") {
    return "bin";
  }

  if (input === "archive") {
    return "archive";
  }

  if (input === "scheduled") {
    return "scheduled";
  }

  return "discover";
}

function normalizeKind(input: string | undefined): PostKind {
  return input === "Reel" ? "Reel" : "Photo";
}

function normalizeMediaType(input: string | undefined): "image" | "video" | undefined {
  if (input === "image" || input === "video") {
    return input;
  }

  return undefined;
}

function normalizeMediaItems({
  media,
  mediaUrl,
  mediaType,
  immersiveVideo,
}: {
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  immersiveVideo?: boolean;
}): { items?: MediaItem[]; error?: string } {
  const items: MediaItem[] = [];

  const normalizeHotspots = (input: unknown): ImmersiveHotspot[] | undefined => {
    type NormalizedHotspot = ImmersiveHotspot;

    if (!Array.isArray(input)) {
      return undefined;
    }

    const normalized = input
      .map((entry): NormalizedHotspot | null => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const candidate = entry as Partial<ImmersiveHotspot>;
        const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
        if (!title) {
          return null;
        }

        const yaw =
          typeof candidate.yaw === "number" && Number.isFinite(candidate.yaw)
            ? Math.max(-180, Math.min(180, candidate.yaw))
            : 0;
        const pitch =
          typeof candidate.pitch === "number" && Number.isFinite(candidate.pitch)
            ? Math.max(-45, Math.min(45, candidate.pitch))
            : 0;

        return {
          id:
            typeof candidate.id === "string" && candidate.id.trim()
              ? candidate.id.trim()
              : createId("hst"),
          title,
          detail:
            typeof candidate.detail === "string" && candidate.detail.trim()
              ? candidate.detail.trim()
              : undefined,
          yaw,
          pitch,
        };
      })
      .filter((entry): entry is NormalizedHotspot => entry !== null);

    return normalized.length > 0 ? normalized.slice(0, 6) : undefined;
  };

  if (Array.isArray(media)) {
    for (const entry of media) {
      if (!entry || typeof entry !== "object") {
        return { error: "media items must include url and type." };
      }
      const url = (entry as MediaItem).url;
      const type = (entry as MediaItem).type;
      const immersive = (entry as MediaItem).immersive;
      const hotspots = normalizeHotspots((entry as MediaItem).hotspots);

      if (typeof url !== "string" || (type !== "image" && type !== "video")) {
        return { error: "media items must include url and type." };
      }

      items.push({
        url,
        type,
        immersive: type === "video" && typeof immersive === "boolean" ? immersive : undefined,
        hotspots: type === "video" ? hotspots : undefined,
      });
    }
  }

  if (items.length === 0 && mediaUrl) {
    if (!mediaType) {
      return { error: "mediaType is required when mediaUrl is provided." };
    }
    items.push({
      url: mediaUrl,
      type: mediaType,
      immersive:
        mediaType === "video" && typeof immersiveVideo === "boolean"
          ? immersiveVideo
          : undefined,
      hotspots: undefined,
    });
  }

  return { items: items.length > 0 ? items : undefined };
}

function parsePayloadRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows
    .map((row) => {
      if (typeof row.payload !== "string") {
        return null;
      }

      try {
        return JSON.parse(row.payload) as T;
      } catch {
        return null;
      }
    })
    .filter((value): value is T => value !== null);
}

function isBlockedBetweenDirect(
  blocks: BlockRecord[],
  leftUserId: string,
  rightUserId: string,
) {
  return blocks.some(
    (entry) =>
      (entry.blockerId === leftUserId && entry.blockedUserId === rightUserId) ||
      (entry.blockerId === rightUserId && entry.blockedUserId === leftUserId),
  );
}

function isVisibleToViewerDirect({
  blocks,
  mutes,
  viewerId,
  authorId,
  respectMute = false,
}: {
  blocks: BlockRecord[];
  mutes: MuteRecord[];
  viewerId: string | null;
  authorId: string;
  respectMute?: boolean;
}) {
  if (!viewerId || viewerId === authorId) {
    return true;
  }

  if (isBlockedBetweenDirect(blocks, viewerId, authorId)) {
    return false;
  }

  if (respectMute) {
    return !mutes.some(
      (entry) => entry.userId === viewerId && entry.mutedUserId === authorId,
    );
  }

  return true;
}

async function loadPostsDirect({
  sqliteDb,
  currentUserId,
  feedScope,
  hashtag,
  selectedInterest,
}: {
  sqliteDb: SqliteDatabaseHandle;
  currentUserId: string | null;
  feedScope: FeedScope | "bin" | "archive" | "scheduled";
  hashtag?: string;
  selectedInterest?: ReturnType<typeof normalizeInterest> | null;
}) {
  const postRows = sqliteDb
    .prepare("SELECT payload FROM posts ORDER BY sort_at DESC")
    .all();
  const posts = parsePayloadRows<PostRecord>(postRows);

  const follows = currentUserId
    ? parsePayloadRows<FollowRecord>(
        sqliteDb.prepare("SELECT payload FROM follows WHERE owner_id = ?").all(currentUserId),
      )
    : [];
  const conversations = currentUserId
    ? parsePayloadRows<ConversationRecord>(
        sqliteDb
          .prepare(
            "SELECT DISTINCT c.payload FROM conversations c JOIN json_each(c.payload, '$.participantIds') participants ON participants.value = ?",
          )
          .all(currentUserId),
      )
    : [];
  const blocks = currentUserId
    ? parsePayloadRows<BlockRecord>(
        sqliteDb
          .prepare("SELECT payload FROM blocks WHERE owner_id = ? OR related_id = ?")
          .all(currentUserId, currentUserId),
      )
    : [];
  const mutes = currentUserId
    ? parsePayloadRows<MuteRecord>(
        sqliteDb.prepare("SELECT payload FROM mutes WHERE owner_id = ?").all(currentUserId),
      )
    : [];

  const referencedUserIds = new Set<string>();
  posts.forEach((post) => {
    referencedUserIds.add(post.userId);
    post.coAuthorIds?.forEach((userId) => referencedUserIds.add(userId));
    post.coAuthorInvites?.forEach((userId) => referencedUserIds.add(userId));
  });
  if (currentUserId) {
    referencedUserIds.add(currentUserId);
  }

  const users =
    referencedUserIds.size > 0
      ? (() => {
          const placeholders = [...referencedUserIds].map(() => "?").join(", ");
          const userRows = sqliteDb
            .prepare(`SELECT payload FROM users WHERE entity_key IN (${placeholders})`)
            .all(...referencedUserIds);
          return parsePayloadRows<UserRecord>(userRows);
        })()
      : [];

  const usersById = new Map(users.map((user) => [user.id, user]));
  const followSet = new Set(
    follows
      .filter((follow) => follow.followerId === currentUserId)
      .map((follow) => follow.followingId),
  );

  if (currentUserId) {
    followSet.add(currentUserId);
  }

  const rankedPosts = rankDiscoverPostsFromCollections({
    collections: {
      posts,
      follows,
      conversations,
      users,
    },
    currentUserId,
    selectedInterest,
  });

  const followingPosts = rankedPosts.filter((post) => {
    if (post.deletedAt != null) return false;
    if (post.archivedAt != null) return false;
    if (!isPostReleased(post)) return false;

    if (!currentUserId) {
      return post.scope === "following";
    }

    const isCoAuthor = post.coAuthorIds?.includes(currentUserId) ?? false;
    return followSet.has(post.userId) || isCoAuthor;
  });

  const discoverPosts = rankedPosts.filter(
    (post) =>
      post.deletedAt == null &&
      post.archivedAt == null &&
      isPostReleased(post),
  );

  const orderedPosts =
    hashtag
      ? (() => {
          const combined = new Map<string, PostRecord>();

          [...followingPosts, ...discoverPosts].forEach((post) => {
            if (!combined.has(post.id)) {
              combined.set(post.id, post);
            }
          });

          return [...combined.values()]
            .filter((post) => extractHashtags(post.caption).includes(hashtag))
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
        })()
      : feedScope === "bin"
        ? posts
            .filter(
              (post) =>
                post.userId === currentUserId &&
                post.deletedAt != null &&
                !post.archivedAt,
            )
            .sort(
              (a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime(),
            )
        : feedScope === "archive"
          ? posts
              .filter(
                (post) =>
                  post.userId === currentUserId && post.archivedAt != null,
              )
              .sort(
                (a, b) =>
                  new Date(b.archivedAt ?? 0).getTime() -
                  new Date(a.archivedAt ?? 0).getTime(),
              )
          : feedScope === "scheduled"
            ? currentUserId
                ? posts
                    .filter(
                      (post) =>
                        post.userId === currentUserId &&
                        post.deletedAt == null &&
                        post.archivedAt == null &&
                        !isPostReleased(post),
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.visibleAt ?? 0).getTime() -
                        new Date(b.visibleAt ?? 0).getTime(),
                    )
                : []
            : feedScope === "following"
              ? followingPosts
              : discoverPosts;

  const visiblePosts = orderedPosts.filter((post) => {
    const author = usersById.get(post.userId);
    if (!author) return false;
    if (author.id === currentUserId) return true;
    if (currentUserId && post.coAuthorIds?.includes(currentUserId)) return true;

    if (
      !isVisibleToViewerDirect({
        blocks,
        mutes,
        viewerId: currentUserId,
        authorId: author.id,
        respectMute: true,
      })
    ) {
      return false;
    }

    const visibility = author.feedVisibility ?? "everyone";

    if (visibility === "followers") {
      if (!currentUserId || !followSet.has(author.id)) return false;
    } else if (visibility === "non_followers") {
      if (currentUserId && followSet.has(author.id)) return false;
    } else if (visibility === "custom") {
      if (currentUserId && author.hiddenFromIds?.includes(currentUserId)) return false;
    }

    return true;
  });

  return {
    posts: visiblePosts.map((post) =>
      mapPostToDto({
        post,
        usersById,
        currentUserId,
      }),
    ),
  };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const feedScope = normalizeScope(searchParams.get("scope"));
  const hashtag = normalizeHashtag(searchParams.get("hashtag"));
  const selectedInterest = (() => {
    const raw = searchParams.get("interest");
    return raw ? normalizeInterest(raw) : null;
  })();
  const currentUser = await getAuthUser(request);
  const currentUserId = currentUser?.id ?? null;

  try {
    const directResult = await withSqliteRead((sqliteDb) =>
      loadPostsDirect({
        sqliteDb,
        currentUserId,
        feedScope,
        hashtag,
        selectedInterest,
      }),
    );

    if (directResult) {
      return NextResponse.json(directResult);
    }
  } catch {
    // Fall back to the compatibility path below.
  }

  const db = await readDb();
  const usersById = new Map(db.users.map((user) => [user.id, user]));
  const followSet = new Set(
    db.follows
      .filter((follow) => follow.followerId === currentUserId)
      .map((follow) => follow.followingId),
  );

  if (currentUserId) {
    followSet.add(currentUserId);
  }

  const rankedPosts = rankDiscoverPosts({
    db,
    currentUserId,
    selectedInterest,
  });

  const followingPosts = rankedPosts
    .filter((post) => {
      if (post.deletedAt != null) return false;
      if (post.archivedAt != null) return false;
      if (!isPostReleased(post)) return false;

      if (!currentUserId) {
        return post.scope === "following";
      }

      const isCoAuthor = post.coAuthorIds?.includes(currentUserId) ?? false;
      return followSet.has(post.userId) || isCoAuthor;
    });

  const discoverPosts = rankedPosts.filter(
    (post) =>
      post.deletedAt == null &&
      post.archivedAt == null &&
      isPostReleased(post),
  );

  const orderedPosts =
    hashtag
      ? (() => {
          const combined = new Map<string, PostRecord>();

          [...followingPosts, ...discoverPosts].forEach((post) => {
            if (!combined.has(post.id)) {
              combined.set(post.id, post);
            }
          });

          return [...combined.values()]
            .filter((post) => extractHashtags(post.caption).includes(hashtag))
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
        })()
      : feedScope === "bin"
      ? db.posts
        .filter(
          (post) =>
            post.userId === currentUserId &&
            post.deletedAt != null &&
            !post.archivedAt,
        )
        .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime())
      : feedScope === "archive"
        ? db.posts
          .filter(
            (post) =>
              post.userId === currentUserId && post.archivedAt != null,
          )
          .sort(
            (a, b) =>
              new Date(b.archivedAt ?? 0).getTime() -
              new Date(a.archivedAt ?? 0).getTime(),
          )
        : feedScope === "scheduled"
          ? currentUserId
            ? db.posts
              .filter(
                (post) =>
                  post.userId === currentUserId &&
                  post.deletedAt == null &&
                  post.archivedAt == null &&
                  !isPostReleased(post),
              )
              .sort(
                (a, b) =>
                  new Date(a.visibleAt ?? 0).getTime() -
                  new Date(b.visibleAt ?? 0).getTime(),
              )
            : []
        : feedScope === "following"
          ? followingPosts
          : discoverPosts;

  const visiblePosts = orderedPosts.filter((post) => {
    const author = usersById.get(post.userId);
    if (!author) return false;
    if (author.id === currentUserId) return true;
    if (currentUserId && post.coAuthorIds?.includes(currentUserId)) return true;

    if (
      !isVisibleToViewer({
        db,
        viewerId: currentUserId,
        authorId: author.id,
        respectMute: true,
      })
    ) {
      return false;
    }

    const visibility = author.feedVisibility ?? "everyone";

    if (visibility === "followers") {
      if (!currentUserId || !followSet.has(author.id)) return false;
    } else if (visibility === "non_followers") {
      if (currentUserId && followSet.has(author.id)) return false;
    } else if (visibility === "custom") {
      if (currentUserId && author.hiddenFromIds?.includes(currentUserId)) return false;
    }

    return true;
  });

  const data = visiblePosts
    .map((post) => mapPostToDto({ post, usersById, currentUserId }));

  return NextResponse.json({ posts: data });
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreatePostBody;

  try {
    body = (await request.json()) as CreatePostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const caption = body.caption?.trim() ?? "";
  const location = body.location?.trim() ?? "";
  const scope = body.scope === "following" ? "following" : "discover";
  const kind = normalizeKind(body.kind);
  const mediaUrl = body.mediaUrl?.trim() || undefined;
  const mediaType = normalizeMediaType(body.mediaType);
  const rawVisibleAt = body.visibleAt?.trim() || undefined;
  const interests = normalizeInterests(body.interests);
  const normalizedMedia = normalizeMediaItems({
    media: body.media,
    mediaUrl,
    mediaType,
    immersiveVideo: body.immersiveVideo,
  });

  if (caption.length < 8) {
    return NextResponse.json(
      { error: "Caption must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (normalizedMedia.error) {
    return NextResponse.json({ error: normalizedMedia.error }, { status: 400 });
  }

  const mediaItems = normalizedMedia.items;

  if (mediaItems?.some((item) => !item.url.startsWith("/uploads/"))) {
    return NextResponse.json(
      { error: "mediaUrl must point to /uploads." },
      { status: 400 },
    );
  }

  if (kind === "Reel" && mediaItems?.some((item) => item.type === "image")) {
    return NextResponse.json(
      { error: "Reel posts cannot include image media." },
      { status: 400 },
    );
  }

  let visibleAt: string | undefined;

  if (rawVisibleAt) {
    const releaseAt = new Date(rawVisibleAt).getTime();

    if (Number.isNaN(releaseAt)) {
      return NextResponse.json({ error: "Choose a valid future date." }, { status: 400 });
    }

    if (releaseAt <= Date.now()) {
      return NextResponse.json(
        { error: "Time capsule posts must open in the future." },
        { status: 400 },
      );
    }

    visibleAt = new Date(releaseAt).toISOString();
  }

  const requestedCoAuthor = body.coAuthorHandle?.trim() || "";
  const normalizedCoAuthor = requestedCoAuthor.replace(/^@/, "").toLowerCase();

  const created = await updateDb((db) => {
    const coAuthor =
      normalizedCoAuthor.length > 0
        ? db.users.find(
            (candidate) => candidate.handle.toLowerCase() === normalizedCoAuthor,
          )
        : undefined;

    if (normalizedCoAuthor.length > 0 && !coAuthor) {
      return { error: "co_author_not_found" } as const;
    }

    if (coAuthor && coAuthor.id === user.id) {
      return { error: "co_author_self" } as const;
    }

    const gradient =
      body.gradient ??
      DEFAULT_POST_GRADIENTS[db.posts.length % DEFAULT_POST_GRADIENTS.length];
    const primaryMedia = mediaItems?.[0];
    const newPost: PostRecord = {
      id: createId("pst"),
      userId: user.id,
      coAuthorIds: [],
      coAuthorInvites: coAuthor ? [coAuthor.id] : [],
      scope,
      kind,
      caption,
      location,
      interests,
      gradient,
      media: mediaItems,
      mediaUrl: primaryMedia?.url,
      mediaType: primaryMedia?.type,
      immersiveVideo:
        primaryMedia?.type === "video" ? Boolean(primaryMedia.immersive) : undefined,
      likedBy: [user.id],
      savedBy: [],
      commentCount: 0,
      shareCount: 0,
      watchTimeMs: 0,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      visibleAt,
    };

    db.posts.push(newPost);
    if (coAuthor) {
      db.notifications.push({
        id: createId("not"),
        userId: coAuthor.id,
        actorId: user.id,
        type: "collab_invite",
        postId: newPost.id,
        createdAt: new Date().toISOString(),
      });
    }
    return { post: newPost, coAuthor } as const;
  });

  if ("error" in created) {
    return NextResponse.json(
      {
        error:
          created.error === "co_author_self"
            ? "Choose a different collaborator."
            : "Collaborator not found.",
      },
      { status: 400 },
    );
  }

  const usersById = new Map([[user.id, user]]);
  if (created.coAuthor) {
    usersById.set(created.coAuthor.id, created.coAuthor);
  }
  const dto = mapPostToDto({
    post: created.post,
    usersById,
    currentUserId: user.id,
  });

  return NextResponse.json({ post: dto }, { status: 201 });
}
