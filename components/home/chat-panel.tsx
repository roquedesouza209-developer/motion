"use client";

import type { FormEvent, RefObject } from "react";

import Image from "next/image";

type Presence = "Online" | "Away";
type MessagePanelTab = "chats" | "calls";
type CallTypeFilter = "all" | "voice" | "video";
type CallDirectionFilter = "all" | "incoming" | "outgoing" | "missed";

type Conversation = {
  id: string;
  userId: string;
  name: string;
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
  lastCallMode?: "voice" | "video";
  lastCallEvent?: "started" | "accepted" | "declined" | "ended" | "missed";
};

type ChatAttachment = {
  url: string;
  type: "image" | "audio";
  durationMs?: number;
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
  createdAt: string;
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
  messageTab: MessagePanelTab;
  callTypeFilter: CallTypeFilter;
  callDirectionFilter: CallDirectionFilter;
  missedCallsTotal: number;
  markingMissedSeen?: boolean;
  filteredConversations: Conversation[];
  activeId: string | null;
  activeConversation: Conversation | null;
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
  chatThreadRef: RefObject<HTMLDivElement | null>;
  chatPhotoInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onChatSearchChange: (value: string) => void;
  onMessageTabChange: (value: MessagePanelTab) => void;
  onCallTypeFilterChange: (value: CallTypeFilter) => void;
  onCallDirectionFilterChange: (value: CallDirectionFilter) => void;
  onMarkAllMissedSeen: () => void;
  onOpenCallsPage?: () => void;
  onClearChatSearch: () => void;
  onSelectConversation: (conversationId: string) => void;
  onBack: () => void;
  onToggleReactionMenu: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onMessageInputChange: (value: string) => void;
  onChatPhotoSelection: (files: FileList | null) => void;
  onToggleRecording: () => void;
  onStartVoiceCall: () => void;
  onStartVideoCall: () => void;
  onOpenGroupVideoCall?: () => void;
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

export default function ChatPanel({
  open,
  variant = "floating",
  title = "Messages",
  searchPlaceholder = "Search threads...",
  availableTabs = ["chats", "calls"],
  chatSearch,
  messageTab,
  callTypeFilter,
  callDirectionFilter,
  missedCallsTotal,
  markingMissedSeen = false,
  filteredConversations,
  activeId,
  activeConversation,
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
  chatThreadRef,
  chatPhotoInputRef,
  onClose,
  onChatSearchChange,
  onMessageTabChange,
  onCallTypeFilterChange,
  onCallDirectionFilterChange,
  onMarkAllMissedSeen,
  onOpenCallsPage,
  onClearChatSearch,
  onSelectConversation,
  onBack,
  onToggleReactionMenu,
  onToggleReaction,
  onMessageInputChange,
  onChatPhotoSelection,
  onToggleRecording,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenGroupVideoCall,
  onSubmit,
  formatChatTime,
  formatVoiceDuration,
}: ChatPanelProps) {
  if (!open) {
    return null;
  }

  const threadMessages =
    messageTab === "calls"
      ? messages.filter((message) => message.systemType === "call")
      : messages;

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
                const label = tabId === "calls" ? "Calls" : "Chats";
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

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`chat-convo-item ${activeId === conversation.id ? "is-active" : ""}`}
                  type="button"
                >
                  <div
                    className="chat-avatar"
                    style={{ background: gradients[gradientIndex] }}
                  >
                    {initials}
                    {isActive ? <span className="presence-dot" /> : null}
                  </div>
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
              );
            })}
            {filteredConversations.length === 0 ? (
              <div className="chat-empty">
                {messageTab === "calls"
                  ? chatSearch || callDirectionFilter !== "all" || callTypeFilter !== "all"
                    ? "No call logs match that search or filter."
                    : "No call history yet."
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
              <div className="chat-thread-header flex items-center justify-between gap-3 px-4 py-2.5">
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
                  {callStatusLabel ? (
                    <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
                      {callStatusLabel}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={onStartVoiceCall}
                    className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
                    aria-label="Start voice call"
                    title="Voice call"
                    disabled={!activeId || callBusy}
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
                    className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
                    aria-label="Start video call"
                    title="Video call"
                    disabled={!activeId || callBusy}
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
                      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
                      aria-label="Start group video call"
                      title="Group video call"
                      disabled={!activeId || callBusy}
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
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-[11px] font-semibold text-slate-500 transition hover:text-[var(--brand)]"
                  >
                    Back
                  </button>
                </div>
              </div>
              <div ref={chatThreadRef} className="chat-thread space-y-2 px-4 py-3">
                {threadMessages.map((message) => (
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
                  >
                    <div
                      className={`chat-bubble ${message.from === "me" ? "is-me" : "is-them"}`}
                    >
                      {message.attachment?.type === "image" ? (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(message.attachment?.url, "_blank", "noopener,noreferrer")
                          }
                          className="mb-2 block overflow-hidden rounded-2xl"
                        >
                          <Image
                            src={message.attachment.url}
                            alt="Shared chat photo"
                            width={220}
                            height={220}
                            className="h-auto w-[220px] max-w-full rounded-2xl object-cover"
                          />
                        </button>
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
                            <p className="mt-1 text-[10px] opacity-75">
                              {formatVoiceDuration(message.attachment.durationMs)} voice message
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {message.text ? <p>{message.text}</p> : null}
                      <div
                        className={`mt-2 flex items-center gap-1.5 text-[10px] ${
                          message.from === "me" ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        <span>{formatChatTime(message.createdAt)}</span>
                        {message.from === "me" ? (
                          <MessageTicks state={message.deliveryState} />
                        ) : null}
                      </div>
                    </div>
                    {message.reactions.length > 0 ? (
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
                    </div>
                  </div>
                  )
                ))}
                {messageTab === "calls" && threadMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                    No call history in this thread yet.
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
                <form onSubmit={onSubmit} className="chat-composer flex gap-2 px-3 py-2.5">
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
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60"
                  aria-label="Send photo"
                  disabled={!activeId || chatUploading || chatSending || recording}
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
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                    recording
                      ? "border-rose-300 bg-rose-500 text-white"
                      : "border-[var(--line)] bg-white text-slate-500 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  } disabled:opacity-60`}
                  aria-label={recording ? "Stop recording" : "Record voice message"}
                  disabled={!activeId || chatUploading || chatSending}
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
                  className="h-9 flex-1 rounded-full border border-[var(--line)] bg-white px-4 text-xs transition focus:border-[var(--brand)] focus:outline-none"
                  placeholder={recording ? "Recording voice message..." : "Type a message..."}
                  disabled={!activeId || chatUploading}
                />
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white transition hover:brightness-110 disabled:opacity-60"
                  type="submit"
                  aria-label="Send message"
                  disabled={!activeId || !text.trim() || chatUploading || chatSending}
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
                </form>
              ) : (
                <div className="border-t border-[var(--line)] px-4 py-3 text-[11px] font-semibold text-slate-500">
                  Call logs only. Switch back to Chats to send a message.
                </div>
              )}
              {messageTab === "chats" && (recording || chatUploading) ? (
                <div className="border-t border-[var(--line)] px-4 py-2 text-[11px] font-semibold text-slate-500">
                  {recording ? "Recording voice message..." : "Sending media..."}
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
