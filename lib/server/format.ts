import type {
  CallSessionDto,
  CallSessionRecord,
  ChatAttachment,
  CommentDto,
  CommentRecord,
  MediaItem,
  MessageDto,
  MessageRecord,
  PostDto,
  PostRecord,
  Presence,
  StoryDto,
  StoryRecord,
  UserRecord,
} from "@/lib/server/types";

const PRESENCE_WINDOW_MS = 5 * 60_000;
const TYPING_WINDOW_MS = 7_000;

export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / minute));
    return `${minutes}m`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h`;
  }

  const days = Math.floor(diff / day);
  return `${days}d`;
}

export function formatPostAge(isoDate: string): string {
  const diff = Math.max(1_000, Date.now() - new Date(isoDate).getTime());
  const second = 1_000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) {
    const seconds = Math.max(1, Math.floor(diff / second));
    return `${seconds} ${seconds === 1 ? "Sec" : "Secs"} ago`;
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} ${minutes === 1 ? "Min" : "Mins"} ago`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} ${hours === 1 ? "Hr" : "Hrs"} ago`;
  }

  if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days} ${days === 1 ? "Day" : "Days"} ago`;
  }

  const weeks = Math.floor(diff / week);
  return `${weeks} ${weeks === 1 ? "Week" : "Weeks"} ago`;
}

export function isPostReleased(post: Pick<PostRecord, "visibleAt">, now = Date.now()): boolean {
  if (!post.visibleAt) {
    return true;
  }

  const releaseAt = new Date(post.visibleAt).getTime();

  if (Number.isNaN(releaseAt)) {
    return true;
  }

  return releaseAt <= now;
}

export function isUserActive(user?: UserRecord | null): boolean {
  if (!user?.lastActiveAt) {
    return false;
  }

  return Date.now() - new Date(user.lastActiveAt).getTime() <= PRESENCE_WINDOW_MS;
}

export function resolvePresence(user?: UserRecord | null): Presence {
  return isUserActive(user) ? "Online" : "Away";
}

export function isTypingActive(typingAt?: string, now = Date.now()): boolean {
  if (!typingAt) {
    return false;
  }

  const parsed = new Date(typingAt).getTime();

  if (Number.isNaN(parsed)) {
    return false;
  }

  return now - parsed <= TYPING_WINDOW_MS;
}

