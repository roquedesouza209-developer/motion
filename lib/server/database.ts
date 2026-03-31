import fs from "node:fs/promises";
import path from "node:path";

import {
  clampChatWallpaperBlur,
  clampChatWallpaperDim,
  DEFAULT_CHAT_WALLPAPER,
  isChatWallpaper,
  isChatWallpaperSelection,
} from "@/lib/chat-wallpapers";
import { normalizeInterests } from "@/lib/interests";
import {
  DEFAULT_PROFILE_ACCENT,
  DEFAULT_PROFILE_COVER,
  isProfileAccent,
  isProfileCoverTheme,
} from "@/lib/profile-styles";
import { createId, createPasswordHash } from "@/lib/server/crypto";
import type {
  AccountType,
  BlockRecord,
  CallParticipantRecord,
  CallSessionRecord,
  CallSignalRecord,
  ChatAttachment,
  CommentRecord,
  ConversationRecord,
  CreatorReportDeliveryRecord,
  CreatorReportScheduleRecord,
  FollowRecord,
  LiveCommentRecord,
  LiveSessionRecord,
  MessageReactionRecord,
  MessageRecord,
  MuteRecord,
  MotionDb,
  NotificationRecord,
  PostRecord,
  ProfileViewRecord,
  MoveHighlightRecord,
  RandomChatParticipantRecord,
  RandomChatQueueRecord,
  RandomChatReportRecord,
  RandomChatSessionRecord,
  RandomChatSignalRecord,
  SafetyReportRecord,
  SessionRecord,
  StoryRecord,
  SupportRequestRecord,
  UserRecord,
} from "@/lib/server/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const DATABASE_PATH = path.join(DATA_DIRECTORY, "motion-db.json");
const SQLITE_DATABASE_PATH = path.join(DATA_DIRECTORY, "motion-db.sqlite");
const DEMO_PASSWORD = "demo12345";
const BIN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RANDOM_CHAT_QUEUE_TTL_MS = 5 * 60 * 1000;
const RANDOM_CHAT_ACTIVE_TTL_MS = 30 * 60 * 1000;
const RANDOM_CHAT_ENDED_TTL_MS = 60 * 60 * 1000;

const USER_IDS = {
  demo: "usr_demo",
  lena: "usr_lena",
  ty: "usr_ty",
  ari: "usr_ari",
  mina: "usr_mina",
  noah: "usr_noah",
  kiko: "usr_kiko",
  sora: "usr_sora",
} as const;

const DEFAULT_USER_INTERESTS = {
  [USER_IDS.demo]: ["tech", "travel"],
  [USER_IDS.lena]: ["fashion", "travel"],
  [USER_IDS.ty]: ["sports", "tech"],
  [USER_IDS.ari]: ["travel"],
  [USER_IDS.mina]: ["fashion", "tech"],
  [USER_IDS.noah]: ["tech", "gaming"],
  [USER_IDS.kiko]: ["fashion", "travel"],
  [USER_IDS.sora]: ["tech", "gaming"],
} as const;

let updateQueue: Promise<void> = Promise.resolve();
let sqliteModulePromise: Promise<{ DatabaseSync: new (path: string) => SQLiteDatabaseLike } | null> | null =
  null;

type SQLiteStatementLike = {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): unknown;
};

type SQLiteDatabaseLike = {
  exec(sql: string): unknown;
  prepare(sql: string): SQLiteStatementLike;
  close?: () => void;
  [Symbol.dispose]?: () => void;
};

export type SqliteDatabaseHandle = SQLiteDatabaseLike;

async function getSqliteModule(): Promise<{
  DatabaseSync: new (path: string) => SQLiteDatabaseLike;
} | null> {
  if (!sqliteModulePromise) {
    sqliteModulePromise = new Function(
      "return import('node:sqlite').catch(() => null)",
    )() as Promise<{ DatabaseSync: new (path: string) => SQLiteDatabaseLike } | null>;
  }

  return sqliteModulePromise;
}

function toIsoWithMinuteOffset(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

function seedUser({
  id,
  name,
  handle,
  role,
  accountType = "creator",
  email,
  avatarGradient,
  lastActiveOffsetMinutes,
  interests = [],
}: {
  id: string;
  name: string;
  handle: string;
  role: string;
  accountType?: AccountType;
  email: string;
  avatarGradient: string;
  lastActiveOffsetMinutes?: number;
  interests?: UserRecord["interests"];
}): UserRecord {
  const { hash, salt } = createPasswordHash(DEMO_PASSWORD);

  return {
    id,
    name,
    handle,
    role,
    accountType,
    email,
    passwordHash: hash,
    passwordSalt: salt,
    avatarGradient,
    coverTheme: DEFAULT_PROFILE_COVER,
    profileAccent: DEFAULT_PROFILE_ACCENT,
    onboardingCompleted: true,
    restrictedAccount: false,
    interests,
    chatWallpaper: DEFAULT_CHAT_WALLPAPER,
    createdAt: toIsoWithMinuteOffset(-120),
    lastActiveAt:
      typeof lastActiveOffsetMinutes === "number"
        ? toIsoWithMinuteOffset(lastActiveOffsetMinutes)
        : undefined,
  };
}

function createSeedComments(posts: PostRecord[]): CommentRecord[] {
  const knownPostIds = new Set(posts.map((post) => post.id));
  const comments: CommentRecord[] = [];

  const pushComment = (comment: CommentRecord) => {
    if (knownPostIds.has(comment.postId)) {
      comments.push(comment);
    }
  };

  pushComment({
    id: "cmt_501",
    postId: "pst_101",
    userId: USER_IDS.ari,
    text: "Those rooftop highlights are clean. The natural light really worked.",
    createdAt: toIsoWithMinuteOffset(-35),
  });
  pushComment({
    id: "cmt_502",
    postId: "pst_101",
    userId: USER_IDS.mina,
    text: "Love the warmer grade on this set.",
    createdAt: toIsoWithMinuteOffset(-32),
  });
  pushComment({
    id: "cmt_503",
    postId: "pst_102",
    userId: USER_IDS.noah,
    text: "That swipe timing is sharp. The pacing lands.",
    createdAt: toIsoWithMinuteOffset(-24),
  });
  pushComment({
    id: "cmt_504",
    postId: "pst_103",
    userId: USER_IDS.lena,
    text: "The skin tones feel balanced without losing the street mood.",
    createdAt: toIsoWithMinuteOffset(-14),
  });
  pushComment({
    id: "cmt_505",
    postId: "pst_104",
    userId: USER_IDS.demo,
    text: "The BTS framing is strong. The new lens profile looks crisp.",
    createdAt: toIsoWithMinuteOffset(-8),
  });

  return comments;
}

function normalizeTypingMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  );
}

function normalizeChatAttachment(input: unknown): ChatAttachment | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const candidate = input as Partial<ChatAttachment>;

  if (typeof candidate.url !== "string") {
    return undefined;
  }

  if (
    candidate.type !== "image" &&
    candidate.type !== "audio" &&
    candidate.type !== "video"
  ) {
    return undefined;
  }

  return {
    url: candidate.url,
    type: candidate.type,
    durationMs:
      typeof candidate.durationMs === "number" && Number.isFinite(candidate.durationMs)
        ? candidate.durationMs
        : undefined,
    mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : undefined,
    name: typeof candidate.name === "string" ? candidate.name : undefined,
  };
}

function normalizeMessageReactions(input: unknown): MessageReactionRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(
    (entry): entry is MessageReactionRecord =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as MessageReactionRecord).userId === "string" &&
      typeof (entry as MessageReactionRecord).emoji === "string",
  );
}

function normalizeStringIdArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((value): value is string => typeof value === "string")
    : [];
}

