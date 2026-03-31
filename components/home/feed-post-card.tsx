"use client";

import type { ReactNode } from "react";

import CaptionWithHashtags from "@/components/caption-with-hashtags";
import InterestBadges from "@/components/interest-badges";
import LivePostAge from "@/components/live-post-age";
import { resolvePostInterests, type InterestKey } from "@/lib/interests";

type FeedPostCardPost = {
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
  kind: "Photo" | "Reel";
  caption: string;
  location: string;
  likes: number;
  liked: boolean;
  saved: boolean;
  comments: number;
  shareCount: number;
  createdAt: string;
  timeAgo: string;
  interests?: InterestKey[];
};

type FeedPostCardProps = {
  post: FeedPostCardPost;
  viewerId?: string | null;
  isFollowing: boolean;
  media: ReactNode;
  saveIcon: ReactNode;
  showHeartBurst: boolean;
  heartBurstToken?: number;
  shareOpen: boolean;
  shareNotice?: string | null;
  onOpenProfile: (handle: string) => void;
  onLike: () => void;
  onComment: () => void;
  onToggleSave: () => void;
  onToggleShare: () => void;
  onShareToAccount: () => void;
  onCopyLink: () => void;
  onDoubleClick: () => void;
  onWithdrawInvite: () => void;
  onToggleFollow: () => void;
  onReport: () => void;
};

export default function FeedPostCard({
  post,
  viewerId,
  isFollowing,
  media,
  saveIcon,
  showHeartBurst,
  heartBurstToken,
  shareOpen,
  shareNotice,
  onOpenProfile,
  onLike,
  onComment,
  onToggleSave,
  onToggleShare,
  onShareToAccount,
  onCopyLink,
  onDoubleClick,
  onWithdrawInvite,
  onToggleFollow,
  onReport,
}: FeedPostCardProps) {
  const interestBadges = resolvePostInterests(post);
  const isOwnPost = Boolean(viewerId && post.userId === viewerId);
  const showFollowButton = Boolean(viewerId && !isOwnPost);

  return (
    <article className="post-card rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => onOpenProfile(post.handle)}
            className="text-left text-sm font-semibold text-slate-900 hover:text-[var(--brand)]"
          >
            {post.author}
          </button>
          <button
            type="button"
            onClick={() => onOpenProfile(post.handle)}
            className="block text-left text-xs text-slate-500 hover:text-[var(--brand)]"
          >
            {post.location ? `${post.handle} - ${post.location}` : post.handle}
          </button>
          {post.coAuthors && post.coAuthors.length > 0 ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              with {post.coAuthors.map((coAuthor) => `@${coAuthor.handle}`).join(" & ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[11px] text-slate-500">
            <LivePostAge createdAt={post.createdAt} initialLabel={post.timeAgo} />
          </span>
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[11px]">
            {post.kind}
          </span>
          {post.collabInvites && post.collabInvites.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                {post.collabInvites.length === 1
                  ? `Invite pending - @${post.collabInvites[0].handle}`
                  : `${post.collabInvites.length} invites pending`}
              </span>
              {isOwnPost ? (
                <button
                  type="button"
                  onClick={onWithdrawInvite}
                  className="rounded-full border border-amber-200 px-2 py-1 text-[10px] font-semibold text-amber-700 hover:border-amber-300"
                >
                  Withdraw
                </button>
              ) : null}
            </div>
          ) : null}
          {showFollowButton ? (
            <button
              type="button"
              onClick={onToggleFollow}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                isFollowing
                  ? "border border-[var(--line)] bg-white text-slate-600 hover:border-[var(--brand)]"
                  : "bg-[var(--brand)] text-white"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
          {!isOwnPost ? (
            <button
              type="button"
              onClick={onReport}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
            >
              Report
            </button>
          ) : null}
        </div>
      </div>

      <div className="post-media-frame mb-3" onDoubleClick={onDoubleClick}>
        {media}
        {showHeartBurst ? (
          <div key={heartBurstToken ?? post.id} className="like-burst">
            <svg viewBox="0 0 64 64" className="like-burst-heart" aria-hidden="true">
              <path
                d="M32 55c-1.4 0-2.8-.5-4-1.5C20.7 47.2 8 36.7 8 22.9 8 14.7 14.3 9 22.3 9c4.1 0 8.1 1.8 10.7 4.9C35.6 10.8 39.6 9 43.7 9 51.7 9 58 14.7 58 22.9c0 13.8-12.7 24.3-20 30.6-1.2 1-2.6 1.5-4 1.5Z"
                fill="#e11d48"
                stroke="#111111"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}
      </div>

      <p className="text-sm text-slate-700">
        <CaptionWithHashtags caption={post.caption} />
      </p>
      <InterestBadges interests={interestBadges} variant="accent" />

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onLike}
            className={`rounded-full border px-3 py-1 ${
              post.liked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)]"
            }`}
            type="button"
          >
            Like {post.likes}
          </button>
          <button
            type="button"
            onClick={onComment}
            className="rounded-full border border-[var(--line)] px-3 py-1"
          >
            Comment {post.comments}
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
              post.saved
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--line)] text-slate-600"
            }`}
            aria-label={post.saved ? "Remove from vault" : "Vault post"}
            title={post.saved ? "Vaulted" : "Vault"}
          >
            {saveIcon}
            {post.saved ? "Saved" : "Save"}
          </button>
        </div>
        <div className="relative flex flex-col items-end">
          <button
            type="button"
            data-share-trigger="true"
            onClick={onToggleShare}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-slate-600"
            aria-label="Share"
            aria-expanded={shareOpen}
          >
            Share {post.shareCount}
          </button>
          {shareOpen ? (
            <div
              data-share-menu="true"
              className="absolute right-0 top-full mt-2 w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--line)] bg-white p-2 shadow-lg"
            >
              <button
                type="button"
                onClick={onShareToAccount}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-[var(--brand-soft)]"
              >
                Share to account
              </button>
              <button
                type="button"
                onClick={onCopyLink}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-[var(--brand-soft)]"
              >
                Copy link
              </button>
            </div>
          ) : null}
          {shareNotice ? <span className="mt-2 text-[10px] text-slate-500">{shareNotice}</span> : null}
        </div>
      </div>
    </article>
  );
}
