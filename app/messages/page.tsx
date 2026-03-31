"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import ChatPanel from "@/components/home/chat-panel";
import UserAvatar from "@/components/user-avatar";
import type {
  ChatWallpaper,
  ChatWallpaperTarget,
} from "@/lib/chat-wallpapers";
import {
  MOTION_CALL_STATE_EVENT,
  MOTION_CALL_SYNC_REQUEST_EVENT,
  MOTION_START_CALL_EVENT,
  type MotionCallStateDetail,
  type MotionStartCallDetail,
} from "@/lib/call-events";
import type {
  CallMode,
  CallSessionDto,
  ConversationDto,
  MessageDto,
} from "@/lib/server/types";

type ViewportMode = "desktop" | "tablet" | "mobile";
type MessagePanelTab = "chats" | "calls" | "recordings";
type CallTypeFilter = "all" | "voice" | "video";
type CallDirectionFilter = "all" | "incoming" | "outgoing" | "missed";
type User = {
  id: string;
  name: string;
  handle: string;
  chatWallpaper?: ChatWallpaper;
  restrictedAccount?: boolean;
  avatarGradient: string;
  avatarUrl?: string;
};
type FriendActivity = {
  id: string;
  isActive: boolean;
};

type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
};

type ConversationWallpaperState = Pick<
  ConversationDto,
  | "chatWallpaper"
  | "chatWallpaperUrl"
  | "chatWallpaperLight"
  | "chatWallpaperLightUrl"
  | "chatWallpaperDark"
  | "chatWallpaperDarkUrl"
  | "chatWallpaperBlur"
  | "chatWallpaperDim"
>;

type ChatUploadResponse = {
  attachment: NonNullable<MessageDto["attachment"]>;
};

function isViewportMode(value: string | null): value is ViewportMode {
  return value === "desktop" || value === "tablet" || value === "mobile";
}

function isMessagePanelTab(value: string | null): value is MessagePanelTab {
  return value === "chats" || value === "calls" || value === "recordings";
}

function isCallTypeFilter(value: string | null): value is CallTypeFilter {
  return value === "all" || value === "voice" || value === "video";
}

function isCallDirectionFilter(value: string | null): value is CallDirectionFilter {
  return (
    value === "all" ||
    value === "incoming" ||
    value === "outgoing" ||
    value === "missed"
  );
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers, cache: "no-store" });

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }

  return payload as T;
}