function createSeedDatabase(): MotionDb {
  const users: UserRecord[] = [
    seedUser({
      id: USER_IDS.demo,
      name: "Morgan Otto",
      handle: "morgan.motion",
      role: "Creator",
      email: "demo@motion.app",
      avatarGradient: "linear-gradient(135deg, #ff8f6b, #ff5f6d)",
      lastActiveOffsetMinutes: -2,
      interests: ["tech", "travel"],
    }),
    seedUser({
      id: USER_IDS.lena,
      name: "Lena Hart",
      handle: "lensbylena",
      role: "Photographer",
      email: "lena@motion.app",
      avatarGradient: "linear-gradient(135deg, #f6d365, #fda085)",
      lastActiveOffsetMinutes: -9,
      interests: ["fashion", "travel"],
    }),
    seedUser({
      id: USER_IDS.ty,
      name: "Ty Rivers",
      handle: "tyinmotion",
      role: "Creator",
      email: "ty@motion.app",
      avatarGradient: "linear-gradient(135deg, #96fbc4, #f9f586)",
      lastActiveOffsetMinutes: -1,
      interests: ["sports", "tech"],
    }),
    seedUser({
      id: USER_IDS.ari,
      name: "Ari Rowan",
      handle: "ari.rowan",
      role: "Traveler",
      email: "ari@motion.app",
      avatarGradient: "linear-gradient(135deg, #ffc048, #ff6b6b)",
      lastActiveOffsetMinutes: -18,
      interests: ["travel"],
    }),
    seedUser({
      id: USER_IDS.mina,
      name: "Mina Roe",
      handle: "mina.roe",
      role: "Designer",
      email: "mina@motion.app",
      avatarGradient: "linear-gradient(135deg, #ff9a9e, #fbc2eb)",
      lastActiveOffsetMinutes: -4,
      interests: ["fashion", "tech"],
    }),
    seedUser({
      id: USER_IDS.noah,
      name: "Noah Kim",
      handle: "noah.kim",
      role: "Filmmaker",
      email: "noah@motion.app",
      avatarGradient: "linear-gradient(135deg, #4facfe, #00f2fe)",
      lastActiveOffsetMinutes: -27,
      interests: ["tech", "gaming"],
    }),
    seedUser({
      id: USER_IDS.kiko,
      name: "Kiko Vale",
      handle: "kiko.studio",
      role: "Photographer",
      email: "kiko@motion.app",
      avatarGradient: "linear-gradient(135deg, #84fab0, #8fd3f4)",
      lastActiveOffsetMinutes: -12,
      interests: ["fashion", "travel"],
    }),
    seedUser({
      id: USER_IDS.sora,
      name: "Sora Miles",
      handle: "sora.reel",
      role: "Editor",
      email: "sora@motion.app",
      avatarGradient: "linear-gradient(135deg, #fbc2eb, #a6c1ee)",
      lastActiveOffsetMinutes: -6,
      interests: ["tech", "gaming"],
    }),
  ];

  const posts: PostRecord[] = [
    {
      id: "pst_101",
      userId: USER_IDS.lena,
      scope: "following",
      kind: "Photo",
      caption:
        "Golden-hour session from downtown rooftops. Shot this in one take with natural light only.",
      location: "Seattle, WA",
      gradient: "linear-gradient(145deg, #f6d365, #fda085)",
      likedBy: [USER_IDS.demo, USER_IDS.ari, USER_IDS.ty],
      savedBy: [],
      commentCount: 41,
      shareCount: 6,
      watchTimeMs: 18_000,
      viewCount: 12,
      createdAt: toIsoWithMinuteOffset(-43),
    },
    {
      id: "pst_102",
      userId: USER_IDS.ty,
      scope: "following",
      kind: "Reel",
      caption: "30-second city run transition edit. Swipe timing was the hardest part.",
      location: "Brooklyn, NY",
      gradient: "linear-gradient(145deg, #96fbc4, #f9f586)",
      likedBy: [USER_IDS.demo, USER_IDS.lena, USER_IDS.mina, USER_IDS.noah],
      savedBy: [],
      commentCount: 63,
      shareCount: 14,
      watchTimeMs: 92_000,
      viewCount: 42,
      createdAt: toIsoWithMinuteOffset(-30),
    },
    {
      id: "pst_103",
      userId: USER_IDS.kiko,
      scope: "discover",
      kind: "Photo",
      caption: "Street portrait series from this weekend. Testing a warmer grade for skin tones.",
      location: "Austin, TX",
      gradient: "linear-gradient(145deg, #84fab0, #8fd3f4)",
      likedBy: [USER_IDS.lena, USER_IDS.ari],
      savedBy: [],
      commentCount: 29,
      shareCount: 3,
      watchTimeMs: 8_000,
      viewCount: 8,
      createdAt: toIsoWithMinuteOffset(-19),
    },
    {
      id: "pst_104",
      userId: USER_IDS.sora,
      scope: "discover",
      kind: "Reel",
      caption:
        "Quick behind-the-scenes from a music video setup. New lens profile looks clean.",
      location: "Los Angeles, CA",
      gradient: "linear-gradient(145deg, #fbc2eb, #a6c1ee)",
      likedBy: [USER_IDS.demo, USER_IDS.mina, USER_IDS.noah],
      savedBy: [],
      commentCount: 57,
      shareCount: 11,
      watchTimeMs: 112_000,
      viewCount: 51,
      createdAt: toIsoWithMinuteOffset(-11),
    },
  ];

  const stories: StoryRecord[] = [
    {
      id: "sty_201",
      userId: USER_IDS.lena,
      caption: "Sunset recce before tonight's shoot.",
      gradient: "linear-gradient(135deg, #ff8f6b, #ff5f6d)",
      createdAt: toIsoWithMinuteOffset(-30),
      expiresAt: toIsoWithMinuteOffset(18),
      seenBy: [USER_IDS.ty],
    },
    {
      id: "sty_202",
      userId: USER_IDS.ty,
      caption: "Drone battery survived all six takes.",
      gradient: "linear-gradient(135deg, #00a3a3, #00b1ff)",
      createdAt: toIsoWithMinuteOffset(-20),
      expiresAt: toIsoWithMinuteOffset(44),
      seenBy: [USER_IDS.demo],
    },
    {
      id: "sty_203",
      userId: USER_IDS.ari,
      caption: "Train station textures are unreal today.",
      gradient: "linear-gradient(135deg, #ffc048, #ff6b6b)",
      createdAt: toIsoWithMinuteOffset(-25),
      expiresAt: toIsoWithMinuteOffset(72),
      seenBy: [],
    },
    {
      id: "sty_204",
      userId: USER_IDS.noah,
      caption: "Lens tests for the next short film.",
      gradient: "linear-gradient(135deg, #4facfe, #00f2fe)",
      createdAt: toIsoWithMinuteOffset(-32),
      expiresAt: toIsoWithMinuteOffset(95),
      seenBy: [USER_IDS.demo],
    },
    {
      id: "sty_205",
      userId: USER_IDS.mina,
      caption: "Color cards dialed in for product shots.",
      gradient: "linear-gradient(135deg, #ff9a9e, #fbc2eb)",
      createdAt: toIsoWithMinuteOffset(-40),
      expiresAt: toIsoWithMinuteOffset(113),
      seenBy: [],
    },
  ];

  const conversations: ConversationRecord[] = [
    {
      id: "con_301",
      participantIds: [USER_IDS.demo, USER_IDS.ari],
      unreadCountByUserId: {
        [USER_IDS.demo]: 2,
        [USER_IDS.ari]: 0,
      },
      typingByUserId: {},
      updatedAt: toIsoWithMinuteOffset(-2),
    },
    {
      id: "con_302",
      participantIds: [USER_IDS.demo, USER_IDS.mina],
      unreadCountByUserId: {
        [USER_IDS.demo]: 0,
        [USER_IDS.mina]: 0,
      },
      typingByUserId: {},
      updatedAt: toIsoWithMinuteOffset(-27),
    },
    {
      id: "con_303",
      participantIds: [USER_IDS.demo, USER_IDS.noah],
      unreadCountByUserId: {
        [USER_IDS.demo]: 1,
        [USER_IDS.noah]: 0,
      },
      typingByUserId: {},
      updatedAt: toIsoWithMinuteOffset(-60),
    },
  ];

  const messages: MessageRecord[] = [
    {
      id: "msg_401",
      conversationId: "con_301",
      senderId: USER_IDS.ari,
      text: "Your rooftop reel looked sharp.",
      reactions: [],
      deliveredToIds: [USER_IDS.ari, USER_IDS.demo],
      readByIds: [USER_IDS.ari, USER_IDS.demo],
      createdAt: toIsoWithMinuteOffset(-6),
    },
    {
      id: "msg_402",
      conversationId: "con_301",
      senderId: USER_IDS.demo,
      text: "Thanks, I finally fixed the motion blur.",
      reactions: [],
      deliveredToIds: [USER_IDS.demo, USER_IDS.ari],
      readByIds: [USER_IDS.demo, USER_IDS.ari],
      createdAt: toIsoWithMinuteOffset(-4),
    },
    {
      id: "msg_403",
      conversationId: "con_301",
      senderId: USER_IDS.ari,
      text: "Can you send the LUT from yesterday?",
      reactions: [],
      deliveredToIds: [USER_IDS.ari, USER_IDS.demo],
      readByIds: [USER_IDS.ari],
      createdAt: toIsoWithMinuteOffset(-2),
    },
    {
      id: "msg_404",
      conversationId: "con_302",
      senderId: USER_IDS.mina,
      text: "Move collab this weekend?",
      reactions: [],
      deliveredToIds: [USER_IDS.mina, USER_IDS.demo],
      readByIds: [USER_IDS.mina, USER_IDS.demo],
      createdAt: toIsoWithMinuteOffset(-29),
    },
    {
      id: "msg_405",
      conversationId: "con_302",
      senderId: USER_IDS.demo,
      text: "Yes, Saturday afternoon works for me.",
      reactions: [],
      deliveredToIds: [USER_IDS.demo, USER_IDS.mina],
      readByIds: [USER_IDS.demo, USER_IDS.mina],
      createdAt: toIsoWithMinuteOffset(-27),
    },
    {
      id: "msg_406",
      conversationId: "con_303",
      senderId: USER_IDS.demo,
      text: "Did you export the b-roll clips?",
      reactions: [],
      deliveredToIds: [USER_IDS.demo, USER_IDS.noah],
      readByIds: [USER_IDS.demo],
      createdAt: toIsoWithMinuteOffset(-63),
    },
    {
      id: "msg_407",
      conversationId: "con_303",
      senderId: USER_IDS.noah,
      text: "Uploading the raw clips now.",
      reactions: [],
      deliveredToIds: [USER_IDS.noah, USER_IDS.demo],
      readByIds: [USER_IDS.noah],
      createdAt: toIsoWithMinuteOffset(-60),
    },
  ];

  const follows: FollowRecord[] = [
    { followerId: USER_IDS.demo, followingId: USER_IDS.lena, createdAt: toIsoWithMinuteOffset(-60 * 24 * 9) },
    { followerId: USER_IDS.demo, followingId: USER_IDS.ty, createdAt: toIsoWithMinuteOffset(-60 * 24 * 6) },
    { followerId: USER_IDS.demo, followingId: USER_IDS.ari, createdAt: toIsoWithMinuteOffset(-60 * 24 * 4) },
    { followerId: USER_IDS.demo, followingId: USER_IDS.mina, createdAt: toIsoWithMinuteOffset(-60 * 24 * 3) },
    { followerId: USER_IDS.demo, followingId: USER_IDS.noah, createdAt: toIsoWithMinuteOffset(-60 * 24 * 2) },
    { followerId: USER_IDS.lena, followingId: USER_IDS.ty, createdAt: toIsoWithMinuteOffset(-60 * 24 * 5) },
    { followerId: USER_IDS.ty, followingId: USER_IDS.sora, createdAt: toIsoWithMinuteOffset(-60 * 24) },
  ];
  const notifications: NotificationRecord[] = [];
  const blocks: BlockRecord[] = [];
  const mutes: MuteRecord[] = [];
  const safetyReports: SafetyReportRecord[] = [];

  const sessions: SessionRecord[] = [];
  const comments = createSeedComments(posts);
  const profileViews: ProfileViewRecord[] = [];
  const supportRequests: SupportRequestRecord[] = [];
  const moveHighlights: MoveHighlightRecord[] = [];
  const liveSessions: LiveSessionRecord[] = [];
  const liveComments: LiveCommentRecord[] = [];
  const callSessions: CallSessionRecord[] = [];
  const randomChatQueue: RandomChatQueueRecord[] = [];
  const randomChatSessions: RandomChatSessionRecord[] = [];
  const randomChatReports: RandomChatReportRecord[] = [];

  return {
    users,
    sessions,
    posts,
    comments,
    stories,
    moveHighlights,
    liveSessions,
    liveComments,
    callSessions,
    randomChatQueue,
    randomChatSessions,
    randomChatReports,
    conversations,
    messages,
    follows,
    blocks,
    mutes,
    safetyReports,
    notifications,
    profileViews,
    supportRequests,
    creatorReportSchedules: [],
    creatorReportDeliveries: [],
  };
}

