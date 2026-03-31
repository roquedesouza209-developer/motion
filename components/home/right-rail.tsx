"use client";

import Link from "next/link";
import type { ReactNode, RefObject } from "react";

import UserSearchPanel from "@/components/home/user-search-panel";
import UserAvatar from "@/components/user-avatar";

type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
};

type LiveSessionSummary = {
  id: string;
  viewerCount: number;
  isHost: boolean;
  host: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  };
};

type FriendActivity = {
  id: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
};

type NotificationFilter = "all" | "follows" | "likes" | "comments" | "calls" | "moves";

type HomeNotificationAction =
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

type HomeNotification = {
  id: string;
  sourceIds: string[];
  title: string;
  detail: string;
  meta: string;
  createdAt: string;
  tone: "follow" | "like" | "comment" | "view" | "tag" | "call";
  category: NotificationFilter | "profile" | "collabs";
  groupCount?: number;
  marker?: "reaction" | "reply" | "ringing";
  action?: HomeNotificationAction;
};

type HomeRightRailProps = {
  railRef: RefObject<HTMLElement | null>;
  searchQuery: string;
  searchLoading: boolean;
  searchError: string | null;
  searchResults: UserSearchResult[];
  onSearchQueryChange: (value: string) => void;
  onSelectUser: (handle: string) => void;
  themePicker: ReactNode;
  liveSessions: LiveSessionSummary[];
  onOpenLive: (liveId: string) => void;
  activeFriends: FriendActivity[];
  onOpenProfile: (handle: string) => void;
  notificationCount: number;
  pendingCollabInvites: number;
  notificationsOpen: boolean;
  notificationFilter: NotificationFilter;
  notificationItems: HomeNotification[];
  unseenNotificationItems: HomeNotification[];
  earlierNotificationItems: HomeNotification[];
  onToggleNotifications: () => void;
  onNotificationFilterChange: (filter: NotificationFilter) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenCollabRequests: () => void;
  onRespondToCollabInvite: (postId: string, response: "accept" | "decline") => void;
  onNotificationAction: (notification: HomeNotification) => void;
};

