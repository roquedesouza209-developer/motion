import type { ChatWallpaper, ChatWallpaperSelection } from "@/lib/chat-wallpapers";

export type FeedScope = "following" | "discover";
export type FeedVisibility = "everyone" | "followers" | "non_followers" | "custom";
export type PostKind = "Photo" | "Reel";
export type Presence = "Online" | "Away";
export type AccountType = "public" | "creator";
export type InterestKey = "tech" | "sports" | "fashion" | "travel" | "gaming";
export type CreatorReportFrequency = "daily" | "weekly" | "monthly";
export type CreatorReportFormat = "csv" | "json" | "excel" | "pdf";
export type CreatorReportRange = "7d" | "30d" | "90d";
export type ProfileCoverTheme = "midnight" | "sunrise" | "aurora" | "studio";
export type ProfileAccent = "cobalt" | "ember" | "jade" | "violet";
export type CallMode = "voice" | "video";
export type CallStatus = "ringing" | "connecting" | "active" | "declined" | "ended" | "missed";
export type CallSignalType = "offer" | "answer" | "ice";
export type RandomChatStatus = "connecting" | "active" | "ended";
export type RandomChatEndReason = "skip" | "left" | "report" | "timeout";
export type ImmersiveHotspot = {
  id: string;
  title: string;
  detail?: string;
  yaw: number;
  pitch: number;
};
export type MediaItem = {
  url: string;
  type: "image" | "video";
  immersive?: boolean;
  hotspots?: ImmersiveHotspot[];
};
export type ChatAttachmentType = "image" | "audio" | "video";
export type ChatAttachment = {
  url: string;
  type: ChatAttachmentType;
  durationMs?: number;
  mimeType?: string;
  name?: string;
};
export type MessageReactionRecord = {
  userId: string;
  emoji: string;
};