function normalizeDatabase(raw: unknown): MotionDb {
  if (!raw || typeof raw !== "object") {
    return createSeedDatabase();
  }

  const candidate = raw as Partial<MotionDb>;
  const normalizeMediaList = (
    media: unknown,
    mediaUrl: unknown,
    mediaType: unknown,
    immersiveVideo?: unknown,
  ): {
    media?: {
      url: string;
      type: "image" | "video";
      immersive?: boolean;
      hotspots?: {
        id: string;
        title: string;
        detail?: string;
        yaw: number;
        pitch: number;
      }[];
    }[];
    mediaUrl?: string;
    mediaType?: "image" | "video";
    immersiveVideo?: boolean;
  } => {
    const items: {
      url: string;
      type: "image" | "video";
      immersive?: boolean;
      hotspots?: {
        id: string;
        title: string;
        detail?: string;
        yaw: number;
        pitch: number;
      }[];
    }[] = [];

    const normalizeHotspots = (value: unknown) =>
      Array.isArray(value)
        ? (() => {
            type NormalizedHotspot = {
              id: string;
              title: string;
              detail?: string;
              yaw: number;
              pitch: number;
            };

            return value
            .map((entry): NormalizedHotspot | null => {
              if (!entry || typeof entry !== "object") {
                return null;
              }

              const candidate = entry as {
                id?: unknown;
                title?: unknown;
                detail?: unknown;
                yaw?: unknown;
                pitch?: unknown;
              };

              if (typeof candidate.title !== "string" || !candidate.title.trim()) {
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
                    : `hst-${Math.random().toString(36).slice(2, 10)}`,
                title: candidate.title.trim(),
                detail:
                  typeof candidate.detail === "string" && candidate.detail.trim()
                    ? candidate.detail.trim()
                    : undefined,
                yaw,
                pitch,
              };
            })
            .filter(
              (entry): entry is NormalizedHotspot => entry !== null,
            )
            .slice(0, 6);
          })()
        : undefined;

    if (Array.isArray(media)) {
      for (const entry of media) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const url = (entry as { url?: unknown }).url;
        const type = (entry as { type?: unknown }).type;
        const immersive = (entry as { immersive?: unknown }).immersive;
        const hotspots = normalizeHotspots((entry as { hotspots?: unknown }).hotspots);
        if (
          typeof url === "string" &&
          (type === "image" || type === "video")
        ) {
          items.push({
            url,
            type,
            immersive: type === "video" && typeof immersive === "boolean" ? immersive : undefined,
            hotspots: type === "video" ? hotspots : undefined,
          });
        }
      }
    }

    if (
      items.length === 0 &&
      typeof mediaUrl === "string" &&
      (mediaType === "image" || mediaType === "video")
    ) {
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

    return {
      media: items.length > 0 ? items : undefined,
      mediaUrl: items[0]?.url ?? (typeof mediaUrl === "string" ? mediaUrl : undefined),
      mediaType: items[0]?.type ?? (mediaType === "image" || mediaType === "video" ? mediaType : undefined),
      immersiveVideo:
        items[0]?.type === "video"
          ? Boolean(items[0]?.immersive)
          : typeof immersiveVideo === "boolean"
            ? immersiveVideo
            : undefined,
    };
  };
  const normalizeStoryPoll = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const poll = value as {
      question?: unknown;
      options?: unknown;
      votes?: unknown;
    };
    const question = typeof poll.question === "string" ? poll.question : "";
    const options = Array.isArray(poll.options)
      ? poll.options.filter((entry): entry is string => typeof entry === "string")
      : [];
    const votes = Array.isArray(poll.votes)
      ? poll.votes
          .filter((entry): entry is { userId: string; optionIndex: number } =>
            Boolean(entry && typeof (entry as { userId?: unknown }).userId === "string"),
          )
          .map((entry) => ({
            userId: (entry as { userId: string }).userId,
            optionIndex: typeof (entry as { optionIndex?: unknown }).optionIndex === "number"
              ? (entry as { optionIndex: number }).optionIndex
              : 0,
          }))
      : [];
    if (!question || options.length === 0) {
      return undefined;
    }
    return { question, options, votes };
  };
  const normalizeStoryQuestion = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const question = value as {
      prompt?: unknown;
      answers?: unknown;
    };
    const prompt = typeof question.prompt === "string" ? question.prompt : "";
    const answers = Array.isArray(question.answers)
      ? question.answers
          .filter((entry): entry is { id: string; userId: string; text: string; createdAt: string } =>
            Boolean(entry && typeof (entry as { userId?: unknown }).userId === "string"),
          )
          .map((entry) => ({
            id: typeof (entry as { id?: unknown }).id === "string"
              ? (entry as { id: string }).id
              : createId("ans"),
            userId: (entry as { userId: string }).userId,
            text: typeof (entry as { text?: unknown }).text === "string"
              ? (entry as { text: string }).text
              : "",
            createdAt: typeof (entry as { createdAt?: unknown }).createdAt === "string"
              ? (entry as { createdAt: string }).createdAt
              : new Date().toISOString(),
          }))
      : [];
    if (!prompt) {
      return undefined;
    }
    return { prompt, answers };
  };
  const normalizeStoryReactions = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((entry): entry is { emoji: string; userIds: string[] } =>
            Boolean(entry && typeof (entry as { emoji?: unknown }).emoji === "string"),
          )
          .map((entry) => ({
            emoji: (entry as { emoji: string }).emoji,
            userIds: normalizeStringArray((entry as { userIds?: unknown }).userIds),
          }))
      : undefined;
  const normalizeStoryMusic = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const music = value as {
      id?: unknown;
      title?: unknown;
      artist?: unknown;
      url?: unknown;
      duration?: unknown;
    };
    if (typeof music.title !== "string" || !music.title.trim()) {
      return undefined;
    }
    const title = music.title.trim();
    const id = typeof music.id === "string" ? music.id.trim() : undefined;
    const artist =
      typeof music.artist === "string" && music.artist.trim()
        ? music.artist.trim()
        : undefined;
    const url =
      typeof music.url === "string" && music.url.trim()
        ? music.url.trim()
        : undefined;
    const duration =
      typeof music.duration === "number" && Number.isFinite(music.duration)
        ? Math.max(0, music.duration)
        : undefined;
    return { id, title, artist, url, duration };
  };
  type StoryReplyCandidate = {
    id?: unknown;
    userId?: unknown;
    text?: unknown;
    createdAt?: unknown;
  };
  const normalizeStoryReplies = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter(
            (entry): entry is StoryReplyCandidate =>
              Boolean(entry && typeof entry === "object"),
          )
          .filter((entry): entry is StoryReplyCandidate & { userId: string } =>
            typeof entry.userId === "string",
          )
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : createId("rpl"),
            userId: entry.userId,
            text: typeof entry.text === "string" ? entry.text : "",
            createdAt:
              typeof entry.createdAt === "string"
                ? entry.createdAt
                : new Date().toISOString(),
          }))
      : undefined;
  const normalizeStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  const normalizeCreatorReportFrequency = (value: unknown) =>
    value === "daily" || value === "weekly" || value === "monthly"
      ? value
      : "weekly";
  const normalizeCreatorReportFormat = (value: unknown) =>
    value === "csv" || value === "json" || value === "excel" || value === "pdf"
      ? value
      : "pdf";
  const normalizeCreatorReportRange = (value: unknown) =>
    value === "7d" || value === "90d" ? value : "30d";
  const normalizeCallSignalType = (value: unknown) =>
    value === "offer" || value === "answer" || value === "ice" ? value : "ice";
  const normalizeCallStatus = (value: unknown) =>
    value === "ringing" ||
    value === "connecting" ||
    value === "active" ||
    value === "declined" ||
    value === "ended" ||
    value === "missed"
      ? value
      : "ended";
  const normalizeCallParticipant = (value: unknown): CallParticipantRecord | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const participant = value as Partial<CallParticipantRecord>;

    if (typeof participant.userId !== "string") {
      return null;
    }

    return {
      userId: participant.userId,
      joinedAt:
        typeof participant.joinedAt === "string" ? participant.joinedAt : undefined,
      audioEnabled:
        typeof participant.audioEnabled === "boolean" ? participant.audioEnabled : true,
      videoEnabled:
        typeof participant.videoEnabled === "boolean" ? participant.videoEnabled : false,
      screenSharing:
        typeof participant.screenSharing === "boolean" ? participant.screenSharing : false,
      recording:
        typeof participant.recording === "boolean" ? participant.recording : false,
    };
  };
  const normalizeCallSignals = (value: unknown): CallSignalRecord[] =>
    Array.isArray(value)
      ? value
          .filter(
            (entry): entry is Partial<CallSignalRecord> =>
              Boolean(entry && typeof entry === "object"),
          )
          .filter(
            (entry): entry is Partial<CallSignalRecord> & {
              fromUserId: string;
              toUserId: string;
            } =>
              typeof entry.fromUserId === "string" && typeof entry.toUserId === "string",
          )
          .map((signal) => ({
            id: typeof signal.id === "string" ? signal.id : createId("sig"),
            fromUserId: signal.fromUserId,
            toUserId: signal.toUserId,
            type: normalizeCallSignalType(signal.type),
            payload: signal.payload,
            createdAt:
              typeof signal.createdAt === "string"
                ? signal.createdAt
                : new Date().toISOString(),
          }))
      : [];
  const normalizeRandomChatStatus = (value: unknown) =>
    value === "connecting" || value === "active" || value === "ended"
      ? value
      : "ended";
  const normalizeRandomChatEndReason = (value: unknown) =>
    value === "skip" ||
    value === "left" ||
    value === "report" ||
    value === "timeout"
      ? value
      : undefined;
  const normalizeRandomChatParticipant = (
    value: unknown,
  ): RandomChatParticipantRecord | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const participant = value as Partial<RandomChatParticipantRecord>;

    if (typeof participant.userId !== "string") {
      return null;
    }

    return {
      userId: participant.userId,
      country:
        typeof participant.country === "string" && participant.country.trim()
          ? participant.country.trim().toLowerCase()
          : undefined,
      interests: normalizeInterests(participant.interests),
      joinedAt:
        typeof participant.joinedAt === "string" ? participant.joinedAt : undefined,
      audioEnabled:
        typeof participant.audioEnabled === "boolean" ? participant.audioEnabled : true,
      videoEnabled:
        typeof participant.videoEnabled === "boolean" ? participant.videoEnabled : true,
    };
  };
  const normalizeRandomChatSignals = (value: unknown): RandomChatSignalRecord[] =>
    Array.isArray(value)
      ? value
          .filter(
            (entry): entry is Partial<RandomChatSignalRecord> =>
              Boolean(entry && typeof entry === "object"),
          )
          .filter(
            (entry): entry is Partial<RandomChatSignalRecord> & {
              fromUserId: string;
              toUserId: string;
            } =>
              typeof entry.fromUserId === "string" && typeof entry.toUserId === "string",
          )
          .map((signal) => ({
            id: typeof signal.id === "string" ? signal.id : createId("rsg"),
            fromUserId: signal.fromUserId,
            toUserId: signal.toUserId,
            type: normalizeCallSignalType(signal.type),
            payload: signal.payload,
            createdAt:
              typeof signal.createdAt === "string"
                ? signal.createdAt
                : new Date().toISOString(),
          }))
      : [];

  const normalizedPosts = Array.isArray(candidate.posts)
    ? (candidate.posts as Partial<PostRecord>[]).map((post) => ({
        ...(post as PostRecord),
        ...normalizeMediaList(
          (post as PostRecord).media,
          post.mediaUrl,
          post.mediaType,
          post.immersiveVideo,
        ),
        interests: normalizeInterests(post.interests),
        coAuthorIds: normalizeStringArray(post.coAuthorIds),
        coAuthorInvites: normalizeStringArray(post.coAuthorInvites),
        likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
        savedBy: Array.isArray(post.savedBy) ? post.savedBy : [],
        commentCount: typeof post.commentCount === "number" ? post.commentCount : 0,
        shareCount: typeof post.shareCount === "number" ? post.shareCount : 0,
        watchTimeMs:
          typeof post.watchTimeMs === "number" && Number.isFinite(post.watchTimeMs)
            ? post.watchTimeMs
            : 0,
        viewCount:
          typeof post.viewCount === "number" && Number.isFinite(post.viewCount)
            ? Math.max(0, Math.round(post.viewCount))
            : undefined,
      }))
    : [];
  const normalizedComments = Array.isArray(candidate.comments)
    ? (candidate.comments as CommentRecord[])
    : createSeedComments(normalizedPosts);
  const commentTotals = new Map<string, number>();

  normalizedComments.forEach((comment) => {
    commentTotals.set(
      comment.postId,
      (commentTotals.get(comment.postId) ?? 0) + 1,
    );
  });

  const normalizedLiveSessions = Array.isArray(candidate.liveSessions)
    ? (candidate.liveSessions as Partial<LiveSessionRecord>[]).map((session) => ({
        ...(session as LiveSessionRecord),
        viewerIds: normalizeStringArray(session.viewerIds),
      }))
    : [];

  const normalizedLiveComments = Array.isArray(candidate.liveComments)
    ? (candidate.liveComments as LiveCommentRecord[])
        .filter(
          (comment): comment is LiveCommentRecord =>
            Boolean(comment && typeof comment.liveId === "string"),
        )
        .map((comment) => ({
          ...comment,
          text: typeof comment.text === "string" ? comment.text : "",
          createdAt:
            typeof comment.createdAt === "string"
              ? comment.createdAt
              : new Date().toISOString(),
        }))
    : [];

  const normalizeLastActive = (user: UserRecord): string => {
    if (typeof user.lastActiveAt === "string") {
      return user.lastActiveAt;
    }
    const checksum = [...user.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const minutesAgo = checksum % 18;
    return new Date(Date.now() - minutesAgo * 60_000).toISOString();
  };

  return {
    users: Array.isArray(candidate.users)
      ? (candidate.users as UserRecord[]).map((user) => ({
          ...user,
          accountType:
            user.accountType === "creator" || user.accountType === "public"
              ? user.accountType
              : Object.values(USER_IDS).includes(
                  user.id as (typeof USER_IDS)[keyof typeof USER_IDS],
                )
                ? "creator"
                : "public",
          hiddenFromIds: normalizeStringArray(user.hiddenFromIds),
          interests:
            normalizeInterests(user.interests).length > 0
              ? normalizeInterests(user.interests)
              : normalizeInterests(
                  DEFAULT_USER_INTERESTS[
                    user.id as keyof typeof DEFAULT_USER_INTERESTS
                  ],
                ),
          chatWallpaper: isChatWallpaper(user.chatWallpaper)
            ? user.chatWallpaper
            : DEFAULT_CHAT_WALLPAPER,
          coverTheme: isProfileCoverTheme(user.coverTheme)
            ? user.coverTheme
            : DEFAULT_PROFILE_COVER,
          coverImageUrl:
            typeof user.coverImageUrl === "string" &&
            user.coverImageUrl.startsWith("/uploads/")
              ? user.coverImageUrl
              : undefined,
          profileAccent: isProfileAccent(user.profileAccent)
            ? user.profileAccent
            : DEFAULT_PROFILE_ACCENT,
          restrictedAccount: Boolean(user.restrictedAccount),
          onboardingCompleted:
            typeof user.onboardingCompleted === "boolean"
              ? user.onboardingCompleted
              : true,
          postLayoutOrder: normalizeStringArray(user.postLayoutOrder),
          pinnedPostIds: normalizeStringArray(user.pinnedPostIds),
          lastActiveAt: normalizeLastActive(user),
        }))
      : [],
    sessions: Array.isArray(candidate.sessions)
      ? (candidate.sessions as SessionRecord[])
      : [],
    posts: normalizedPosts.map((post) => ({
      ...post,
      commentCount: Math.max(post.commentCount, commentTotals.get(post.id) ?? 0),
    })),
    comments: normalizedComments,
    stories: Array.isArray(candidate.stories)
      ? (candidate.stories as Partial<StoryRecord>[]).map((story) => ({
          ...(story as StoryRecord),
          ...normalizeMediaList(
            (story as StoryRecord).media,
            story.mediaUrl,
            story.mediaType,
          ),
          poll: normalizeStoryPoll((story as StoryRecord).poll),
          question: normalizeStoryQuestion((story as StoryRecord).question),
          emojiReactions: normalizeStoryReactions((story as StoryRecord).emojiReactions),
          music: normalizeStoryMusic((story as StoryRecord).music),
          replies: normalizeStoryReplies((story as StoryRecord).replies),
          seenBy: Array.isArray(story.seenBy) ? story.seenBy : [],
        }))
      : [],
    moveHighlights: Array.isArray((candidate as { moveHighlights?: unknown }).moveHighlights)
      ? (
          (candidate as { moveHighlights: unknown[] }).moveHighlights as Partial<MoveHighlightRecord>[]
        )
          .filter(
            (highlight): highlight is Partial<MoveHighlightRecord> & {
              userId: string;
              title: string;
            } =>
              Boolean(highlight && typeof highlight.userId === "string") &&
              typeof highlight.title === "string",
          )
          .map((highlight) => ({
            id: typeof highlight.id === "string" ? highlight.id : createId("hgh"),
            userId: highlight.userId,
            title: highlight.title.trim() || "Highlight",
            accent: isProfileAccent(highlight.accent)
              ? highlight.accent
              : DEFAULT_PROFILE_ACCENT,
            items: Array.isArray(highlight.items)
              ? highlight.items.reduce<MoveHighlightRecord["items"]>((items, item) => {
                  if (!item || typeof item !== "object") {
                    return items;
                  }
                  const candidateItem = item as MoveHighlightRecord["items"][number];
                  const normalizedMedia = normalizeMediaList(
                    candidateItem.media,
                    candidateItem.mediaUrl,
                    candidateItem.mediaType,
                  );

                  items.push({
                    id:
                      typeof candidateItem.id === "string"
                        ? candidateItem.id
                        : createId("hgi"),
                    sourceStoryId:
                      typeof candidateItem.sourceStoryId === "string"
                        ? candidateItem.sourceStoryId
                        : undefined,
                    caption:
                      typeof candidateItem.caption === "string"
                        ? candidateItem.caption
                        : "",
                    gradient:
                      typeof candidateItem.gradient === "string"
                        ? candidateItem.gradient
                        : "linear-gradient(135deg, #4facfe, #00f2fe)",
                    ...normalizedMedia,
                    createdAt:
                      typeof candidateItem.createdAt === "string"
                        ? candidateItem.createdAt
                        : new Date().toISOString(),
                  });

                  return items;
                }, [])
              : [],
            createdAt:
              typeof highlight.createdAt === "string"
                ? highlight.createdAt
                : new Date().toISOString(),
            updatedAt:
              typeof highlight.updatedAt === "string"
                ? highlight.updatedAt
                : typeof highlight.createdAt === "string"
                  ? highlight.createdAt
                  : new Date().toISOString(),
          }))
      : [],
    liveSessions: normalizedLiveSessions,
    liveComments: normalizedLiveComments,
    conversations: Array.isArray(candidate.conversations)
      ? (candidate.conversations as ConversationRecord[]).map((conversation) => ({
          ...conversation,
          pinnedByUserIds: normalizeStringIdArray(conversation.pinnedByUserIds),
          chatWallpaper: isChatWallpaperSelection(conversation.chatWallpaper)
            ? conversation.chatWallpaper
            : undefined,
          chatWallpaperUrl:
            conversation.chatWallpaper === "custom" &&
            typeof conversation.chatWallpaperUrl === "string" &&
            conversation.chatWallpaperUrl.startsWith("/uploads/")
              ? conversation.chatWallpaperUrl
              : undefined,
          chatWallpaperLight: isChatWallpaperSelection(conversation.chatWallpaperLight)
            ? conversation.chatWallpaperLight
            : undefined,
          chatWallpaperLightUrl:
            conversation.chatWallpaperLight === "custom" &&
            typeof conversation.chatWallpaperLightUrl === "string" &&
            conversation.chatWallpaperLightUrl.startsWith("/uploads/")
              ? conversation.chatWallpaperLightUrl
              : undefined,
          chatWallpaperDark: isChatWallpaperSelection(conversation.chatWallpaperDark)
            ? conversation.chatWallpaperDark
            : undefined,
          chatWallpaperDarkUrl:
            conversation.chatWallpaperDark === "custom" &&
            typeof conversation.chatWallpaperDarkUrl === "string" &&
            conversation.chatWallpaperDarkUrl.startsWith("/uploads/")
              ? conversation.chatWallpaperDarkUrl
              : undefined,
          chatWallpaperBlur: clampChatWallpaperBlur(conversation.chatWallpaperBlur),
          chatWallpaperDim: clampChatWallpaperDim(conversation.chatWallpaperDim),
          typingByUserId: normalizeTypingMap(conversation.typingByUserId),
        }))
      : [],
    messages: Array.isArray(candidate.messages)
      ? (candidate.messages as MessageRecord[]).map((message) => ({
          ...message,
          text: typeof message.text === "string" ? message.text : "",
          replyToId: typeof message.replyToId === "string" ? message.replyToId : undefined,
          systemType: message.systemType === "call" ? "call" : undefined,
          callId: typeof message.callId === "string" ? message.callId : undefined,
          callMode:
            message.callMode === "voice" || message.callMode === "video"
              ? message.callMode
              : undefined,
          callEvent:
            message.callEvent === "started" ||
            message.callEvent === "accepted" ||
            message.callEvent === "declined" ||
            message.callEvent === "ended" ||
            message.callEvent === "missed"
              ? message.callEvent
              : undefined,
          callDurationMs:
            typeof message.callDurationMs === "number" &&
            Number.isFinite(message.callDurationMs) &&
            message.callDurationMs >= 0
              ? Math.round(message.callDurationMs)
              : undefined,
          attachment: normalizeChatAttachment(message.attachment),
          reactions: normalizeMessageReactions(message.reactions),
          deliveredToIds: normalizeStringIdArray(message.deliveredToIds),
          readByIds: normalizeStringIdArray(message.readByIds),
          unsentAt: typeof message.unsentAt === "string" ? message.unsentAt : undefined,
          unsentById: typeof message.unsentById === "string" ? message.unsentById : undefined,
        }))
      : [],
    callSessions: Array.isArray((candidate as { callSessions?: unknown }).callSessions)
      ? ((candidate as { callSessions: unknown[] }).callSessions as Partial<CallSessionRecord>[])
          .filter(
            (session): session is Partial<CallSessionRecord> & {
              conversationId: string;
              initiatorId: string;
            } =>
              Boolean(session && typeof session.conversationId === "string") &&
              typeof session.initiatorId === "string",
          )
          .map((session) => ({
            id: typeof session.id === "string" ? session.id : createId("call"),
            conversationId: session.conversationId,
            initiatorId: session.initiatorId,
            participantIds: normalizeStringIdArray(session.participantIds),
            mode: session.mode === "voice" || session.mode === "video" ? session.mode : "video",
            status: normalizeCallStatus(session.status),
            participants: Array.isArray(session.participants)
              ? session.participants
                  .map((participant) => normalizeCallParticipant(participant))
                  .filter(
                    (participant): participant is CallParticipantRecord =>
                      Boolean(participant),
                  )
              : [],
            signals: normalizeCallSignals(session.signals),
            createdAt:
              typeof session.createdAt === "string"
                ? session.createdAt
                : new Date().toISOString(),
            updatedAt:
              typeof session.updatedAt === "string"
                ? session.updatedAt
                : new Date().toISOString(),
            answeredAt:
              typeof session.answeredAt === "string" ? session.answeredAt : undefined,
            endedAt: typeof session.endedAt === "string" ? session.endedAt : undefined,
            endedById:
              typeof session.endedById === "string" ? session.endedById : undefined,
          }))
      : [],
    randomChatQueue: Array.isArray(
      (candidate as { randomChatQueue?: unknown }).randomChatQueue,
    )
      ? (
          (candidate as { randomChatQueue: unknown[] }).randomChatQueue as Partial<RandomChatQueueRecord>[]
        )
          .filter(
            (entry): entry is Partial<RandomChatQueueRecord> & { userId: string } =>
              Boolean(entry && typeof entry.userId === "string"),
          )
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : createId("rqc"),
            userId: entry.userId,
            country:
              typeof entry.country === "string" && entry.country.trim()
                ? entry.country.trim().toLowerCase()
                : undefined,
            preferredCountry:
              typeof entry.preferredCountry === "string" && entry.preferredCountry.trim()
                ? entry.preferredCountry.trim().toLowerCase()
                : undefined,
            preferredInterests: normalizeInterests(entry.preferredInterests),
            createdAt:
              typeof entry.createdAt === "string"
                ? entry.createdAt
                : new Date().toISOString(),
            updatedAt:
              typeof entry.updatedAt === "string"
                ? entry.updatedAt
                : typeof entry.createdAt === "string"
                  ? entry.createdAt
                  : new Date().toISOString(),
          }))
      : [],
    randomChatSessions: Array.isArray(
      (candidate as { randomChatSessions?: unknown }).randomChatSessions,
    )
      ? (
          (candidate as { randomChatSessions: unknown[] })
            .randomChatSessions as Partial<RandomChatSessionRecord>[]
        )
          .filter(
            (session): session is Partial<RandomChatSessionRecord> & {
              initiatorId: string;
            } =>
              Boolean(session && typeof session.initiatorId === "string"),
          )
          .map((session) => ({
            id: typeof session.id === "string" ? session.id : createId("rnd"),
            initiatorId: session.initiatorId,
            participantIds: normalizeStringArray(session.participantIds),
            participants: Array.isArray(session.participants)
              ? session.participants
                  .map((participant) => normalizeRandomChatParticipant(participant))
                  .filter(
                    (participant): participant is RandomChatParticipantRecord =>
                      Boolean(participant),
                  )
              : [],
            signals: normalizeRandomChatSignals(session.signals),
            status: normalizeRandomChatStatus(session.status),
            createdAt:
              typeof session.createdAt === "string"
                ? session.createdAt
                : new Date().toISOString(),
            matchedAt:
              typeof session.matchedAt === "string"
                ? session.matchedAt
                : typeof session.createdAt === "string"
                  ? session.createdAt
                  : new Date().toISOString(),
            updatedAt:
              typeof session.updatedAt === "string"
                ? session.updatedAt
                : new Date().toISOString(),
            endedAt: typeof session.endedAt === "string" ? session.endedAt : undefined,
            endedById:
              typeof session.endedById === "string" ? session.endedById : undefined,
            endedReason: normalizeRandomChatEndReason(session.endedReason),
          }))
      : [],
    randomChatReports: Array.isArray(
      (candidate as { randomChatReports?: unknown }).randomChatReports,
    )
      ? (
          (candidate as { randomChatReports: unknown[] })
            .randomChatReports as Partial<RandomChatReportRecord>[]
        )
          .filter(
            (report): report is Partial<RandomChatReportRecord> & {
              sessionId: string;
              reporterId: string;
              reportedUserId: string;
            } =>
              Boolean(report && typeof report.sessionId === "string") &&
              typeof report.reporterId === "string" &&
              typeof report.reportedUserId === "string",
          )
          .map((report) => ({
            id: typeof report.id === "string" ? report.id : createId("rrp"),
            sessionId: report.sessionId,
            reporterId: report.reporterId,
            reportedUserId: report.reportedUserId,
            reason: typeof report.reason === "string" ? report.reason : undefined,
            createdAt:
              typeof report.createdAt === "string"
                ? report.createdAt
                : new Date().toISOString(),
          }))
      : [],
    follows: Array.isArray(candidate.follows)
      ? (candidate.follows as FollowRecord[]).map((follow, index) => ({
          ...follow,
          createdAt:
            typeof follow.createdAt === "string"
              ? follow.createdAt
              : new Date(
                  Date.now() - ((index % 14) + 1) * 24 * 60 * 60 * 1000,
                ).toISOString(),
        }))
      : [],
    blocks: Array.isArray((candidate as { blocks?: unknown }).blocks)
      ? (
          (candidate as { blocks: unknown[] }).blocks as Partial<BlockRecord>[]
        )
          .filter(
            (entry): entry is Partial<BlockRecord> & {
              blockerId: string;
              blockedUserId: string;
            } =>
              Boolean(entry && typeof entry.blockerId === "string") &&
              typeof entry.blockedUserId === "string",
          )
          .map((entry) => ({
            blockerId: entry.blockerId,
            blockedUserId: entry.blockedUserId,
            createdAt:
              typeof entry.createdAt === "string"
                ? entry.createdAt
                : new Date().toISOString(),
          }))
      : [],
    mutes: Array.isArray((candidate as { mutes?: unknown }).mutes)
      ? (
          (candidate as { mutes: unknown[] }).mutes as Partial<MuteRecord>[]
        )
          .filter(
            (entry): entry is Partial<MuteRecord> & {
              userId: string;
              mutedUserId: string;
            } =>
              Boolean(entry && typeof entry.userId === "string") &&
              typeof entry.mutedUserId === "string",
          )
          .map((entry) => ({
            userId: entry.userId,
            mutedUserId: entry.mutedUserId,
            createdAt:
              typeof entry.createdAt === "string"
                ? entry.createdAt
                : new Date().toISOString(),
          }))
      : [],
    safetyReports: Array.isArray((candidate as { safetyReports?: unknown }).safetyReports)
      ? (
          (candidate as { safetyReports: unknown[] }).safetyReports as Partial<SafetyReportRecord>[]
        )
          .filter(
            (entry): entry is Partial<SafetyReportRecord> & {
              reporterId: string;
              targetType: "account" | "post" | "message";
              targetId: string;
              reason: string;
            } =>
              Boolean(entry && typeof entry.reporterId === "string") &&
              (entry.targetType === "account" ||
                entry.targetType === "post" ||
                entry.targetType === "message") &&
              typeof entry.targetId === "string" &&
              typeof entry.reason === "string",
          )
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : createId("rpt"),
            reporterId: entry.reporterId,
            targetType: entry.targetType,
            targetId: entry.targetId,
            targetUserId:
              typeof entry.targetUserId === "string" ? entry.targetUserId : undefined,
            conversationId:
              typeof entry.conversationId === "string" ? entry.conversationId : undefined,
            reason: entry.reason,
            details: typeof entry.details === "string" ? entry.details : undefined,
            status: entry.status === "reviewed" ? "reviewed" : "open",
            createdAt:
              typeof entry.createdAt === "string"
                ? entry.createdAt
                : new Date().toISOString(),
          }))
      : [],
    notifications: Array.isArray(candidate.notifications)
      ? (candidate.notifications as NotificationRecord[])
      : [],
    profileViews: Array.isArray(candidate.profileViews)
      ? (candidate.profileViews as ProfileViewRecord[])
      : [],
    supportRequests: Array.isArray((candidate as { supportRequests?: unknown }).supportRequests)
      ? (
          (candidate as { supportRequests: unknown[] }).supportRequests as Partial<SupportRequestRecord>[]
        )
          .filter(
            (request): request is Partial<SupportRequestRecord> & {
              email: string;
              message: string;
            } =>
              Boolean(request && typeof request.email === "string") &&
              typeof request.message === "string",
          )
          .map((request) => ({
            id: typeof request.id === "string" ? request.id : createId("sup"),
            email: request.email,
            message: request.message,
            userId: typeof request.userId === "string" ? request.userId : null,
            status: request.status === "resolved" ? "resolved" : "open",
            createdAt:
              typeof request.createdAt === "string"
                ? request.createdAt
                : new Date().toISOString(),
          }))
      : [],
    creatorReportSchedules: Array.isArray(candidate.creatorReportSchedules)
      ? (candidate.creatorReportSchedules as Partial<CreatorReportScheduleRecord>[])
          .filter(
            (schedule): schedule is Partial<CreatorReportScheduleRecord> & { userId: string } =>
              Boolean(schedule && typeof schedule.userId === "string"),
          )
          .map((schedule, index) => ({
            id:
              typeof schedule.id === "string"
                ? schedule.id
                : createId(`rps${index}`),
            userId: schedule.userId,
            destinationEmail:
              typeof schedule.destinationEmail === "string"
                ? schedule.destinationEmail
                : "",
            frequency: normalizeCreatorReportFrequency(schedule.frequency),
            format: normalizeCreatorReportFormat(schedule.format),
            range: normalizeCreatorReportRange(schedule.range),
            enabled: Boolean(schedule.enabled),
            createdAt:
              typeof schedule.createdAt === "string"
                ? schedule.createdAt
                : new Date().toISOString(),
            updatedAt:
              typeof schedule.updatedAt === "string"
                ? schedule.updatedAt
                : new Date().toISOString(),
            lastSentAt:
              typeof schedule.lastSentAt === "string"
                ? schedule.lastSentAt
                : undefined,
            nextSendAt:
              typeof schedule.nextSendAt === "string"
                ? schedule.nextSendAt
                : undefined,
          }))
      : [],
    creatorReportDeliveries: Array.isArray(candidate.creatorReportDeliveries)
      ? (candidate.creatorReportDeliveries as Partial<CreatorReportDeliveryRecord>[])
          .filter(
            (delivery): delivery is Partial<CreatorReportDeliveryRecord> & { userId: string } =>
              Boolean(delivery && typeof delivery.userId === "string"),
          )
          .map((delivery) => ({
            id:
              typeof delivery.id === "string"
                ? delivery.id
                : createId("rpd"),
            userId: delivery.userId,
            destinationEmail:
              typeof delivery.destinationEmail === "string"
                ? delivery.destinationEmail
                : "",
            frequency: normalizeCreatorReportFrequency(delivery.frequency),
            format: normalizeCreatorReportFormat(delivery.format),
            range: normalizeCreatorReportRange(delivery.range),
            deliveredAt:
              typeof delivery.deliveredAt === "string"
                ? delivery.deliveredAt
                : new Date().toISOString(),
            status: "sent",
          }))
      : [],
  };
}