function toneClasses(tone: HomeNotification["tone"]) {
  switch (tone) {
    case "follow":
      return "bg-sky-100 text-sky-700";
    case "like":
      return "bg-rose-100 text-rose-700";
    case "view":
      return "bg-emerald-100 text-emerald-700";
    case "tag":
      return "bg-indigo-100 text-indigo-700";
    case "call":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function NotificationMarker({ marker }: { marker: HomeNotification["marker"] }) {
  if (!marker) {
    return null;
  }

  if (marker === "ringing") {
    return (
      <span className="inline-flex h-5 items-center gap-1 rounded-full bg-violet-100 px-2 text-[10px] font-semibold text-violet-700">
        <span className="inline-flex items-end gap-[2px]">
          {[0, 1, 2].map((index) => (
            <span
              key={`ring-bar-${index}`}
              className="w-[3px] rounded-full bg-current animate-pulse"
              style={{
                height: `${8 + index * 2}px`,
                animationDelay: `${index * 140}ms`,
                animationDuration: "1s",
              }}
            />
          ))}
        </span>
        Ringing
      </span>
    );
  }

  const markerClasses =
    marker === "reaction" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-blue-100 text-blue-700";

  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${markerClasses}`}>
      {marker === "reaction" ? (
        <svg
          viewBox="0 0 20 20"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 17.2s-5.3-3.3-7.1-6.2C1.8 8.9 2.4 6.7 4 5.6c1.3-.9 3.1-.6 4.2.6L10 8l1.8-1.8c1.1-1.2 2.9-1.5 4.2-.6 1.6 1.1 2.2 3.3 1.1 5.4-1.8 2.9-7.1 6.2-7.1 6.2Z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 20 20"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4.5h12a2.5 2.5 0 0 1 2.5 2.5v4.5A2.5 2.5 0 0 1 16 14H8l-4 3v-3H4A2.5 2.5 0 0 1 1.5 11.5V7A2.5 2.5 0 0 1 4 4.5Z" />
        </svg>
      )}
      {marker === "reaction" ? "Reacted" : "Reply"}
    </span>
  );
}

function NotificationCard({
  notification,
  dimmed = false,
  onRespondToCollabInvite,
  onNotificationAction,
}: {
  notification: HomeNotification;
  dimmed?: boolean;
  onRespondToCollabInvite: (postId: string, response: "accept" | "decline") => void;
  onNotificationAction: (notification: HomeNotification) => void;
}) {
  const clickable = Boolean(notification.action) && notification.action?.kind !== "collab_invite";
  const collabAction =
    notification.action?.kind === "collab_invite" ? notification.action : null;
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses(notification.tone)}`}>
            {notification.title}
          </span>
          {notification.groupCount && notification.groupCount > 1 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {notification.groupCount}
            </span>
          ) : null}
          <NotificationMarker marker={notification.marker} />
        </div>
        <p className="mt-0.5 break-words text-xs text-slate-500">{notification.detail}</p>
        {!dimmed && collabAction ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRespondToCollabInvite(collabAction.postId, "accept")}
              className="rounded-full bg-[var(--brand)] px-3 py-1 text-[11px] font-semibold text-white"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onRespondToCollabInvite(collabAction.postId, "decline")}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-slate-600"
            >
              Decline
            </button>
          </div>
        ) : null}
      </div>
      <span className="shrink-0 text-[11px] text-slate-500">{notification.meta}</span>
    </div>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onNotificationAction(notification)}
        className={`w-full rounded-xl border border-[var(--line)] px-3 py-2 text-left transition hover:border-[var(--brand)] ${
          dimmed ? "bg-white/80 opacity-60" : "bg-white"
        }`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`w-full rounded-xl border border-[var(--line)] px-3 py-2 text-left ${
        dimmed ? "bg-white/80 opacity-60" : "bg-white"
      }`}
    >
      {content}
    </div>
  );
}

