"use client";

import CaptionWithHashtags from "@/components/caption-with-hashtags";
import AuthScreen from "@/components/home/auth-screen";
import CreateContentModal from "@/components/home/create-content-modal";
import FeedPostCard from "@/components/home/feed-post-card";
import OnboardingBanner from "@/components/home/onboarding-banner";
import ImmersiveVideoViewer from "@/components/media/immersive-video-viewer";
import MoveComposerModal from "@/components/home/move-composer-modal";
import HomeRightRail from "@/components/home/right-rail";
import WelcomeOnboardingModal from "@/components/home/welcome-onboarding-modal";
import SupportWidget from "@/components/support/support-widget";
import UserAvatar from "@/components/user-avatar";
import {
  MOTION_CALL_STATE_EVENT,
  type MotionCallStateDetail,
} from "@/lib/call-events";
import {
  INTEREST_OPTIONS,
  type InterestKey,
} from "@/lib/interests";
import type {
  ChatWallpaperSelection,
} from "@/lib/chat-wallpapers";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type FeedView = "following" | "discover";
type ContentView = "posts" | "reels";
type Presence = "Online" | "Away";
type PostKind = "Photo" | "Reel";
type ComposerMode = "post" | "reel" | "story" | "live";
type MediaType = "image" | "video";
type MediaItem = {
  url: string;
  type: MediaType;
  immersive?: boolean;
  hotspots?: {
    id: string;
    title: string;
    detail?: string;
    yaw: number;
    pitch: number;
  }[];
};
type ViewportMode = "desktop" | "tablet" | "mobile";
type AuthMode = "signin" | "signup";
type FeedInterestFilter = "all" | InterestKey;
type ThemeSelection =
  | "light"
  | "dark"
  | "summer"
  | "autumn";

type User = {
  id: string;
  name: string;
  handle: string;
  email: string;
  interests?: InterestKey[];
  onboardingCompleted?: boolean;
  avatarGradient: string;
  avatarUrl?: string;
  bio?: string;
};

type SuggestedCreator = {
  id: string;
  name: string;
  handle: string;
  role: string;
  accountType?: "public" | "creator";
  avatarGradient: string;
  avatarUrl?: string;
  bio?: string;
  interests: InterestKey[];
  sharedInterests: InterestKey[];
  followerCount: number;
};

type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
};

type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
};

type StoredAccount = {
  name: string;
  email: string;
  password: string;
  handle?: string;
};

type Story = {
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  caption: string;
  minutesLeft: number;
  gradient: string;
  seen: boolean;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: MediaType;
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

type Post = {
  id: string;
  userId: string;
  author: string;
  handle: string;
  coAuthors?: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  }[];
  collabInvites?: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  }[];
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
  interests?: InterestKey[];
  visibleAt?: string;
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: MediaType;
  immersiveVideo?: boolean;
};

type ComposerHotspot = {
  id: string;
  title: string;
  detail: string;
  yaw: number;
  pitch: number;
};

type Conversation = {
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

type CallMode = "voice" | "video";
type NotificationFilter = "all" | "follows" | "likes" | "comments" | "calls" | "moves";
type UploadResponse = {
  mediaUrl: string;
  mediaType: MediaType;
};

type NotificationAction =
  | {
      kind: "collab_invite";
      postId: string;
    }
  | {
      kind: "open_conversation";
      conversationId: string;
    }
  | {
      kind: "open_profile";
      handle: string;
    }
  | {
      kind: "open_comments";
      postId: string;
    }
  | {
      kind: "open_story";
      storyId: string;
    };

type NotificationEntry = {
  id: string;
  sourceIds: string[];
  title:
    | "New follower"
    | "Liked your post"
    | "Commented"
    | "Move reaction"
    | "Move reply"
    | "Missed call"
    | "Viewed your profile"
    | "Tagged you"
    | "Collab invite"
    | "Collab accepted";
  detail: string;
  meta: string;
  createdAt: string;
  tone: "follow" | "like" | "comment" | "view" | "tag" | "call";
  category: NotificationFilter | "profile" | "collabs";
  actorNames?: string[];
  groupKey?: string;
  groupCount?: number;
  marker?: "reaction" | "reply" | "ringing";
  action?: NotificationAction;
};

type FriendActivity = {
  id: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
  lastActiveAt?: string | null;
  isActive: boolean;
};

type MotionNotification = {
  id: string;
  type:
    | "follow"
    | "collab_invite"
    | "collab_accept"
    | "story_reaction"
    | "story_reply"
    | "missed_call";
  createdAt: string;
  time: string;
  callMode?: CallMode | null;
  conversationId?: string | null;
  emoji?: string | null;
  text?: string | null;
  actor: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  };
  post?: {
    id: string;
    caption: string;
    kind: PostKind;
  } | null;
  story?: {
    id: string;
    caption: string;
  } | null;
};

type ProfileViewEntry = {
  id: string;
  viewerId: string;
  viewerName: string;
  viewerHandle: string;
  viewerAvatarGradient: string;
  viewerAvatarUrl?: string | null;
  createdAt: string;
  time: string;
};

function summarizeNotificationActors(actorNames: string[] = []): string {
  const unique = [...new Set(actorNames.filter((name) => name.trim().length > 0))];

  if (unique.length === 0) {
    return "Someone";
  }

  if (unique.length === 1) {
    return unique[0];
  }

  if (unique.length === 2) {
    return `${unique[0]} and ${unique[1]}`;
  }

  return `${unique[0]} and ${unique.length - 1} others`;
}

function groupNotificationEntries(entries: NotificationEntry[]): NotificationEntry[] {
  const ordered = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const grouped = new Map<string, NotificationEntry>();

  ordered.forEach((entry) => {
    const key = entry.groupKey ?? entry.id;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...entry,
        sourceIds: [...entry.sourceIds],
        actorNames: [...(entry.actorNames ?? [])],
        groupCount: 1,
      });
      return;
    }

    const actorNames = [...new Set([...(existing.actorNames ?? []), ...(entry.actorNames ?? [])])];
    const sourceIds = [...new Set([...existing.sourceIds, ...entry.sourceIds])];
    const groupCount = (existing.groupCount ?? 1) + 1;
    const actorSummary = summarizeNotificationActors(actorNames);

    let detail = existing.detail;

    switch (existing.title) {
      case "New follower":
        detail = `${actorSummary} started following you.`;
        break;
      case "Move reaction":
        detail = `${actorSummary} reacted to your move.`;
        break;
      case "Move reply":
        detail = `${actorSummary} replied to your move.`;
        break;
      case "Missed call":
        detail = `${actorSummary} tried to reach you.`;
        break;
      case "Viewed your profile":
        detail = `${actorSummary} viewed your profile.`;
        break;
      case "Tagged you":
        detail = `${actorSummary} tagged you in a post.`;
        break;
      case "Liked your post":
        detail = `${actorSummary} liked your post.`;
        break;
      case "Commented":
        detail = `${actorSummary} commented on your post.`;
        break;
      case "Collab accepted":
        detail = `${actorSummary} accepted your collab.`;
        break;
      default:
        break;
    }

    grouped.set(key, {
      ...existing,
      sourceIds,
      actorNames,
      detail,
      groupCount,
      action: groupCount > 1 && existing.action?.kind === "open_profile" ? undefined : existing.action,
    });
  });

  return [...grouped.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

type FollowSummary = {
  id: string;
};

type LiveSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  viewerCount: number;
  isHost: boolean;
  isViewer: boolean;
  host: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  };
};

type CommentEntry = {
  id: string;
  author: string;
  handle: string;
  avatarGradient: string;
  text: string;
  createdAt: string;
  time: string;
};

const DEFAULT_POST_LOCATION = "";
const ACCOUNTS_STORAGE_KEY = "motion-accounts";
const LAST_ACCOUNT_KEY = "motion-last-account";
const STORY_EMOJI_OPTIONS = [
  "\u{1F525}",
  "\u{1F60D}",
  "\u{1F602}",
  "\u{1F44F}",
  "\u{1F62E}",
  "\u{1F4AF}",
];
const THEME_OPTIONS: { id: ThemeSelection; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "summer", label: "Summer" },
  { id: "autumn", label: "Autumn" },
];
function isThemeSelection(input: string | null): input is ThemeSelection {
  return THEME_OPTIONS.some((option) => option.id === input);
}

function sortByNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function toDateTimeLocalValue(input: string | number | Date): string {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatCapsuleDate(input: string | number | Date): string {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return "your chosen date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }

  return payload as T;
}

function createComposerHotspot(): ComposerHotspot {
  return {
    id: `hotspot-${Math.random().toString(36).slice(2, 10)}`,
    title: "",
    detail: "",
    yaw: 0,
    pitch: 0,
  };
}

function resolveMediaItems({
  media,
  mediaUrl,
  mediaType,
}: {
  media?: MediaItem[];
  mediaUrl?: string;
  mediaType?: MediaType;
}): MediaItem[] {
  if (Array.isArray(media) && media.length > 0) {
    return media;
  }

  if (mediaUrl && mediaType) {
    return [{ url: mediaUrl, type: mediaType }];
  }

  return [];
}

function MediaCarousel({ media, className }: { media: MediaItem[]; className: string }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = 0;
    }
  }, [media.length]);

  return (
    <div className={`${className} relative overflow-hidden`}>
      <div
        ref={scrollerRef}
        className="media-carousel"
        onScroll={(event) => {
          const target = event.currentTarget;
          const width = target.clientWidth || 1;
          const nextIndex = Math.round(target.scrollLeft / width);
          if (nextIndex !== index) {
            setIndex(nextIndex);
          }
        }}
      >
        {media.map((item, itemIndex) => (
          <div key={`${item.url}-${itemIndex}`} className="media-slide">
            {item.type === "image" ? (
              <Image
                src={item.url}
                alt="Post media"
                fill
                className="object-cover"
              />
            ) : (
              item.immersive ? (
                <ImmersiveVideoViewer
                  src={item.url}
                  hotspots={item.hotspots}
                  className="h-full w-full"
                  videoClassName="h-full w-full"
                  controls
                  muted
                  preload="metadata"
                />
              ) : (
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  controls
                  muted
                  preload="metadata"
                />
              )
            )}
          </div>
        ))}
      </div>
      {media.length > 1 ? (
        <div className="media-dots">
          {media.map((_, dotIndex) => (
            <span
              key={`dot-${dotIndex}`}
              className={`media-dot ${dotIndex === index ? "is-active" : ""}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MediaPreview({ post, className }: { post: Post; className: string }) {
  const mediaItems = resolveMediaItems({
    media: post.media,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
  });

  if (mediaItems.length > 1) {
    return <MediaCarousel media={mediaItems} className={className} />;
  }

  if (mediaItems.length === 1 && mediaItems[0]?.type === "image") {
    return (
      <div className={`${className} relative overflow-hidden`}>
        <Image
          src={mediaItems[0].url}
          alt={`${post.author} post`}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  if (mediaItems.length === 1 && mediaItems[0]?.type === "video") {
    return (
      mediaItems[0].immersive ? (
        <ImmersiveVideoViewer
          src={mediaItems[0].url}
          hotspots={mediaItems[0].hotspots}
          className={`${className} bg-black`}
          videoClassName="h-full w-full"
          controls
          muted
          preload="metadata"
        />
      ) : (
        <video
          src={mediaItems[0].url}
          className={`${className} bg-black object-cover`}
          controls
          muted
          preload="metadata"
        />
      )
    );
  }

  return <div className={className} style={{ background: post.gradient }} />;
}

function StoryAvatarContent({ story, isLive }: { story: Story; isLive?: boolean }) {
  const mediaItems = resolveMediaItems({
    media: story.media,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
  });
  const primary = mediaItems[0];
  const liveBadge = isLive ? <span className="live-badge">LIVE</span> : null;

  if (primary && primary.type === "image") {
    return (
      <span className="story-avatar overflow-hidden" style={{ background: story.gradient }}>
        <Image
          src={primary.url}
          alt={`${story.name} move`}
          fill
          className="object-cover"
        />
        {liveBadge}
      </span>
    );
  }

  return (
    <span className="story-avatar overflow-hidden" style={{ background: story.gradient }}>
      {story.name.slice(0, 2).toUpperCase()}
      {primary?.type === "video" ? <span className="story-video-badge">▶</span> : null}
      {liveBadge}
    </span>
  );
}
function SaveGlyph({ saved, className }: { saved: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className ?? "h-4 w-4"}
      fill={saved ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.1 3.2h9.8a1.4 1.4 0 0 1 1.4 1.4v12l-6.3-3.4-6.3 3.4v-12a1.4 1.4 0 0 1 1.4-1.4Z" />
    </svg>
  );
}

function formatTrackDuration(durationSec?: number): string {
  if (!durationSec || durationSec <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.max(1, Math.round(durationSec));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ThemeGlyph({ theme }: { theme: ThemeSelection }) {
  if (theme === "dark") {
    return (
      <path d="M14.5 2.8a6.8 6.8 0 1 0 2.7 12.9 7.2 7.2 0 1 1-2.7-12.9Z" />
    );
  }

  if (theme === "light") {
    return (
      <>
        <circle cx="10" cy="10" r="3.2" />
        <path d="M10 2.2v2.3M10 15.5v2.3M2.2 10h2.3M15.5 10h2.3M4.5 4.5l1.6 1.6M13.9 13.9l1.6 1.6M4.5 15.5l1.6-1.6M13.9 6.1l1.6-1.6" />
      </>
    );
  }

  if (theme === "summer") {
    return (
      <>
        <circle cx="9" cy="8" r="2.8" />
        <path d="M9 2.5v1.8M9 11.7v1.8M3.5 8H5.3M12.7 8h1.8M5.1 4.1l1.2 1.2M11.7 10.7l1.2 1.2" />
        <path d="M3.2 15.1c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.8 0 3.2-1.4 4.8 0" />
      </>
    );
  }

  if (theme === "autumn") {
    return <path d="M10 2.4c2.7 2.6 3.6 6.1 2.5 9-1 2.7-3.7 4.7-6.8 5.1 0-1.8.6-3.5 1.8-4.8 1-1.1 2.4-1.9 4-2.2-2.3-.2-4.4.3-6.1 1.7-.5-3.4 1.2-6.7 4.6-8.8Z" />;
  }
  return <path d="M10 2.4c2.7 2.6 3.6 6.1 2.5 9-1 2.7-3.7 4.7-6.8 5.1 0-1.8.6-3.5 1.8-4.8 1-1.1 2.4-1.9 4-2.2-2.3-.2-4.4.3-6.1 1.7-.5-3.4 1.2-6.7 4.6-8.8Z" />;
}

function ThemePicker({
  selectedTheme,
  onThemeChange,
}: {
  selectedTheme: ThemeSelection;
  onThemeChange: (theme: ThemeSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeTheme =
    THEME_OPTIONS.find((option) => option.id === selectedTheme) ?? THEME_OPTIONS[0];

  return (
    <div className="theme-picker">
      <button
        type="button"
        className="theme-trigger-button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open theme menu"
        aria-expanded={open}
        title={`Theme: ${activeTheme.label}`}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ThemeGlyph theme={selectedTheme} />
        </svg>
      </button>
      {open ? (
        <div className="theme-menu motion-surface p-2">
          <div className="theme-strip">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onThemeChange(option.id);
                  setOpen(false);
                }}
                className={`theme-strip-item ${selectedTheme === option.id ? "is-active" : ""}`}
                aria-label={`Switch to ${option.label} theme`}
                title={option.label}
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <ThemeGlyph theme={option.id} />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ViewportPicker({
  mode,
  onChange,
}: {
  mode: ViewportMode;
  onChange: (next: ViewportMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = mode === "desktop" ? "Desktop" : mode === "tablet" ? "Tablet" : "Mobile";

  return (
    <div className="viewport-picker">
      <button
        type="button"
        className="theme-trigger-button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Switch viewport size"
        aria-expanded={open}
        title={`Viewport: ${label}`}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2.6" y="4" width="14.8" height="9.4" rx="1.6" />
          <path d="M7.5 16h5" />
          <path d="M9 13.4v2.6" />
        </svg>
      </button>
      {open ? (
        <div className="theme-menu motion-surface p-2">
          <div className="space-y-1">
            {([
              { id: "desktop" as const, label: "Desktop" },
              { id: "tablet" as const, label: "Tablet" },
              { id: "mobile" as const, label: "Mobile" },
            ]).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold ${mode === option.id
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--line)] bg-white text-slate-700"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<StoredAccount[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [rememberPromptOpen, setRememberPromptOpen] = useState(false);
  const [rememberCandidate, setRememberCandidate] = useState<User | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingInterests, setOnboardingInterests] = useState<InterestKey[]>([]);
  const [onboardingSuggestedCreators, setOnboardingSuggestedCreators] = useState<SuggestedCreator[]>([]);
  const [onboardingSelectedFollowIds, setOnboardingSelectedFollowIds] = useState<string[]>([]);
  const [onboardingBio, setOnboardingBio] = useState("");
  const [onboardingAvatarUrl, setOnboardingAvatarUrl] = useState("");
  const [onboardingAvatarUploading, setOnboardingAvatarUploading] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const feedView: FeedView = "discover";
  const [contentView, setContentView] = useState<ContentView>("posts");
  const [activeFeedInterest, setActiveFeedInterest] = useState<FeedInterestFilter>("all");
  const [stories, setStories] = useState<Story[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSessionSummary[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [friendActivity, setFriendActivity] = useState<Record<string, FriendActivity>>({});
  const [followNotifications, setFollowNotifications] = useState<MotionNotification[]>([]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("post");
  const [composerCaption, setComposerCaption] = useState("");
  const [composerVisibleAt, setComposerVisibleAt] = useState("");
  const [coAuthorHandle, setCoAuthorHandle] = useState("");
  const [composerInterests, setComposerInterests] = useState<InterestKey[]>([]);
  const [composerImmersiveVideo, setComposerImmersiveVideo] = useState(false);
  const [composerHotspots, setComposerHotspots] = useState<ComposerHotspot[]>([]);
  const [liveTitle, setLiveTitle] = useState("");
  const [storyCaption, setStoryCaption] = useState("");
  const [storyPollQuestion, setStoryPollQuestion] = useState("");
  const [storyPollOptionA, setStoryPollOptionA] = useState("");
  const [storyPollOptionB, setStoryPollOptionB] = useState("");
  const [storyQuestionPrompt, setStoryQuestionPrompt] = useState("");
  const [storyEmojiChoices, setStoryEmojiChoices] = useState<string[]>([]);
  const [storyMusicTrack, setStoryMusicTrack] = useState<MusicTrack | null>(null);
  const [storyMusicQuery, setStoryMusicQuery] = useState("");
  const [storyMusicResults, setStoryMusicResults] = useState<MusicTrack[]>([]);
  const [storyMusicLoading, setStoryMusicLoading] = useState(false);
  const [storyMusicError, setStoryMusicError] = useState<string | null>(null);
  const [musicPreviewId, setMusicPreviewId] = useState<string | null>(null);
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [storyFiles, setStoryFiles] = useState<File[]>([]);
  const [storyKind, setStoryKind] = useState<PostKind>("Photo");
  const [publishing, setPublishing] = useState(false);
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>("dark");
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
  const wasNotificationsOpenRef = useRef(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([]);
  const [heartBurst, setHeartBurst] = useState<{ postId: string; token: number } | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<{ id: string; text: string } | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [commentEntries, setCommentEntries] = useState<CommentEntry[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [storyReplyText, setStoryReplyText] = useState("");
  const [storyReplySending, setStoryReplySending] = useState(false);
  const [storyQuestionAnswer, setStoryQuestionAnswer] = useState("");
  const [storyAudioPlaying, setStoryAudioPlaying] = useState(false);
  const [profileViews, setProfileViews] = useState<ProfileViewEntry[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const composerCaptionRef = useRef<HTMLTextAreaElement | null>(null);
  const storyCaptionRef = useRef<HTMLTextAreaElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const headerActionsRef = useRef<HTMLElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const feedSectionRef = useRef<HTMLElement | null>(null);
  const heartBurstTimerRef = useRef<number | null>(null);
  const shareNoticeTimerRef = useRef<number | null>(null);
  const homeClickRef = useRef<number>(0);
  const bottomNavLastScrollRef = useRef(0);
  const bottomNavTickingRef = useRef(false);
  const musicPreviewRef = useRef<HTMLAudioElement | null>(null);
  const storyAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationsStorageKey = user
    ? `motion-seen-notifications:${user.id}`
    : null;
  const onboardingDismissStorageKey = user
    ? `motion-onboarding-dismissed:${user.id}`
    : null;

  const loadConversations = useCallback(async () => {
    const convoRes = await req<{ conversations: Conversation[] }>("/api/messages/conversations");
    setConversations(convoRes.conversations);
    return convoRes.conversations;
  }, []);

  const updateStoryInState = useCallback((nextStory: Story) => {
    setStories((current) =>
      current.map((story) => (story.id === nextStory.id ? nextStory : story)),
    );
  }, []);

  useEffect(() => {
    const handleCallState = (event: Event) => {
      const detail = (event as CustomEvent<MotionCallStateDetail>).detail;

      if (!detail?.conversationId || !user) {
        return;
      }

      void loadConversations().catch(() => undefined);
    };

    window.addEventListener(MOTION_CALL_STATE_EVENT, handleCallState as EventListener);

    return () => {
      window.removeEventListener(MOTION_CALL_STATE_EVENT, handleCallState as EventListener);
    };
  }, [loadConversations, user]);

  const loadData = useCallback(async (scope: FeedView) => {
    const interestQuery =
      activeFeedInterest !== "all" ? `&interest=${activeFeedInterest}` : "";
    const [storiesRes, postsRes, savedRes, convoRes, liveRes] = await Promise.all([
      req<{ stories: Story[] }>("/api/stories"),
      req<{ posts: Post[] }>(`/api/posts?scope=${scope}${interestQuery}`),
      req<{ posts: Post[] }>("/api/posts/saved"),
      loadConversations(),
      req<{ sessions: LiveSessionSummary[] }>("/api/live"),
    ]);

    setStories(storiesRes.stories);
    setPosts(postsRes.posts);
    setSavedPosts(savedRes.posts);
    setConversations(convoRes);
    setLiveSessions(liveRes.sessions ?? []);
  }, [activeFeedInterest, loadConversations]);

  const refreshLiveSessions = useCallback(async () => {
    if (!user) {
      setLiveSessions([]);
      return;
    }

    try {
      const liveRes = await req<{ sessions: LiveSessionSummary[] }>("/api/live");
      setLiveSessions(liveRes.sessions ?? []);
    } catch {
      // Ignore transient live refresh errors.
    }
  }, [user]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("motion-theme");
    if (isThemeSelection(storedTheme)) {
      setThemeSelection(storedTheme);
    }

    const storedViewport = window.localStorage.getItem("motion-viewport");
    if (storedViewport === "desktop" || storedViewport === "tablet" || storedViewport === "mobile") {
      setViewportMode(storedViewport);
    }
  }, []);

  useEffect(() => {
    const storedAccounts = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!storedAccounts) {
      return;
    }

    try {
      const parsed = JSON.parse(storedAccounts) as StoredAccount[];
      const accounts = Array.isArray(parsed)
        ? parsed.filter(
          (account): account is StoredAccount =>
            Boolean(account?.email) && Boolean(account?.password),
        )
        : [];
      setSavedAccounts(accounts);

      const lastAccountKey = window.localStorage.getItem(LAST_ACCOUNT_KEY);
      const match =
        accounts.find(
          (account) =>
            account.handle === lastAccountKey || account.email === lastAccountKey,
        ) ?? accounts[0];

      if (match) {
        setEmail(match.email);
        setPassword(match.password);
        const parts = (match.name ?? "").trim().split(" ");
        setAuthFirstName(parts[0] ?? "");
        setAuthLastName(parts.slice(1).join(" "));
        setAuthUsername(match.handle ?? "");
      }
    } catch {
      setSavedAccounts([]);
    }
  }, []);

  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      setUserSearchError(null);
      setUserSearchLoading(false);
      return;
    }

    let active = true;
    setUserSearchLoading(true);
    setUserSearchError(null);

    const handle = window.setTimeout(async () => {
      try {
        const payload = await req<{ users: UserSearchResult[] }>(
          `/api/users?q=${encodeURIComponent(userSearchQuery)}`,
        );
        if (!active) {
          return;
        }
        setUserSearchResults(payload.users ?? []);
      } catch (searchError) {
        if (!active) {
          return;
        }
        setUserSearchResults([]);
        setUserSearchError(
          searchError instanceof Error ? searchError.message : "Search failed.",
        );
      } finally {
        if (active) {
          setUserSearchLoading(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [userSearchQuery]);

  useEffect(() => {
    window.localStorage.setItem("motion-theme", themeSelection);
    document.documentElement.setAttribute("data-theme", themeSelection);
  }, [themeSelection]);

  useEffect(() => {
    if (!notificationsStorageKey) {
      setSeenNotificationIds([]);
      return;
    }

    const stored = window.localStorage.getItem(notificationsStorageKey);

    if (!stored) {
      setSeenNotificationIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      setSeenNotificationIds(
        Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : [],
      );
    } catch {
      setSeenNotificationIds([]);
    }
  }, [notificationsStorageKey]);

  useEffect(() => {
    if (!notificationsStorageKey) {
      return;
    }

    window.localStorage.setItem(
      notificationsStorageKey,
      JSON.stringify(seenNotificationIds),
    );
  }, [notificationsStorageKey, seenNotificationIds]);

  useEffect(() => {
    if (!user) {
      setFriendActivity({});
      return;
    }

    let active = true;

    const pingPresence = async () => {
      try {
        const payload = await req<{ activity: FriendActivity[] }>("/api/presence", {
          method: "POST",
        });
        if (!active) {
          return;
        }
        const next = Object.fromEntries(
          (payload.activity ?? []).map((entry) => [entry.id, entry]),
        );
        setFriendActivity(next);
      } catch {
        // Ignore presence errors.
      }
    };

    void pingPresence();
    const interval = window.setInterval(pingPresence, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void pingPresence();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  useEffect(() => {
    window.localStorage.setItem("motion-viewport", viewportMode);
  }, [viewportMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    bottomNavLastScrollRef.current = window.scrollY;
    const onScroll = () => {
      if (bottomNavTickingRef.current) {
        return;
      }
      bottomNavTickingRef.current = true;
      window.requestAnimationFrame(() => {
        const current = window.scrollY;
        const delta = current - bottomNavLastScrollRef.current;

        if (current < 80) {
          setBottomNavHidden(false);
        } else if (delta > 8) {
          setBottomNavHidden(true);
        } else if (delta < -8) {
          setBottomNavHidden(false);
        }

        bottomNavLastScrollRef.current = current;
        bottomNavTickingRef.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setError(null);

      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });

        if (me.status === 401) {
          setUser(null);
          return;
        }

        const payload = (await me.json()) as { user: User };
        setUser(payload.user);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    void boot();
  }, []);

  useEffect(() => {
    if (!user) {
      setOnboardingOpen(false);
      setOnboardingDismissed(false);
      setOnboardingSuggestedCreators([]);
      return;
    }

    setOnboardingInterests(user.interests ?? []);
    setOnboardingBio(user.bio ?? "");
    setOnboardingAvatarUrl(user.avatarUrl ?? "");
    setOnboardingStep(1);
    setOnboardingError(null);

    if (!onboardingDismissStorageKey) {
      setOnboardingDismissed(false);
      return;
    }

    setOnboardingDismissed(window.localStorage.getItem(onboardingDismissStorageKey) === "1");
  }, [onboardingDismissStorageKey, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const loadOnboardingSuggestions = async () => {
      try {
        const payload = await req<{ creators: SuggestedCreator[] }>("/api/onboarding");
        if (!active) {
          return;
        }
        setOnboardingSuggestedCreators(payload.creators ?? []);
      } catch {
        if (!active) {
          return;
        }
        setOnboardingSuggestedCreators([]);
      }
    };

    void loadOnboardingSuggestions();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!user.onboardingCompleted && !rememberPromptOpen && !onboardingDismissed) {
      setOnboardingOpen(true);
      return;
    }

    if (user.onboardingCompleted) {
      setOnboardingOpen(false);
    }
  }, [onboardingDismissed, rememberPromptOpen, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setError(null);
    void loadData(feedView).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Failed to load data"),
    );
  }, [user, feedView, loadData]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshLiveSessions();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [user, refreshLiveSessions]);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      setFollowingLoaded(false);
      setOnboardingSelectedFollowIds([]);
      return;
    }

    const loadFollowing = async () => {
      try {
        const payload = await req<{ users: FollowSummary[] }>(
          `/api/follows?userId=${user.id}&list=following`,
        );
        const ids = (payload.users ?? []).map((follow) => follow.id);
        setFollowingIds(ids);
        if (!user.onboardingCompleted) {
          setOnboardingSelectedFollowIds(ids);
        }
      } catch {
        setFollowingIds([]);
        if (!user.onboardingCompleted) {
          setOnboardingSelectedFollowIds([]);
        }
      } finally {
        setFollowingLoaded(true);
      }
    };

    setFollowingLoaded(false);
    void loadFollowing();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadViews = async () => {
      try {
        const payload = await req<{ views: ProfileViewEntry[] }>(
          "/api/profile/views",
        );
        setProfileViews(payload.views ?? []);
      } catch {
        // Ignore profile view errors so the feed stays responsive.
      }
    };

    void loadViews();
  }, [user]);

  useEffect(() => {
    if (!user || !notificationsOpen) {
      return;
    }

    const loadViews = async () => {
      try {
        const payload = await req<{ views: ProfileViewEntry[] }>(
          "/api/profile/views",
        );
        setProfileViews(payload.views ?? []);
      } catch {
        // Ignore errors.
      }
    };

    void loadViews();
  }, [user, notificationsOpen]);

  useEffect(() => {
    if (!user || !notificationsOpen) {
      return;
    }

    const loadNotifications = async () => {
      try {
        const payload = await req<{ notifications: MotionNotification[] }>(
          "/api/notifications",
        );
        setFollowNotifications(payload.notifications ?? []);
      } catch {
        // Ignore errors.
      }
    };

    void loadNotifications();
  }, [user, notificationsOpen]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const refreshConversations = async () => {
      try {
        const nextConversations = await loadConversations();
        if (!active) {
          return;
        }
        setConversations(nextConversations);
      } catch {
        // Ignore inbox badge refresh failures.
      }
    };

    void refreshConversations();
    const interval = window.setInterval(refreshConversations, 4_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadConversations, user]);

  useEffect(() => {
    if (!composerOpen) {
      return;
    }

    composerCaptionRef.current?.focus();
  }, [composerOpen]);

  useEffect(() => {
    if (!storyComposerOpen) {
      return;
    }

    storyCaptionRef.current?.focus();
  }, [storyComposerOpen]);

  useEffect(() => {
    const query = storyMusicQuery.trim();

    if (!query) {
      setStoryMusicResults([]);
      setStoryMusicLoading(false);
      setStoryMusicError(null);
      return;
    }

    let active = true;
    setStoryMusicLoading(true);
    setStoryMusicError(null);
    const handle = window.setTimeout(async () => {
      try {
        const payload = await req<{ tracks: MusicTrack[] }>(
          `/api/music?query=${encodeURIComponent(query)}`,
        );
        if (active) {
          setStoryMusicResults(payload.tracks ?? []);
          setStoryMusicError(null);
        }
      } catch (e) {
        if (active) {
          setStoryMusicError(e instanceof Error ? e.message : "Music search failed.");
        }
      } finally {
        if (active) {
          setStoryMusicLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [storyMusicQuery]);

  useEffect(() => {
    if (!composerOpen && !storyComposerOpen) {
      stopMusicPreview();
    }
  }, [composerOpen, storyComposerOpen]);

  useEffect(() => {
    stopStoryAudio();
  }, [activeStoryId]);

  useEffect(() => {
    return () => {
      if (heartBurstTimerRef.current !== null) {
        window.clearTimeout(heartBurstTimerRef.current);
      }
      stopMusicPreview();
      stopStoryAudio();
    };
  }, []);

  const sortedPosts = useMemo(() => sortByNewest(posts), [posts]);
  const photoPosts = useMemo(
    () => sortedPosts.filter((post) => post.kind === "Photo"),
    [sortedPosts],
  );
  const reels = useMemo(
    () => sortedPosts.filter((post) => post.kind === "Reel"),
    [sortedPosts],
  );
  const visiblePosts = contentView === "posts" ? photoPosts : reels;
  const profileNeedsWork = !user?.avatarUrl || !(user.bio?.trim().length);
  const personalizedSuggestedCreators = useMemo(() => {
    const picked = new Set(onboardingInterests);

    return [...onboardingSuggestedCreators].sort((a, b) => {
      const aMatches = a.interests.filter((interest) => picked.has(interest)).length;
      const bMatches = b.interests.filter((interest) => picked.has(interest)).length;

      if (bMatches !== aMatches) {
        return bMatches - aMatches;
      }

      if (a.accountType !== b.accountType) {
        return a.accountType === "creator" ? -1 : 1;
      }

      return b.followerCount - a.followerCount;
    });
  }, [onboardingInterests, onboardingSuggestedCreators]);
  const showOnboardingBanner = Boolean(
    user &&
      !onboardingOpen &&
      (!user.onboardingCompleted || profileNeedsWork || (followingLoaded && followingIds.length === 0)),
  );
  const feedInterestOptions = useMemo(() => {
    const preferred = INTEREST_OPTIONS.filter((option) =>
      user?.interests?.includes(option.id),
    );
    return preferred.length > 0 ? preferred : INTEREST_OPTIONS;
  }, [user?.interests]);

  useEffect(() => {
    if (activeFeedInterest === "all") {
      return;
    }

    if (!feedInterestOptions.some((option) => option.id === activeFeedInterest)) {
      setActiveFeedInterest("all");
    }
  }, [activeFeedInterest, feedInterestOptions]);

  const capsuleMinValue = toDateTimeLocalValue(Date.now() + 60_000);
  const notificationItems = useMemo<NotificationEntry[]>(() => {
    const followerName =
      stories.find((story) => story.name !== user?.name.split(" ")[0])?.name ??
      conversations[0]?.name ??
      "Ari Rowan";
    const likeSource =
      photoPosts.find((post) => post.author !== user?.name) ??
      sortedPosts.find((post) => post.author !== user?.name) ??
      null;
    const commentSource =
      reels.find((post) => post.author !== user?.name) ??
      sortedPosts.find((post) => post.author !== user?.name) ??
      null;
    const handleTag = user?.handle?.toLowerCase() ?? "";
    const tagNotifications =
      handleTag.length > 0
        ? sortedPosts
            .filter(
              (post) =>
                post.author !== user?.name &&
                post.caption.toLowerCase().includes(`@${handleTag}`),
            )
            .map((post) => ({
              id: `tag-${post.id}`,
              sourceIds: [`tag-${post.id}`],
              title: "Tagged you" as const,
              detail: `${post.author} tagged you in a post.`,
              meta: post.timeAgo || "Just now",
              createdAt: post.createdAt,
              tone: "tag" as const,
              category: "comments" as const,
              actorNames: [post.author],
              groupKey: `tag-${post.id}`,
              action: { kind: "open_comments" as const, postId: post.id },
            }))
        : [];

    const viewNotifications = profileViews.map((view) => ({
      id: `view-${view.id}`,
      sourceIds: [`view-${view.id}`],
      title: "Viewed your profile" as const,
      detail: `${view.viewerName} viewed your profile.`,
      meta: view.time,
      createdAt: view.createdAt,
      tone: "view" as const,
      category: "profile" as const,
      actorNames: [view.viewerName],
      groupKey: "profile-views",
      action: { kind: "open_profile" as const, handle: view.viewerHandle },
    }));
    const storyReactionNotices = followNotifications
      .filter((notification) => notification.type === "story_reaction")
      .map((notification) => {
        const emoji = notification.emoji ?? "";
        const emojiText = emoji ? `${emoji} ` : "";
        return {
          id: `story-reaction-${notification.id}`,
          sourceIds: [`story-reaction-${notification.id}`],
          title: "Move reaction" as const,
          detail: `${notification.actor.name} reacted ${emojiText}to your move.`,
          meta: notification.time,
          createdAt: notification.createdAt,
          tone: "like" as const,
          category: "moves" as const,
          actorNames: [notification.actor.name],
          groupKey: `move-reaction-${notification.story?.id ?? "all"}`,
          marker: "reaction" as const,
          action: notification.story?.id
            ? { kind: "open_story" as const, storyId: notification.story.id }
            : undefined,
        };
      });
    const storyReplyNotices = followNotifications
      .filter((notification) => notification.type === "story_reply")
      .map((notification) => {
        const replyText = notification.text?.trim() ?? "";
        const trimmed =
          replyText.length > 84 ? `${replyText.slice(0, 84).trimEnd()}...` : replyText;
        return {
          id: `story-reply-${notification.id}`,
          sourceIds: [`story-reply-${notification.id}`],
          title: "Move reply" as const,
          detail: replyText
            ? `${notification.actor.name} replied: "${trimmed}"`
            : `${notification.actor.name} replied to your move.`,
          meta: notification.time,
          createdAt: notification.createdAt,
          tone: "comment" as const,
          category: "moves" as const,
          actorNames: [notification.actor.name],
          groupKey: `move-reply-${notification.story?.id ?? "all"}`,
          marker: "reply" as const,
          action: notification.story?.id
            ? { kind: "open_story" as const, storyId: notification.story.id }
            : undefined,
        };
      });
    const missedCallNotices = followNotifications
      .filter((notification) => notification.type === "missed_call")
      .map((notification) => ({
        id: `missed-call-${notification.id}`,
        sourceIds: [`missed-call-${notification.id}`],
        title: "Missed call" as const,
        detail: `${notification.actor.name} tried to reach you by ${
          notification.callMode === "video" ? "video" : "voice"
        } call.`,
        meta: notification.time,
        createdAt: notification.createdAt,
        tone: "call" as const,
        category: "calls" as const,
        actorNames: [notification.actor.name],
        groupKey: `missed-call-${notification.conversationId ?? notification.actor.id}`,
        marker: "ringing" as const,
        action: notification.conversationId
          ? {
              kind: "open_conversation" as const,
              conversationId: notification.conversationId,
            }
          : undefined,
      }));
    const followNotices = followNotifications
      .filter((notification) => notification.type === "follow")
      .map((notification) => ({
        id: `follow-${notification.id}`,
        sourceIds: [`follow-${notification.id}`],
        title: "New follower" as const,
        detail: `${notification.actor.name} started following you.`,
        meta: notification.time,
        createdAt: notification.createdAt,
        tone: "follow" as const,
        category: "follows" as const,
        actorNames: [notification.actor.name],
        groupKey: "new-followers",
        action: { kind: "open_profile" as const, handle: notification.actor.handle },
      }));

    const collabInvites = followNotifications
      .filter((notification) => notification.type === "collab_invite")
      .map((notification) => ({
        id: `collab-invite-${notification.id}`,
        sourceIds: [`collab-invite-${notification.id}`],
        title: "Collab invite" as const,
        detail: `${notification.actor.name} invited you to co-post.`,
        meta: notification.post?.kind ?? "Post",
        createdAt: notification.createdAt,
        tone: "comment" as const,
        category: "comments" as const,
        actorNames: [notification.actor.name],
        action: notification.post?.id
          ? { kind: "collab_invite" as const, postId: notification.post.id }
          : undefined,
      }));

    const collabAccepts = followNotifications
      .filter((notification) => notification.type === "collab_accept")
      .map((notification) => ({
        id: `collab-accept-${notification.id}`,
        sourceIds: [`collab-accept-${notification.id}`],
        title: "Collab accepted" as const,
        detail: `${notification.actor.name} accepted your collab.`,
        meta: notification.time,
        createdAt: notification.createdAt,
        tone: "follow" as const,
        category: "comments" as const,
        actorNames: [notification.actor.name],
        action: { kind: "open_profile" as const, handle: notification.actor.handle },
      }));

    const likeNotification =
      likeSource && likeSource.author !== user?.name
        ? [
            {
              id: `like-${likeSource.id}`,
              sourceIds: [`like-${likeSource.id}`],
              title: "Liked your post" as const,
              detail: "New likes landed on your post.",
              meta: `${likeSource.likes} likes`,
              createdAt: likeSource.createdAt,
              tone: "like" as const,
              category: "likes" as const,
              groupKey: `like-${likeSource.id}`,
              action: { kind: "open_comments" as const, postId: likeSource.id },
            },
          ]
        : [];

    const commentNotification =
      commentSource && commentSource.author !== user?.name
        ? [
            {
              id: `comment-${commentSource.id}`,
              sourceIds: [`comment-${commentSource.id}`],
              title: "Commented" as const,
              detail: "New comments landed on your post.",
              meta: `${commentSource.comments} comments`,
              createdAt: commentSource.createdAt,
              tone: "comment" as const,
              category: "comments" as const,
              groupKey: `comment-${commentSource.id}`,
              action: { kind: "open_comments" as const, postId: commentSource.id },
            },
          ]
        : [];

    const baseEntries = [
      ...tagNotifications,
      ...viewNotifications,
      ...missedCallNotices,
      ...storyReactionNotices,
      ...storyReplyNotices,
      ...collabInvites,
      ...collabAccepts,
      ...(followNotices.length > 0
        ? followNotices
        : [
            {
              id: `follow-${followerName}`,
              sourceIds: [`follow-${followerName}`],
              title: "New follower" as const,
              detail: `${followerName} started following you.`,
              meta: "Just now",
              createdAt: new Date().toISOString(),
              tone: "follow" as const,
              category: "follows" as const,
              actorNames: [followerName],
              groupKey: "new-followers",
            },
          ]),
      ...likeNotification,
      ...commentNotification,
    ];

    return groupNotificationEntries(baseEntries);
  }, [conversations, followNotifications, photoPosts, profileViews, reels, sortedPosts, stories, user]);
  const activeFriends = useMemo(
    () => Object.values(friendActivity).filter((entry) => entry.isActive),
    [friendActivity],
  );
  const filteredNotificationItems = useMemo(() => {
    if (notificationFilter === "all") {
      return notificationItems;
    }

    return notificationItems.filter((notification) => notification.category === notificationFilter);
  }, [notificationFilter, notificationItems]);
  const unseenNotificationItems = useMemo(
    () =>
      filteredNotificationItems.filter((notification) =>
        notification.sourceIds.some((sourceId) => !seenNotificationIds.includes(sourceId)),
      ),
    [filteredNotificationItems, seenNotificationIds],
  );
  const earlierNotificationItems = useMemo(
    () =>
      filteredNotificationItems.filter((notification) =>
        notification.sourceIds.every((sourceId) => seenNotificationIds.includes(sourceId)),
      ),
    [filteredNotificationItems, seenNotificationIds],
  );
  const notificationCount = useMemo(
    () =>
      notificationItems.filter((notification) =>
        notification.sourceIds.some((sourceId) => !seenNotificationIds.includes(sourceId)),
      ).length,
    [notificationItems, seenNotificationIds],
  );
  const markNotificationsSeen = useCallback((items: NotificationEntry[]) => {
    setSeenNotificationIds((current) => {
      if (items.length === 0) {
        return current;
      }

      const next = new Set(current);

      items.forEach((notification) => {
        if (notification.action?.kind === "collab_invite") {
          return;
        }

        notification.sourceIds.forEach((sourceId) => {
          next.add(sourceId);
        });
      });

      if (next.size === current.length) {
        return current;
      }

      return [...next];
    });
  }, []);
  const pendingCollabInvites = useMemo(
    () => followNotifications.filter((notification) => notification.type === "collab_invite").length,
    [followNotifications],
  );
  const activeCommentsPost = useMemo(
    () => posts.find((post) => post.id === commentsPostId) ?? null,
    [commentsPostId, posts],
  );
  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);
  const liveSessionByHost = useMemo(
    () => new Map(liveSessions.map((session) => [session.host.id, session])),
    [liveSessions],
  );
  const isUserLive = Boolean(user && liveSessionByHost.has(user.id));
  const activeStory = useMemo(
    () => stories.find((story) => story.id === activeStoryId) ?? null,
    [activeStoryId, stories],
  );
  const activeStoryMedia = useMemo(
    () =>
      activeStory
        ? resolveMediaItems({
          media: activeStory.media,
          mediaUrl: activeStory.mediaUrl,
          mediaType: activeStory.mediaType,
        })
        : [],
    [activeStory],
  );

  useEffect(() => {
    if (!activeStory) {
      setStoryQuestionAnswer("");
      setStoryReplyText("");
      return;
    }
    setStoryQuestionAnswer(activeStory.question?.myAnswer ?? "");
    setStoryReplyText("");
  }, [activeStory, activeStoryId]);

  const unread = conversations.reduce((sum, convo) => sum + convo.unread, 0);
  const missedCallsTotal = conversations.reduce(
    (sum, convo) => sum + convo.missedCallCount,
    0,
  );
  const messagesBadgeCount = missedCallsTotal > 0 ? missedCallsTotal : unread;
  const messagesBadgeTone = missedCallsTotal > 0 ? "missed" : "default";

  useEffect(() => {
    if (!notificationsOpen && wasNotificationsOpenRef.current) {
      markNotificationsSeen(filteredNotificationItems);
    }

    wasNotificationsOpenRef.current = notificationsOpen;
  }, [filteredNotificationItems, markNotificationsSeen, notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen && !profileMenuOpen) {
      return;
    }

    const closeMenus = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        headerActionsRef.current?.contains(target) ||
        profileMenuRef.current?.contains(target)
      ) {
        return;
      }

      setNotificationsOpen(false);
      setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, [notificationsOpen, profileMenuOpen]);

  useEffect(() => {
    if (!sharePostId) {
      return;
    }

    const closeShareMenu = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest('[data-share-menu="true"]') ||
        target.closest('[data-share-trigger="true"]')
      ) {
        return;
      }

      setSharePostId(null);
    };

    document.addEventListener("mousedown", closeShareMenu);
    return () => document.removeEventListener("mousedown", closeShareMenu);
  }, [sharePostId]);

  useEffect(() => {
    return () => {
      if (shareNoticeTimerRef.current !== null) {
        window.clearTimeout(shareNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!publishNotice) {
      return;
    }

    const timer = window.setTimeout(() => setPublishNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [publishNotice]);

  const openComposer = (mode: ComposerMode = "post") => {
    setError(null);
    setPublishNotice(null);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);
    setStoryComposerOpen(false);
    setComposerImmersiveVideo(false);
    setComposerHotspots([]);
    setComposerMode(mode);
    if (mode === "story") {
      setStoryKind("Photo");
      setComposerVisibleAt("");
    }
    if (mode === "story") {
      setStoryPollQuestion("");
      setStoryPollOptionA("");
      setStoryPollOptionB("");
      setStoryQuestionPrompt("");
      setStoryEmojiChoices([]);
      clearStoryMusicTrack();
    }
    if (mode === "live") {
      setComposerCaption("");
      setComposerFiles([]);
      setComposerVisibleAt("");
      setLiveTitle("");
    }
    setCoAuthorHandle("");
    setStoryFiles([]);
    setComposerOpen(true);
  };

  const openStoryComposer = () => {
    setError(null);
    setPublishNotice(null);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);
    setComposerOpen(false);
    setComposerImmersiveVideo(false);
    setComposerHotspots([]);
    setComposerVisibleAt("");
    setCoAuthorHandle("");
    setStoryKind("Photo");
    setStoryPollQuestion("");
    setStoryPollOptionA("");
    setStoryPollOptionB("");
    setStoryQuestionPrompt("");
    setStoryEmojiChoices([]);
    clearStoryMusicTrack();
    setStoryFiles([]);
    setStoryComposerOpen(true);
  };

  const openChat = () => {
    const params = new URLSearchParams();
    const targetConversationId = conversations[0]?.id ?? null;

    setError(null);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);

    if (targetConversationId) {
      params.set("conversation", targetConversationId);
    }

    router.push(`/messages${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  const openContentView = (view: ContentView) => {
    setError(null);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);
    setContentView(view);
    feedSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const goHome = () => {
    setError(null);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);
    setContentView("posts");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openProfile = (handle: string) => {
    const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
    router.push(`/profile?user=${cleanHandle}`);
  };

  const openLive = (sessionId: string) => {
    setError(null);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);
    router.push(`/live/${sessionId}`);
  };

  const clearUserSearch = () => {
    setUserSearchQuery("");
    setUserSearchResults([]);
    setUserSearchError(null);
  };

  const persistAccounts = (accounts: StoredAccount[]) => {
    setSavedAccounts(accounts);
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  };

  const upsertAccount = (account: StoredAccount) => {
    const next = [...savedAccounts];
    const accountKey = account.handle ?? account.email;
    const index = next.findIndex(
      (item) => (item.handle ?? item.email) === accountKey,
    );

    if (index >= 0) {
      next[index] = { ...next[index], ...account };
    } else {
      next.push(account);
    }

    persistAccounts(next);
  };

  const switchAccount = async () => {
    if (!user) {
      return;
    }

    if (savedAccounts.length < 2) {
      setError("Add another account to switch.");
      return;
    }

    const currentIndex = savedAccounts.findIndex(
      (account) =>
        account.handle === user.handle || account.email === user.email,
    );
    const nextIndex =
      currentIndex >= 0
        ? (currentIndex + 1) % savedAccounts.length
        : 0;
    const nextAccount = savedAccounts[nextIndex];

    if (!nextAccount) {
      return;
    }

    setError(null);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setSharePostId(null);
    setActiveStoryId(null);

    try {
      await req<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout errors; we will attempt to log in anyway.
    }

    try {
      const identifier = nextAccount.handle ?? nextAccount.email;
      const payload = await req<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: identifier,
          password: nextAccount.password,
        }),
      });
      setUser(payload.user);
      setEmail(nextAccount.email);
      setPassword(nextAccount.password);
      const nameParts = (nextAccount.name ?? "").split(" ");
      setAuthFirstName(nameParts[0] ?? "");
      setAuthLastName(nameParts.slice(1).join(" "));
      setAuthUsername(payload.user.handle);
      window.localStorage.setItem(LAST_ACCOUNT_KEY, payload.user.handle);
      goHome();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to switch account.";
      if (message.includes("multiple accounts") && !nextAccount.handle) {
        setError(
          "This saved account needs a username. Sign in with the username and tap Save info.",
        );
      } else {
        setError(message);
      }
    }
  };

  const handleHomePress = () => {
    const now = Date.now();

    if (now - homeClickRef.current < 350) {
      homeClickRef.current = 0;
      void switchAccount();
      return;
    }

    homeClickRef.current = now;
    goHome();
  };

  const handleRememberChoice = (shouldSave: boolean) => {
    if (rememberCandidate) {
      if (shouldSave) {
        upsertAccount({
          name: rememberCandidate.name,
          email: rememberCandidate.email,
          password,
          handle: rememberCandidate.handle,
        });
        window.localStorage.setItem(LAST_ACCOUNT_KEY, rememberCandidate.handle);
      }
      setUser(rememberCandidate);
    }
    setRememberCandidate(null);
    setRememberPromptOpen(false);
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setAuthHint(null);

    try {
      const payload = await req<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setRememberCandidate(payload.user);
      setRememberPromptOpen(true);
      const nameParts = payload.user.name.split(" ");
      setAuthFirstName(nameParts[0] ?? "");
      setAuthLastName(nameParts.slice(1).join(" "));
      setAuthUsername(payload.user.handle);
      window.localStorage.setItem(LAST_ACCOUNT_KEY, payload.user.handle);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      if (message.includes("multiple accounts")) {
        setAuthHint("This email is linked to multiple accounts. Use your username.");
      }
      setError(message);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setAuthHint(null);

    try {
      const payload = await req<{ user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName: authFirstName.trim(),
          lastName: authLastName.trim(),
          handle: authUsername.trim(),
          email: email.trim(),
          password,
        }),
      });
      setRememberCandidate(payload.user);
      setRememberPromptOpen(true);
      const nameParts = payload.user.name.split(" ");
      setAuthFirstName(nameParts[0] ?? "");
      setAuthLastName(nameParts.slice(1).join(" "));
      setAuthUsername(payload.user.handle);
      window.localStorage.setItem(LAST_ACCOUNT_KEY, payload.user.handle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    }
  };

  const logout = async () => {
    try {
      await req<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      setComposerOpen(false);
      setStoryComposerOpen(false);
      setNotificationsOpen(false);
      setProfileMenuOpen(false);
      setCommentsPostId(null);
      setActiveStoryId(null);
      setUser(null);
      setStories([]);
      setPosts([]);
      setSavedPosts([]);
      setLiveSessions([]);
      setConversations([]);
      setComposerMode("post");
      setComposerCaption("");
      setComposerVisibleAt("");
      setCoAuthorHandle("");
      setLiveTitle("");
      setStoryCaption("");
      setComposerFiles([]);
      setStoryFiles([]);
      setStoryKind("Photo");
      setPublishNotice(null);
      setProfileViews([]);
      setFollowingIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    }
  };

  const like = async (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
            ...post,
            liked: !post.liked,
            likes: post.likes + (post.liked ? -1 : 1),
          }
          : post,
      ),
    );

    try {
      const payload = await req<{ liked: boolean; likes: number }>(
        `/api/posts/${postId}/like`,
        { method: "POST" },
      );
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, liked: payload.liked, likes: payload.likes }
            : post,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Like failed");
      await loadData(feedView);
    }
  };

  const voteStoryPoll = async (storyId: string, optionIndex: number) => {
    try {
      const payload = await req<{ story: Story }>(`/api/stories/${storyId}/poll`, {
        method: "POST",
        body: JSON.stringify({ optionIndex }),
      });
      updateStoryInState(payload.story);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to vote on this poll.");
    }
  };

  const answerStoryQuestion = async (storyId: string) => {
    const answer = storyQuestionAnswer.trim();
    if (!answer) {
      setError("Add an answer before submitting.");
      return;
    }
    try {
      const payload = await req<{ story: Story }>(`/api/stories/${storyId}/question`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      });
      updateStoryInState(payload.story);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to answer this question.");
    }
  };

  const toggleStoryReaction = async (storyId: string, emoji: string) => {
    try {
      const payload = await req<{ story: Story }>(`/api/stories/${storyId}/reaction`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      updateStoryInState(payload.story);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to react to this story.");
    }
  };

  const submitStoryReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeStoryId) {
      return;
    }
    const text = storyReplyText.trim();
    if (!text) {
      setError("Write a reply first.");
      return;
    }
    setStoryReplySending(true);
    try {
      const payload = await req<{ story: Story }>(`/api/stories/${activeStoryId}/reply`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      updateStoryInState(payload.story);
      setStoryReplyText("");
      setPublishNotice("Reply sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send reply.");
    } finally {
      setStoryReplySending(false);
    }
  };

  const respondToCollabInvite = async (
    postId: string,
    action: "accept" | "decline",
  ) => {
    try {
      await req<{ postId: string; action: string }>(`/api/posts/${postId}/collab`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setFollowNotifications((current) =>
        current.filter(
          (notification) =>
            !(
              notification.type === "collab_invite" &&
              notification.post?.id === postId
            ),
        ),
      );
      await loadData(feedView);
      if (action === "accept") {
        setPublishNotice("Collab accepted. The post is now on your profile.");
      } else {
        setPublishNotice("Collab invite declined.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update collab invite.");
    }
  };

  const withdrawCollabInvite = async (postId: string) => {
    try {
      await req<{ postId: string; action: string }>(`/api/posts/${postId}/collab`, {
        method: "POST",
        body: JSON.stringify({ action: "withdraw" }),
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, collabInvites: [] } : post,
        ),
      );
      setPublishNotice("Collab invite withdrawn.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw invite.");
    }
  };

  const closeComments = () => {
    if (commentSubmitting) {
      return;
    }

    setCommentsPostId(null);
    setCommentEntries([]);
    setCommentsTotal(0);
    setCommentDraft("");
    setCommentsError(null);
  };

  const openComments = async (postId: string) => {
    setCommentsPostId(postId);
    setCommentsLoading(true);
    setCommentsError(null);
    setCommentEntries([]);
    setCommentDraft("");
    setSharePostId(null);
    setShareNotice(null);

    try {
      const payload = await req<{ comments: CommentEntry[]; total: number }>(
        `/api/posts/${postId}/comments`,
      );
      setCommentEntries(payload.comments);
      setCommentsTotal(payload.total);
    } catch (e) {
      setCommentsError(
        e instanceof Error ? e.message : "Failed to load comments",
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();

    if (!commentsPostId) {
      return;
    }

    const textValue = commentDraft.trim();

    if (!textValue) {
      setCommentsError("Comment cannot be empty.");
      return;
    }

    setCommentSubmitting(true);
    setCommentsError(null);

    try {
      const payload = await req<{ comment: CommentEntry; total: number }>(
        `/api/posts/${commentsPostId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ text: textValue }),
        },
      );

      setCommentEntries((current) => [...current, payload.comment]);
      setCommentsTotal(payload.total);
      setCommentDraft("");
      setPosts((current) =>
        current.map((post) =>
          post.id === commentsPostId
            ? { ...post, comments: payload.total }
            : post,
        ),
      );
    } catch (e) {
      setCommentsError(
        e instanceof Error ? e.message : "Failed to post comment",
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  const showShareNotice = (postId: string, textValue: string) => {
    setShareNotice({ id: postId, text: textValue });

    if (shareNoticeTimerRef.current !== null) {
      window.clearTimeout(shareNoticeTimerRef.current);
    }

    shareNoticeTimerRef.current = window.setTimeout(() => {
      setShareNotice(null);
      shareNoticeTimerRef.current = null;
    }, 2000);
  };

  const trackShare = async (postId: string) => {
    try {
      const payload = await req<{ shares: number }>(`/api/posts/${postId}/share`, {
        method: "POST",
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, shareCount: payload.shares } : post,
        ),
      );
    } catch {
      // Ignore share tracking errors.
    }
  };

  const buildShareUrl = (postId: string) => {
    if (typeof window === "undefined") {
      return `/posts/${postId}`;
    }

    return new URL(`/?post=${postId}`, window.location.origin).toString();
  };

  const copyShareLink = async (postId: string) => {
    const url = buildShareUrl(postId);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      showShareNotice(postId, "Link copied.");
      void trackShare(postId);
    } catch {
      showShareNotice(postId, "Could not copy the link.");
    } finally {
      setSharePostId(null);
    }
  };

  const shareToAccounts = async (post: Post) => {
    const url = buildShareUrl(post.id);

    if (!navigator.share) {
      await copyShareLink(post.id);
      return;
    }

    try {
      await navigator.share({
        title: `${post.author} on Motion`,
        text: post.caption ? post.caption.slice(0, 120) : "Check this out on Motion.",
        url,
      });
      showShareNotice(post.id, "Share sheet opened.");
      void trackShare(post.id);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setSharePostId(null);
        return;
      }
      showShareNotice(post.id, "Could not open share.");
    } finally {
      setSharePostId(null);
    }
  };

  const triggerHeartBurst = (postId: string) => {
    const token = Date.now();

    if (heartBurstTimerRef.current !== null) {
      window.clearTimeout(heartBurstTimerRef.current);
    }

    setHeartBurst({ postId, token });
    heartBurstTimerRef.current = window.setTimeout(() => {
      setHeartBurst((current) =>
        current?.postId === postId && current.token === token ? null : current,
      );
      heartBurstTimerRef.current = null;
    }, 720);
  };

  const handlePostDoubleClick = (post: Post) => {
    triggerHeartBurst(post.id);

    if (!post.liked) {
      void like(post.id);
    }
  };

  const toggleSave = async (postId: string) => {
    try {
      await req<{ saved: boolean }>(`/api/posts/${postId}/save`, {
        method: "POST",
      });
      await loadData(feedView);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vault failed");
    }
  };

  const toggleFollowFromFeed = async (targetUserId: string) => {
    if (!user || targetUserId === user.id) {
      return;
    }

    const wasFollowing = followingSet.has(targetUserId);
    setFollowingIds((current) =>
      wasFollowing
        ? current.filter((id) => id !== targetUserId)
        : [...current, targetUserId],
    );

    try {
      const payload = await req<{ following: boolean }>(
        `/api/follows/${targetUserId}`,
        { method: "POST" },
      );
      setFollowingIds((current) =>
        payload.following
          ? Array.from(new Set([...current, targetUserId]))
          : current.filter((id) => id !== targetUserId),
      );
      await loadData(feedView);
    } catch (e) {
      setFollowingIds((current) =>
        wasFollowing
          ? Array.from(new Set([...current, targetUserId]))
          : current.filter((id) => id !== targetUserId),
      );
      setError(e instanceof Error ? e.message : "Failed to follow user.");
    }
  };

  const reportPost = async (post: Post) => {
    if (!user || post.userId === user.id) {
      return;
    }

    const reason =
      typeof window === "undefined"
        ? ""
        : window.prompt("Why are you reporting this post?", "Spam");

    if (!reason || reason.trim().length < 3) {
      return;
    }

    setError(null);

    try {
      await req<{ ok: boolean }>("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType: "post",
          targetId: post.id,
          targetUserId: post.userId,
          reason: reason.trim(),
        }),
      });
      setPublishNotice("Post reported. Motion added it to the safety queue.");
    } catch (reportError) {
      setError(
        reportError instanceof Error ? reportError.message : "Failed to submit report.",
      );
    }
  };

  const markSeen = async (storyId: string) => {
    setStories((current) =>
      current.map((story) =>
        story.id === storyId ? { ...story, seen: true } : story,
      ),
    );

    try {
      await req<{ seen: boolean }>(`/api/stories/${storyId}/seen`, { method: "POST" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark move");
    }
  };

  const openStory = (storyId: string) => {
    setError(null);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setCommentsPostId(null);
    setActiveStoryId(storyId);
    void markSeen(storyId);
  };

  const openConversationFromNotification = useCallback((conversationId: string) => {
    const params = new URLSearchParams();
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
    setComposerOpen(false);
    setStoryComposerOpen(false);
    params.set("conversation", conversationId);
    params.set("tab", "calls");
    params.set("direction", "missed");
    router.push(`/messages?${params.toString()}`);
  }, [router]);

  const handleNotificationAction = async (
    notification: Pick<NotificationEntry, "action" | "sourceIds">,
  ) => {
    markNotificationsSeen([notification as NotificationEntry]);
    const action = notification.action;

    if (!action) {
      return;
    }

    if (action.kind === "open_conversation") {
      openConversationFromNotification(action.conversationId);
      return;
    }

    if (action.kind === "open_profile") {
      openProfile(action.handle);
      return;
    }

    if (action.kind === "open_comments") {
      await openComments(action.postId);
      return;
    }

    if (action.kind === "open_story") {
      openStory(action.storyId);
    }
  };

  const closeStory = () => {
    stopStoryAudio();
    setActiveStoryId(null);
  };

  const uploadSelectedMedia = async (
    file: File,
    kind?: PostKind,
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    if (kind) {
      formData.append("kind", kind);
    }

    return req<UploadResponse>("/api/media/upload", {
      method: "POST",
      body: formData,
    });
  };

  const uploadOnboardingAvatar = async (file: File) => {
    setOnboardingAvatarUploading(true);
    setOnboardingError(null);

    try {
      const payload = await uploadSelectedMedia(file, "Photo");
      setOnboardingAvatarUrl(payload.mediaUrl);
    } catch (e) {
      setOnboardingError(
        e instanceof Error ? e.message : "Unable to upload your profile photo.",
      );
    } finally {
      setOnboardingAvatarUploading(false);
    }
  };

  const closeOnboarding = () => {
    setOnboardingOpen(false);
    setOnboardingError(null);
    setOnboardingStep(1);
    setOnboardingDismissed(true);
    if (onboardingDismissStorageKey) {
      window.localStorage.setItem(onboardingDismissStorageKey, "1");
    }
  };

  const completeOnboarding = async () => {
    if (!user) {
      return;
    }

    if (onboardingInterests.length === 0) {
      setOnboardingError("Pick at least one interest before finishing setup.");
      setOnboardingStep(1);
      return;
    }

    setOnboardingSaving(true);
    setOnboardingError(null);

    try {
      const payload = await req<{ user: User; followingIds: string[] }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          interests: onboardingInterests,
          followUserIds: onboardingSelectedFollowIds,
          bio: onboardingBio.trim(),
          avatarUrl: onboardingAvatarUrl,
        }),
      });

      setUser(payload.user);
      setFollowingIds(payload.followingIds ?? []);
      setOnboardingOpen(false);
      setOnboardingDismissed(false);
      setOnboardingStep(1);
      setPublishNotice("Welcome to Motion. Your flow is ready.");
      if (onboardingDismissStorageKey) {
        window.localStorage.removeItem(onboardingDismissStorageKey);
      }
      await loadData(feedView);
    } catch (e) {
      setOnboardingError(
        e instanceof Error ? e.message : "Unable to finish onboarding.",
      );
    } finally {
      setOnboardingSaving(false);
    }
  };

  const mergeFiles = (current: File[], incoming: File[]) => {
    const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
    const merged = [...current];
    for (const file of incoming) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(file);
      }
    }
    return merged;
  };

  const addComposerFiles = (fileList: FileList | null) => {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) {
      return;
    }
    setComposerFiles((current) => {
      const merged = mergeFiles(current, incoming);
      if (!merged.some((file) => file.type.startsWith("video/"))) {
        setComposerImmersiveVideo(false);
        setComposerHotspots([]);
      }
      return merged;
    });
  };

  const addComposerHotspot = () => {
    setComposerHotspots((current) =>
      current.length >= 4 ? current : [...current, createComposerHotspot()],
    );
  };

  const updateComposerHotspot = (
    hotspotId: string,
    patch: Partial<ComposerHotspot>,
  ) => {
    setComposerHotspots((current) =>
      current.map((hotspot) =>
        hotspot.id === hotspotId
          ? {
              ...hotspot,
              ...patch,
            }
          : hotspot,
      ),
    );
  };

  const removeComposerHotspot = (hotspotId: string) => {
    setComposerHotspots((current) =>
      current.filter((hotspot) => hotspot.id !== hotspotId),
    );
  };

  const addStoryFiles = (fileList: FileList | null) => {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) {
      return;
    }
    setStoryFiles((current) => mergeFiles(current, incoming));
  };

  const buildStoryStickers = () => {
    const pollQuestion = storyPollQuestion.trim();
    const pollOptionA = storyPollOptionA.trim();
    const pollOptionB = storyPollOptionB.trim();
    const poll =
      pollQuestion && pollOptionA && pollOptionB
        ? {
            question: pollQuestion,
            options: [pollOptionA, pollOptionB],
          }
        : undefined;
    const questionPrompt = storyQuestionPrompt.trim();
    const question = questionPrompt ? { prompt: questionPrompt } : undefined;
    const emojiReactions = storyEmojiChoices.length > 0 ? storyEmojiChoices : undefined;
    const music = storyMusicTrack
      ? {
          id: storyMusicTrack.id,
          title: storyMusicTrack.title,
          artist: storyMusicTrack.artist,
          url: storyMusicTrack.url,
          duration: storyMusicTrack.duration,
        }
      : undefined;
    return { poll, question, emojiReactions, music };
  };

  const toggleStoryEmojiChoice = (emoji: string) => {
    setStoryEmojiChoices((current) => {
      if (current.includes(emoji)) {
        return current.filter((entry) => entry !== emoji);
      }
      const next = [...current, emoji];
      return next.slice(0, 4);
    });
  };

  const stopMusicPreview = () => {
    if (musicPreviewRef.current) {
      musicPreviewRef.current.pause();
      musicPreviewRef.current.currentTime = 0;
    }
    setMusicPreviewId(null);
  };

  const toggleMusicPreview = (track: MusicTrack) => {
    if (!musicPreviewRef.current) {
      musicPreviewRef.current = new Audio();
    }
    const audio = musicPreviewRef.current;

    if (musicPreviewId === track.id) {
      if (audio.paused) {
        const playResult = audio.play();
        if (playResult && typeof playResult.then === "function") {
          playResult
            .then(() => setMusicPreviewId(track.id))
            .catch(() => setMusicPreviewId(null));
        } else {
          setMusicPreviewId(track.id);
        }
      } else {
        audio.pause();
        setMusicPreviewId(null);
      }
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = track.url;
    audio.onended = () => {
      setMusicPreviewId((current) => (current === track.id ? null : current));
    };
    void audio.play()
      .then(() => setMusicPreviewId(track.id))
      .catch(() => setMusicPreviewId(null));
  };

  const selectStoryMusicTrack = (track: MusicTrack) => {
    setStoryMusicTrack(track);
    setStoryMusicQuery("");
    setStoryMusicResults([]);
    setStoryMusicError(null);
    stopMusicPreview();
  };

  const clearStoryMusicTrack = () => {
    setStoryMusicTrack(null);
    setStoryMusicQuery("");
    setStoryMusicResults([]);
    setStoryMusicError(null);
    setStoryMusicLoading(false);
    stopMusicPreview();
  };

  const stopStoryAudio = () => {
    if (storyAudioRef.current) {
      storyAudioRef.current.pause();
      storyAudioRef.current.currentTime = 0;
    }
    setStoryAudioPlaying(false);
  };

  const toggleStoryAudio = () => {
    if (!storyAudioRef.current) {
      return;
    }
    if (storyAudioRef.current.paused) {
      const playResult = storyAudioRef.current.play();
      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => setStoryAudioPlaying(true))
          .catch(() => setStoryAudioPlaying(false));
      } else {
        setStoryAudioPlaying(true);
      }
    } else {
      storyAudioRef.current.pause();
      setStoryAudioPlaying(false);
    }
  };

  const renderStoryMusicPicker = () => (
    <div>
      <label className="text-xs font-semibold text-slate-700">Music</label>
      {storyMusicTrack ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              {storyMusicTrack.title}
            </p>
            <p className="text-[11px] text-slate-500">
              {storyMusicTrack.artist} -{" "}
              {formatTrackDuration(storyMusicTrack.duration)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleMusicPreview(storyMusicTrack)}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-slate-600"
            >
              {musicPreviewId === storyMusicTrack.id ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={clearStoryMusicTrack}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-slate-500"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
        <input
          value={storyMusicQuery}
          onChange={(e) => setStoryMusicQuery(e.target.value)}
          placeholder="Search tracks"
          className="h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-xs"
        />
        {!storyMusicQuery.trim() ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Type to search tracks.
          </p>
        ) : storyMusicLoading ? (
          <p className="mt-2 text-[11px] text-slate-500">Searching...</p>
        ) : storyMusicError ? (
          <p className="mt-2 text-[11px] text-rose-600">{storyMusicError}</p>
        ) : storyMusicResults.length > 0 ? (
          <div className="mt-2 space-y-2">
            {storyMusicResults.map((track) => (
              <div
                key={track.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3 py-2"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    {track.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {track.artist} - {formatTrackDuration(track.duration)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleMusicPreview(track)}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-slate-600"
                  >
                    {musicPreviewId === track.id ? "Pause" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectStoryMusicTrack(track)}
                    className="rounded-full bg-[var(--brand)] px-3 py-1 text-[11px] font-semibold text-white"
                  >
                    Use
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500">
            No matches yet.
          </p>
        )}
      </div>
    </div>
  );

  const createStory = async ({
    caption,
    media,
    poll,
    question,
    emojiReactions,
    music,
  }: {
    caption?: string;
    media?: MediaItem[];
    poll?: { question: string; options: string[] };
    question?: { prompt: string };
    emojiReactions?: string[];
    music?: {
      id?: string;
      title: string;
      artist?: string;
      url?: string;
      duration?: number;
    };
  }) => {
    await req<{ story: Story }>("/api/stories", {
      method: "POST",
      body: JSON.stringify({ caption, media, poll, question, emojiReactions, music }),
    });
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();

    const storyStickerPayload =
      composerMode === "story" ? buildStoryStickers() : null;
    const hasStoryStickers = Boolean(
      storyStickerPayload &&
      (storyStickerPayload.poll ||
        storyStickerPayload.question ||
        (storyStickerPayload.emojiReactions?.length ?? 0) > 0 ||
        storyStickerPayload.music),
    );

    if ((composerMode === "post" || composerMode === "reel") && !composerCaption.trim()) {
      setError("Caption is required.");
      return;
    }

    if (
      composerMode === "story" &&
      !composerCaption.trim() &&
      composerFiles.length === 0 &&
      !hasStoryStickers
    ) {
      setError("Add a move caption or upload a photo/video.");
      return;
    }

    const scheduledReleaseAt =
      (composerMode === "post" || composerMode === "reel") && composerVisibleAt
        ? new Date(composerVisibleAt).getTime()
        : null;

    if ((composerMode === "post" || composerMode === "reel") && composerVisibleAt) {
      if (scheduledReleaseAt === null || Number.isNaN(scheduledReleaseAt)) {
        setError("Choose a valid future date for the time capsule.");
        return;
      }

      if (scheduledReleaseAt <= Date.now()) {
        setError("Time capsule posts must open in the future.");
        return;
      }
    }

    const preparedHotspots = composerHotspots
      .map((hotspot) => ({
        ...hotspot,
        title: hotspot.title.trim(),
        detail: hotspot.detail.trim(),
      }))
      .filter((hotspot) => hotspot.title.length > 0)
      .map((hotspot) => ({
        id: hotspot.id,
        title: hotspot.title,
        detail: hotspot.detail || undefined,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
      }));

    if (composerImmersiveVideo) {
      const videoFiles =
        composerMode === "reel"
          ? composerFiles.slice(0, 1).filter((file) => file.type.startsWith("video/"))
          : composerFiles.filter((file) => file.type.startsWith("video/"));

      if (videoFiles.length !== 1 || composerFiles.some((file) => !file.type.startsWith("video/"))) {
        setError("360 immersive posts currently support one video clip at a time.");
        return;
      }
    }

    setPublishing(true);
    setError(null);
    setPublishNotice(null);

    try {
      if (composerMode === "live") {
        const payload = await req<{ session: LiveSessionSummary }>("/api/live", {
          method: "POST",
          body: JSON.stringify({
            title: liveTitle.trim() || undefined,
          }),
        });

        setLiveSessions((current) => [
          payload.session,
          ...current.filter((session) => session.id !== payload.session.id),
        ]);
        setComposerCaption("");
        setComposerMode("post");
        setComposerFiles([]);
        setComposerVisibleAt("");
        setCoAuthorHandle("");
        setComposerInterests([]);
        setComposerImmersiveVideo(false);
        setComposerHotspots([]);
        setLiveTitle("");
        setComposerOpen(false);
        router.push(`/live/${payload.session.id}`);
        return;
      }

      if (composerMode === "story") {
        const stickers = storyStickerPayload ?? buildStoryStickers();
        const media =
          composerFiles.length > 0
            ? (await Promise.all(
              composerFiles.map((file) => uploadSelectedMedia(file, storyKind)),
            )).map((uploaded) => ({
              url: uploaded.mediaUrl,
              type: uploaded.mediaType,
            }))
            : undefined;
        await createStory({
          caption: composerCaption.trim() || undefined,
          media,
          ...stickers,
        });
        setComposerCaption("");
        setComposerMode("post");
        setComposerFiles([]);
        setComposerVisibleAt("");
        setStoryKind("Photo");
        setStoryPollQuestion("");
        setStoryPollOptionA("");
        setStoryPollOptionB("");
        setStoryQuestionPrompt("");
        setStoryEmojiChoices([]);
        clearStoryMusicTrack();
        setCoAuthorHandle("");
        setComposerInterests([]);
        setComposerImmersiveVideo(false);
        setComposerHotspots([]);
        setComposerOpen(false);
        await loadData(feedView);
        return;
      }

      const postKind: PostKind = composerMode === "reel" ? "Reel" : "Photo";
      const filesToUpload =
        composerMode === "reel" ? composerFiles.slice(0, 1) : composerFiles;
      const media =
        filesToUpload.length > 0
          ? (await Promise.all(
            filesToUpload.map((file) => {
              const expectedKind =
                composerMode === "post"
                  ? file.type.startsWith("video/")
                    ? "Reel"
                    : "Photo"
                  : postKind;
              return uploadSelectedMedia(file, expectedKind);
            }),
          )).map((uploaded) => ({
            url: uploaded.mediaUrl,
            type: uploaded.mediaType,
            immersive: composerImmersiveVideo && uploaded.mediaType === "video",
            hotspots:
              composerImmersiveVideo && uploaded.mediaType === "video" && preparedHotspots.length > 0
                ? preparedHotspots
                : undefined,
          }))
          : undefined;
      await req<{ post: Post }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          caption: composerCaption.trim(),
          kind: postKind,
          location: DEFAULT_POST_LOCATION,
          scope: feedView,
          media,
          coAuthorHandle: coAuthorHandle.trim() || undefined,
          interests: composerInterests,
          visibleAt:
            scheduledReleaseAt != null
              ? new Date(scheduledReleaseAt).toISOString()
              : undefined,
        }),
      });

      setComposerCaption("");
      setComposerMode("post");
        setComposerFiles([]);
        setComposerVisibleAt("");
        setCoAuthorHandle("");
        setComposerInterests([]);
        setComposerImmersiveVideo(false);
        setComposerHotspots([]);
        setLiveTitle("");
        setComposerOpen(false);
      await loadData(feedView);
      if (scheduledReleaseAt != null) {
        setPublishNotice(
          `Time capsule scheduled. It opens ${formatCapsuleDate(scheduledReleaseAt)}.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const publishStory = async (event: FormEvent) => {
    event.preventDefault();

    const stickerPayload = buildStoryStickers();
    const hasStoryStickers = Boolean(
      stickerPayload.poll ||
        stickerPayload.question ||
        (stickerPayload.emojiReactions?.length ?? 0) > 0 ||
        stickerPayload.music,
    );

    if (!storyCaption.trim() && storyFiles.length === 0 && !hasStoryStickers) {
      setError("Upload a photo/video or add a move caption.");
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const stickers = stickerPayload;
      const media =
        storyFiles.length > 0
          ? (await Promise.all(
            storyFiles.map((file) => uploadSelectedMedia(file, storyKind)),
          )).map((uploaded) => ({
            url: uploaded.mediaUrl,
            type: uploaded.mediaType,
          }))
          : undefined;
      await createStory({
        caption: storyCaption.trim() || undefined,
        media,
        ...stickers,
      });
      setStoryCaption("");
      setStoryFiles([]);
      setStoryKind("Photo");
      setStoryPollQuestion("");
      setStoryPollOptionA("");
      setStoryPollOptionB("");
      setStoryQuestionPrompt("");
      setStoryEmojiChoices([]);
      clearStoryMusicTrack();
      setStoryComposerOpen(false);
      await loadData(feedView);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const closeComposerOverlay = () => {
    setComposerOpen(false);
    setComposerMode("post");
    setComposerFiles([]);
    setComposerImmersiveVideo(false);
    setComposerHotspots([]);
    setComposerVisibleAt("");
    setCoAuthorHandle("");
    setLiveTitle("");
    setStoryKind("Photo");
    setStoryPollQuestion("");
    setStoryPollOptionA("");
    setStoryPollOptionB("");
    setStoryQuestionPrompt("");
    setStoryEmojiChoices([]);
    clearStoryMusicTrack();
  };

  const handleComposerModeChange = (mode: ComposerMode) => {
    setComposerMode(mode);
    setComposerFiles([]);
    setComposerImmersiveVideo(false);
    setComposerHotspots([]);

    if (mode === "story") {
      setComposerVisibleAt("");
      setCoAuthorHandle("");
      setStoryKind("Photo");
    }

    if (mode === "live") {
      setComposerVisibleAt("");
      setCoAuthorHandle("");
      setComposerCaption("");
      setLiveTitle("");
    }
  };

  const closeStoryComposerOverlay = () => {
    setStoryComposerOpen(false);
    setStoryFiles([]);
    setStoryKind("Photo");
    setStoryPollQuestion("");
    setStoryPollOptionA("");
    setStoryPollOptionB("");
    setStoryQuestionPrompt("");
    setStoryEmojiChoices([]);
    clearStoryMusicTrack();
  };

  if (loading) {
    return (
      <div className="motion-shell min-h-screen p-8">
        Loading Motion...
        <SupportWidget defaultEmail="" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="motion-shell auth-shell min-h-screen">
        <AuthScreen
          themePicker={<ThemePicker selectedTheme={themeSelection} onThemeChange={setThemeSelection} />}
          authMode={authMode}
          authFirstName={authFirstName}
          authLastName={authLastName}
          authUsername={authUsername}
          email={email}
          password={password}
          authHint={authHint}
          error={error}
          rememberPromptOpen={rememberPromptOpen}
          rememberCandidate={rememberCandidate}
          onSubmit={authMode === "signup" ? register : login}
          onChangeAuthMode={setAuthMode}
          onChangeFirstName={setAuthFirstName}
          onChangeLastName={setAuthLastName}
          onChangeUsername={setAuthUsername}
          onChangeEmail={setEmail}
          onChangePassword={setPassword}
          onRememberChoice={handleRememberChoice}
          onClearFeedback={() => {
            setError(null);
            setAuthHint(null);
          }}
        />
        <SupportWidget defaultEmail={email} />
      </div>
    );
  }

  return (
    <div className="motion-shell min-h-screen" data-viewport={viewportMode}>
      <div className="motion-viewport">
        <main className="w-full px-4 pb-20 pt-6">
          <header className="motion-surface relative z-50 flex flex-wrap items-center justify-between gap-3 overflow-visible px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-bold text-white">
                MO
              </div>
              <p className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-heading)" }}>
                Motion
              </p>
            </div>
            <div className="relative z-40 flex flex-wrap items-center justify-end gap-2">
              <ViewportPicker mode={viewportMode} onChange={setViewportMode} />
              <button
                onClick={() => openComposer()}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-lg font-semibold text-slate-700"
                type="button"
                aria-label="Create"
                title="Create"
              >
                +
              </button>
              <div ref={profileMenuRef} className="relative z-40">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setProfileMenuOpen((current) => !current);
                  }}
                  className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-[var(--line)] text-xs font-bold text-white"
                  aria-label="Open profile menu"
                  title="Profile"
                >
                  <UserAvatar
                    name={user.name}
                    avatarGradient={user.avatarGradient}
                    avatarUrl={user.avatarUrl}
                    className="h-full w-full text-xs font-bold"
                    textClassName="text-xs font-bold text-white"
                    sizes="40px"
                  >
                    {isUserLive ? <span className="avatar-live-badge">LIVE</span> : null}
                  </UserAvatar>
                </button>
                {profileMenuOpen ? (
                  <div className="motion-surface header-popover min-w-52 p-2">
                    <div className="rounded-xl bg-white/80 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">@{user.handle}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        router.push("/profile");
                      }}
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700"
                      type="button"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        router.push("/profile?tab=saved");
                      }}
                      className="mt-2 flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      type="button"
                    >
                      <span>Vault</span>
                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px]">
                        {savedPosts.length}
                      </span>
                    </button>
                    <button
                      onClick={logout}
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      type="button"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <CreateContentModal
            open={composerOpen}
            publishing={publishing}
            composerMode={composerMode}
            composerCaption={composerCaption}
            liveTitle={liveTitle}
            coAuthorHandle={coAuthorHandle}
            composerVisibleAt={composerVisibleAt}
            composerInterests={composerInterests}
            composerImmersiveVideo={composerImmersiveVideo}
            composerHotspots={composerHotspots}
            interestOptions={INTEREST_OPTIONS}
            composerFilesCount={composerFiles.length}
            composerCaptionRef={composerCaptionRef}
            composerInputRef={composerInputRef}
            capsuleMinValue={capsuleMinValue}
            error={error}
            userAvatarGradient={user.avatarGradient}
            storyKind={storyKind}
            storyPollQuestion={storyPollQuestion}
            storyPollOptionA={storyPollOptionA}
            storyPollOptionB={storyPollOptionB}
            storyQuestionPrompt={storyQuestionPrompt}
            storyEmojiChoices={storyEmojiChoices}
            storyEmojiOptions={STORY_EMOJI_OPTIONS}
            storyMusicPicker={renderStoryMusicPicker()}
            formatCapsuleDate={formatCapsuleDate}
            onClose={closeComposerOverlay}
            onSubmit={publish}
            onModeChange={handleComposerModeChange}
            onCaptionChange={setComposerCaption}
            onLiveTitleChange={setLiveTitle}
            onCoAuthorHandleChange={setCoAuthorHandle}
            onVisibleAtChange={setComposerVisibleAt}
            onToggleInterest={(interestId) =>
              setComposerInterests((current) =>
                current.includes(interestId)
                  ? current.filter((item) => item !== interestId)
                  : [...current, interestId],
              )
            }
            onComposerImmersiveVideoChange={(next) => {
              setComposerImmersiveVideo(next);
              if (!next) {
                setComposerHotspots([]);
              }
            }}
            onAddComposerHotspot={addComposerHotspot}
            onUpdateComposerHotspot={updateComposerHotspot}
            onRemoveComposerHotspot={removeComposerHotspot}
            onStoryKindChange={(kind) => {
              setStoryKind(kind);
              setComposerFiles([]);
              setComposerImmersiveVideo(false);
            }}
            onComposerFilesSelected={addComposerFiles}
            onStoryPollQuestionChange={setStoryPollQuestion}
            onStoryPollOptionAChange={setStoryPollOptionA}
            onStoryPollOptionBChange={setStoryPollOptionB}
            onStoryQuestionPromptChange={setStoryQuestionPrompt}
            onToggleStoryEmojiChoice={toggleStoryEmojiChoice}
          />

          <MoveComposerModal
            open={storyComposerOpen}
            publishing={publishing}
            storyCaption={storyCaption}
            storyKind={storyKind}
            storyFilesCount={storyFiles.length}
            storyCaptionRef={storyCaptionRef}
            storyInputRef={storyInputRef}
            userAvatarGradient={user.avatarGradient}
            error={error}
            storyPollQuestion={storyPollQuestion}
            storyPollOptionA={storyPollOptionA}
            storyPollOptionB={storyPollOptionB}
            storyQuestionPrompt={storyQuestionPrompt}
            storyEmojiChoices={storyEmojiChoices}
            storyEmojiOptions={STORY_EMOJI_OPTIONS}
            storyMusicPicker={renderStoryMusicPicker()}
            onClose={closeStoryComposerOverlay}
            onSubmit={publishStory}
            onStoryCaptionChange={setStoryCaption}
            onStoryKindChange={(kind) => {
              setStoryKind(kind);
              setStoryFiles([]);
            }}
            onStoryFilesSelected={addStoryFiles}
            onStoryPollQuestionChange={setStoryPollQuestion}
            onStoryPollOptionAChange={setStoryPollOptionA}
            onStoryPollOptionBChange={setStoryPollOptionB}
            onStoryQuestionPromptChange={setStoryQuestionPrompt}
            onToggleStoryEmojiChoice={toggleStoryEmojiChoice}
          />
          {activeStory ? (
            <div
              className="fixed inset-0 z-[91] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-sm"
              onClick={closeStory}
            >
              <section
                className="motion-surface w-full max-w-lg p-5"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Move"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      className="text-xl font-semibold text-slate-900"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {activeStory.name}&apos;s Move
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeStory.minutesLeft}m left
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeStory}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white text-slate-500"
                    aria-label="Close move"
                  >
                    x
                  </button>
                </div>

                <div className="mt-4">
                  {activeStoryMedia.length > 0 ? (
                    <MediaCarousel
                      key={activeStory.id}
                      media={activeStoryMedia}
                      className="h-72 w-full rounded-2xl"
                    />
                  ) : (
                    <div
                      className="h-72 w-full rounded-2xl"
                      style={{ background: activeStory.gradient }}
                    />
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  {activeStory.caption ? (
                    <p className="text-sm text-slate-700">{activeStory.caption}</p>
                  ) : null}

                  {activeStory.music ? (
                    <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Music
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {activeStory.music.title}
                          </p>
                          {activeStory.music.artist || activeStory.music.duration ? (
                            <p className="text-[11px] text-slate-500">
                              {activeStory.music.artist ?? "Motion Lab"}
                              {activeStory.music.duration
                                ? ` - ${formatTrackDuration(activeStory.music.duration)}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                        {activeStory.music.url ? (
                          <button
                            type="button"
                            onClick={toggleStoryAudio}
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-slate-600"
                          >
                            {storyAudioPlaying ? "Pause" : "Play"}
                          </button>
                        ) : null}
                      </div>
                      {activeStory.music.url ? (
                        <audio
                          ref={storyAudioRef}
                          src={activeStory.music.url}
                          preload="metadata"
                          onEnded={() => setStoryAudioPlaying(false)}
                          className="hidden"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {activeStory.poll ? (
                    <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Poll
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {activeStory.poll.question}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {activeStory.poll.options.map((option, index) => {
                          const totalVotes = activeStory.poll?.counts.reduce(
                            (sum, count) => sum + count,
                            0,
                          ) ?? 0;
                          const votes = activeStory.poll?.counts[index] ?? 0;
                          const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          const isSelected = activeStory.poll?.myVote === index;
                          return (
                            <button
                              key={`${activeStory.id}-poll-${index}`}
                              type="button"
                              onClick={() => voteStoryPoll(activeStory.id, index)}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                                isSelected
                                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                                  : "border-[var(--line)] bg-white text-slate-700 hover:border-[var(--brand)]"
                              }`}
                            >
                              <span>{option}</span>
                              <span>{percent}%</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {activeStory.question ? (
                    <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Question
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {activeStory.question.prompt}
                      </p>
                      {user?.id === activeStory.ownerId ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {activeStory.question.totalAnswers} responses so far.
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            value={storyQuestionAnswer}
                            onChange={(e) => setStoryQuestionAnswer(e.target.value)}
                            className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                            placeholder="Write your answer..."
                          />
                          <button
                            type="button"
                            onClick={() => answerStoryQuestion(activeStory.id)}
                            className="h-10 rounded-xl bg-[var(--brand)] px-4 text-xs font-semibold text-white"
                          >
                            {activeStory.question.myAnswer ? "Update" : "Send"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeStory.emojiReactions && activeStory.emojiReactions.length > 0 ? (
                    <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Reactions
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeStory.emojiReactions.map((reaction) => (
                          <button
                            key={`${activeStory.id}-${reaction.emoji}`}
                            type="button"
                            onClick={() => toggleStoryReaction(activeStory.id, reaction.emoji)}
                            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              reaction.reacted
                                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                                : "border-[var(--line)] bg-white text-slate-700"
                            }`}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {user?.id === activeStory.ownerId ? (
                    <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Replies
                      </p>
                      {activeStory.replies?.latest && activeStory.replies.latest.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {activeStory.replies.latest.map((reply) => (
                            <div key={reply.id} className="rounded-xl border border-[var(--line)] px-3 py-2">
                              <p className="text-xs font-semibold text-slate-700">
                                {reply.author} <span className="text-[10px] text-slate-500">{reply.time}</span>
                              </p>
                              <p className="text-xs text-slate-600">{reply.text}</p>
                            </div>
                          ))}
                          <p className="text-[11px] text-slate-500">
                            {activeStory.replies.total} replies total.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No replies yet.</p>
                      )}
                    </div>
                  ) : null}

                  {user && user.id !== activeStory.ownerId ? (
                    <form onSubmit={submitStoryReply} className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Reply
                      </p>
                      <textarea
                        value={storyReplyText}
                        onChange={(e) => setStoryReplyText(e.target.value)}
                        className="mt-2 min-h-20 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        placeholder={`Reply to ${activeStory.name}...`}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={storyReplySending}
                          className="h-9 rounded-xl bg-[var(--brand)] px-4 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {storyReplySending ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {commentsPostId ? (
            <div
              className="fixed inset-0 z-[92] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-sm"
              onClick={closeComments}
            >
              <section
                className="motion-surface w-full max-w-2xl p-5"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Comments"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      className="text-xl font-semibold text-slate-900"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Comments
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {activeCommentsPost
                        ? `${activeCommentsPost.author} · ${commentsTotal} comments`
                        : `${commentsTotal} comments`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeComments}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white text-slate-500"
                    aria-label="Close comments"
                    disabled={commentSubmitting}
                  >
                    x
                  </button>
                </div>

                {activeCommentsPost ? (
                  <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {activeCommentsPost.author}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      <CaptionWithHashtags caption={activeCommentsPost.caption} />
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                  {commentsLoading ? (
                    <p className="rounded-2xl border border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                      Loading comments...
                    </p>
                  ) : commentEntries.length > 0 ? (
                    <>
                      {commentEntries.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                              style={{ background: comment.avatarGradient }}
                            >
                              {comment.author
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  {comment.author}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {comment.handle}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {comment.time}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">
                                {comment.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {commentsTotal > commentEntries.length ? (
                        <p className="px-1 text-xs text-slate-500">
                          Showing {commentEntries.length} visible comments.{" "}
                          {commentsTotal - commentEntries.length} older comments are not
                          loaded in this preview.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="rounded-2xl border border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                      No comments yet. Start the conversation.
                    </p>
                  )}
                </div>

                <form onSubmit={submitComment} className="mt-4 space-y-3">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                    placeholder="Write a comment..."
                    maxLength={280}
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        {commentDraft.trim().length}/280
                      </p>
                      {commentsError ? (
                        <p className="mt-1 text-xs text-red-700">{commentsError}</p>
                      ) : null}
                    </div>
                    <button
                      type="submit"
                      disabled={commentSubmitting || commentsLoading}
                      className="h-10 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {commentSubmitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}

          {error && !composerOpen && !storyComposerOpen && !commentsPostId ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {publishNotice && !composerOpen && !storyComposerOpen && !commentsPostId ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {publishNotice}
            </p>
          ) : null}

          <div className="motion-layout-grid mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_280px]">
            <aside className="motion-surface motion-sidebar hidden self-start p-4 md:flex md:flex-col">
              <div className="mb-4 flex items-center gap-3">
                <UserAvatar
                  name={user.name}
                  avatarGradient={user.avatarGradient}
                  avatarUrl={user.avatarUrl}
                  className="h-11 w-11 text-xs font-bold"
                  textClassName="text-xs font-bold text-white"
                  sizes="44px"
                />
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-slate-500">@{user.handle}</p>
                </div>
              </div>
              {["Home", "Reels", "Messages", "Explore", "Random"].map((item) => (
                item === "Home" ? (
                  <button
                    key={item}
                    type="button"
                    onClick={handleHomePress}
                    className="nav-item mb-2 w-full text-left text-sm"
                    aria-pressed={contentView === "posts"}
                  >
                    {item}
                  </button>
                ) : item === "Messages" ? (
                  <button
                    key={item}
                    type="button"
                    onClick={openChat}
                    className="nav-item mb-2 w-full text-left text-sm"
                  >
                    {item}
                    {missedCallsTotal > 0
                      ? ` (${missedCallsTotal} missed)`
                      : unread > 0
                        ? ` (${unread})`
                        : ""}
                  </button>
                ) : item === "Reels" ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => router.push("/reels")}
                    className="nav-item mb-2 w-full text-left text-sm"
                    aria-label="Open reels page"
                  >
                    {item}
                  </button>
                ) : item === "Explore" ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => router.push("/explore")}
                    className="nav-item mb-2 w-full text-left text-sm"
                    aria-label="Open explore page"
                  >
                    {item}
                  </button>
                ) : item === "Random" ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => router.push("/random")}
                    className="nav-item mb-2 w-full text-left text-sm"
                    aria-label="Open random chat page"
                  >
                    {item}
                  </button>
                ) : (
                  <div key={item} className="nav-item mb-2 text-sm">
                    {item}
                  </div>
                )
              ))}
            </aside>

            <section className="motion-main space-y-5">
              {showOnboardingBanner ? (
                <OnboardingBanner
                  showProfilePrompt={profileNeedsWork}
                  followsCount={followingIds.length}
                  selectedInterestsCount={user.interests?.length ?? 0}
                  onOpen={() => {
                    setOnboardingDismissed(false);
                    if (onboardingDismissStorageKey) {
                      window.localStorage.removeItem(onboardingDismissStorageKey);
                    }
                    setOnboardingOpen(true);
                    setOnboardingError(null);
                  }}
                />
              ) : null}

              <section className="motion-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Moves</h2>
                    <p className="text-[11px] text-slate-500">Photo/video · 24h only</p>
                  </div>
                  <span className="text-xs text-slate-500">Disappear in 24h</span>
                </div>
                <div className="story-strip">
                  <button
                    className="story-button is-own-story"
                    onClick={openStoryComposer}
                    type="button"
                  >
                    <span className="story-frame">
                      <UserAvatar
                        name={user.name}
                        avatarGradient={user.avatarGradient}
                        avatarUrl={user.avatarUrl}
                        className="story-avatar"
                        sizes="72px"
                      >
                        {isUserLive ? <span className="live-badge">LIVE</span> : null}
                        <span className="story-avatar-badge">+</span>
                      </UserAvatar>
                    </span>
                    <span className="text-xs font-semibold">Your Move</span>
                    <span className="text-[11px] text-slate-500">Add now</span>
                  </button>
                  {stories.map((story) => {
                    const liveSession = liveSessionByHost.get(story.ownerId);
                    return (
                      <button
                        key={story.id}
                        data-seen={story.seen}
                        onClick={() =>
                          liveSession ? openLive(liveSession.id) : openStory(story.id)
                        }
                        className="story-button"
                        type="button"
                        title={story.caption || `${story.name}'s move`}
                      >
                        <span className="story-frame">
                          <StoryAvatarContent story={story} isLive={Boolean(liveSession)} />
                        </span>
                        <span className="text-xs font-semibold">{story.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {liveSession
                            ? "Live now"
                            : story.seen
                              ? "Seen"
                              : `${story.minutesLeft}m left`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section ref={feedSectionRef} className="motion-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
                    <button
                      className={`rounded-full px-3 py-1 text-sm ${contentView === "posts" ? "bg-[var(--brand)] text-white" : ""
                        }`}
                      onClick={() => openContentView("posts")}
                      type="button"
                    >
                      Posts
                    </button>
                    <button
                      className={`rounded-full px-3 py-1 text-sm ${contentView === "reels" ? "bg-[var(--brand)] text-white" : ""
                        }`}
                      onClick={() => openContentView("reels")}
                      type="button"
                    >
                      Reels
                    </button>
                  </div>
                  <span className="text-xs text-slate-500">
                    {visiblePosts.length} {contentView === "posts" ? "Posts" : "Reels"}
                  </span>
                </div>

                <div className="space-y-3">
                  {visiblePosts.map((post) => (
                    <FeedPostCard
                      key={post.id}
                      post={post}
                      viewerId={user?.id ?? null}
                      isFollowing={followingSet.has(post.userId)}
                      media={
                        <MediaPreview
                          post={post}
                          className={`post-media w-full rounded-xl ${post.kind === "Reel" ? "is-reel" : ""}`}
                        />
                      }
                      saveIcon={<SaveGlyph saved={post.saved} className="h-4 w-4" />}
                      showHeartBurst={heartBurst?.postId === post.id}
                      heartBurstToken={heartBurst?.token}
                      shareOpen={sharePostId === post.id}
                      shareNotice={shareNotice?.id === post.id ? shareNotice.text : null}
                      onOpenProfile={openProfile}
                      onLike={() => void like(post.id)}
                      onComment={() => void openComments(post.id)}
                      onToggleSave={() => void toggleSave(post.id)}
                      onToggleShare={() => {
                        setShareNotice(null);
                        setSharePostId((current) => (current === post.id ? null : post.id));
                      }}
                      onShareToAccount={() => void shareToAccounts(post)}
                      onCopyLink={() => void copyShareLink(post.id)}
                      onDoubleClick={() => handlePostDoubleClick(post)}
                      onWithdrawInvite={() => void withdrawCollabInvite(post.id)}
                      onToggleFollow={() => void toggleFollowFromFeed(post.userId)}
                      onReport={() => void reportPost(post)}
                    />
                  ))}
                  {visiblePosts.length === 0 ? (
                    !user.onboardingCompleted || (followingLoaded && followingIds.length === 0) ? (
                      <div className="rounded-[1.7rem] border border-[var(--line)] bg-white px-5 py-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Your feed is warming up
                        </p>
                        <h3
                          className="mt-2 text-lg font-semibold text-slate-900"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Let&apos;s make Motion feel alive from the start
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm text-slate-500">
                          Finish your welcome setup, choose a few interests, and follow some
                          creators. We&apos;ll use that to fill your {contentView} feed with better
                          picks right away.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
                            onClick={() => {
                              setOnboardingDismissed(false);
                              if (onboardingDismissStorageKey) {
                                window.localStorage.removeItem(onboardingDismissStorageKey);
                              }
                              setOnboardingError(null);
                              setOnboardingOpen(true);
                            }}
                          >
                            Finish setup
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-[var(--line)] bg-[var(--plain-bg)] px-4 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => router.push("/explore")}
                          >
                            Explore creators
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                        {contentView === "reels"
                          ? "No reels yet."
                          : "No posts yet."}
                      </p>
                    )
                  ) : null}
                </div>
              </section>
            </section>

            <HomeRightRail
              railRef={headerActionsRef}
              searchQuery={userSearchQuery}
              searchLoading={userSearchLoading}
              searchError={userSearchError}
              searchResults={userSearchResults}
              onSearchQueryChange={setUserSearchQuery}
              onSelectUser={(handle) => {
                openProfile(handle);
                clearUserSearch();
              }}
              themePicker={
                <ThemePicker
                  selectedTheme={themeSelection}
                  onThemeChange={setThemeSelection}
                />
              }
              liveSessions={liveSessions}
              onOpenLive={openLive}
              activeFriends={activeFriends}
              onOpenProfile={openProfile}
              notificationCount={notificationCount}
              pendingCollabInvites={pendingCollabInvites}
              notificationsOpen={notificationsOpen}
              notificationFilter={notificationFilter}
              notificationItems={filteredNotificationItems}
              unseenNotificationItems={unseenNotificationItems}
              earlierNotificationItems={earlierNotificationItems}
              onToggleNotifications={() => {
                setProfileMenuOpen(false);
                setNotificationsOpen((current) => !current);
              }}
              onNotificationFilterChange={setNotificationFilter}
              onMarkAllNotificationsRead={() => {
                markNotificationsSeen(filteredNotificationItems);
              }}
              onOpenCollabRequests={() => router.push("/collab-requests")}
              onRespondToCollabInvite={(postId, response) => {
                void respondToCollabInvite(postId, response);
              }}
              onNotificationAction={(notification) => {
                void handleNotificationAction(notification);
              }}
            />
          </div>
        </main>
      </div>

      <nav
        className={`motion-bottom-nav md:hidden ${bottomNavHidden ? "is-hidden" : ""}`}
        aria-hidden={bottomNavHidden}
      >
        <button
          type="button"
          onClick={handleHomePress}
          className="bottom-nav-item"
          aria-pressed={contentView === "posts"}
          aria-label="Home"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => router.push("/reels")}
          className="bottom-nav-item"
          aria-label="Reels"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="17" x2="22" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={openChat}
          className="bottom-nav-item relative"
          aria-label="Messages"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
          </svg>
          {messagesBadgeCount > 0 ? (
            <span
              className={`absolute right-3 top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                messagesBadgeTone === "missed" ? "bg-rose-500" : "bg-[var(--brand)]"
              }`}
            >
              {messagesBadgeCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="bottom-nav-item"
          aria-label="Explore"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => router.push("/random")}
          className="bottom-nav-item"
          aria-label="Random chat"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="9" r="3" />
            <circle cx="17" cy="15" r="3" />
            <path d="M11.5 11.5 14.5 12.5" />
            <path d="M6.5 16.5 14 9.5" />
          </svg>
        </button>
      </nav>

      <button
        type="button"
        className="chat-fab"
        onClick={openChat}
        aria-label="Open messages"
        aria-expanded={false}
        title="Messages"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.1 4.7A1.6 1.6 0 0 1 4.7 3.1h10.6a1.6 1.6 0 0 1 1.6 1.6v7.2a1.6 1.6 0 0 1-1.6 1.6H8.8L5.1 16v-2.5H4.7a1.6 1.6 0 0 1-1.6-1.6Z" />
        </svg>
        {messagesBadgeCount > 0 ? (
          <span
            className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${
              messagesBadgeTone === "missed"
                ? "bg-rose-500 text-white"
                : "bg-white text-[var(--brand)]"
            }`}
          >
            {messagesBadgeCount}
          </span>
        ) : null}
      </button>
      <WelcomeOnboardingModal
        open={onboardingOpen}
        userName={user.name}
        step={onboardingStep}
        selectedInterests={onboardingInterests}
        suggestedCreators={personalizedSuggestedCreators}
        selectedFollowIds={onboardingSelectedFollowIds}
        bio={onboardingBio}
        avatarUrl={onboardingAvatarUrl}
        avatarUploading={onboardingAvatarUploading}
        saving={onboardingSaving}
        error={onboardingError}
        onClose={closeOnboarding}
        onBack={() => {
          setOnboardingError(null);
          setOnboardingStep((current) => Math.max(1, current - 1));
        }}
        onNext={() => {
          if (onboardingStep === 1 && onboardingInterests.length === 0) {
            setOnboardingError("Pick at least one interest to personalize the feed.");
            return;
          }
          setOnboardingError(null);
          setOnboardingStep((current) => Math.min(3, current + 1));
        }}
        onChangeBio={setOnboardingBio}
        onToggleInterest={(interest) => {
          setOnboardingInterests((current) =>
            current.includes(interest)
              ? current.filter((item) => item !== interest)
              : [...current, interest],
          );
        }}
        onToggleFollowUser={(userId) => {
          setOnboardingSelectedFollowIds((current) =>
            current.includes(userId)
              ? current.filter((id) => id !== userId)
              : [...current, userId],
          );
        }}
        onUploadAvatar={(file) => {
          void uploadOnboardingAvatar(file);
        }}
        onRemoveAvatar={() => setOnboardingAvatarUrl("")}
        onComplete={() => {
          void completeOnboarding();
        }}
      />
      <SupportWidget defaultEmail={user.email} />
    </div>
  );
}