function pruneExpiredRecords(db: MotionDb): void {
  const now = Date.now();
  db.sessions = db.sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now,
  );
  db.stories = db.stories.filter((story) => new Date(story.expiresAt).getTime() > now);

  const expiredPostIds = new Set(
    db.posts
      .filter(
        (post) =>
          post.deletedAt &&
          now - new Date(post.deletedAt).getTime() > BIN_RETENTION_MS,
      )
      .map((post) => post.id),
  );

  if (expiredPostIds.size > 0) {
    db.posts = db.posts.filter((post) => !expiredPostIds.has(post.id));
    db.comments = db.comments.filter((comment) => !expiredPostIds.has(comment.postId));
  }

  const staleLiveIds = new Set(
    db.liveSessions
      .filter(
        (session) =>
          session.endedAt &&
          now - new Date(session.endedAt).getTime() > 6 * 60 * 60 * 1000,
      )
      .map((session) => session.id),
  );

  if (staleLiveIds.size > 0) {
    db.liveSessions = db.liveSessions.filter((session) => !staleLiveIds.has(session.id));
    db.liveComments = db.liveComments.filter((comment) => !staleLiveIds.has(comment.liveId));
  }

  db.randomChatQueue = db.randomChatQueue.filter(
    (entry) => now - new Date(entry.updatedAt).getTime() <= RANDOM_CHAT_QUEUE_TTL_MS,
  );

  db.randomChatSessions = db.randomChatSessions.map((session) => {
    if (
      !session.endedAt &&
      now - new Date(session.updatedAt).getTime() > RANDOM_CHAT_ACTIVE_TTL_MS
    ) {
      return {
        ...session,
        status: "ended",
        endedAt: new Date().toISOString(),
        endedReason: session.endedReason ?? "timeout",
        updatedAt: new Date().toISOString(),
      };
    }

    return session;
  });

  db.randomChatSessions = db.randomChatSessions.filter((session) => {
    if (!session.endedAt) {
      return true;
    }

    return now - new Date(session.endedAt).getTime() <= RANDOM_CHAT_ENDED_TTL_MS;
  });

  db.callSessions = db.callSessions.map((session) => {
    if (
      session.status === "ringing" &&
      now - new Date(session.createdAt).getTime() > 45_000
    ) {
      const hasMissedMessage = db.messages.some(
        (message) => message.callId === session.id && message.callEvent === "missed",
      );

      if (!hasMissedMessage) {
        const conversation = db.conversations.find(
          (candidate) => candidate.id === session.conversationId,
        );
        const createdAt = new Date().toISOString();

        db.messages.push({
          id: createId("msg"),
          conversationId: session.conversationId,
          senderId: session.initiatorId,
          text: `Missed ${session.mode} call`,
          systemType: "call",
          callId: session.id,
          callMode: session.mode,
          callEvent: "missed",
          reactions: [],
          deliveredToIds: [],
          readByIds: [],
          createdAt,
        });

        if (conversation) {
          conversation.updatedAt = createdAt;

          for (const participantId of conversation.participantIds) {
            if (participantId === session.initiatorId) {
              conversation.unreadCountByUserId[participantId] = 0;
            } else {
              conversation.unreadCountByUserId[participantId] =
                (conversation.unreadCountByUserId[participantId] ?? 0) + 1;

              const hasMissedCallNotification = db.notifications.some(
                (notification) =>
                  notification.type === "missed_call" &&
                  notification.callId === session.id &&
                  notification.userId === participantId,
              );

              if (!hasMissedCallNotification) {
                db.notifications.unshift({
                  id: createId("ntf"),
                  userId: participantId,
                  actorId: session.initiatorId,
                  type: "missed_call",
                  callId: session.id,
                  callMode: session.mode,
                  conversationId: session.conversationId,
                  text: `Missed ${session.mode} call`,
                  createdAt,
                });
              }
            }
          }
        }
      }

      return {
        ...session,
        status: "missed",
        endedAt: session.endedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return session;
  });

  db.callSessions = db.callSessions.filter((session) => {
    if (!session.endedAt) {
      return true;
    }

    return now - new Date(session.endedAt).getTime() <= 6 * 60 * 60 * 1000;
  });
}

async function writeJsonSnapshot(db: MotionDb): Promise<void> {
  const tempPath = `${DATABASE_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tempPath, DATABASE_PATH);
}

async function ensureJsonSnapshot(seed?: MotionDb): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await fs.access(DATABASE_PATH);
  } catch {
    await writeJsonSnapshot(seed ?? createSeedDatabase());
  }
}

async function readJsonSnapshot(): Promise<MotionDb | null> {
  try {
    await ensureJsonSnapshot();
    const raw = await fs.readFile(DATABASE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeDatabase(parsed);
  } catch {
    return null;
  }
}

type CollectionConfig = {
  key: keyof MotionDb;
  table: string;
  getPrimaryKey: (record: unknown) => string;
  getOwnerId?: (record: unknown) => string | null | undefined;
  getRelatedId?: (record: unknown) => string | null | undefined;
  getSortAt?: (record: unknown) => string | null | undefined;
};

const RELATIONAL_SCHEMA_VERSION = "2";

function buildCompositeKey(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part ?? "").join("::");
}

const MOTION_COLLECTIONS: CollectionConfig[] = [
  { key: "users", table: "users", getPrimaryKey: (record) => (record as UserRecord).id },
  {
    key: "sessions",
    table: "sessions",
    getPrimaryKey: (record) => (record as SessionRecord).id,
    getOwnerId: (record) => (record as SessionRecord).userId,
    getSortAt: (record) => (record as SessionRecord).createdAt,
  },
  {
    key: "posts",
    table: "posts",
    getPrimaryKey: (record) => (record as PostRecord).id,
    getOwnerId: (record) => (record as PostRecord).userId,
    getSortAt: (record) => (record as PostRecord).createdAt,
  },
  {
    key: "comments",
    table: "comments",
    getPrimaryKey: (record) => (record as CommentRecord).id,
    getOwnerId: (record) => (record as CommentRecord).userId,
    getRelatedId: (record) => (record as CommentRecord).postId,
    getSortAt: (record) => (record as CommentRecord).createdAt,
  },
  {
    key: "stories",
    table: "stories",
    getPrimaryKey: (record) => (record as StoryRecord).id,
    getOwnerId: (record) => (record as StoryRecord).userId,
    getSortAt: (record) => (record as StoryRecord).createdAt,
  },
  {
    key: "moveHighlights",
    table: "move_highlights",
    getPrimaryKey: (record) => (record as MoveHighlightRecord).id,
    getOwnerId: (record) => (record as MoveHighlightRecord).userId,
    getSortAt: (record) => (record as MoveHighlightRecord).updatedAt,
  },
  {
    key: "liveSessions",
    table: "live_sessions",
    getPrimaryKey: (record) => (record as LiveSessionRecord).id,
    getOwnerId: (record) => (record as LiveSessionRecord).hostId,
    getSortAt: (record) => (record as LiveSessionRecord).createdAt,
  },
  {
    key: "liveComments",
    table: "live_comments",
    getPrimaryKey: (record) => (record as LiveCommentRecord).id,
    getOwnerId: (record) => (record as LiveCommentRecord).userId,
    getRelatedId: (record) => (record as LiveCommentRecord).liveId,
    getSortAt: (record) => (record as LiveCommentRecord).createdAt,
  },
  {
    key: "conversations",
    table: "conversations",
    getPrimaryKey: (record) => (record as ConversationRecord).id,
    getSortAt: (record) => (record as ConversationRecord).updatedAt,
  },
  {
    key: "messages",
    table: "messages",
    getPrimaryKey: (record) => (record as MessageRecord).id,
    getOwnerId: (record) => (record as MessageRecord).senderId,
    getRelatedId: (record) => (record as MessageRecord).conversationId,
    getSortAt: (record) => (record as MessageRecord).createdAt,
  },
  {
    key: "callSessions",
    table: "call_sessions",
    getPrimaryKey: (record) => (record as CallSessionRecord).id,
    getOwnerId: (record) => (record as CallSessionRecord).initiatorId,
    getRelatedId: (record) => (record as CallSessionRecord).conversationId,
    getSortAt: (record) => (record as CallSessionRecord).updatedAt,
  },
  {
    key: "randomChatQueue",
    table: "random_chat_queue",
    getPrimaryKey: (record) => (record as RandomChatQueueRecord).id,
    getOwnerId: (record) => (record as RandomChatQueueRecord).userId,
    getSortAt: (record) => (record as RandomChatQueueRecord).updatedAt,
  },
  {
    key: "randomChatSessions",
    table: "random_chat_sessions",
    getPrimaryKey: (record) => (record as RandomChatSessionRecord).id,
    getOwnerId: (record) => (record as RandomChatSessionRecord).initiatorId,
    getSortAt: (record) => (record as RandomChatSessionRecord).updatedAt,
  },
  {
    key: "randomChatReports",
    table: "random_chat_reports",
    getPrimaryKey: (record) => (record as RandomChatReportRecord).id,
    getOwnerId: (record) => (record as RandomChatReportRecord).reporterId,
    getRelatedId: (record) => (record as RandomChatReportRecord).sessionId,
    getSortAt: (record) => (record as RandomChatReportRecord).createdAt,
  },
  {
    key: "follows",
    table: "follows",
    getPrimaryKey: (record) =>
      buildCompositeKey([
        (record as FollowRecord).followerId,
        (record as FollowRecord).followingId,
      ]),
    getOwnerId: (record) => (record as FollowRecord).followerId,
    getRelatedId: (record) => (record as FollowRecord).followingId,
    getSortAt: (record) => (record as FollowRecord).createdAt,
  },
  {
    key: "blocks",
    table: "blocks",
    getPrimaryKey: (record) =>
      buildCompositeKey([
        (record as BlockRecord).blockerId,
        (record as BlockRecord).blockedUserId,
      ]),
    getOwnerId: (record) => (record as BlockRecord).blockerId,
    getRelatedId: (record) => (record as BlockRecord).blockedUserId,
    getSortAt: (record) => (record as BlockRecord).createdAt,
  },
  {
    key: "mutes",
    table: "mutes",
    getPrimaryKey: (record) =>
      buildCompositeKey([(record as MuteRecord).userId, (record as MuteRecord).mutedUserId]),
    getOwnerId: (record) => (record as MuteRecord).userId,
    getRelatedId: (record) => (record as MuteRecord).mutedUserId,
    getSortAt: (record) => (record as MuteRecord).createdAt,
  },
  {
    key: "safetyReports",
    table: "safety_reports",
    getPrimaryKey: (record) => (record as SafetyReportRecord).id,
    getOwnerId: (record) => (record as SafetyReportRecord).reporterId,
    getRelatedId: (record) => (record as SafetyReportRecord).targetUserId,
    getSortAt: (record) => (record as SafetyReportRecord).createdAt,
  },
  {
    key: "notifications",
    table: "notifications",
    getPrimaryKey: (record) => (record as NotificationRecord).id,
    getOwnerId: (record) => (record as NotificationRecord).userId,
    getRelatedId: (record) => (record as NotificationRecord).actorId,
    getSortAt: (record) => (record as NotificationRecord).createdAt,
  },
  {
    key: "profileViews",
    table: "profile_views",
    getPrimaryKey: (record) => (record as ProfileViewRecord).id,
    getOwnerId: (record) => (record as ProfileViewRecord).viewerId,
    getRelatedId: (record) => (record as ProfileViewRecord).viewedId,
    getSortAt: (record) => (record as ProfileViewRecord).createdAt,
  },
  {
    key: "supportRequests",
    table: "support_requests",
    getPrimaryKey: (record) => (record as SupportRequestRecord).id,
    getOwnerId: (record) => (record as SupportRequestRecord).userId,
    getSortAt: (record) => (record as SupportRequestRecord).createdAt,
  },
  {
    key: "creatorReportSchedules",
    table: "creator_report_schedules",
    getPrimaryKey: (record) => (record as CreatorReportScheduleRecord).id,
    getOwnerId: (record) => (record as CreatorReportScheduleRecord).userId,
    getSortAt: (record) => (record as CreatorReportScheduleRecord).updatedAt,
  },
  {
    key: "creatorReportDeliveries",
    table: "creator_report_deliveries",
    getPrimaryKey: (record) => (record as CreatorReportDeliveryRecord).id,
    getOwnerId: (record) => (record as CreatorReportDeliveryRecord).userId,
    getSortAt: (record) => (record as CreatorReportDeliveryRecord).deliveredAt,
  },
];

function configureSqliteDatabase(sqliteDb: SQLiteDatabaseLike): void {
  sqliteDb.exec("PRAGMA journal_mode = WAL;");
  sqliteDb.exec("PRAGMA busy_timeout = 5000;");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS motion_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  for (const collection of MOTION_COLLECTIONS) {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS ${collection.table} (
        entity_key TEXT PRIMARY KEY,
        owner_id TEXT,
        related_id TEXT,
        sort_at TEXT,
        order_index INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
    `);
    sqliteDb.exec(
      `CREATE INDEX IF NOT EXISTS idx_${collection.table}_owner ON ${collection.table}(owner_id)`,
    );
    sqliteDb.exec(
      `CREATE INDEX IF NOT EXISTS idx_${collection.table}_related ON ${collection.table}(related_id)`,
    );
    sqliteDb.exec(
      `CREATE INDEX IF NOT EXISTS idx_${collection.table}_sort ON ${collection.table}(sort_at)`,
    );
  }
}

