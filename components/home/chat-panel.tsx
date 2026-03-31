"use client";

import type { CSSProperties, FormEvent, RefObject, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import {
  CHAT_WALLPAPER_BLUR_MAX,
  CHAT_WALLPAPER_BLUR_MIN,
  CHAT_WALLPAPER_DIM_MAX,
  CHAT_WALLPAPER_DIM_MIN,
  CHAT_WALLPAPER_OPTIONS,
  CHAT_WALLPAPER_TARGETS,
  DEFAULT_CHAT_WALLPAPER_BLUR,
  DEFAULT_CHAT_WALLPAPER_DIM,
  DEFAULT_CHAT_WALLPAPER,
  resolveChatAppearanceTone,
  type ChatAppearanceTone,
  type ChatWallpaper,
  type ChatWallpaperSelection,
  type ChatWallpaperTarget,
} from "@/lib/chat-wallpapers";

type Presence = "Online" | "Away";
type MessagePanelTab = "chats" | "calls" | "recordings";
type CallTypeFilter = "all" | "voice" | "video";
type CallDirectionFilter = "all" | "incoming" | "outgoing" | "missed";

type Conversation = {
  id: string;
  userId: string;
  isGroup?: boolean;
  name: string;
  pinned?: boolean;
  status: Presence;
  unread: number;
  time: string;
  lastMessage: string;
  typing: boolean;
  missedCallCount: number;
  hasRecordingHistory: boolean;
  recordingCount: number;
  hasVoiceCallHistory: boolean;
  hasVideoCallHistory: boolean;
  hasIncomingCallHistory: boolean;
  hasOutgoingCallHistory: boolean;
  chatWallpaper?: ChatWallpaperSelection;
  chatWallpaperUrl?: string;
  chatWallpaperLight?: ChatWallpaperSelection;
  chatWallpaperLightUrl?: string;
  chatWallpaperDark?: ChatWallpaperSelection;
  chatWallpaperDarkUrl?: string;
  chatWallpaperBlur?: number;
  chatWallpaperDim?: number;
  lastCallMode?: "voice" | "video";
  lastCallEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
};

type ChatAttachment = {
  url: string;
  type: "image" | "audio" | "video";
  durationMs?: number;
  mimeType?: string;
  name?: string;
};

type MessageReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

type Message = {
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
    attachmentType?: ChatAttachment["type"];
    unsent?: boolean;
  };
  systemType?: "call";
  callId?: string;
  callMode?: "voice" | "video";
  callDirection?: "incoming" | "outgoing";
  callEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
  callDurationMs?: number;
  attachment?: ChatAttachment;
  reactions: MessageReaction[];
  deliveryState: "sent" | "delivered" | "read";
};

type ChatPanelProps = {
  open: boolean;
  variant?: "floating" | "page";
  title?: string;
  searchPlaceholder?: string;
  availableTabs?: MessagePanelTab[];
  chatSearch: string;
  threadSearch?: string;
  messageTab: MessagePanelTab;
  callTypeFilter: CallTypeFilter;
  callDirectionFilter: CallDirectionFilter;
  missedCallsTotal: number;
  markingMissedSeen?: boolean;
  filteredConversations: Conversation[];
  activeId: string | null;
  activeConversation: Conversation | null;
  activeConversationSafety?: {
    blocked: boolean;
    muted: boolean;
    restrictedAccount: boolean;
    canMessage: boolean;
    messageGateReason: "blocked" | "restricted" | "missing" | null;
  } | null;
  friendActivity: Record<string, { isActive: boolean } | undefined>;
  messages: Message[];
  reactionMenuId: string | null;
  chatReactions: string[];
  recording: boolean;
  chatUploading: boolean;
  chatSending: boolean;
  text: string;
  callStatusLabel?: string | null;
  callBusy?: boolean;
  chatWallpaper?: ChatWallpaperSelection;
  chatWallpaperUrl?: string;
  chatWallpaperLight?: ChatWallpaperSelection;
  chatWallpaperLightUrl?: string;
  chatWallpaperDark?: ChatWallpaperSelection;
  chatWallpaperDarkUrl?: string;
  chatWallpaperBlur?: number;
  chatWallpaperDim?: number;
  defaultChatWallpaper?: ChatWallpaper;
  savingChatWallpaper?: boolean;
  pinningConversation?: boolean;
  chatThreadRef: RefObject<HTMLDivElement | null>;
  chatPhotoInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onChatSearchChange: (value: string) => void;
  onThreadSearchChange?: (value: string) => void;
  onMessageTabChange: (value: MessagePanelTab) => void;
  onCallTypeFilterChange: (value: CallTypeFilter) => void;
  onCallDirectionFilterChange: (value: CallDirectionFilter) => void;
  onMarkAllMissedSeen: () => void;
  onOpenCallsPage?: () => void;
  onClearChatSearch: () => void;
  onSelectConversation: (conversationId: string) => void;
  onBack: () => void;
  onTogglePinConversation?: (conversationId: string) => void;
  onToggleMuteUser?: () => void;
  onToggleBlockUser?: () => void;
  onReportConversation?: () => void;
  onToggleReactionMenu: (messageId: string) => void;
  onReplyToMessage?: (messageId: string) => void;
  replyingToMessage?: Message | null;
  onClearReplyTo?: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onMessageInputChange: (value: string) => void;
  onChatPhotoSelection: (files: FileList | null) => void;
  onToggleRecording: () => void;
  onStartVoiceCall: () => void;
  onStartVideoCall: () => void;
  onOpenGroupVideoCall?: () => void;
  onChatWallpaperChange?: (wallpaper: ChatWallpaper, target: ChatWallpaperTarget) => void;
  onUploadChatWallpaper?: (file: File | null, target: ChatWallpaperTarget) => void;
  onResetChatWallpaper?: (target: ChatWallpaperTarget) => void;
  onChatWallpaperEffectsChange?: (effects: { blur: number; dim: number }) => void;
  onDeleteRecording?: (messageId: string) => void;
  onReportMessage?: (messageId: string) => void;
  onUnsendMessage?: (messageId: string) => void;
  unsendingMessageId?: string | null;
  deletingRecordingId?: string | null;
  onDeleteAllRecordings?: () => void;
  deletingAllRecordings?: boolean;
  safetyActionState?: "block" | "mute" | "report" | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formatChatTime: (value: string) => string;
  formatVoiceDuration: (durationMs?: number) => string;
};

