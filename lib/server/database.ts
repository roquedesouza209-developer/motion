import fs from "node:fs/promises";
import path from "node:path";

import { normalizeInterests } from "@/lib/interests";
import { createId, createPasswordHash } from "@/lib/server/crypto";
import type {
  AccountType,
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
  MotionDb,
  NotificationRecord,
  PostRecord,
  ProfileViewRecord,
  SessionRecord,
  StoryRecord,
  UserRecord,
} from "@/lib/server/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const DATABASE_PATH = path.join(DATA_DIRECTORY, "motion-db.json");
const DEMO_PASSWORD = "demo12345";
const BIN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
    interests,
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

  if (candidate.type !== "image" && candidate.type !== "audio") {
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

  const sessions: SessionRecord[] = [];
  const comments = createSeedComments(posts);
  const profileViews: ProfileViewRecord[] = [];
  const liveSessions: LiveSessionRecord[] = [];
  const liveComments: LiveCommentRecord[] = [];
  const callSessions: CallSessionRecord[] = [];

  return {
    users,
    sessions,
    posts,
    comments,
    stories,
    liveSessions,
    liveComments,
    callSessions,
    conversations,
    messages,
    follows,
    notifications,
    profileViews,
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
  ): { media?: { url: string; type: "image" | "video" }[]; mediaUrl?: string; mediaType?: "image" | "video" } => {
    const items: { url: string; type: "image" | "video" }[] = [];

    if (Array.isArray(media)) {
      for (const entry of media) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const url = (entry as { url?: unknown }).url;
        const type = (entry as { type?: unknown }).type;
        if (
          typeof url === "string" &&
          (type === "image" || type === "video")
        ) {
          items.push({ url, type });
        }
      }
    }

    if (
      items.length === 0 &&
      typeof mediaUrl === "string" &&
      (mediaType === "image" || mediaType === "video")
    ) {
      items.push({ url: mediaUrl, type: mediaType });
    }

    return {
      media: items.length > 0 ? items : undefined,
      mediaUrl: items[0]?.url ?? (typeof mediaUrl === "string" ? mediaUrl : undefined),
      mediaType: items[0]?.type ?? (mediaType === "image" || mediaType === "video" ? mediaType : undefined),
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

  const normalizedPosts = Array.isArray(candidate.posts)
    ? (candidate.posts as Partial<PostRecord>[]).map((post) => ({
        ...(post as PostRecord),
        ...normalizeMediaList(
          (post as PostRecord).media,
          post.mediaUrl,
          post.mediaType,
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
    liveSessions: normalizedLiveSessions,
    liveComments: normalizedLiveComments,
    conversations: Array.isArray(candidate.conversations)
      ? (candidate.conversations as ConversationRecord[]).map((conversation) => ({
          ...conversation,
          typingByUserId: normalizeTypingMap(conversation.typingByUserId),
        }))
      : [],
    messages: Array.isArray(candidate.messages)
      ? (candidate.messages as MessageRecord[]).map((message) => ({
          ...message,
          text: typeof message.text === "string" ? message.text : "",
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
    notifications: Array.isArray(candidate.notifications)
      ? (candidate.notifications as NotificationRecord[])
      : [],
    profileViews: Array.isArray(candidate.profileViews)
      ? (candidate.profileViews as ProfileViewRecord[])
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

async function ensureDatabaseFile(): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await fs.access(DATABASE_PATH);
  } catch {
    const seed = createSeedDatabase();
    await writeToDisk(seed);
  }
}

async function readFromDisk(): Promise<MotionDb> {
  await ensureDatabaseFile();

  try {
    const raw = await fs.readFile(DATABASE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeDatabase(parsed);
  } catch {
    const seed = createSeedDatabase();
    await writeToDisk(seed);
    return seed;
  }
}

async function writeToDisk(db: MotionDb): Promise<void> {
  const tempPath = `${DATABASE_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tempPath, DATABASE_PATH);
}

export async function readDb(): Promise<MotionDb> {
  const db = await readFromDisk();
  pruneExpiredRecords(db);
  return db;
}

export function updateDb<T>(updater: (db: MotionDb) => T | Promise<T>): Promise<T> {
  const task = updateQueue.then(async () => {
    const db = await readFromDisk();
    pruneExpiredRecords(db);
    const result = await updater(db);
    await writeToDisk(db);
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