function closeSqliteDatabase(sqliteDb: SQLiteDatabaseLike): void {
  if (typeof sqliteDb[Symbol.dispose] === "function") {
    sqliteDb[Symbol.dispose]!();
    return;
  }

  if (typeof sqliteDb.close === "function") {
    sqliteDb.close();
  }
}

async function ensureStorageReady(): Promise<"sqlite" | "json"> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  const sqlite = await getSqliteModule();

  if (!sqlite) {
    await ensureJsonSnapshot();
    return "json";
  }

  const sqliteDb = new sqlite.DatabaseSync(SQLITE_DATABASE_PATH);

  try {
    configureSqliteDatabase(sqliteDb);
    const storageModeRow = sqliteDb
      .prepare("SELECT value FROM motion_meta WHERE key = 'storage_mode'")
      .get();
    const storageMode =
      typeof storageModeRow?.value === "string" ? storageModeRow.value : null;

    if (storageMode !== "relational") {
      const relationalRowCount = MOTION_COLLECTIONS.reduce((sum, collection) => {
        const row = sqliteDb
          .prepare(`SELECT COUNT(*) as count FROM ${collection.table}`)
          .get();
        return sum + Number(row?.count ?? 0);
      }, 0);

      if (relationalRowCount === 0) {
        let seed: MotionDb | null = null;
        const legacySnapshotTable = sqliteDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'motion_state'")
          .get();

        if (legacySnapshotTable?.name) {
          const legacyRow = sqliteDb
            .prepare("SELECT payload FROM motion_state WHERE id = 1")
            .get();
          if (typeof legacyRow?.payload === "string") {
            try {
              seed = normalizeDatabase(JSON.parse(legacyRow.payload) as unknown);
            } catch {
              seed = null;
            }
          }
        }

        if (!seed) {
          seed = (await readJsonSnapshot()) ?? createSeedDatabase();
        }

        writeRelationalTables(sqliteDb, seed);
        await writeJsonSnapshot(seed);
      }

      sqliteDb
        .prepare("INSERT OR REPLACE INTO motion_meta (key, value) VALUES (?, ?)")
        .run("storage_mode", "relational");
      sqliteDb
        .prepare("INSERT OR REPLACE INTO motion_meta (key, value) VALUES (?, ?)")
        .run("schema_version", RELATIONAL_SCHEMA_VERSION);
    }
  } finally {
    closeSqliteDatabase(sqliteDb);
  }

  return "sqlite";
}

