export type FeedScope = "following" | "discover";
export type FeedVisibility = "everyone" | "followers" | "non_followers" | "custom";
export type PostKind = "Photo" | "Reel";
export type Presence = "Online" | "Away";
export type AccountType = "public" | "creator";
export type InterestKey = "tech" | "sports" | "fashion" | "travel" | "gaming";
export type CreatorReportFrequency = "daily" | "weekly" | "monthly";
export type CreatorReportFormat = "csv" | "json" | "excel" | "pdf";
export type CreatorReportRange = "7d" | "30d" | "90d";
export type CallMode = "voice" | "video";
export type CallStatus = "ringing" | "connecting" | "active" | "declined" | "ended" | "missed";
export type CallSignalType = "offer" | "answer" | "ice";
export type MediaItem = {
  url: string;
  type: "image" | "video";
};
export type ChatAttachmentType = "image" | "audio";
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
  interests?: InterestKey[];
  feedVisibility?: FeedVisibility;
  hiddenFromIds?: string[];
  postLayoutOrder?: string[];
  pinnedPostIds?: string[];
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
  typingByUserId?: Record<string, string>;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  systemType?: "call";
  callId?: string;
  callMode?: CallMode;
  callEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
  callDurationMs?: number;
  attachment?: ChatAttachment;
  reactions?: MessageReactionRecord[];
  deliveredToIds?: string[];
  readByIds?: string[];
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
  liveSessions: LiveSessionRecord[];
  liveComments: LiveCommentRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  callSessions: CallSessionRecord[];
  follows: FollowRecord[];
  notifications: NotificationRecord[];
  profileViews: ProfileViewRecord[];
  creatorReportSchedules: CreatorReportScheduleRecord[];
  creatorReportDeliveries: CreatorReportDeliveryRecord[];
};

export type PublicUser = Pick<
  UserRecord,
  "id" | "name" | "handle" | "role" | "accountType" | "email" | "avatarGradient" | "avatarUrl" | "bio" | "feedVisibility" | "hiddenFromIds"
  | "interests"
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
  deletedAt?: string;
  archivedAt?: string;
};

export type StoryDto = {
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  role: string;
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

export type MessageDto = {
  id: string;
  from: "them" | "me" | "system";
  text: string;
  createdAt: string;
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
  status: Presence;
  unread: number;
  time: string;
  lastMessage: string;
  typing: boolean;
  missedCallCount: number;
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

export type CommentDto = {
  id: string;
  author: string;
  handle: string;
  avatarGradient: string;
  text: string;
  createdAt: string;
  time: string;
};