export type UserRecord = {
  id: string;
  name: string;
  handle: string;
  role: string;
  accountType: AccountType;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  avatarGradient: string;
  avatarUrl?: string;
  bio?: string;
  coverTheme?: ProfileCoverTheme;
  coverImageUrl?: string;
  profileAccent?: ProfileAccent;
  interests?: InterestKey[];
  chatWallpaper?: ChatWallpaper;
  feedVisibility?: FeedVisibility;
  hiddenFromIds?: string[];
  restrictedAccount?: boolean;
  postLayoutOrder?: string[];
  pinnedPostIds?: string[];
  onboardingCompleted?: boolean;
  createdAt: string;
  lastActiveAt?: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type PostRecord = {
  id: string;
  userId: string;
  coAuthorIds?: string[];
  coAuthorInvites?: string[];
  scope: FeedScope;
  kind: PostKind;
  caption: string;
  location: string;
  interests?: InterestKey[];
  gradient: string;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  immersiveVideo?: boolean;
  likedBy: string[];
  savedBy: string[];
  commentCount: number;
  shareCount: number;
  watchTimeMs: number;
  viewCount?: number;
  createdAt: string;
  visibleAt?: string;
  deletedAt?: string;
  archivedAt?: string;
};

export type StoryRecord = {
  id: string;
  userId: string;
  caption: string;
  gradient: string;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  poll?: {
    question: string;
    options: string[];
    votes: { userId: string; optionIndex: number }[];
  };
  question?: {
    prompt: string;
    answers: { id: string; userId: string; text: string; createdAt: string }[];
  };
  emojiReactions?: { emoji: string; userIds: string[] }[];
  music?: {
    id?: string;
    title: string;
    artist?: string;
    url?: string;
    duration?: number;
  };
  replies?: { id: string; userId: string; text: string; createdAt: string }[];
  createdAt: string;
  expiresAt: string;
  seenBy: string[];
};

export type MoveHighlightItemRecord = {
  id: string;
  sourceStoryId?: string;
  caption: string;
  gradient: string;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  createdAt: string;
};

export type MoveHighlightRecord = {
  id: string;
  userId: string;
  title: string;
  accent?: ProfileAccent;
  items: MoveHighlightItemRecord[];
  createdAt: string;
  updatedAt: string;
};

export type LiveSessionRecord = {
  id: string;
  hostId: string;
  title: string;
  createdAt: string;
  endedAt?: string;
  viewerIds: string[];
};

export type LiveCommentRecord = {
  id: string;
  liveId: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type ConversationRecord = {
  id: string;
  participantIds: string[];
  unreadCountByUserId: Record<string, number>;
  pinnedByUserIds?: string[];
  typingByUserId?: Record<string, string>;
  chatWallpaper?: ChatWallpaperSelection;
  chatWallpaperUrl?: string;
  chatWallpaperLight?: ChatWallpaperSelection;
  chatWallpaperLightUrl?: string;
  chatWallpaperDark?: ChatWallpaperSelection;
  chatWallpaperDarkUrl?: string;
  chatWallpaperBlur?: number;
  chatWallpaperDim?: number;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  replyToId?: string;
  systemType?: "call";
  callId?: string;
  callMode?: CallMode;
  callEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
  callDurationMs?: number;
  attachment?: ChatAttachment;
  reactions?: MessageReactionRecord[];
  deliveredToIds?: string[];
  readByIds?: string[];
  unsentAt?: string;
  unsentById?: string;
  createdAt: string;
};

export type CallParticipantRecord = {
  userId: string;
  joinedAt?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing?: boolean;
  recording?: boolean;
};

export type CallSignalRecord = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: CallSignalType;
  payload?: unknown;
  createdAt: string;
};

export type CallSessionRecord = {
  id: string;
  conversationId: string;
  initiatorId: string;
  participantIds: string[];
  mode: CallMode;
  status: CallStatus;
  participants: CallParticipantRecord[];
  signals: CallSignalRecord[];
  createdAt: string;
  updatedAt: string;
  answeredAt?: string;
  endedAt?: string;
  endedById?: string;
};

export type RandomChatQueueRecord = {
  id: string;
  userId: string;
  country?: string;
  preferredCountry?: string;
  preferredInterests: InterestKey[];
  createdAt: string;
  updatedAt: string;
};

export type RandomChatParticipantRecord = {
  userId: string;
  country?: string;
  interests?: InterestKey[];
  joinedAt?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
};

export type RandomChatSignalRecord = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: CallSignalType;
  payload?: unknown;
  createdAt: string;
};

export type RandomChatSessionRecord = {
  id: string;
  initiatorId: string;
  participantIds: string[];
  participants: RandomChatParticipantRecord[];
  signals: RandomChatSignalRecord[];
  status: RandomChatStatus;
  createdAt: string;
  matchedAt: string;
  updatedAt: string;
  endedAt?: string;
  endedById?: string;
  endedReason?: RandomChatEndReason;
};

export type RandomChatReportRecord = {
  id: string;
  sessionId: string;
  reporterId: string;
  reportedUserId: string;
  reason?: string;
  createdAt: string;
};

export type CommentRecord = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type FollowRecord = {
  followerId: string;
  followingId: string;
  createdAt?: string;
};

export type BlockRecord = {
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
};

export type MuteRecord = {
  userId: string;
  mutedUserId: string;
  createdAt: string;
};

export type SafetyReportTargetType = "account" | "post" | "message";

export type SafetyReportRecord = {
  id: string;
  reporterId: string;
  targetType: SafetyReportTargetType;
  targetId: string;
  targetUserId?: string;
  conversationId?: string;
  reason: string;
  details?: string;
  status: "open" | "reviewed";
  createdAt: string;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  actorId: string;
  type:
    | "follow"
    | "collab_invite"
    | "collab_accept"
    | "story_reaction"
    | "story_reply"
    | "missed_call";
  callId?: string;
  callMode?: CallMode;
  conversationId?: string;
  postId?: string;
  storyId?: string;
  emoji?: string;
  text?: string;
  createdAt: string;
};