function readRelationalTables(sqliteDb: SQLiteDatabaseLike): MotionDb {
  const db = createSeedDatabase();

  for (const collection of MOTION_COLLECTIONS) {
    const rows = sqliteDb
      .prepare(`SELECT payload FROM ${collection.table} ORDER BY order_index ASC`)
      .all();
    (db[collection.key] as unknown[]) = rows
      .map((row) => {
        if (typeof row.payload !== "string") {
          return null;
        }

        try {
          return JSON.parse(row.payload) as unknown;
        } catch {
          return null;
        }
      })
      .filter((record): record is unknown => record !== null);
  }

  return normalizeDatabase(db);
}

function writeRelationalTables(sqliteDb: SQLiteDatabaseLike, db: MotionDb): void {
  sqliteDb.exec("BEGIN IMMEDIATE");

  try {
    for (const collection of MOTION_COLLECTIONS) {
      sqliteDb.exec(`DELETE FROM ${collection.table}`);
      const records = db[collection.key] as unknown[];
      const insert = sqliteDb.prepare(
        `INSERT INTO ${collection.table} (entity_key, owner_id, related_id, sort_at, order_index, payload) VALUES (?, ?, ?, ?, ?, ?)`,
      );

      records.forEach((record, index) => {
        insert.run(
          collection.getPrimaryKey(record),
          collection.getOwnerId?.(record) ?? null,
          collection.getRelatedId?.(record) ?? null,
          collection.getSortAt?.(record) ?? null,
          index,
          JSON.stringify(record),
        );
      });
    }

    sqliteDb
      .prepare("INSERT OR REPLACE INTO motion_meta (key, value) VALUES (?, ?)")
      .run("storage_mode", "relational");
    sqliteDb
      .prepare("INSERT OR REPLACE INTO motion_meta (key, value) VALUES (?, ?)")
      .run("schema_version", RELATIONAL_SCHEMA_VERSION);
    sqliteDb.exec("COMMIT");
  } catch (error) {
    sqliteDb.exec("ROLLBACK");
    throw error;
  }
}