export function buildHandle(name: string, existingHandles: string[]): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".");

  const root = normalized.length > 0 ? normalized : "motion.user";
  let candidate = root;
  let suffix = 1;

  while (existingHandles.includes(candidate)) {
    candidate = `${root}${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function resolveMedia({
  media,
  mediaUrl,
  mediaType,
}: {
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: "image" | "video";
}): MediaItem[] | undefined {
  if (Array.isArray(media) && media.length > 0) {
    return media;
  }

  if (mediaUrl && mediaType) {
    return [{ url: mediaUrl, type: mediaType }];
  }

  return undefined;
}

function buildReactionSummary({
  reactions,
  currentUserId,
}: {
  reactions?: { userId: string; emoji: string }[];
  currentUserId: string;
}) {
  const grouped = new Map<string, { emoji: string; count: number; mine: boolean }>();

  (reactions ?? []).forEach((reaction) => {
    const current = grouped.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      mine: false,
    };
    current.count += 1;
    current.mine = current.mine || reaction.userId === currentUserId;
    grouped.set(reaction.emoji, current);
  });

  return [...grouped.values()];
}

export function getMessageDeliveryState({
  message,
  recipientIds,
}: {
  message: Pick<MessageRecord, "senderId" | "deliveredToIds" | "readByIds">;
  recipientIds: string[];
}): "sent" | "delivered" | "read" {
  if (
    recipientIds.length > 0 &&
    recipientIds.every((recipientId) => message.readByIds?.includes(recipientId))
  ) {
    return "read";
  }

  if (
    recipientIds.length > 0 &&
    recipientIds.every((recipientId) => message.deliveredToIds?.includes(recipientId))
  ) {
    return "delivered";
  }

  return "sent";
}

export function summarizeConversationMessage({
  message,
  currentUserId,
  otherTyping,
}: {
  message?: Pick<
    MessageRecord,
    "senderId" | "text" | "attachment" | "systemType" | "callEvent"
  >;
  currentUserId: string;
  otherTyping?: boolean;
}): string {
  if (otherTyping) {
    return "Typing...";
  }

  if (!message) {
    return "No messages yet.";
  }

  if (message.systemType === "call") {
    return message.text || "Call activity";
  }

  const prefix = message.senderId === currentUserId ? "You: " : "";

  if (message.attachment?.type === "audio") {
    return `${prefix}Voice message`;
  }

  if (message.attachment?.type === "image") {
    return message.text ? `${prefix}${message.text}` : `${prefix}Photo`;
  }

  return message.text || `${prefix}Message`;
}

export function mapMessageToDto({
  message,
  currentUserId,
  recipientIds,
}: {
  message: MessageRecord;
  currentUserId: string;
  recipientIds: string[];
}): MessageDto {
  return {
    id: message.id,
    from:
      message.systemType === "call"
        ? "system"
        : message.senderId === currentUserId
          ? "me"
          : "them",
    text: message.text,
    createdAt: message.createdAt,
    systemType: message.systemType,
    callId: message.callId,
    callMode: message.callMode,
    callDirection:
      message.systemType === "call"
        ? message.senderId === currentUserId
          ? "outgoing"
          : "incoming"
        : undefined,
    callEvent: message.callEvent,
    callDurationMs: message.callDurationMs,
    attachment: message.attachment as ChatAttachment | undefined,
    reactions: buildReactionSummary({
      reactions: message.reactions,
      currentUserId,
    }),
    deliveryState: getMessageDeliveryState({
      message,
      recipientIds,
    }),
  };
}

export function mapCallSessionToDto({
  session,
  usersById,
  currentUserId,
}: {
  session: CallSessionRecord;
  usersById: Map<string, UserRecord>;
  currentUserId: string;
}): CallSessionDto {
  const otherParticipantIds = session.participantIds.filter(
    (participantId) => participantId !== currentUserId,
  );
  const otherUserId =
    otherParticipantIds[0] ??
    session.initiatorId;
  const otherUser = usersById.get(otherUserId);
  const participantNames = otherParticipantIds
    .map((participantId) => usersById.get(participantId)?.name)
    .filter((name): name is string => Boolean(name));
  const title =
    otherParticipantIds.length <= 1
      ? otherUser?.name ?? "Motion user"
      : `${participantNames.slice(0, 2).join(", ")}${
          participantNames.length > 2 ? ` +${participantNames.length - 2}` : ""
        }`;

  return {
    id: session.id,
    conversationId: session.conversationId,
    currentUserId,
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    answeredAt: session.answeredAt,
    endedAt: session.endedAt,
    isInitiator: session.initiatorId === currentUserId,
    isIncoming: session.initiatorId !== currentUserId && session.status === "ringing",
    isGroup: otherParticipantIds.length > 1,
    title,
    otherUser: {
      id: otherUser?.id ?? otherUserId,
      name: otherUser?.name ?? "Motion user",
      handle: otherUser?.handle ?? "motion.user",
      avatarGradient:
        otherUser?.avatarGradient ?? "linear-gradient(135deg, #4facfe, #00f2fe)",
      avatarUrl: otherUser?.avatarUrl,
    },
    participants: session.participants.map((participant) => {
      const user = usersById.get(participant.userId);

      return {
        userId: participant.userId,
        name: user?.name ?? "Motion user",
        handle: user?.handle ?? "motion.user",
        avatarGradient:
          user?.avatarGradient ?? "linear-gradient(135deg, #4facfe, #00f2fe)",
        avatarUrl: user?.avatarUrl,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
        screenSharing: participant.screenSharing,
        recording: participant.recording,
        joined: Boolean(participant.joinedAt),
      };
    }),
    signals: session.signals.map((signal) => ({
      id: signal.id,
      fromUserId: signal.fromUserId,
      toUserId: signal.toUserId,
      type: signal.type,
      payload: signal.payload,
      createdAt: signal.createdAt,
    })),
  };
}

export function mapPostToDto({
  post,
  usersById,
  currentUserId,
}: {
  post: PostRecord;
  usersById: Map<string, UserRecord>;
  currentUserId: string | null;
}): PostDto {
  const author = usersById.get(post.userId);
  const coAuthors =
    post.coAuthorIds && post.coAuthorIds.length > 0
      ? post.coAuthorIds
          .filter((id) => id !== post.userId)
          .map((id) => usersById.get(id))
          .filter((value): value is UserRecord => Boolean(value))
          .map((user) => ({
            id: user.id,
            name: user.name,
            handle: user.handle,
            avatarGradient: user.avatarGradient,
            avatarUrl: user.avatarUrl,
          }))
      : undefined;
  const canSeeInvites =
    Boolean(currentUserId) &&
    (post.userId === currentUserId ||
      post.coAuthorInvites?.includes(currentUserId ?? ""));
  const collabInvites =
    canSeeInvites && post.coAuthorInvites && post.coAuthorInvites.length > 0
      ? post.coAuthorInvites
          .filter((id) => id !== post.userId)
          .map((id) => usersById.get(id))
          .filter((value): value is UserRecord => Boolean(value))
          .map((user) => ({
            id: user.id,
            name: user.name,
            handle: user.handle,
            avatarGradient: user.avatarGradient,
            avatarUrl: user.avatarUrl,
          }))
      : undefined;
  const media = resolveMedia({
    media: post.media,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
  });
  const primary = media?.[0];

  return {
    id: post.id,
    userId: post.userId,
    author: author?.name ?? "Unknown Creator",
    handle: author ? `@${author.handle}` : "@unknown",
    coAuthors: coAuthors && coAuthors.length > 0 ? coAuthors : undefined,
    collabInvites: collabInvites && collabInvites.length > 0 ? collabInvites : undefined,
    scope: post.scope,
    kind: post.kind,
    caption: post.caption,
    location: post.location,
    likes: post.likedBy.length,
    liked: currentUserId ? post.likedBy.includes(currentUserId) : false,
    saved: currentUserId ? post.savedBy.includes(currentUserId) : false,
    comments: post.commentCount,
    shareCount: post.shareCount ?? 0,
    gradient: post.gradient,
    createdAt: post.createdAt,
    timeAgo: formatPostAge(post.createdAt),
    visibleAt: post.visibleAt,
    interests: post.interests,
    media,
    mediaUrl: post.mediaUrl ?? primary?.url,
    mediaType: post.mediaType ?? primary?.type,
    deletedAt: post.deletedAt,
    archivedAt: post.archivedAt,
  };
}

export function mapStoryToDto({
  story,
  usersById,
  currentUserId,
}: {
  story: StoryRecord;
  usersById: Map<string, UserRecord>;
  currentUserId: string | null;
}): StoryDto {
  const owner = usersById.get(story.userId);
  const msLeft = new Date(story.expiresAt).getTime() - Date.now();
  const minutesLeft = Math.max(1, Math.floor(msLeft / 60_000));
  const media = resolveMedia({
    media: story.media,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
  });
  const primary = media?.[0];
  const isOwner = Boolean(currentUserId && currentUserId === story.userId);
  const poll = story.poll
    ? (() => {
        const counts = story.poll.options.map(() => 0);
        let myVote: number | undefined;
        story.poll.votes.forEach((vote) => {
          if (vote.optionIndex >= 0 && vote.optionIndex < counts.length) {
            counts[vote.optionIndex] += 1;
          }
          if (currentUserId && vote.userId === currentUserId) {
            myVote = vote.optionIndex;
          }
        });
        return {
          question: story.poll.question,
          options: story.poll.options,
          counts,
          myVote,
        };
      })()
    : undefined;
  const question = story.question
    ? (() => {
        const answers = story.question.answers ?? [];
        const mine = currentUserId
          ? answers.find((answer) => answer.userId === currentUserId)
          : undefined;
        return {
          prompt: story.question.prompt,
          myAnswer: mine?.text,
          totalAnswers: answers.length,
        };
      })()
    : undefined;
  const emojiReactions = story.emojiReactions
    ? story.emojiReactions.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction.userIds.length,
        reacted: currentUserId ? reaction.userIds.includes(currentUserId) : false,
      }))
    : undefined;
  const replies = story.replies ?? [];
  const replySummary =
    replies.length > 0
      ? {
          total: replies.length,
          latest: isOwner
            ? replies
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )
                .slice(0, 3)
                .map((reply) => {
                  const author = usersById.get(reply.userId);
                  return {
                    id: reply.id,
                    author: author?.name ?? "Viewer",
                    handle: author ? `@${author.handle}` : "@viewer",
                    avatarGradient: author?.avatarGradient ?? "#111827",
                    avatarUrl: author?.avatarUrl,
                    text: reply.text,
                    createdAt: reply.createdAt,
                    time: formatRelativeTime(reply.createdAt),
                  };
                })
            : undefined,
        }
      : undefined;

  return {
    id: story.id,
    ownerId: story.userId,
    name: owner?.name.split(" ")[0] ?? "Creator",
    handle: owner ? `@${owner.handle}` : "@creator",
    role: owner?.role ?? "Member",
    minutesLeft,
    gradient: story.gradient,
    caption: story.caption,
    seen: currentUserId ? story.seenBy.includes(currentUserId) : false,
    poll,
    question,
    emojiReactions,
    music: story.music,
    replies: replySummary,
    media,
    mediaUrl: story.mediaUrl ?? primary?.url,
    mediaType: story.mediaType ?? primary?.type,
  };
}

export function mapCommentToDto({
  comment,
  usersById,
}: {
  comment: CommentRecord;
  usersById: Map<string, UserRecord>;
}): CommentDto {
  const author = usersById.get(comment.userId);

  return {
    id: comment.id,
    author: author?.name ?? "Unknown Creator",
    handle: author ? `@${author.handle}` : "@unknown",
    avatarGradient:
      author?.avatarGradient ?? "linear-gradient(135deg, #94a3b8, #64748b)",
    text: comment.text,
    createdAt: comment.createdAt,
    time: formatRelativeTime(comment.createdAt),
  };
}