export type ProfileViewRecord = {
  id: string;
  viewerId: string;
  viewedId: string;
  createdAt: string;
};

export type SupportRequestRecord = {
  id: string;
  email: string;
  message: string;
  userId: string | null;
  status: "open" | "resolved";
  createdAt: string;
};

export type CreatorReportScheduleRecord = {
  id: string;
  userId: string;
  destinationEmail: string;
  frequency: CreatorReportFrequency;
  format: CreatorReportFormat;
  range: CreatorReportRange;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastSentAt?: string;
  nextSendAt?: string;
};

export type CreatorReportDeliveryRecord = {
  id: string;
  userId: string;
  destinationEmail: string;
  frequency: CreatorReportFrequency;
  format: CreatorReportFormat;
  range: CreatorReportRange;
  deliveredAt: string;
  status: "sent";
};

export type MotionDb = {
  users: UserRecord[];
  sessions: SessionRecord[];
  posts: PostRecord[];
  comments: CommentRecord[];
  stories: StoryRecord[];
  moveHighlights: MoveHighlightRecord[];
  liveSessions: LiveSessionRecord[];
  liveComments: LiveCommentRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  callSessions: CallSessionRecord[];
  randomChatQueue: RandomChatQueueRecord[];
  randomChatSessions: RandomChatSessionRecord[];
  randomChatReports: RandomChatReportRecord[];
  follows: FollowRecord[];
  blocks: BlockRecord[];
  mutes: MuteRecord[];
  safetyReports: SafetyReportRecord[];
  notifications: NotificationRecord[];
  profileViews: ProfileViewRecord[];
  supportRequests: SupportRequestRecord[];
  creatorReportSchedules: CreatorReportScheduleRecord[];
  creatorReportDeliveries: CreatorReportDeliveryRecord[];
};

export type PublicUser = Pick<
  UserRecord,
  "id" | "name" | "handle" | "role" | "accountType" | "email" | "avatarGradient" | "avatarUrl" | "bio" | "feedVisibility" | "hiddenFromIds"
  | "interests" | "chatWallpaper" | "coverTheme" | "coverImageUrl" | "profileAccent" | "onboardingCompleted" | "restrictedAccount"
>;

export type PostCoAuthor = Pick<
  UserRecord,
  "id" | "name" | "handle" | "avatarGradient" | "avatarUrl"
>;

export type PostDto = {
  id: string;
  userId: string;
  author: string;
  handle: string;
  coAuthors?: PostCoAuthor[];
  collabInvites?: PostCoAuthor[];
  scope: FeedScope;
  kind: PostKind;
  caption: string;
  location: string;
  likes: number;
  liked: boolean;
  saved: boolean;
  comments: number;
  shareCount: number;
  gradient: string;
  createdAt: string;
  timeAgo: string;
  visibleAt?: string;
  interests?: InterestKey[];
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  immersiveVideo?: boolean;
  deletedAt?: string;
  archivedAt?: string;
};

export type StoryDto = {
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  role: string;
  createdAt: string;
  minutesLeft: number;
  gradient: string;
  caption: string;
  seen: boolean;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
  poll?: {
    question: string;
    options: string[];
    counts: number[];
    myVote?: number;
  };
  question?: {
    prompt: string;
    myAnswer?: string;
    totalAnswers: number;
  };
  emojiReactions?: { emoji: string; count: number; reacted: boolean }[];
  music?: {
    id?: string;
    title: string;
    artist?: string;
    url?: string;
    duration?: number;
  };
  replies?: {
    total: number;
    latest?: {
      id: string;
      author: string;
      handle: string;
      avatarGradient: string;
      avatarUrl?: string;
      text: string;
      createdAt: string;
      time: string;
    }[];
  };
};