function MessageTicks({ state }: { state: Message["deliveryState"] }) {
  const color = state === "read" ? "#38bdf8" : "currentColor";

  if (state === "sent") {
    return (
      <svg
        viewBox="0 0 18 18"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4.2 9.4 2.2 2.3 4.4-5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 22 18"
      className="h-3.5 w-4"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3.2 9.4 2.2 2.3 4.4-5" />
      <path d="m10.2 9.4 2.2 2.3 6-7" />
    </svg>
  );
}

function formatCallDuration(durationMs?: number): string | null {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function messageMatchesThreadSearch(message: Message, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const searchableParts = [
    message.text,
    message.unsent ? "message unsent" : "",
    message.replyTo?.text,
    message.replyTo?.author,
    message.attachment?.type,
    message.callMode,
    message.callEvent,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return searchableParts.some((value) => value.includes(normalized));
}

function isCallRecordingAttachment(attachment?: ChatAttachment): boolean {
  return Boolean(attachment?.name?.startsWith("motion-call-recording-"));
}

function CallLogIcon({
  direction,
  missed,
}: {
  direction?: Message["callDirection"];
  missed?: boolean;
}) {
  const classes = missed
    ? "bg-rose-100 text-rose-600"
    : direction === "incoming"
      ? "bg-emerald-100 text-emerald-600"
      : "bg-sky-100 text-sky-600";

  if (missed) {
    return (
      <span className={`grid h-5 w-5 place-items-center rounded-full ${classes}`}>
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.6 3.7h2.1l1.2 3.1-1.6 1.4a10.4 10.4 0 0 0 4.6 4.6l1.4-1.6 3.1 1.2v2.1a1.4 1.4 0 0 1-1.5 1.4A12 12 0 0 1 3.2 5.2a1.4 1.4 0 0 1 1.4-1.5Z" />
          <path d="M4 4l12 12" />
        </svg>
      </span>
    );
  }

  if (direction === "incoming") {
    return (
      <span className={`grid h-5 w-5 place-items-center rounded-full ${classes}`}>
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.6 3.7h2.1l1.2 3.1-1.6 1.4a10.4 10.4 0 0 0 4.6 4.6l1.4-1.6 3.1 1.2v2.1a1.4 1.4 0 0 1-1.5 1.4A12 12 0 0 1 3.2 5.2a1.4 1.4 0 0 1 1.4-1.5Z" />
          <path d="m6.5 12.5 3.2-3.2" />
          <path d="M6.5 8.7v3.8h3.8" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`grid h-5 w-5 place-items-center rounded-full ${classes}`}>
      <svg
        viewBox="0 0 20 20"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.6 3.7h2.1l1.2 3.1-1.6 1.4a10.4 10.4 0 0 0 4.6 4.6l1.4-1.6 3.1 1.2v2.1a1.4 1.4 0 0 1-1.5 1.4A12 12 0 0 1 3.2 5.2a1.4 1.4 0 0 1 1.4-1.5Z" />
        <path d="m13.5 7.5-3.2 3.2" />
        <path d="M13.5 11.3V7.5H9.7" />
      </svg>
    </span>
  );
}

type WallpaperState = {
  chatWallpaper?: ChatWallpaperSelection;
  chatWallpaperUrl?: string;
  chatWallpaperLight?: ChatWallpaperSelection;
  chatWallpaperLightUrl?: string;
  chatWallpaperDark?: ChatWallpaperSelection;
  chatWallpaperDarkUrl?: string;
  chatWallpaperBlur?: number;
  chatWallpaperDim?: number;
};

function getWallpaperSlotState(
  wallpaperState: WallpaperState,
  target: ChatWallpaperTarget,
): {
  wallpaper?: ChatWallpaperSelection;
  url?: string;
} {
  if (target === "light") {
    return {
      wallpaper: wallpaperState.chatWallpaperLight,
      url: wallpaperState.chatWallpaperLightUrl,
    };
  }

  if (target === "dark") {
    return {
      wallpaper: wallpaperState.chatWallpaperDark,
      url: wallpaperState.chatWallpaperDarkUrl,
    };
  }

  return {
    wallpaper: wallpaperState.chatWallpaper,
    url: wallpaperState.chatWallpaperUrl,
  };
}

function resolveEffectiveWallpaper(
  wallpaperState: WallpaperState,
  appearanceTone: ChatAppearanceTone,
  defaultChatWallpaper: ChatWallpaper,
) {
  const toneSlot =
    appearanceTone === "light"
      ? getWallpaperSlotState(wallpaperState, "light")
      : getWallpaperSlotState(wallpaperState, "dark");
  const universalSlot = getWallpaperSlotState(wallpaperState, "all");
  const toneWallpaperReady =
    toneSlot.wallpaper && (toneSlot.wallpaper !== "custom" || Boolean(toneSlot.url));
  const universalWallpaperReady =
    universalSlot.wallpaper &&
    (universalSlot.wallpaper !== "custom" || Boolean(universalSlot.url));
  const wallpaper = toneWallpaperReady
    ? toneSlot.wallpaper
    : universalWallpaperReady
      ? universalSlot.wallpaper
      : defaultChatWallpaper;
  const url =
    toneWallpaperReady && toneSlot.wallpaper === "custom"
      ? toneSlot.url
      : universalWallpaperReady && universalSlot.wallpaper === "custom"
        ? universalSlot.url
        : undefined;

  return { wallpaper, url };
}

function buildWallpaperStyle({
  wallpaper,
  url,
  blur,
  dim,
}: {
  wallpaper?: ChatWallpaperSelection;
  url?: string;
  blur?: number;
  dim?: number;
}): CSSProperties {
  const nextStyle = {
    "--chat-wallpaper-blur": `${blur ?? DEFAULT_CHAT_WALLPAPER_BLUR}px`,
    "--chat-wallpaper-dim-top": `${Math.min(0.82, 0.08 + (dim ?? DEFAULT_CHAT_WALLPAPER_DIM) / 100).toFixed(2)}`,
    "--chat-wallpaper-dim-bottom": `${Math.min(0.94, 0.34 + (dim ?? DEFAULT_CHAT_WALLPAPER_DIM) / 100).toFixed(2)}`,
  } as CSSProperties & Record<string, string>;

  if (wallpaper === "custom" && url) {
    nextStyle["--chat-custom-wallpaper-url"] = `url("${url}")`;
  }

  return nextStyle;
}

export default function ChatPanel({
  open,
  variant = "floating",
  title = "Messages",
  searchPlaceholder = "Search threads...",
  availableTabs = ["chats", "calls", "recordings"],
  chatSearch,
  threadSearch = "",
  messageTab,
  callTypeFilter,
  callDirectionFilter,
  missedCallsTotal,
  markingMissedSeen = false,
  filteredConversations,
  activeId,
  activeConversation,
  activeConversationSafety = null,
  friendActivity,
  messages,
  reactionMenuId,
  chatReactions,
  recording,
  chatUploading,
  chatSending,
  text,
  callStatusLabel,
  callBusy,
  chatWallpaper,
  chatWallpaperUrl,
  chatWallpaperLight,
  chatWallpaperLightUrl,
  chatWallpaperDark,
  chatWallpaperDarkUrl,
  chatWallpaperBlur = DEFAULT_CHAT_WALLPAPER_BLUR,
  chatWallpaperDim = DEFAULT_CHAT_WALLPAPER_DIM,
  defaultChatWallpaper = DEFAULT_CHAT_WALLPAPER,
  savingChatWallpaper = false,
  pinningConversation = false,
  chatThreadRef,
  chatPhotoInputRef,
  onClose,
  onChatSearchChange,
  onThreadSearchChange,
  onMessageTabChange,
  onCallTypeFilterChange,
  onCallDirectionFilterChange,
  onMarkAllMissedSeen,
  onOpenCallsPage,
  onClearChatSearch,
  onSelectConversation,
  onBack,
  onTogglePinConversation,
  onToggleMuteUser,
  onToggleBlockUser,
  onReportConversation,
  onToggleReactionMenu,
  onReplyToMessage,
  replyingToMessage = null,
  onClearReplyTo,
  onToggleReaction,
  onMessageInputChange,
  onChatPhotoSelection,
  onToggleRecording,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenGroupVideoCall,
  onChatWallpaperChange,
  onUploadChatWallpaper,
  onResetChatWallpaper,
  onChatWallpaperEffectsChange,
  onDeleteRecording,
  onReportMessage,
  onUnsendMessage,
  unsendingMessageId = null,
  deletingRecordingId = null,
  onDeleteAllRecordings,
  deletingAllRecordings = false,
  safetyActionState = null,
  onSubmit,
  formatChatTime,
  formatVoiceDuration,
}: ChatPanelProps) {
  const [appearanceTone, setAppearanceTone] = useState<ChatAppearanceTone>("dark");
  const [wallpaperMenuOpen, setWallpaperMenuOpen] = useState(false);
  const [wallpaperTarget, setWallpaperTarget] = useState<ChatWallpaperTarget>("all");
  const [blurDraft, setBlurDraft] = useState(chatWallpaperBlur);
  const [dimDraft, setDimDraft] = useState(chatWallpaperDim);
  const [swipeReplyPreview, setSwipeReplyPreview] = useState<{
    messageId: string;
    offset: number;
  } | null>(null);
  const wallpaperMenuRef = useRef<HTMLDivElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeMessageIdRef = useRef<string | null>(null);

  const selectedWallpaperState = getWallpaperSlotState(
    {
      chatWallpaper,
      chatWallpaperUrl,
      chatWallpaperLight,
      chatWallpaperLightUrl,
      chatWallpaperDark,
      chatWallpaperDarkUrl,
    },
    wallpaperTarget,
  );
  const resolvedWallpaperState = resolveEffectiveWallpaper(
    {
      chatWallpaper,
      chatWallpaperUrl,
      chatWallpaperLight,
      chatWallpaperLightUrl,
      chatWallpaperDark,
      chatWallpaperDarkUrl,
    },
    appearanceTone,
    defaultChatWallpaper,
  );
  const resolvedWallpaper = resolvedWallpaperState.wallpaper;
  const chatThreadStyle = buildWallpaperStyle({
    wallpaper: resolvedWallpaperState.wallpaper,
    url: resolvedWallpaperState.url,
    blur: blurDraft,
    dim: dimDraft,
  });
  const selectedWallpaperPreviewStyle = buildWallpaperStyle({
    wallpaper: selectedWallpaperState.wallpaper,
    url: selectedWallpaperState.url,
    blur: blurDraft,
    dim: dimDraft,
  });

  useEffect(() => {
    setBlurDraft(chatWallpaperBlur);
  }, [chatWallpaperBlur]);

  useEffect(() => {
    setDimDraft(chatWallpaperDim);
  }, [chatWallpaperDim]);

  useEffect(() => {
    const syncAppearanceTone = () => {
      const rootTheme = document.documentElement.getAttribute("data-theme");
      if (rootTheme) {
        setAppearanceTone(resolveChatAppearanceTone(rootTheme));
        return;
      }

      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setAppearanceTone(prefersDark ? "dark" : "light");
    };

    syncAppearanceTone();

    const observer = new MutationObserver(syncAppearanceTone);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", syncAppearanceTone);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", syncAppearanceTone);
    };
  }, []);

  useEffect(() => {
    if (!wallpaperMenuOpen) {
      return;
    }

    if (blurDraft === chatWallpaperBlur && dimDraft === chatWallpaperDim) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onChatWallpaperEffectsChange?.({
        blur: blurDraft,
        dim: dimDraft,
      });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [
    blurDraft,
    chatWallpaperBlur,
    chatWallpaperDim,
    dimDraft,
    onChatWallpaperEffectsChange,
    wallpaperMenuOpen,
  ]);

  useEffect(() => {
    if (!wallpaperMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wallpaperMenuRef.current?.contains(event.target as Node)) {
        setWallpaperMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [wallpaperMenuOpen]);

  if (!open) {
    return null;
  }

  const threadMessages =
    messageTab === "calls"
      ? messages.filter(
          (message) =>
            message.systemType === "call" ||
            isCallRecordingAttachment(message.attachment),
        )
      : messageTab === "recordings"
        ? messages.filter((message) => isCallRecordingAttachment(message.attachment))
      : messages;
  const normalizedThreadSearch = threadSearch.trim().toLowerCase();
  const visibleThreadMessages = normalizedThreadSearch
    ? threadMessages.filter((message) => messageMatchesThreadSearch(message, normalizedThreadSearch))
    : threadMessages;
  const threadSearchMatches = visibleThreadMessages.length;
  const activeRecordingCount = activeConversation?.recordingCount ?? 0;
  const conversationBlocked = Boolean(activeConversationSafety?.blocked);
  const conversationRestricted =
    activeConversationSafety?.messageGateReason === "restricted" &&
    !activeConversationSafety?.canMessage;

  const handleMessageTouchStart = (messageId: string) => (event: TouchEvent<HTMLDivElement>) => {
    if (messageTab !== "chats" || !onReplyToMessage) {
      return;
    }

    swipeStartXRef.current = event.touches[0]?.clientX ?? null;
    swipeMessageIdRef.current = messageId;
    setSwipeReplyPreview({ messageId, offset: 0 });
  };

  const handleMessageTouchMove =
    (messageId: string, from: Message["from"]) => (event: TouchEvent<HTMLDivElement>) => {
      if (
        messageTab !== "chats" ||
        !onReplyToMessage ||
        swipeMessageIdRef.current !== messageId ||
        swipeStartXRef.current === null
      ) {
        return;
      }

      const delta = event.touches[0]?.clientX - swipeStartXRef.current;
      if (typeof delta !== "number") {
        return;
      }

      const directionalDelta = from === "me" ? Math.max(0, -delta) : Math.max(0, delta);
      setSwipeReplyPreview({
        messageId,
        offset: Math.min(directionalDelta, 72),
      });
    };

  const resetSwipeReply = () => {
    swipeStartXRef.current = null;
    swipeMessageIdRef.current = null;
    setSwipeReplyPreview(null);
  };

  const handleMessageTouchEnd = (messageId: string) => () => {
    if (
      messageTab === "chats" &&
      onReplyToMessage &&
      swipeReplyPreview?.messageId === messageId &&
      swipeReplyPreview.offset >= 54
    ) {
      onReplyToMessage(messageId);
    }

    resetSwipeReply();
  };

  return (
    <section
      className={`chat-panel motion-surface overflow-hidden p-0 ${
        variant === "page" ? "is-page" : ""
      }`}
    >
      <div className="chat-shell">
        <div className="chat-list-column">
          <div className="chat-header flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[var(--brand)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
              </svg>
              <h2
                className="text-base font-semibold text-slate-900"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h2>
              <div className="pulse-dot" />
            </div>
            <div className="flex items-center gap-2">
              {messageTab === "calls" && onOpenCallsPage ? (
                <button
                  type="button"
                  onClick={onOpenCallsPage}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  Full page
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                aria-label="Close messages"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
          </div>

          {availableTabs.length > 1 ? (
            <div className="flex items-center gap-2 px-4 pb-3">
              {availableTabs.map((tabId) => {
                const label =
                  tabId === "calls"
                    ? "Calls"
                    : tabId === "recordings"
                      ? "Recordings"
                      : "Chats";
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => onMessageTabChange(tabId)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      messageTab === tabId
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--line)] bg-white text-slate-500 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="chat-search px-4 pb-3">
            <div className="relative">
              <input
                value={chatSearch}
                onChange={(event) => onChatSearchChange(event.target.value)}
                className="chat-search-input"
                placeholder={searchPlaceholder}
                aria-label="Search messages"
              />
              {chatSearch ? (
                <button
                  type="button"
                  onClick={onClearChatSearch}
                  className="chat-search-clear"
                  aria-label="Clear search"
                >
                  x
                </button>
              ) : null}
            </div>
          </div>

          {messageTab === "calls" ? (
            <>
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {[
                  { id: "all", label: "All" },
                  { id: "incoming", label: "Incoming" },
                  { id: "outgoing", label: "Outgoing" },
                  { id: "missed", label: "Missed" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() =>
                      onCallDirectionFilterChange(filter.id as CallDirectionFilter)
                    }
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      callDirectionFilter === filter.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--line)] bg-white text-slate-500 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {missedCallsTotal > 0 ? (
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    onClick={onMarkAllMissedSeen}
                    disabled={markingMissedSeen}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {markingMissedSeen
                      ? "Marking missed calls..."
                      : `Mark all missed calls as seen (${missedCallsTotal})`}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {[
                  { id: "all", label: "All types" },
                  { id: "voice", label: "Voice" },
                  { id: "video", label: "Video" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() =>
                      onCallTypeFilterChange(filter.id as CallTypeFilter)
                    }
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      callTypeFilter === filter.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--line)] bg-white text-slate-500 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </>
          ) : messageTab === "recordings" ? (
            <div className="px-4 pb-3">
              <div className="rounded-2xl border border-[var(--line)] bg-white px-3.5 py-3 text-[11px] text-slate-500">
                Saved call recordings live in their original thread so you can replay, download, or remove them later.
              </div>
            </div>
          ) : null}

          <div className="chat-list">
            {filteredConversations.map((conversation) => {
              const isActive =
                Boolean(conversation.userId) &&
                Boolean(friendActivity[conversation.userId]?.isActive);
              const initials = conversation.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2);
              const gradients = [
                "linear-gradient(135deg, #ff8f6b, #ff5f6d)",
                "linear-gradient(135deg, #f6d365, #fda085)",
                "linear-gradient(135deg, #96fbc4, #f9f586)",
                "linear-gradient(135deg, #4facfe, #00f2fe)",
                "linear-gradient(135deg, #ff9a9e, #fbc2eb)",
                "linear-gradient(135deg, #84fab0, #8fd3f4)",
              ];
              const gradientIndex =
                [...conversation.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
                gradients.length;
              const conversationPreview = resolveEffectiveWallpaper(
                conversation,
                appearanceTone,
                defaultChatWallpaper,
              );

              return (
                <div
                  key={conversation.id}
                  className={`chat-convo-item ${activeId === conversation.id ? "is-active" : ""}`}
                >
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    type="button"
                  >
                    <div
                      className="chat-avatar"
                      style={{ background: gradients[gradientIndex] }}
                    >
                      {initials}
                      {isActive ? <span className="presence-dot" /> : null}
                    </div>
                    <span
                      className={`chat-convo-wallpaper-preview is-${conversationPreview.wallpaper}`}
                      style={buildWallpaperStyle({
                        wallpaper: conversationPreview.wallpaper,
                        url: conversationPreview.url,
                      })}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {conversation.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {conversation.time}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-xs ${
                              conversation.typing
                                ? "font-semibold text-[var(--brand)]"
                                : "text-slate-500"
                            }`}
                          >
                            {conversation.typing
                              ? "Typing..."
                              : isActive
                                ? "Active now"
                                : conversation.lastMessage}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {conversation.pinned ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                Pinned
                              </span>
                            ) : null}
                            {conversation.missedCallCount > 0 ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                                {conversation.missedCallCount} missed
                              </span>
                            ) : null}
                            {conversation.lastCallMode ? (
                              <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                {conversation.lastCallMode === "video" ? "Video" : "Voice"}
                              </span>
                            ) : null}
                            {messageTab === "recordings" && conversation.hasRecordingHistory ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                                {conversation.recordingCount} recording
                                {conversation.recordingCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {messageTab !== "recordings" &&
                            conversation.recordingCount > 0 ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                                {conversation.recordingCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {conversation.unread > 0 ? (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
                              {conversation.unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </button>
                  {onTogglePinConversation ? (
                    <button
                      type="button"
                      onClick={() => onTogglePinConversation(conversation.id)}
                      className="chat-header-button ml-2 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full disabled:opacity-60"
                      aria-label={conversation.pinned ? "Unpin chat" : "Pin chat"}
                      title={conversation.pinned ? "Unpin chat" : "Pin chat"}
                      disabled={pinningConversation}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill={conversation.pinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6.7 3.5h6.6l-1.2 4.2 2.1 2.1v1H10.7V16l-1.4.9-.7-.9v-5.2H5.8v-1l2.1-2.1Z" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              );
            })}
            {filteredConversations.length === 0 ? (
              <div className="chat-empty">
                {messageTab === "calls"
                  ? chatSearch || callDirectionFilter !== "all" || callTypeFilter !== "all"
                    ? "No call logs match that search or filter."
                    : "No call history yet."
                  : messageTab === "recordings"
                    ? chatSearch
                      ? "No recording threads match that search."
                      : "No saved call recordings yet."
                  : chatSearch
                    ? "No threads match that search."
                    : "No threads yet."}
              </div>
            ) : null}
          </div>
        </div>

        <div className="chat-thread-column">
          {activeId ? (
            <div className="chat-thread-wrap flex flex-1 flex-col">
              <div className="chat-thread-header space-y-3 px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {activeConversation?.name ?? "Conversation"}
                  </p>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activeConversation?.status === "Online"
                        ? "bg-emerald-400"
                        : "bg-slate-300"
                    }`}
                  />
                  {activeConversation?.userId && activeConversation.typing ? (
                    <span className="text-[11px] font-semibold text-[var(--brand)]">
                      Typing...
                    </span>
                  ) : activeConversation?.userId &&
                    friendActivity[activeConversation.userId]?.isActive ? (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      Active now
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div ref={wallpaperMenuRef} className="chat-wallpaper-controls">
                    <button
                      type="button"
                      onClick={() => setWallpaperMenuOpen((current) => !current)}
                      className="chat-header-button"
                      aria-label="Choose chat wallpaper"
                      aria-expanded={wallpaperMenuOpen}
                      title="Wallpaper"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 5.3A1.8 1.8 0 0 1 5.3 3.5h9.4a1.8 1.8 0 0 1 1.8 1.8v9.4a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z" />
                        <path d="m5.9 12.8 2.5-2.7 2 1.8 3.7-4 1.9 2.3" />
                        <circle cx="7.2" cy="7.3" r="1" />
                      </svg>
                    </button>
                    {wallpaperMenuOpen ? (
                      <div className="chat-wallpaper-menu">
                        <div className="chat-wallpaper-menu-header">
                          <span>Wallpaper</span>
                          <span>
                            {savingChatWallpaper
                              ? "Saving..."
                              : `This chat only · ${appearanceTone} look active`}
                          </span>
                        </div>
                        <div className="chat-wallpaper-targets">
                          {CHAT_WALLPAPER_TARGETS.map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => setWallpaperTarget(target.id)}
                              className={`chat-wallpaper-target ${
                                wallpaperTarget === target.id ? "is-active" : ""
                              }`}
                              disabled={savingChatWallpaper}
                            >
                              {target.label}
                            </button>
                          ))}
                        </div>
                        <input
                          ref={wallpaperInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            onUploadChatWallpaper?.(
                              event.target.files?.[0] ?? null,
                              wallpaperTarget,
                            );
                            event.target.value = "";
                            setWallpaperMenuOpen(false);
                          }}
                        />
                        <div className="chat-wallpaper-actions">
                          <button
                            type="button"
                            onClick={() => wallpaperInputRef.current?.click()}
                            className="chat-wallpaper-action"
                            disabled={savingChatWallpaper}
                          >
                            Upload custom
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onResetChatWallpaper?.(wallpaperTarget);
                              setWallpaperMenuOpen(false);
                            }}
                            className="chat-wallpaper-action"
                            disabled={
                              savingChatWallpaper || selectedWallpaperState.wallpaper === undefined
                            }
                          >
                            Use default
                          </button>
                        </div>
                        {selectedWallpaperState.wallpaper === "custom" ? (
                          <div className="chat-wallpaper-custom-preview">
                            <span
                              className="chat-wallpaper-swatch is-custom"
                              style={selectedWallpaperPreviewStyle}
                              aria-hidden
                            />
                            <span className="chat-wallpaper-option-label">
                              Custom upload
                            </span>
                          </div>
                        ) : null}
                        <div className="chat-wallpaper-grid">
                          {CHAT_WALLPAPER_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                onChatWallpaperChange?.(option.id, wallpaperTarget);
                                setWallpaperMenuOpen(false);
                              }}
                              className={`chat-wallpaper-option ${
                                selectedWallpaperState.wallpaper === option.id ? "is-active" : ""
                              }`}
                              disabled={savingChatWallpaper}
                            >
                              <span
                                className={`chat-wallpaper-swatch is-${option.id}`}
                                aria-hidden
                              />
                              <span className="chat-wallpaper-option-label">
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="chat-wallpaper-effects">
                          <div className="chat-wallpaper-effects-header">
                            <span>Effects</span>
                            <span>{blurDraft}px blur · {dimDraft}% dim</span>
                          </div>
                          <label className="chat-wallpaper-slider">
                            <span>Blur</span>
                            <input
                              type="range"
                              min={CHAT_WALLPAPER_BLUR_MIN}
                              max={CHAT_WALLPAPER_BLUR_MAX}
                              value={blurDraft}
                              onChange={(event) =>
                                setBlurDraft(Number(event.target.value))
                              }
                            />
                          </label>
                          <label className="chat-wallpaper-slider">
                            <span>Dim</span>
                            <input
                              type="range"
                              min={CHAT_WALLPAPER_DIM_MIN}
                              max={CHAT_WALLPAPER_DIM_MAX}
                              value={dimDraft}
                              onChange={(event) =>
                                setDimDraft(Number(event.target.value))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {activeRecordingCount > 0 ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600">
                      {activeRecordingCount} recording
                      {activeRecordingCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {callStatusLabel ? (
                    <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
                      {callStatusLabel}
                    </span>
                  ) : null}
                  {activeConversation?.userId && !activeConversation.isGroup ? (
                    <>
                      {onToggleMuteUser ? (
                        <button
                          type="button"
                          onClick={onToggleMuteUser}
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60"
                          disabled={safetyActionState === "mute"}
                        >
                          {safetyActionState === "mute"
                            ? "Working..."
                            : activeConversationSafety?.muted
                              ? "Unmute"
                              : "Mute"}
                        </button>
                      ) : null}
                      {onToggleBlockUser ? (
                        <button
                          type="button"
                          onClick={onToggleBlockUser}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                          disabled={safetyActionState === "block"}
                        >
                          {safetyActionState === "block"
                            ? "Working..."
                            : activeConversationSafety?.blocked
                              ? "Unblock"
                              : "Block"}
                        </button>
                      ) : null}
                      {onReportConversation ? (
                        <button
                          type="button"
                          onClick={onReportConversation}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-60"
                          disabled={safetyActionState === "report"}
                        >
                          {safetyActionState === "report" ? "Sending..." : "Report"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {messageTab === "recordings" && activeRecordingCount > 0 && onDeleteAllRecordings ? (
                    <button
                      type="button"
                      onClick={onDeleteAllRecordings}
                      disabled={deletingAllRecordings}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingAllRecordings
                        ? "Removing..."
                        : `Delete all (${activeRecordingCount})`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onStartVoiceCall}
                    className="chat-header-button grid h-8 w-8 place-items-center rounded-full disabled:opacity-50"
                    aria-label="Start voice call"
                    title="Voice call"
                    disabled={!activeId || callBusy || conversationBlocked || conversationRestricted}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5.4 3.7h2.1l1.2 3.1-1.6 1.4a10.7 10.7 0 0 0 4.7 4.7l1.4-1.6 3.1 1.2v2.1a1.4 1.4 0 0 1-1.5 1.4A12.2 12.2 0 0 1 4 5.2a1.4 1.4 0 0 1 1.4-1.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={onStartVideoCall}
                    className="chat-header-button grid h-8 w-8 place-items-center rounded-full disabled:opacity-50"
                    aria-label="Start video call"
                    title="Video call"
                    disabled={!activeId || callBusy || conversationBlocked || conversationRestricted}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2.8" y="5" width="10.4" height="10" rx="2" />
                      <path d="m13.2 8 4-2.3v8.6l-4-2.3" />
                    </svg>
                  </button>
                  {messageTab === "chats" && onOpenGroupVideoCall ? (
                    <button
                      type="button"
                      onClick={onOpenGroupVideoCall}
                      className="chat-header-button grid h-8 w-8 place-items-center rounded-full disabled:opacity-50"
                      aria-label="Start group video call"
                      title="Group video call"
                      disabled={!activeId || callBusy || conversationBlocked || conversationRestricted}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6.2 9a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 6.2 9Z" />
                        <path d="M13.8 9a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 13.8 9Z" />
                        <path d="M10 15.8v-2.2" />
                        <path d="M7.2 13.6H4.5c0-1.8 1.4-3 3.2-3.2" />
                        <path d="M15.5 13.6h-2.7c0-1.8-1.4-3-3.2-3.2" />
                        <path d="M10 10.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z" />
                      </svg>
                    </button>
                  ) : null}
                  {onTogglePinConversation && activeConversation ? (
                    <button
                      type="button"
                      onClick={() => onTogglePinConversation(activeConversation.id)}
                      className="chat-header-button grid h-8 w-8 place-items-center rounded-full disabled:opacity-60"
                      aria-label={activeConversation.pinned ? "Unpin chat" : "Pin chat"}
                      title={activeConversation.pinned ? "Unpin chat" : "Pin chat"}
                      disabled={pinningConversation}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill={activeConversation.pinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6.7 3.5h6.6l-1.2 4.2 2.1 2.1v1H10.7V16l-1.4.9-.7-.9v-5.2H5.8v-1l2.1-2.1Z" />
                      </svg>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-[11px] font-semibold text-slate-500 transition hover:text-[var(--brand)]"
                  >
                    Back
                  </button>
                </div>
                </div>
                {onThreadSearchChange ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <input
                        value={threadSearch}
                        onChange={(event) => onThreadSearchChange(event.target.value)}
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-white/80 px-4 text-xs text-slate-600 outline-none transition focus:border-[var(--brand)]"
                        placeholder="Search inside this thread..."
                        aria-label="Search inside this thread"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {normalizedThreadSearch ? (
                        <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {threadSearchMatches} match{threadSearchMatches === 1 ? "" : "es"}
                        </span>
                      ) : null}
                      {replyingToMessage ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-[11px] text-slate-600">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800">
                              Replying to {replyingToMessage.from === "me" ? "You" : activeConversation?.name ?? "them"}
                            </p>
                            <p className="max-w-[18rem] truncate text-slate-500">
                              {replyingToMessage.unsent
                                ? "Message unsent"
                                : replyingToMessage.text ||
                                  (replyingToMessage.attachment?.type === "image"
                                    ? "Photo"
                                    : replyingToMessage.attachment?.type === "video"
                                      ? "Video"
                                      : replyingToMessage.attachment?.type === "audio"
                                        ? "Voice message"
                                        : "Message")}
                            </p>
                          </div>
                          {onClearReplyTo ? (
                            <button
                              type="button"
                              onClick={onClearReplyTo}
                              className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] font-semibold text-slate-500"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {conversationBlocked ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    This thread is blocked. Unblock the account if you want messages and calls to work again.
                  </div>
                ) : null}
                {!conversationBlocked && conversationRestricted ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    This account only allows messages and calls from followers right now.
                  </div>
                ) : null}
              </div>
              <div
                ref={chatThreadRef}
                className="chat-thread space-y-2 px-4 py-3"
                data-chat-wallpaper={resolvedWallpaper}
                style={chatThreadStyle}
              >
                {visibleThreadMessages.map((message) => (
                   message.from === "system" ? (
                     <div key={message.id} className="flex justify-center py-1">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.6)]">
                        <CallLogIcon
                          direction={message.callDirection}
                          missed={message.callEvent === "missed"}
                        />
                        <span>{message.text}</span>
                        {message.callDurationMs ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            {formatCallDuration(message.callDurationMs)}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-slate-400">
                          {formatChatTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                   ) : (
                   <div
                     key={message.id}
                     className={`chat-message ${message.from === "me" ? "is-me" : "is-them"}`}
                     style={
                       swipeReplyPreview?.messageId === message.id
                         ? {
                             transform: `translateX(${
                               message.from === "me"
                                 ? -swipeReplyPreview.offset
                                 : swipeReplyPreview.offset
                             }px)`,
                             transition: "transform 120ms ease-out",
                           }
                         : undefined
                     }
                     onTouchStart={handleMessageTouchStart(message.id)}
                     onTouchMove={handleMessageTouchMove(message.id, message.from)}
                     onTouchEnd={handleMessageTouchEnd(message.id)}
                     onTouchCancel={resetSwipeReply}
                   >
                     {swipeReplyPreview?.messageId === message.id &&
                     swipeReplyPreview.offset > 10 ? (
                       <div
                         className={`mb-1 flex text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)] ${
                           message.from === "me" ? "justify-end" : "justify-start"
                         }`}
                       >
                         Reply
                       </div>
                     ) : null}
                     <div
                       className={`chat-message-shell ${
                         message.from === "me" ? "is-me" : "is-them"
                      }`}
                    >
                      <div className="chat-message-label">
                        <span className="chat-message-author">
                          {message.from === "me"
                            ? "You"
                            : activeConversation?.name ?? "Motion"}
                        </span>
                        <span aria-hidden>{"//"}</span>
                        <span>{formatChatTime(message.createdAt)}</span>
                      </div>
                       <div
                         className={`chat-bubble ${message.from === "me" ? "is-me" : "is-them"}`}
                       >
                         {!message.unsent && message.replyTo ? (
                           <div className="mb-2 rounded-2xl border border-white/18 bg-white/8 px-3 py-2 text-[11px] text-white/80">
                             <p className="font-semibold text-white/95">
                               {message.replyTo.author}
                             </p>
                             <p className="truncate">
                               {message.replyTo.text}
                             </p>
                           </div>
                         ) : null}
                         {isCallRecordingAttachment(message.attachment) ? (
                           <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200/70 bg-rose-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-100">
                            <span className="h-2 w-2 rounded-full bg-rose-300" />
                            <span>Call recording</span>
                          </div>
                        ) : null}
                        {message.attachment?.type === "image" ? (
                          <button
                            type="button"
                            onClick={() =>
                              window.open(message.attachment?.url, "_blank", "noopener,noreferrer")
                            }
                            className="mb-2 block overflow-hidden rounded-[1.1rem]"
                          >
                            <Image
                              src={message.attachment.url}
                              alt="Shared chat photo"
                              width={220}
                              height={220}
                              className="h-auto w-[220px] max-w-full rounded-[1.1rem] object-cover"
                            />
                          </button>
                        ) : null}
                        {message.attachment?.type === "video" ? (
                          <div className="mb-2 overflow-hidden rounded-[1.1rem] bg-slate-950">
                            <video
                              controls
                              preload="metadata"
                              src={message.attachment.url}
                              className="h-auto w-[240px] max-w-full rounded-[1.1rem] bg-black"
                            />
                          </div>
                        ) : null}
                         {message.attachment?.type === "audio" ? (
                           <div className="chat-voice-note">
                            <div className="chat-voice-pill">
                              <svg
                                viewBox="0 0 20 20"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="7" y="3" width="6" height="10" rx="3" />
                                <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0" />
                                <path d="M10 15v2.5" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <audio
                                controls
                                src={message.attachment.url}
                                className="chat-audio-player"
                                preload="metadata"
                              />
                              <p className="mt-1 text-[10px] text-white/70">
                                {formatVoiceDuration(message.attachment.durationMs)}{" "}
                                {isCallRecordingAttachment(message.attachment)
                                  ? "call recording"
                                  : "voice message"}
                              </p>
                            </div>
                           </div>
                         ) : null}
                         {message.unsent ? (
                           <p className="chat-bubble-text italic text-white/70">
                             {message.from === "me"
                               ? "You unsent a message."
                               : "This message was unsent."}
                           </p>
                         ) : message.text ? (
                           <p className="chat-bubble-text">{message.text}</p>
                         ) : null}
                         {isCallRecordingAttachment(message.attachment) ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <a
                              href={message.attachment?.url}
                              download={message.attachment?.name ?? `motion-recording-${message.id}.webm`}
                              className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white transition hover:border-white/50 hover:bg-white/16"
                            >
                              Download
                            </a>
                            {onDeleteRecording ? (
                              <button
                                type="button"
                                onClick={() => onDeleteRecording(message.id)}
                                disabled={deletingRecordingId === message.id}
                                className="rounded-full border border-rose-200/55 bg-rose-500/10 px-3 py-1 text-[10px] font-semibold text-rose-100 transition hover:border-rose-200/75 hover:bg-rose-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingRecordingId === message.id
                                  ? "Removing..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        {message.from === "me" ? (
                          <div className="chat-bubble-meta is-me">
                            <span className="sr-only">{message.deliveryState}</span>
                            <MessageTicks state={message.deliveryState} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                     {!message.unsent && message.reactions.length > 0 ? (
                       <div
                         className={`mt-1 flex flex-wrap gap-1 ${
                          message.from === "me" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.reactions.map((reaction) => (
                          <button
                            key={`${message.id}-${reaction.emoji}`}
                            type="button"
                            onClick={() => onToggleReaction(message.id, reaction.emoji)}
                            className={`chat-reaction-chip ${reaction.mine ? "is-mine" : ""}`}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                     <div
                       className={`mt-1 flex ${
                         message.from === "me" ? "justify-end" : "justify-start"
                       }`}
                     >
                       <div className="relative flex items-center gap-2">
                         {onReplyToMessage && !message.unsent ? (
                           <button
                             type="button"
                             onClick={() => onReplyToMessage(message.id)}
                             className="chat-react-trigger"
                             aria-label="Reply to message"
                             title="Reply"
                           >
                             ↩
                           </button>
                         ) : null}
                         {!message.unsent ? (
                           <div className="relative">
                             <button
                               type="button"
                               onClick={() => onToggleReactionMenu(message.id)}
                               className="chat-react-trigger"
                               aria-label="React to message"
                             >
                               {"\u{1F642}"}
                             </button>
                             {reactionMenuId === message.id ? (
                               <div className="chat-reaction-picker">
                                 {chatReactions.map((emoji) => (
                                   <button
                                     key={`${message.id}-${emoji}`}
                                     type="button"
                                     onClick={() => onToggleReaction(message.id, emoji)}
                                     className="chat-reaction-option"
                                   >
                                     {emoji}
                                   </button>
                                 ))}
                               </div>
                             ) : null}
                           </div>
                          ) : null}
                          {onReportMessage && message.from === "them" && !message.unsent ? (
                            <button
                              type="button"
                              onClick={() => onReportMessage(message.id)}
                              className="chat-react-trigger"
                              aria-label="Report message"
                              title="Report"
                            >
                              Report
                            </button>
                          ) : null}
                          {onUnsendMessage && message.canUnsend ? (
                            <button
                             type="button"
                             onClick={() => onUnsendMessage(message.id)}
                             disabled={unsendingMessageId === message.id}
                             className="chat-react-trigger"
                             aria-label="Unsend message"
                             title="Unsend"
                           >
                             {unsendingMessageId === message.id ? "..." : "Unsend"}
                           </button>
                         ) : null}
                       </div>
                     </div>
                   </div>
                   )
                 ))}
                {normalizedThreadSearch && visibleThreadMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                    No messages in this thread match “{threadSearch}”.
                  </div>
                ) : null}
                {(messageTab === "calls" || messageTab === "recordings") &&
                visibleThreadMessages.length === 0 &&
                !normalizedThreadSearch ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                    {messageTab === "recordings"
                      ? "No saved recordings in this thread yet."
                      : "No call history or saved recordings in this thread yet."}
                  </div>
                ) : null}
                {messageTab === "chats" &&
                visibleThreadMessages.length === 0 &&
                !normalizedThreadSearch ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                    No messages in this thread yet.
                  </div>
                ) : null}
                {messageTab === "chats" && activeConversation?.typing ? (
                  <div className="chat-typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}
              </div>
              {messageTab === "chats" ? (
                <form onSubmit={onSubmit} className="chat-composer px-3 py-2.5">
                {replyingToMessage ? (
                  <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/75 px-3 py-2 text-[11px] text-slate-600">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">
                        Replying to {replyingToMessage.from === "me" ? "You" : activeConversation?.name ?? "them"}
                      </p>
                      <p className="truncate text-slate-500">
                        {replyingToMessage.unsent
                          ? "Message unsent"
                          : replyingToMessage.text ||
                            (replyingToMessage.attachment?.type === "image"
                              ? "Photo"
                              : replyingToMessage.attachment?.type === "video"
                                ? "Video"
                                : replyingToMessage.attachment?.type === "audio"
                                  ? "Voice message"
                                  : "Message")}
                      </p>
                    </div>
                    {onClearReplyTo ? (
                      <button
                        type="button"
                        onClick={onClearReplyTo}
                        className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] font-semibold text-slate-500"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex gap-2">
                <input
                  ref={chatPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    onChatPhotoSelection(event.target.files);
                  }}
                />
                <button
                  type="button"
                  onClick={() => chatPhotoInputRef.current?.click()}
                  className="chat-composer-button grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-60"
                  aria-label="Send photo"
                  disabled={!activeId || chatUploading || chatSending || recording || conversationBlocked || conversationRestricted}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4.2" width="14" height="11.6" rx="2" />
                    <path d="M6.2 12.5 8.6 10l2.2 2.1 3.2-3.2 2 2.2" />
                    <circle cx="7.1" cy="7.8" r="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onToggleRecording}
                  className={`chat-composer-button grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-60 ${
                    recording ? "is-recording" : ""
                  }`}
                  aria-label={recording ? "Stop recording" : "Record voice message"}
                  disabled={!activeId || chatUploading || chatSending || conversationBlocked || conversationRestricted}
                >
                  {recording ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                      <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="7" y="3" width="6" height="10" rx="3" />
                      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0" />
                      <path d="M10 15v2.5" />
                    </svg>
                  )}
                </button>
                <input
                  value={text}
                  onChange={(event) => onMessageInputChange(event.target.value)}
                  className="chat-composer-input h-9 flex-1 rounded-full px-4 text-xs transition focus:outline-none"
                  placeholder={
                    conversationBlocked
                      ? "Blocked conversation"
                      : conversationRestricted
                        ? "Followers only"
                        : recording
                          ? "Recording voice message..."
                          : "Type a message..."
                  }
                  disabled={!activeId || chatUploading || conversationBlocked || conversationRestricted}
                />
                <button
                  className="chat-composer-button is-send grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:brightness-110 disabled:opacity-60"
                  type="submit"
                  aria-label="Send message"
                  disabled={!activeId || !text.trim() || chatUploading || chatSending || conversationBlocked || conversationRestricted}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 2 9 11" />
                    <path d="m18 2-7 18-3-8-8-3z" />
                  </svg>
                </button>
                </div>
                {conversationBlocked ? (
                  <p className="mt-2 text-[11px] font-medium text-rose-300">
                    This conversation is blocked. Unblock the account to message, call, or share media
                    here again.
                  </p>
                ) : conversationRestricted ? (
                  <p className="mt-2 text-[11px] font-medium text-amber-200">
                    This account only allows messages and calls from followers.
                  </p>
                ) : null}
                </form>
              ) : (
                <div className="border-t border-[var(--line)] px-4 py-3 text-[11px] font-semibold text-slate-500">
                  {messageTab === "recordings"
                    ? "Saved recordings only. Switch back to Chats to send a message."
                    : "Call logs only. Switch back to Chats to send a message."}
                </div>
              )}
              {messageTab === "chats" && (recording || chatUploading) ? (
                <div className="chat-composer-status border-t border-[var(--line)] px-4 py-2 text-[11px] font-semibold text-slate-500">
                  {recording ? "Recording voice message..." : "Sending media..."}
                </div>
              ) : null}
              {messageTab === "chats" && !recording && !chatUploading && (conversationBlocked || conversationRestricted) ? (
                <div className="chat-composer-status border-t border-[var(--line)] px-4 py-2 text-[11px] font-semibold text-slate-500">
                  {conversationBlocked
                    ? "This thread is blocked right now."
                    : "This account only allows messages from followers."}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="chat-thread-empty">
              <p>Select a thread to see messages.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