export default function HomeRightRail({
  railRef,
  searchQuery,
  searchLoading,
  searchError,
  searchResults,
  onSearchQueryChange,
  onSelectUser,
  themePicker,
  liveSessions,
  onOpenLive,
  activeFriends,
  onOpenProfile,
  notificationCount,
  pendingCollabInvites,
  notificationsOpen,
  notificationFilter,
  notificationItems,
  unseenNotificationItems,
  earlierNotificationItems,
  onToggleNotifications,
  onNotificationFilterChange,
  onMarkAllNotificationsRead,
  onOpenCollabRequests,
  onRespondToCollabInvite,
  onNotificationAction,
}: HomeRightRailProps) {
  return (
    <aside ref={railRef} className="motion-right-rail space-y-5 self-start xl:sticky xl:top-6">
      <UserSearchPanel
        query={searchQuery}
        loading={searchLoading}
        error={searchError}
        results={searchResults}
        onQueryChange={onSearchQueryChange}
        onSelect={onSelectUser}
      />

      <section className="motion-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Theme</p>
            <p className="text-[11px] text-slate-500">Adjust the look without crowding the header.</p>
          </div>
          {themePicker}
        </div>
      </section>

      <section className="motion-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Live Now</p>
            <p className="text-[11px] text-slate-500">Join live broadcasts in progress.</p>
          </div>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
            {liveSessions.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {liveSessions.length > 0 ? (
            liveSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              >
                <UserAvatar
                  name={session.host.name}
                  avatarGradient={session.host.avatarGradient}
                  avatarUrl={session.host.avatarUrl}
                  className="h-10 w-10 text-xs font-semibold"
                  textClassName="text-xs font-semibold text-white"
                  sizes="40px"
                >
                  <span className="avatar-live-badge">LIVE</span>
                </UserAvatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{session.host.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{session.viewerCount} watching</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLive(session.id)}
                  className="ml-auto rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-[var(--brand)]"
                >
                  {session.isHost ? "Resume" : "Join"}
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">No one is live right now.</p>
          )}
        </div>
      </section>

      <section className="motion-surface overflow-hidden p-4">
        <div className="rounded-[24px] border border-[var(--line)] bg-[radial-gradient(circle_at_top,#dfeeff,transparent_58%),linear-gradient(180deg,#ffffff,#f5f8ff)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Random Chat
          </p>
          <h3
            className="mt-2 text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Meet new people with interest and country filters.
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Motion pairs signed-in members in a private WebRTC room, with skip and report ready if the vibe is off.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Interest match
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700">
              Country filter
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
              Private room
            </span>
          </div>
          <Link
            href="/random"
            className="mt-4 inline-flex items-center rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Open Random Chat
          </Link>
        </div>
      </section>

      <section className="motion-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Active Now</p>
            <p className="text-[11px] text-slate-500">Friends currently online.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {activeFriends.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {activeFriends.length > 0 ? (
            activeFriends.slice(0, 6).map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => onOpenProfile(friend.handle)}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-left transition hover:border-[var(--brand)]"
              >
                <UserAvatar
                  name={friend.name}
                  avatarGradient={friend.avatarGradient}
                  avatarUrl={friend.avatarUrl}
                  className="h-9 w-9 text-[11px] font-bold"
                  textClassName="text-[11px] font-bold text-white"
                  sizes="36px"
                >
                  <span className="presence-dot" />
                </UserAvatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{friend.name}</p>
                  <p className="truncate text-xs text-emerald-600">Active now</p>
                </div>
              </button>
            ))
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-xs text-slate-500">
              No friends active right now.
            </p>
          )}
        </div>
      </section>

      <section className="motion-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <p className="text-[11px] text-slate-500">Follows, likes, and comments.</p>
          </div>
          <button
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-slate-700"
            type="button"
            onClick={onToggleNotifications}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            title="Notifications"
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
              <path d="M10 3.1a3.1 3.1 0 0 0-3.1 3.1v1.1c0 .7-.2 1.4-.6 2l-1.1 1.8c-.3.5 0 1.1.6 1.1h8.4c.6 0 .9-.6.6-1.1l-1.1-1.8c-.4-.6-.6-1.3-.6-2V6.2A3.1 3.1 0 0 0 10 3.1Z" />
              <path d="M8.5 14.7a1.8 1.8 0 0 0 3 0" />
            </svg>
            {notificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
                {notificationCount}
              </span>
            ) : null}
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenCollabRequests}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          <span>Collab requests</span>
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            {pendingCollabInvites}
          </span>
        </button>

        {notificationsOpen ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all" as const, label: "All" },
                { id: "follows" as const, label: "Follows" },
                { id: "likes" as const, label: "Likes" },
                { id: "comments" as const, label: "Comments" },
                { id: "calls" as const, label: "Calls" },
                { id: "moves" as const, label: "Moves" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onNotificationFilterChange(option.id)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    notificationFilter === option.id
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--line)] bg-white text-slate-600 hover:border-[var(--brand)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onMarkAllNotificationsRead}
                disabled={unseenNotificationItems.length === 0}
                className="ml-auto rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark all read
              </button>
            </div>
            {unseenNotificationItems.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    New
                  </p>
                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {unseenNotificationItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {unseenNotificationItems.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onRespondToCollabInvite={onRespondToCollabInvite}
                      onNotificationAction={onNotificationAction}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {earlierNotificationItems.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Earlier
                  </p>
                  <span className="text-[10px] text-slate-500">Already viewed</span>
                </div>
                <div className="space-y-2">
                  {earlierNotificationItems.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      dimmed
                      onRespondToCollabInvite={onRespondToCollabInvite}
                      onNotificationAction={onNotificationAction}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {notificationItems.length === 0 ? (
              <p className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-xs text-slate-500">
                No notifications match this filter right now.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-xs text-slate-500">
            Keep this closed until you need it. The feed stays central and easier to scan.
          </p>
        )}
      </section>
    </aside>
  );
}