export type MoveHighlightDto = {
  id: string;
  title: string;
  accent: ProfileAccent;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  preview?: {
    caption: string;
    gradient: string;
    media?: MediaItem[];
    mediaUrl?: string;
    mediaType?: "image" | "video";
    createdAt: string;
  };
  items: {
    id: string;
    caption: string;
    gradient: string;
    media?: MediaItem[];
    mediaUrl?: string;
    mediaType?: "image" | "video";
    createdAt: string;
  }[];
};

export type MessageDto = {
  id: string;
  from: "them" | "me" | "system";
  text: string;
  unsent?: boolean;
  canUnsend?: boolean;
  createdAt: string;
  replyTo?: {
    id: string;
    author: string;
    from: "them" | "me";
    text: string;
    attachmentType?: ChatAttachmentType;
    unsent?: boolean;
  };
  systemType?: "call";
  callId?: string;
  callMode?: CallMode;
  callDirection?: "incoming" | "outgoing";
  callEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
  callDurationMs?: number;
  attachment?: ChatAttachment;
  reactions: {
    emoji: string;
    count: number;
    mine: boolean;
  }[];
  deliveryState: "sent" | "delivered" | "read";
};

export type ConversationDto = {
  id: string;
  userId: string;
  name: string;
  isGroup: boolean;
  memberCount: number;
  pinned?: boolean;
  status: Presence;
  unread: number;
  time: string;
  lastMessage: string;
  typing: boolean;
  chatWallpaper?: ChatWallpaperSelection;
  chatWallpaperUrl?: string;
  chatWallpaperLight?: ChatWallpaperSelection;
  chatWallpaperLightUrl?: string;
  chatWallpaperDark?: ChatWallpaperSelection;
  chatWallpaperDarkUrl?: string;
  chatWallpaperBlur?: number;
  chatWallpaperDim?: number;
  missedCallCount: number;
  hasRecordingHistory: boolean;
  recordingCount: number;
  hasVoiceCallHistory: boolean;
  hasVideoCallHistory: boolean;
  hasIncomingCallHistory: boolean;
  hasOutgoingCallHistory: boolean;
  lastCallMode?: CallMode;
  lastCallEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
};

export type CallParticipantDto = {
  userId: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing?: boolean;
  recording?: boolean;
  joined: boolean;
};

export type CallSignalDto = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: CallSignalType;
  payload?: unknown;
  createdAt: string;
};

export type CallSessionDto = {
  id: string;
  conversationId: string;
  currentUserId: string;
  mode: CallMode;
  status: CallStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt?: string;
  endedAt?: string;
  isInitiator: boolean;
  isIncoming: boolean;
  isGroup: boolean;
  title: string;
  otherUser: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  };
  participants: CallParticipantDto[];
  signals: CallSignalDto[];
};

export type RandomChatQueueDto = {
  id: string;
  country?: string;
  preferredCountry?: string;
  preferredInterests: InterestKey[];
  createdAt: string;
  updatedAt: string;
};

export type RandomChatParticipantDto = {
  userId: string;
  name: string;
  avatarGradient: string;
  avatarUrl?: string;
  country?: string;
  interests: InterestKey[];
  sharedInterests: InterestKey[];
  audioEnabled: boolean;
  videoEnabled: boolean;
  joined: boolean;
};

export type RandomChatSignalDto = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: CallSignalType;
  payload?: unknown;
  createdAt: string;
};

export type RandomChatSessionDto = {
  id: string;
  currentUserId: string;
  status: RandomChatStatus;
  createdAt: string;
  matchedAt: string;
  updatedAt: string;
  endedAt?: string;
  endedReason?: RandomChatEndReason;
  isInitiator: boolean;
  otherUser: RandomChatParticipantDto;
  participants: RandomChatParticipantDto[];
  signals: RandomChatSignalDto[];
};

export type CommentDto = {
  id: string;
  author: string;
  handle: string;
  avatarGradient: string;
  text: string;
  createdAt: string;
  time: string;
};