async function readFromStorage(): Promise<MotionDb> {
  const mode = await ensureStorageReady();

  if (mode === "sqlite") {
    const sqlite = await getSqliteModule();

    if (sqlite) {
      const sqliteDb = new sqlite.DatabaseSync(SQLITE_DATABASE_PATH);

      try {
        configureSqliteDatabase(sqliteDb);
        return readRelationalTables(sqliteDb);
      } catch {
        // Fall back to the JSON snapshot below.
      } finally {
        closeSqliteDatabase(sqliteDb);
      }
    }
  }

  const jsonSnapshot = await readJsonSnapshot();

  if (jsonSnapshot) {
    return jsonSnapshot;
  }

  const seed = createSeedDatabase();
  await writeToStorage(seed);
  return seed;
}

async function writeToStorage(db: MotionDb): Promise<void> {
  const mode = await ensureStorageReady();

  if (mode === "sqlite") {
    const sqlite = await getSqliteModule();

    if (sqlite) {
      const sqliteDb = new sqlite.DatabaseSync(SQLITE_DATABASE_PATH);

      try {
        configureSqliteDatabase(sqliteDb);
        writeRelationalTables(sqliteDb, db);
      } finally {
        closeSqliteDatabase(sqliteDb);
      }
    }
  }

  await writeJsonSnapshot(db);
}