function formatChatTime(isoDate: string): string {
  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatVoiceDuration(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function MessagesStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");
  const requestedDirection = searchParams.get("direction");
  const requestedType = searchParams.get("type");
  const requestedTab = searchParams.get("tab");

  const [user, setUser] = useState<User | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messageTab, setMessageTab] = useState<MessagePanelTab>("chats");
  const [chatSearch, setChatSearch] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [text, setText] = useState("");
  const [callTypeFilter, setCallTypeFilter] = useState<CallTypeFilter>("all");
  const [callDirectionFilter, setCallDirectionFilter] =
    useState<CallDirectionFilter>("all");
  const [friendActivity, setFriendActivity] = useState<
    Record<string, FriendActivity | undefined>
  >({});
  const [currentCall, setCurrentCall] = useState<CallSessionDto | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [currentCallStatusLabel, setCurrentCallStatusLabel] = useState("");
  const [markingMissedCallsSeen, setMarkingMissedCallsSeen] = useState(false);
  const [savingChatWallpaper, setSavingChatWallpaper] = useState(false);
  const [pinningConversation, setPinningConversation] = useState(false);
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null);
  const [bulkDeletingRecordings, setBulkDeletingRecordings] = useState(false);
  const [chatUploading, setChatUploading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [unsendingMessageId, setUnsendingMessageId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [groupCallOpen, setGroupCallOpen] = useState(false);
  const [groupCallQuery, setGroupCallQuery] = useState("");
  const [groupCallResults, setGroupCallResults] = useState<UserSearchResult[]>([]);
  const [groupCallLoading, setGroupCallLoading] = useState(false);
  const [groupCallError, setGroupCallError] = useState<string | null>(null);
  const [groupCallSelectionIds, setGroupCallSelectionIds] = useState<string[]>([]);
  const [activeConversationSafety, setActiveConversationSafety] = useState<{
    blocked: boolean;
    muted: boolean;
    restrictedAccount: boolean;
    canMessage: boolean;
    messageGateReason: "blocked" | "restricted" | "missing" | null;
  } | null>(null);
  const [safetyAction, setSafetyAction] = useState<"block" | "mute" | "report" | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const chatPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingSentRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const loadConversations = useCallback(async () => {
    const convoRes = await req<{ conversations: ConversationDto[] }>(
      "/api/messages/conversations",
    );
    setConversations(convoRes.conversations);
    setActiveId((current) => {
      const preferredId =
        requestedConversationId &&
        convoRes.conversations.some(
          (conversation) => conversation.id === requestedConversationId,
        )
          ? requestedConversationId
          : current;

      return preferredId &&
        convoRes.conversations.some((conversation) => conversation.id === preferredId)
        ? preferredId
        : convoRes.conversations[0]?.id ?? null;
    });
    return convoRes.conversations;
  }, [requestedConversationId]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const payload = await req<{
      conversation?: Partial<ConversationDto> & { id: string };
      messages: MessageDto[];
    }>(`/api/messages/${conversationId}`);
    setMessages(payload.messages);
    if (payload.conversation) {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === payload.conversation?.id
            ? {
                ...conversation,
                ...payload.conversation,
                unread: 0,
                missedCallCount: 0,
              }
            : conversation,
        ),
      );
    }
    return payload.messages;
  }, []);

  const updateMessageInState = useCallback((nextMessage: MessageDto) => {
    setMessages((current) =>
      current.map((message) => (message.id === nextMessage.id ? nextMessage : message)),
    );
  }, []);

  const postTypingState = useCallback(async (conversationId: string, typing: boolean) => {
    try {
      await req<{ ok: boolean }>(`/api/messages/${conversationId}/typing`, {
        method: "POST",
        body: JSON.stringify({ typing }),
      });
    } catch {
      // Ignore transient typing errors.
    }
  }, []);

  const clearTypingState = useCallback(
    (conversationId?: string | null) => {
      typingSentRef.current = false;

      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }

      if (!user || !conversationId) {
        return;
      }

      void postTypingState(conversationId, false);
    },
    [postTypingState, user],
  );

  const cancelVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = null;
    setRecording(false);
  }, []);

  const deleteRecordingMessage = useCallback(
    async (messageId: string) => {
      if (!activeId || deletingRecordingId) {
        return;
      }

      const confirmed =
        typeof window === "undefined"
          ? true
          : window.confirm("Delete this saved call recording from the thread?");

      if (!confirmed) {
        return;
      }

      setDeletingRecordingId(messageId);
      setError(null);

      try {
        await req<{ ok: boolean }>(`/api/messages/${activeId}/recordings/${messageId}`, {
          method: "DELETE",
        });
        setMessages((current) => current.filter((message) => message.id !== messageId));
        await loadConversations();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete the recording.",
        );
      } finally {
        setDeletingRecordingId(null);
      }
    },
    [activeId, deletingRecordingId, loadConversations],
  );

  const deleteAllRecordingsInThread = useCallback(async () => {
    if (!activeId || bulkDeletingRecordings) {
      return;
    }

    const recordingTotal =
      conversations.find((conversation) => conversation.id === activeId)?.recordingCount ?? 0;
    if (recordingTotal <= 0) {
      return;
    }

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Delete all ${recordingTotal} saved recording${
              recordingTotal === 1 ? "" : "s"
            } from this thread?`,
          );

    if (!confirmed) {
      return;
    }

    setBulkDeletingRecordings(true);
    setError(null);

    try {
      await req<{ ok: boolean; deletedCount: number }>(`/api/messages/${activeId}/recordings`, {
        method: "DELETE",
      });
      setMessages((current) =>
        current.filter(
          (message) =>
            !message.attachment?.name?.startsWith("motion-call-recording-"),
        ),
      );
      await loadConversations();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the recordings.",
      );
    } finally {
      setBulkDeletingRecordings(false);
    }
  }, [activeId, bulkDeletingRecordings, conversations, loadConversations]);

  useEffect(() => {
    const storedViewport = window.localStorage.getItem("motion-viewport");
    if (isViewportMode(storedViewport)) {
      setViewportMode(storedViewport);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("motion-viewport", viewportMode);
  }, [viewportMode]);

  useEffect(() => {
    if (isCallDirectionFilter(requestedDirection)) {
      setCallDirectionFilter(requestedDirection);
    }

    if (isCallTypeFilter(requestedType)) {
      setCallTypeFilter(requestedType);
    }

    if (isMessagePanelTab(requestedTab)) {
      setMessageTab(requestedTab);
    }
  }, [requestedDirection, requestedTab, requestedType]);

  useEffect(() => {
    if (
      requestedConversationId &&
      conversations.some((conversation) => conversation.id === requestedConversationId)
    ) {
      setActiveId(requestedConversationId);
    }
  }, [conversations, requestedConversationId]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });

        if (meResponse.status === 401) {
          router.replace("/");
          return;
        }

        const mePayload = (await meResponse.json()) as { user: User };

        if (!active) {
          return;
        }

        setUser(mePayload.user);
        await loadConversations();
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load call history.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadConversations, router]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const handleCallState = (event: Event) => {
      const detail = (event as CustomEvent<MotionCallStateDetail>).detail;

      if (!detail) {
        return;
      }

      setCurrentCall((detail.session as CallSessionDto | null) ?? null);
      setCallBusy(Boolean(detail.busy));
      setCurrentCallStatusLabel(detail.statusLabel ?? "");

      if (detail.session?.conversationId) {
        setActiveId(detail.session.conversationId);
      }

      if (!detail.conversationId) {
        return;
      }

      void loadConversations().catch(() => undefined);

      if (activeIdRef.current === detail.conversationId) {
        void loadConversationMessages(detail.conversationId).catch(() => undefined);
      }
    };

    window.addEventListener(MOTION_CALL_STATE_EVENT, handleCallState as EventListener);
    window.dispatchEvent(new Event(MOTION_CALL_SYNC_REQUEST_EVENT));

    return () => {
      window.removeEventListener(
        MOTION_CALL_STATE_EVENT,
        handleCallState as EventListener,
      );
    };
  }, [loadConversationMessages, loadConversations]);

  useEffect(() => {
    if (!user) {
      setFriendActivity({});
      return;
    }

    let active = true;

    const pingPresence = async () => {
      try {
        const payload = await req<{
          activity: Array<
            FriendActivity & {
              name: string;
              handle: string;
              avatarGradient: string;
              avatarUrl?: string;
              lastActiveAt?: string | null;
            }
          >;
        }>("/api/presence", {
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
        // Ignore transient presence failures.
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
    if (!activeId) {
      setMessages([]);
      return;
    }

    void loadConversationMessages(activeId).catch((loadError: unknown) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load this conversation.",
      );
    });
  }, [activeId, loadConversationMessages]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const refreshMessages = async () => {
      try {
        await loadConversations();
        if (!active || !activeIdRef.current) {
          return;
        }

        await loadConversationMessages(activeIdRef.current);
      } catch {
        // Ignore refresh failures.
      }
    };

    void refreshMessages();
    const interval = window.setInterval(refreshMessages, 4_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadConversationMessages, loadConversations, user]);

  useEffect(() => {
    return () => {
      clearTypingState(activeIdRef.current);
    };
  }, [clearTypingState]);

  useEffect(() => {
    if (!chatThreadRef.current) {
      return;
    }

    chatThreadRef.current.scrollTo({
      top: chatThreadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, activeId, conversations]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeId) ?? null,
    [activeId, conversations],
  );
  const replyingToMessage = useMemo(
    () =>
      replyingToMessageId
        ? messages.find((message) => message.id === replyingToMessageId) ?? null
        : null,
    [messages, replyingToMessageId],
  );

  const groupCallSelectionSet = useMemo(
    () => new Set(groupCallSelectionIds),
    [groupCallSelectionIds],
  );

  const activeConversationCall = useMemo(
    () =>
      currentCall && activeId && currentCall.conversationId === activeId
        ? currentCall
        : null,
    [activeId, currentCall],
  );

  const callStatusLabel = useMemo(() => {
    if (!activeConversationCall) {
      return null;
    }

    if (activeConversationCall.status === "ringing") {
      return activeConversationCall.isIncoming ? "Incoming" : "Calling";
    }

    if (activeConversationCall.status === "connecting") {
      return "Connecting";
    }

    if (activeConversationCall.status === "active") {
      return currentCallStatusLabel.toLowerCase().includes("connected")
        ? "Live"
        : "Active";
    }

    return activeConversationCall.status;
  }, [activeConversationCall, currentCallStatusLabel]);

  const filteredConversations = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesSearch =
        !query ||
        conversation.name.toLowerCase().includes(query) ||
        conversation.lastMessage.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (messageTab === "calls") {
        const hasAnyCallHistory =
          conversation.hasVoiceCallHistory || conversation.hasVideoCallHistory;

        if (!hasAnyCallHistory) {
          return false;
        }
      }

      if (messageTab === "recordings" && !conversation.hasRecordingHistory) {
        return false;
      }

      if (messageTab !== "calls") {
        return true;
      }

      if (callDirectionFilter === "incoming" && !conversation.hasIncomingCallHistory) {
        return false;
      }

      if (callDirectionFilter === "outgoing" && !conversation.hasOutgoingCallHistory) {
        return false;
      }

      if (callDirectionFilter === "missed" && conversation.missedCallCount <= 0) {
        return false;
      }

      if (callTypeFilter === "voice" && !conversation.hasVoiceCallHistory) {
        return false;
      }

      if (callTypeFilter === "video" && !conversation.hasVideoCallHistory) {
        return false;
      }

      return true;
    });
  }, [callDirectionFilter, callTypeFilter, chatSearch, conversations, messageTab]);

  useEffect(() => {
    if (messageTab === "chats" && activeId) {
      return;
    }

    if (filteredConversations.length === 0) {
      return;
    }

    if (activeId && filteredConversations.some((conversation) => conversation.id === activeId)) {
      return;
    }

    setActiveId(filteredConversations[0]?.id ?? null);
  }, [activeId, filteredConversations, messageTab]);

  const missedCallsTotal = useMemo(
    () =>
      conversations.reduce(
        (sum, conversation) => sum + conversation.missedCallCount,
        0,
      ),
    [conversations],
  );

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
    [conversations],
  );

  const recordingThreadsTotal = useMemo(
    () => conversations.filter((conversation) => conversation.hasRecordingHistory).length,
    [conversations],
  );

  useEffect(() => {
    if (!groupCallOpen || !user) {
      setGroupCallResults([]);
      setGroupCallLoading(false);
      setGroupCallError(null);
      return;
    }

    let active = true;
    setGroupCallLoading(true);
    setGroupCallError(null);

    const handle = window.setTimeout(async () => {
      try {
        const query = groupCallQuery.trim();
        const callConversation =
          conversations.find((conversation) => conversation.id === activeId) ?? null;
        const payload = await req<{ users: UserSearchResult[] }>(
          `/api/users${query ? `?q=${encodeURIComponent(query)}` : ""}`,
        );

        if (!active) {
          return;
        }

        const excludedIds = new Set<string>(
          [user.id, callConversation?.userId]
            .filter((value): value is string => Boolean(value)),
        );

        setGroupCallResults(
          (payload.users ?? []).filter((candidate) => !excludedIds.has(candidate.id)),
        );
      } catch (searchError) {
        if (!active) {
          return;
        }

        setGroupCallResults([]);
        setGroupCallError(
          searchError instanceof Error ? searchError.message : "Could not load people.",
        );
      } finally {
        if (active) {
          setGroupCallLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [activeId, conversations, groupCallOpen, groupCallQuery, user]);

  useEffect(() => {
    setThreadSearch("");
    setReplyingToMessageId(null);
    setReactionMenuId(null);
  }, [activeId]);

  useEffect(() => {
    if (
      replyingToMessageId &&
      !messages.some((message) => message.id === replyingToMessageId)
    ) {
      setReplyingToMessageId(null);
    }
  }, [messages, replyingToMessageId]);

  useEffect(() => {
    if (!user || !activeConversation?.userId || activeConversation.isGroup) {
      setActiveConversationSafety(null);
      return;
    }

    let active = true;

    const loadSafety = async () => {
      try {
        const payload = await req<{
          blocked: boolean;
          muted: boolean;
          restrictedAccount: boolean;
          canMessage: boolean;
          messageGateReason: "blocked" | "restricted" | "missing" | null;
        }>(`/api/safety/${activeConversation.userId}`);

        if (!active) {
          return;
        }

        setActiveConversationSafety(payload);
      } catch {
        if (active) {
          setActiveConversationSafety(null);
        }
      }
    };

    void loadSafety();

    return () => {
      active = false;
    };
  }, [activeConversation?.id, activeConversation?.isGroup, activeConversation?.userId, user]);

  const startGlobalCall = useCallback(
    (mode: CallMode) => {
      if (!activeId || typeof window === "undefined" || callBusy || currentCall) {
        return;
      }

      if (activeConversationSafety?.blocked) {
        setError("This conversation is blocked. Unblock the account to call again.");
        return;
      }

      if (!activeConversationSafety?.canMessage) {
        setError("This account only allows calls from followers.");
        return;
      }

      window.dispatchEvent(
        new CustomEvent<MotionStartCallDetail>(MOTION_START_CALL_EVENT, {
          detail: { conversationId: activeId, mode },
        }),
      );
    },
    [activeConversationSafety?.blocked, activeConversationSafety?.canMessage, activeId, callBusy, currentCall],
  );

  const updateConversationSafety = useCallback(
    async (action: "block" | "mute") => {
      if (!activeConversation?.userId || activeConversation.isGroup) {
        return;
      }

      setSafetyAction(action);
      setError(null);
      setNotice(null);

      try {
        const payload = await req<{
          blocked: boolean;
          muted: boolean;
          restrictedAccount: boolean;
          canMessage: boolean;
          messageGateReason: "blocked" | "restricted" | "missing" | null;
        }>(`/api/safety/${activeConversation.userId}`, {
          method: "POST",
          body: JSON.stringify({ action }),
        });

        setActiveConversationSafety(payload);
        setNotice(
          action === "block"
            ? payload.blocked
              ? "Account blocked. Messages and calls are now locked."
              : "Account unblocked."
            : payload.muted
              ? "Account muted. Their posts, moves, and notifications will stay quieter."
              : "Account unmuted.",
        );

        if (action === "block" && payload.blocked) {
          setMessages([]);
          await loadConversations();
        }
      } catch (safetyError) {
        setError(
          safetyError instanceof Error
            ? safetyError.message
            : "Could not update safety settings.",
        );
      } finally {
        setSafetyAction(null);
      }
    },
    [activeConversation?.isGroup, activeConversation?.userId, loadConversations],
  );

  const reportConversationUser = useCallback(async () => {
    if (!activeConversation?.userId || activeConversation.isGroup) {
      return;
    }

    const reason =
      typeof window === "undefined"
        ? ""
        : window.prompt("Why are you reporting this account?", "Harassment");

    if (!reason || reason.trim().length < 3) {
      return;
    }

    setSafetyAction("report");
    setError(null);
    setNotice(null);

    try {
      await req<{ ok: boolean }>("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType: "account",
          targetId: activeConversation.userId,
          targetUserId: activeConversation.userId,
          conversationId: activeConversation.id,
          reason: reason.trim(),
        }),
      });
      setNotice("Account reported. Motion added it to the safety queue.");
    } catch (reportError) {
      setError(
        reportError instanceof Error ? reportError.message : "Could not submit the report.",
      );
    } finally {
      setSafetyAction(null);
    }
  }, [activeConversation]);

  const reportMessage = useCallback(
    async (messageId: string) => {
      const targetMessage = messages.find((message) => message.id === messageId);
      if (!targetMessage || targetMessage.from !== "them" || !activeConversation) {
        return;
      }

      const reason =
        typeof window === "undefined"
          ? ""
          : window.prompt("Why are you reporting this message?", "Harassment");

      if (!reason || reason.trim().length < 3) {
        return;
      }

      setError(null);
      setNotice(null);

      try {
        await req<{ ok: boolean }>("/api/reports", {
          method: "POST",
          body: JSON.stringify({
            targetType: "message",
            targetId: messageId,
            targetUserId: activeConversation.userId,
            conversationId: activeConversation.id,
            reason: reason.trim(),
          }),
        });
        setNotice("Message reported. Motion added it to the safety queue.");
      } catch (reportError) {
        setError(
          reportError instanceof Error ? reportError.message : "Could not submit the report.",
        );
      }
    },
    [activeConversation, messages],
  );

  const saveChatWallpaper = useCallback(
    async (wallpaper: ChatWallpaper, slot: ChatWallpaperTarget = "all") => {
      if (!activeId || savingChatWallpaper) {
        return;
      }

      const currentConversation =
        conversations.find((conversation) => conversation.id === activeId) ?? null;
      const currentSlotWallpaper =
        slot === "light"
          ? currentConversation?.chatWallpaperLight
          : slot === "dark"
            ? currentConversation?.chatWallpaperDark
            : currentConversation?.chatWallpaper;
      const currentSlotWallpaperUrl =
        slot === "light"
          ? currentConversation?.chatWallpaperLightUrl
          : slot === "dark"
            ? currentConversation?.chatWallpaperDarkUrl
            : currentConversation?.chatWallpaperUrl;

      if (currentSlotWallpaper === wallpaper && !currentSlotWallpaperUrl) {
        return;
      }

      setSavingChatWallpaper(true);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeId
            ? {
                ...conversation,
                ...(slot === "light"
                  ? {
                      chatWallpaperLight: wallpaper,
                      chatWallpaperLightUrl: undefined,
                    }
                  : slot === "dark"
                    ? {
                        chatWallpaperDark: wallpaper,
                        chatWallpaperDarkUrl: undefined,
                      }
                    : {
                        chatWallpaper: wallpaper,
                        chatWallpaperUrl: undefined,
                      }),
              }
            : conversation,
        ),
      );

      try {
        const payload = await req<{
          conversation: { id: string } & ConversationWallpaperState;
        }>(`/api/messages/${activeId}/wallpaper`, {
          method: "PATCH",
          body: JSON.stringify({ wallpaper, slot }),
        });
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === payload.conversation.id
              ? {
                  ...conversation,
                  ...payload.conversation,
                }
              : conversation,
          ),
        );
      } catch (wallpaperError) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeId
              ? {
                  ...conversation,
                  ...(slot === "light"
                    ? {
                        chatWallpaperLight: currentConversation?.chatWallpaperLight,
                        chatWallpaperLightUrl: currentConversation?.chatWallpaperLightUrl,
                      }
                    : slot === "dark"
                      ? {
                          chatWallpaperDark: currentConversation?.chatWallpaperDark,
                          chatWallpaperDarkUrl: currentConversation?.chatWallpaperDarkUrl,
                        }
                      : {
                          chatWallpaper: currentConversation?.chatWallpaper,
                          chatWallpaperUrl: currentConversation?.chatWallpaperUrl,
                        }),
                }
              : conversation,
          ),
        );
        setError(
          wallpaperError instanceof Error
            ? wallpaperError.message
            : "Could not update this chat wallpaper.",
        );
      } finally {
        setSavingChatWallpaper(false);
      }
    },
    [activeId, conversations, savingChatWallpaper],
  );

  const resetChatWallpaper = useCallback(
    async (slot: ChatWallpaperTarget = "all") => {
      if (!activeId || savingChatWallpaper) {
        return;
      }

      const currentConversation =
        conversations.find((conversation) => conversation.id === activeId) ?? null;
      const hasCurrentValue =
        slot === "light"
          ? Boolean(
              currentConversation?.chatWallpaperLight ||
                currentConversation?.chatWallpaperLightUrl,
            )
          : slot === "dark"
            ? Boolean(
                currentConversation?.chatWallpaperDark ||
                  currentConversation?.chatWallpaperDarkUrl,
              )
            : Boolean(currentConversation?.chatWallpaper || currentConversation?.chatWallpaperUrl);
      if (!hasCurrentValue) {
        return;
      }

      setSavingChatWallpaper(true);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeId
            ? {
                ...conversation,
                ...(slot === "light"
                  ? {
                      chatWallpaperLight: undefined,
                      chatWallpaperLightUrl: undefined,
                    }
                  : slot === "dark"
                    ? {
                        chatWallpaperDark: undefined,
                        chatWallpaperDarkUrl: undefined,
                      }
                    : {
                        chatWallpaper: undefined,
                        chatWallpaperUrl: undefined,
                      }),
              }
            : conversation,
        ),
      );

      try {
        const payload = await req<{
          conversation: { id: string } & ConversationWallpaperState;
        }>(`/api/messages/${activeId}/wallpaper`, {
          method: "PATCH",
          body: JSON.stringify({ wallpaper: null, slot }),
        });
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === payload.conversation.id
              ? {
                  ...conversation,
                  ...payload.conversation,
                }
              : conversation,
          ),
        );
      } catch (wallpaperError) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeId
              ? {
                  ...conversation,
                  ...(slot === "light"
                    ? {
                        chatWallpaperLight: currentConversation?.chatWallpaperLight,
                        chatWallpaperLightUrl: currentConversation?.chatWallpaperLightUrl,
                      }
                    : slot === "dark"
                      ? {
                          chatWallpaperDark: currentConversation?.chatWallpaperDark,
                          chatWallpaperDarkUrl: currentConversation?.chatWallpaperDarkUrl,
                        }
                      : {
                          chatWallpaper: currentConversation?.chatWallpaper,
                          chatWallpaperUrl: currentConversation?.chatWallpaperUrl,
                        }),
                }
              : conversation,
          ),
        );
        setError(
          wallpaperError instanceof Error
            ? wallpaperError.message
            : "Could not reset the chat wallpaper.",
        );
      } finally {
        setSavingChatWallpaper(false);
      }
    },
    [activeId, conversations, savingChatWallpaper],
  );

  const uploadChatWallpaper = useCallback(
    async (file: File | null, slot: ChatWallpaperTarget = "all") => {
      if (!activeId || !file || savingChatWallpaper) {
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("slot", slot);
      const currentConversation =
        conversations.find((conversation) => conversation.id === activeId) ?? null;

      setSavingChatWallpaper(true);

      try {
        const payload = await req<{
          conversation: { id: string } & ConversationWallpaperState;
        }>(`/api/messages/${activeId}/wallpaper`, {
          method: "POST",
          body: formData,
        });
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === payload.conversation.id
              ? {
                  ...conversation,
                  ...payload.conversation,
                }
              : conversation,
          ),
        );
      } catch (wallpaperError) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeId
              ? {
                  ...conversation,
                  ...(slot === "light"
                    ? {
                        chatWallpaperLight: currentConversation?.chatWallpaperLight,
                        chatWallpaperLightUrl: currentConversation?.chatWallpaperLightUrl,
                      }
                    : slot === "dark"
                      ? {
                          chatWallpaperDark: currentConversation?.chatWallpaperDark,
                          chatWallpaperDarkUrl: currentConversation?.chatWallpaperDarkUrl,
                        }
                      : {
                          chatWallpaper: currentConversation?.chatWallpaper,
                          chatWallpaperUrl: currentConversation?.chatWallpaperUrl,
                        }),
                }
              : conversation,
          ),
        );
        setError(
          wallpaperError instanceof Error
            ? wallpaperError.message
            : "Could not upload the chat wallpaper.",
        );
      } finally {
        setSavingChatWallpaper(false);
      }
    },
    [activeId, conversations, savingChatWallpaper],
  );

  const saveChatWallpaperEffects = useCallback(
    async (effects: { blur: number; dim: number }) => {
      if (!activeId || savingChatWallpaper) {
        return;
      }

      const currentConversation =
        conversations.find((conversation) => conversation.id === activeId) ?? null;

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeId
            ? {
                ...conversation,
                chatWallpaperBlur: effects.blur,
                chatWallpaperDim: effects.dim,
              }
            : conversation,
        ),
      );

      try {
        const payload = await req<{
          conversation: { id: string } & ConversationWallpaperState;
        }>(`/api/messages/${activeId}/wallpaper`, {
          method: "PATCH",
          body: JSON.stringify(effects),
        });
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === payload.conversation.id
              ? {
                  ...conversation,
                  ...payload.conversation,
                }
              : conversation,
          ),
        );
      } catch (wallpaperError) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeId
              ? {
                  ...conversation,
                  chatWallpaperBlur: currentConversation?.chatWallpaperBlur,
                  chatWallpaperDim: currentConversation?.chatWallpaperDim,
                }
              : conversation,
          ),
        );
        setError(
          wallpaperError instanceof Error
            ? wallpaperError.message
            : "Could not update chat wallpaper styling.",
        );
      }
    },
    [activeId, conversations, savingChatWallpaper],
  );

  const markAllMissedCallsSeen = useCallback(async () => {
    if (markingMissedCallsSeen || missedCallsTotal <= 0) {
      return;
    }

    setMarkingMissedCallsSeen(true);

    try {
      await req<{ markedCount: number; conversationIds: string[] }>(
        "/api/messages/calls/seen",
        {
          method: "POST",
        },
      );

      await loadConversations();

      if (activeId) {
        await loadConversationMessages(activeId);
      }
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Could not mark missed calls as seen.",
      );
    } finally {
      setMarkingMissedCallsSeen(false);
    }
  }, [
    activeId,
    loadConversationMessages,
    loadConversations,
    markingMissedCallsSeen,
    missedCallsTotal,
  ]);

  const handleMessageInputChange = useCallback(
    (value: string) => {
      setText(value);

      if (!user || !activeId) {
        return;
      }

      if (!value.trim()) {
        clearTypingState(activeId);
        return;
      }

      if (!typingSentRef.current) {
        typingSentRef.current = true;
        void postTypingState(activeId, true);
      }

      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      typingStopTimerRef.current = window.setTimeout(() => {
        typingSentRef.current = false;
        void postTypingState(activeId, false);
        typingStopTimerRef.current = null;
      }, 1600);
    },
    [activeId, clearTypingState, postTypingState, user],
  );

  const uploadChatAttachment = useCallback(async (file: File, durationMs?: number) => {
    const formData = new FormData();
    formData.append("file", file);
    if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
      formData.append("durationMs", String(durationMs));
    }

    return req<ChatUploadResponse>("/api/messages/upload", {
      method: "POST",
      body: formData,
    });
  }, []);

  const sendMessagePayload = useCallback(
    async ({
      text: nextText,
      attachment,
    }: {
      text?: string;
      attachment?: NonNullable<MessageDto["attachment"]>;
    }) => {
      if (!activeId) {
        return;
      }

      clearTypingState(activeId);
      setChatSending(true);
      setError(null);

      try {
        const message = await req<MessageDto>(`/api/messages/${activeId}`, {
          method: "POST",
          body: JSON.stringify({
            text: nextText ?? "",
            attachment,
            replyToId: replyingToMessageId ?? undefined,
          }),
        });
        setMessages((current) => [...current, message]);
        setText("");
        setReplyingToMessageId(null);
        setReactionMenuId(null);
        await loadConversations();
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Message failed.");
      } finally {
        setChatSending(false);
      }
    },
    [activeId, clearTypingState, loadConversations, replyingToMessageId],
  );

  const send = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      if (!activeId || !text.trim()) {
        return;
      }

      await sendMessagePayload({ text: text.trim() });
    },
    [activeId, sendMessagePayload, text],
  );

  const sendChatPhoto = useCallback(
    async (file: File) => {
      if (!activeId) {
        return;
      }

      setChatUploading(true);
      setError(null);

      try {
        const uploaded = await uploadChatAttachment(file);
        await sendMessagePayload({
          text: text.trim(),
          attachment: uploaded.attachment,
        });
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Photo send failed.");
      } finally {
        setChatUploading(false);
        if (chatPhotoInputRef.current) {
          chatPhotoInputRef.current.value = "";
        }
      }
    },
    [activeId, sendMessagePayload, text, uploadChatAttachment],
  );

  const handleChatPhotoSelection = useCallback(
    async (fileList: FileList | null) => {
      const file = fileList?.[0];

      if (!file) {
        return;
      }

      await sendChatPhoto(file);
    },
    [sendChatPhoto],
  );

  const sendVoiceMessage = useCallback(
    async (file: File, durationMs?: number) => {
      if (!activeId) {
        return;
      }

      setChatUploading(true);
      setError(null);

      try {
        const uploaded = await uploadChatAttachment(file, durationMs);
        await sendMessagePayload({
          attachment: uploaded.attachment,
        });
      } catch (sendError) {
        setError(
          sendError instanceof Error ? sendError.message : "Voice message failed.",
        );
      } finally {
        setChatUploading(false);
      }
    },
    [activeId, sendMessagePayload, uploadChatAttachment],
  );

  const stopVoiceRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    setRecording(false);
    mediaRecorderRef.current.stop();
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (!activeId) {
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Voice messages are not supported in this browser.");
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationMs = recordingStartedAtRef.current
          ? Date.now() - recordingStartedAtRef.current
          : undefined;
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        recordingChunksRef.current = [];
        recordingStartedAtRef.current = null;
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (blob.size <= 0) {
          return;
        }

        const extension = blob.type.includes("ogg")
          ? "ogg"
          : blob.type.includes("mpeg") || blob.type.includes("mp3")
            ? "mp3"
            : blob.type.includes("mp4")
              ? "m4a"
              : "webm";
        const file = new File([blob], `voice-${Date.now()}.${extension}`, {
          type: blob.type || "audio/webm",
        });

        void sendVoiceMessage(file, durationMs);
      };

      recorder.start();
      setRecording(true);
    } catch (recordError) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecording(false);
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Could not start voice recording.",
      );
    }
  }, [activeId, sendVoiceMessage]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeId) {
        return;
      }

      try {
        const payload = await req<{ message: MessageDto }>(
          `/api/messages/${activeId}/reactions`,
          {
            method: "POST",
            body: JSON.stringify({ messageId, emoji }),
          },
        );
        updateMessageInState(payload.message);
        setReactionMenuId(null);
      } catch (reactionError) {
        setError(
          reactionError instanceof Error ? reactionError.message : "Reaction failed.",
        );
      }
    },
    [activeId, updateMessageInState],
  );

  const togglePinConversation = useCallback(async (conversationId: string) => {
    if (!conversationId || pinningConversation) {
      return;
    }

    setPinningConversation(true);
    setError(null);

    try {
      const payload = await req<{ pinned: boolean }>(`/api/messages/${conversationId}/pin`, {
        method: "POST",
      });

      setConversations((current) => {
        const next = current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, pinned: payload.pinned }
            : conversation,
        );

        return [...next].sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) {
            return a.pinned ? -1 : 1;
          }

          return 0;
        });
      });

      await loadConversations();
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Could not update pinned chat.");
    } finally {
      setPinningConversation(false);
    }
  }, [loadConversations, pinningConversation]);

  const unsendMessage = useCallback(
    async (messageId: string) => {
      if (!activeId || unsendingMessageId) {
        return;
      }

      const confirmed =
        typeof window === "undefined"
          ? true
          : window.confirm("Unsend this message for everyone?");

      if (!confirmed) {
        return;
      }

      setUnsendingMessageId(messageId);
      setError(null);

      try {
        const payload = await req<{ message: MessageDto }>(
          `/api/messages/${activeId}/${messageId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ action: "unsend" }),
          },
        );

        updateMessageInState(payload.message);
        await loadConversations();
      } catch (unsendError) {
        setError(
          unsendError instanceof Error
            ? unsendError.message
            : "Could not unsend the message.",
        );
      } finally {
        setUnsendingMessageId(null);
      }
    },
    [activeId, loadConversations, unsendingMessageId, updateMessageInState],
  );

  const clearGroupCallPicker = useCallback(() => {
    setGroupCallOpen(false);
    setGroupCallQuery("");
    setGroupCallResults([]);
    setGroupCallLoading(false);
    setGroupCallError(null);
    setGroupCallSelectionIds([]);
  }, []);

  const openGroupCallPicker = useCallback(() => {
    if (!activeId || !activeConversation || activeConversation.isGroup || callBusy || currentCall) {
      return;
    }

    setGroupCallSelectionIds([]);
    setGroupCallQuery("");
    setGroupCallError(null);
    setGroupCallOpen(true);
  }, [activeConversation, activeId, callBusy, currentCall]);

  const toggleGroupCallSelection = useCallback((userId: string) => {
    setGroupCallSelectionIds((current) =>
      current.includes(userId)
        ? current.filter((candidateId) => candidateId !== userId)
        : [...current, userId],
    );
  }, []);

  const startGroupVideoCall = useCallback(() => {
    if (!activeId || typeof window === "undefined" || callBusy || currentCall) {
      return;
    }

    if (groupCallSelectionIds.length === 0) {
      setGroupCallError("Pick at least one more person for the group call.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent<MotionStartCallDetail>(MOTION_START_CALL_EVENT, {
        detail: {
          conversationId: activeId,
          mode: "video",
          participantIds: groupCallSelectionIds,
        },
      }),
    );

    clearGroupCallPicker();
  }, [activeId, callBusy, clearGroupCallPicker, currentCall, groupCallSelectionIds]);

  useEffect(() => {
    if (!groupCallOpen) {
      return;
    }

    if (!activeConversation || activeConversation.isGroup || currentCall) {
      clearGroupCallPicker();
    }
  }, [activeConversation, clearGroupCallPicker, currentCall, groupCallOpen]);

  useEffect(() => {
    return () => {
      cancelVoiceRecording();
    };
  }, [cancelVoiceRecording]);

  const handleMessageTabChange = useCallback(
    (nextTab: MessagePanelTab) => {
      setMessageTab(nextTab);
      setReactionMenuId(null);
      if (nextTab !== "chats") {
        setReplyingToMessageId(null);
      }

      if (nextTab !== "chats") {
        clearTypingState(activeIdRef.current);
        if (recording) {
          cancelVoiceRecording();
        }
      }
    },
    [cancelVoiceRecording, clearTypingState, recording],
  );

  const openCallsPage = useCallback(() => {
    const params = new URLSearchParams();

    if (activeId) {
      params.set("conversation", activeId);
    }

    if (callDirectionFilter !== "all") {
      params.set("direction", callDirectionFilter);
    }

    if (callTypeFilter !== "all") {
      params.set("type", callTypeFilter);
    }

    router.push(`/calls${params.size > 0 ? `?${params.toString()}` : ""}`);
  }, [activeId, callDirectionFilter, callTypeFilter, router]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveId(conversationId);
    setThreadSearch("");
    setReplyingToMessageId(null);
    setReactionMenuId(null);
  }, []);

  const handleReplyToMessage = useCallback((messageId: string) => {
    setReplyingToMessageId(messageId);
    setReactionMenuId(null);
    setMessageTab("chats");
  }, []);

  return (
    <main className="motion-shell min-h-screen px-4 py-6" data-viewport={viewportMode}>
      <div className="motion-viewport space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Feed
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="rounded-full"
                aria-label="Open profile"
                title="Profile"
              >
                <UserAvatar
                  name={user.name}
                  avatarGradient={user.avatarGradient}
                  avatarUrl={user.avatarUrl}
                  className="h-10 w-10 border border-[var(--line)]"
                  textClassName="text-xs font-bold text-white"
                  sizes="40px"
                />
              </button>
            ) : null}
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Messages</p>
          </div>
        </div>

        <section className="motion-surface p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Inbox
              </p>
              <h1
                className="mt-2 text-3xl font-semibold text-slate-900"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Keep chats, calls, and recordings in one place.
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Messages now open as a full page so the thread gets proper space,
                instead of crowding the feed with a pop-out panel.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <MessagesStat label="Threads" value={String(conversations.length)} />
              <MessagesStat label="Unread" value={String(unreadTotal)} />
              <MessagesStat label="Missed calls" value={String(missedCallsTotal)} />
              <MessagesStat label="Recording threads" value={String(recordingThreadsTotal)} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="motion-surface border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="motion-surface border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <section className="motion-surface p-6 text-sm text-slate-500">
            Loading messages...
          </section>
        ) : (
          <ChatPanel
            open
            variant="page"
            title="Messages"
            searchPlaceholder="Search chats, calls, or recordings..."
            availableTabs={["chats", "calls", "recordings"]}
            chatSearch={chatSearch}
            messageTab={messageTab}
            callTypeFilter={callTypeFilter}
            callDirectionFilter={callDirectionFilter}
            missedCallsTotal={missedCallsTotal}
            markingMissedSeen={markingMissedCallsSeen}
            filteredConversations={filteredConversations}
            activeId={activeId}
            activeConversation={activeConversation}
            activeConversationSafety={activeConversationSafety}
            friendActivity={friendActivity}
            messages={messages}
            reactionMenuId={reactionMenuId}
            chatReactions={["🔥", "😍", "😂", "👏", "🥶", "💯"]}
            recording={recording}
            chatUploading={chatUploading}
            chatSending={chatSending}
            text={text}
            callStatusLabel={callStatusLabel}
            callBusy={callBusy}
            chatWallpaper={activeConversation?.chatWallpaper}
            chatWallpaperUrl={activeConversation?.chatWallpaperUrl}
            chatWallpaperLight={activeConversation?.chatWallpaperLight}
            chatWallpaperLightUrl={activeConversation?.chatWallpaperLightUrl}
            chatWallpaperDark={activeConversation?.chatWallpaperDark}
            chatWallpaperDarkUrl={activeConversation?.chatWallpaperDarkUrl}
            chatWallpaperBlur={activeConversation?.chatWallpaperBlur}
            chatWallpaperDim={activeConversation?.chatWallpaperDim}
            defaultChatWallpaper={user?.chatWallpaper}
            savingChatWallpaper={savingChatWallpaper}
            pinningConversation={pinningConversation}
            chatThreadRef={chatThreadRef}
            chatPhotoInputRef={chatPhotoInputRef}
            onClose={() => router.push("/")}
            onChatSearchChange={setChatSearch}
            threadSearch={threadSearch}
            onThreadSearchChange={setThreadSearch}
            onMessageTabChange={handleMessageTabChange}
            onCallTypeFilterChange={setCallTypeFilter}
            onCallDirectionFilterChange={setCallDirectionFilter}
            onMarkAllMissedSeen={() => {
              void markAllMissedCallsSeen();
            }}
            onOpenCallsPage={openCallsPage}
            onClearChatSearch={() => setChatSearch("")}
            onSelectConversation={handleSelectConversation}
            onBack={() => {
              setActiveId(null);
              setThreadSearch("");
              setReplyingToMessageId(null);
              setReactionMenuId(null);
            }}
            onTogglePinConversation={(conversationId) => {
              void togglePinConversation(conversationId);
            }}
            onToggleReactionMenu={(messageId) =>
              setReactionMenuId((current) => (current === messageId ? null : messageId))
            }
            onReplyToMessage={handleReplyToMessage}
            replyingToMessage={replyingToMessage}
            onClearReplyTo={() => setReplyingToMessageId(null)}
            onToggleReaction={(messageId, emoji) => {
              void toggleReaction(messageId, emoji);
            }}
            onMessageInputChange={handleMessageInputChange}
            onChatPhotoSelection={(files) => {
              void handleChatPhotoSelection(files);
            }}
            onToggleRecording={() => {
              if (recording) {
                stopVoiceRecording();
                return;
              }
              void startVoiceRecording();
            }}
            onStartVoiceCall={() => startGlobalCall("voice")}
            onStartVideoCall={() => startGlobalCall("video")}
            onToggleMuteUser={() => {
              void updateConversationSafety("mute");
            }}
            onToggleBlockUser={() => {
              void updateConversationSafety("block");
            }}
            onReportConversation={() => {
              void reportConversationUser();
            }}
            onReportMessage={(messageId) => {
              void reportMessage(messageId);
            }}
            safetyActionState={safetyAction}
            onOpenGroupVideoCall={
              activeConversation && !activeConversation.isGroup
                ? () => {
                    openGroupCallPicker();
                  }
                : undefined
            }
            onChatWallpaperChange={(wallpaper, target) => {
              void saveChatWallpaper(wallpaper, target);
            }}
            onUploadChatWallpaper={(file, target) => {
              void uploadChatWallpaper(file, target);
            }}
            onResetChatWallpaper={(target) => {
              void resetChatWallpaper(target);
            }}
            onChatWallpaperEffectsChange={(effects) => {
              void saveChatWallpaperEffects(effects);
            }}
            onDeleteRecording={(messageId) => {
              void deleteRecordingMessage(messageId);
            }}
            onUnsendMessage={(messageId) => {
              void unsendMessage(messageId);
            }}
            unsendingMessageId={unsendingMessageId}
            deletingRecordingId={deletingRecordingId}
            onDeleteAllRecordings={() => {
              void deleteAllRecordingsInThread();
            }}
            deletingAllRecordings={bulkDeletingRecordings}
            onSubmit={send}
            formatChatTime={formatChatTime}
            formatVoiceDuration={formatVoiceDuration}
          />
        )}
      </div>

      {groupCallOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="motion-surface w-[min(34rem,calc(100vw-1.5rem))] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Group Video Call
                </p>
                <h3
                  className="mt-2 text-xl font-semibold text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Add people to {activeConversation?.name ?? "this call"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The current chat is already included. Pick extra people and we will
                  start one shared video call.
                </p>
              </div>
              <button
                type="button"
                onClick={clearGroupCallPicker}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                aria-label="Close group call picker"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--brand-soft)]/35 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {activeConversation ? (
                  <span className="rounded-full border border-[var(--brand)]/20 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {activeConversation.name} is already in the call
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {groupCallSelectionIds.length === 0
                    ? "No extra people selected yet"
                    : `${groupCallSelectionIds.length} extra ${
                        groupCallSelectionIds.length === 1 ? "person" : "people"
                      } selected`}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <input
                value={groupCallQuery}
                onChange={(event) => setGroupCallQuery(event.target.value)}
                className="h-11 w-full rounded-full border border-[var(--line)] bg-white px-4 text-sm text-slate-700 transition focus:border-[var(--brand)] focus:outline-none"
                placeholder="Search people to add..."
                aria-label="Search people for group call"
              />
            </div>

            {groupCallError ? (
              <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                {groupCallError}
              </p>
            ) : null}

            <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {groupCallLoading ? (
                <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-slate-500">
                  Loading people...
                </div>
              ) : null}

              {!groupCallLoading &&
                groupCallResults.map((candidate) => {
                  const selected = groupCallSelectionSet.has(candidate.id);

                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => toggleGroupCallSelection(candidate.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand-soft)]/45"
                          : "border-[var(--line)] bg-white hover:border-[var(--brand)]/40"
                      }`}
                    >
                      <UserAvatar
                        name={candidate.name}
                        avatarGradient={candidate.avatarGradient}
                        avatarUrl={candidate.avatarUrl}
                        className="h-11 w-11"
                        textClassName="text-sm font-semibold text-white"
                        sizes="44px"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {candidate.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          @{candidate.handle}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          selected
                            ? "bg-[var(--brand)] text-white"
                            : "border border-[var(--line)] bg-white text-slate-500"
                        }`}
                      >
                        {selected ? "Selected" : "Add"}
                      </span>
                    </button>
                  );
                })}

              {!groupCallLoading && groupCallResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                  {groupCallQuery.trim()
                    ? "No people match that search."
                    : "Search or scroll to pick people for the group call."}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={clearGroupCallPicker}
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startGroupVideoCall}
                disabled={groupCallSelectionIds.length === 0 || callBusy || Boolean(currentCall)}
                className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start group call
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <main className="motion-shell min-h-screen px-4 py-6">
          <div className="motion-viewport">
            <section className="motion-surface p-6 text-sm text-slate-500">
              Loading messages...
            </section>
          </div>
        </main>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
