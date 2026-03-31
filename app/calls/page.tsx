"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
type CallTypeFilter = "all" | "voice" | "video";
type CallDirectionFilter = "all" | "incoming" | "outgoing" | "missed";
type User = {
  id: string;
  name: string;
  handle: string;
  chatWallpaper?: ChatWallpaper;
  avatarGradient: string;
  avatarUrl?: string;
};
type FriendActivity = {
  id: string;
  isActive: boolean;
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

function isViewportMode(value: string | null): value is ViewportMode {
  return value === "desktop" || value === "tablet" || value === "mobile";
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

function CallsStat({
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

function CallsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");
  const requestedDirection = searchParams.get("direction");
  const requestedType = searchParams.get("type");

  const [user, setUser] = useState<User | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
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
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null);
  const [bulkDeletingRecordings, setBulkDeletingRecordings] = useState(false);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const chatPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const activeIdRef = useRef<string | null>(null);

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
  }, [requestedDirection, requestedType]);

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
          : "Failed to load call thread.",
      );
    });
  }, [activeId, loadConversationMessages]);

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

      const hasAnyCallHistory =
        conversation.hasVoiceCallHistory || conversation.hasVideoCallHistory;

      if (!hasAnyCallHistory) {
        return false;
      }

      if (
        callDirectionFilter === "incoming" &&
        !conversation.hasIncomingCallHistory
      ) {
        return false;
      }

      if (
        callDirectionFilter === "outgoing" &&
        !conversation.hasOutgoingCallHistory
      ) {
        return false;
      }

      if (
        callDirectionFilter === "missed" &&
        conversation.missedCallCount <= 0
      ) {
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
  }, [callDirectionFilter, callTypeFilter, chatSearch, conversations]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      return;
    }

    if (activeId && filteredConversations.some((conversation) => conversation.id === activeId)) {
      return;
    }

    setActiveId(filteredConversations[0]?.id ?? null);
  }, [activeId, filteredConversations]);

  const missedCallsTotal = useMemo(
    () =>
      conversations.reduce(
        (sum, conversation) => sum + conversation.missedCallCount,
        0,
      ),
    [conversations],
  );

  const callThreadsTotal = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.hasVoiceCallHistory || conversation.hasVideoCallHistory,
      ).length,
    [conversations],
  );

  const activeFriendsTotal = useMemo(
    () =>
      Object.values(friendActivity).filter((entry) => Boolean(entry?.isActive)).length,
    [friendActivity],
  );

  const startGlobalCall = useCallback(
    (mode: CallMode) => {
      if (!activeId || typeof window === "undefined" || callBusy || currentCall) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent<MotionStartCallDetail>(MOTION_START_CALL_EVENT, {
          detail: { conversationId: activeId, mode },
        }),
      );
    },
    [activeId, callBusy, currentCall],
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
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Calls</p>
          </div>
        </div>

        <section className="motion-surface p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Call history
              </p>
              <h1
                className="mt-2 text-3xl font-semibold text-slate-900"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Keep every voice and video thread in one place.
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Incoming, outgoing, and missed calls stay organized here, with
                instant actions to jump back into the thread.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CallsStat label="Call threads" value={String(callThreadsTotal)} />
              <CallsStat label="Missed calls" value={String(missedCallsTotal)} />
              <CallsStat label="Friends active" value={String(activeFriendsTotal)} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="motion-surface border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="motion-surface p-6 text-sm text-slate-500">
            Loading call history...
          </section>
        ) : (
          <ChatPanel
            open
            variant="page"
            title="Calls"
            availableTabs={["calls"]}
            searchPlaceholder="Search call history..."
            chatSearch={chatSearch}
            messageTab="calls"
            callTypeFilter={callTypeFilter}
            callDirectionFilter={callDirectionFilter}
            missedCallsTotal={missedCallsTotal}
            markingMissedSeen={markingMissedCallsSeen}
            filteredConversations={filteredConversations}
            activeId={activeId}
            activeConversation={activeConversation}
            friendActivity={friendActivity}
            messages={messages}
            reactionMenuId={null}
            chatReactions={[]}
            recording={false}
            chatUploading={false}
            chatSending={false}
            text=""
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
            chatThreadRef={chatThreadRef}
            chatPhotoInputRef={chatPhotoInputRef}
            onClose={() => router.push("/")}
            onChatSearchChange={setChatSearch}
            onMessageTabChange={() => undefined}
            onCallTypeFilterChange={setCallTypeFilter}
            onCallDirectionFilterChange={setCallDirectionFilter}
            onMarkAllMissedSeen={() => {
              void markAllMissedCallsSeen();
            }}
            onClearChatSearch={() => setChatSearch("")}
            onSelectConversation={setActiveId}
            onBack={() => setActiveId(null)}
            onToggleReactionMenu={() => undefined}
            onToggleReaction={() => undefined}
            onMessageInputChange={() => undefined}
            onChatPhotoSelection={() => undefined}
            onToggleRecording={() => undefined}
            onStartVoiceCall={() => startGlobalCall("voice")}
            onStartVideoCall={() => startGlobalCall("video")}
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
            deletingRecordingId={deletingRecordingId}
            onDeleteAllRecordings={() => {
              void deleteAllRecordingsInThread();
            }}
            deletingAllRecordings={bulkDeletingRecordings}
            onSubmit={(event) => event.preventDefault()}
            formatChatTime={formatChatTime}
            formatVoiceDuration={formatVoiceDuration}
          />
        )}
      </div>
    </main>
  );
}

export default function CallsPage() {
  return (
    <Suspense
      fallback={
        <main className="motion-shell min-h-screen px-4 py-6">
          <div className="motion-viewport">
            <section className="motion-surface p-6 text-sm text-slate-500">
              Loading calls...
            </section>
          </div>
        </main>
      }
    >
      <CallsPageContent />
    </Suspense>
  );
}