export async function withSqliteRead<T>(
  reader: (sqliteDb: SqliteDatabaseHandle) => T | Promise<T>,
): Promise<T | null> {
  const mode = await ensureStorageReady();

  if (mode !== "sqlite") {
    return null;
  }

  const sqlite = await getSqliteModule();

  if (!sqlite) {
    return null;
  }

  const sqliteDb = new sqlite.DatabaseSync(SQLITE_DATABASE_PATH);

  try {
    configureSqliteDatabase(sqliteDb);
    return await reader(sqliteDb);
  } finally {
    closeSqliteDatabase(sqliteDb);
  }
}

export function withSqliteWrite<T>(
  writer: (sqliteDb: SqliteDatabaseHandle) => T | Promise<T>,
): Promise<T | null> {
  const task = updateQueue.then(async () => {
    const mode = await ensureStorageReady();

    if (mode !== "sqlite") {
      return null;
    }

    const sqlite = await getSqliteModule();

    if (!sqlite) {
      return null;
    }

    const sqliteDb = new sqlite.DatabaseSync(SQLITE_DATABASE_PATH);

    try {
      configureSqliteDatabase(sqliteDb);
      sqliteDb.exec("BEGIN IMMEDIATE");

      try {
        const result = await writer(sqliteDb);
        sqliteDb.exec("COMMIT");
        return result;
      } catch (error) {
        sqliteDb.exec("ROLLBACK");
        throw error;
      }
    } finally {
      closeSqliteDatabase(sqliteDb);
    }
  });

  updateQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

export async function readDb(): Promise<MotionDb> {
  const db = await readFromStorage();
  pruneExpiredRecords(db);
  return db;
}

export function updateDb<T>(updater: (db: MotionDb) => T | Promise<T>): Promise<T> {
  const task = updateQueue.then(async () => {
    const db = await readFromStorage();
    pruneExpiredRecords(db);
    const result = await updater(db);
    await writeToStorage(db);
    return result;
  });

  updateQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

export const seedCredentials = {
  email: "demo@motion.app",
  password: DEMO_PASSWORD,
};
