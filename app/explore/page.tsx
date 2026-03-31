"use client";

import CaptionWithHashtags from "@/components/caption-with-hashtags";
import InterestBadges from "@/components/interest-badges";
import LivePostAge from "@/components/live-post-age";
import {
  resolvePostInterests,
  type InterestKey,
  INTEREST_OPTIONS,
} from "@/lib/interests";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MediaType = "image" | "video";
type ExploreFilter = "all" | "photos" | "reels";
type TopicFilter = "all" | InterestKey;
type ViewportMode = "desktop" | "tablet" | "mobile";

type User = {
  id: string;
  name: string;
  handle: string;
  email: string;
  interests?: InterestKey[];
  avatarGradient: string;
};

type Post = {
  id: string;
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
  gradient: string;
  createdAt: string;
  timeAgo: string;
  interests?: InterestKey[];
  mediaUrl?: string;
  mediaType?: MediaType;
  immersiveVideo?: boolean;
};

const DISCOVERY_TAGS = [
  "Street Portraits",
  "Travel Reels",
  "Color Grading",
  "Studio Lighting",
  "Behind The Scenes",
  "Motion Reels",
];
const PHOTO_ROW_SPANS = [26, 30, 34];
const REEL_ROW_SPANS = [34, 40, 46];

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }

  return payload;
}

function sortByNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function extractHashtags(caption: string): string[] {
  return Array.from(
    new Set(
      Array.from(caption.matchAll(/(^|\s)#([a-z0-9_]+)/gi)).map((match) =>
        match[2].toLowerCase(),
      ),
    ),
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
            {[
              { id: "desktop" as const, label: "Desktop" },
              { id: "tablet" as const, label: "Tablet" },
              { id: "mobile" as const, label: "Mobile" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                  mode === option.id
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

function SaveGlyph({ saved }: { saved: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
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

function ExploreTile({
  post,
  featured,
  rowSpan,
  colSpan,
  onToggleSave,
  onOpenProfile,
}: {
  post: Post;
  featured: boolean;
  rowSpan: number;
  colSpan: number;
  onToggleSave: (postId: string) => void;
  onOpenProfile: (handle: string) => void;
}) {
  const interestBadges = resolvePostInterests(post);

  return (
    <article
      className={`explore-mosaic-item group overflow-hidden rounded-2xl border border-[var(--line)] bg-white ${
        featured ? "is-featured" : ""
      }`}
      style={{
        gridRow: `span ${rowSpan} / span ${rowSpan}`,
        gridColumn: `span ${colSpan} / span ${colSpan}`,
      }}
    >
      <div className="relative h-full overflow-hidden">
        {post.mediaUrl && post.mediaType === "image" ? (
          <Image
            src={post.mediaUrl}
            alt={`${post.author} post`}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : post.mediaUrl && post.mediaType === "video" ? (
          <video
            src={post.mediaUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="h-full w-full" style={{ background: post.gradient }} />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/70" />
        <div className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          {post.kind}
        </div>
        {post.immersiveVideo ? (
          <div className="absolute left-3 top-10 rounded-full bg-cyan-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 backdrop-blur-sm">
            360
          </div>
        ) : null}
        <div className="absolute right-3 top-3 rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <LivePostAge createdAt={post.createdAt} initialLabel={post.timeAgo} />
        </div>
        {featured ? (
          <div
            className={`absolute left-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-900 backdrop-blur-sm ${
              post.immersiveVideo ? "top-[4.3rem]" : "top-10"
            }`}
          >
            Featured
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
          <div className="min-w-0 text-white">
            <button
              type="button"
              onClick={() => onOpenProfile(post.handle)}
              className="truncate text-left text-sm font-semibold hover:text-white/80"
            >
              {post.author}
            </button>
            <p className="line-clamp-2 text-xs text-white/80">
              {post.caption ? (
                <CaptionWithHashtags
                  caption={post.caption}
                  hashtagClassName="font-semibold text-white transition hover:text-[var(--brand-soft)]"
                />
              ) : (
                post.handle
              )}
            </p>
            <InterestBadges interests={interestBadges} variant="overlay" />
          </div>
          <button
            type="button"
            onClick={() => onToggleSave(post.id)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border backdrop-blur-sm ${
              post.saved
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-white/20 bg-black/35 text-white"
            }`}
            aria-label={post.saved ? "Remove from vault" : "Vault post"}
            title={post.saved ? "Vaulted" : "Vault"}
          >
            <SaveGlyph saved={post.saved} />
          </button>
        </div>
      </div>
    </article>
  );
}

function TrendingCard({
  post,
  onOpenProfile,
}: {
  post: Post;
  onOpenProfile: (handle: string) => void;
}) {
  const interestBadges = resolvePostInterests(post);

  return (
    <article className="group rounded-2xl border border-[var(--line)] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[var(--brand)]">
      <div className="relative h-36 overflow-hidden rounded-xl">
        {post.mediaUrl && post.mediaType === "image" ? (
          <Image
            src={post.mediaUrl}
            alt={`${post.author} post`}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : post.mediaUrl && post.mediaType === "video" ? (
          <video
            src={post.mediaUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="h-full w-full" style={{ background: post.gradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/40" />
        <div className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          {post.kind}
        </div>
        {post.immersiveVideo ? (
          <div className="absolute left-2 top-9 rounded-full bg-cyan-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 backdrop-blur-sm">
            360
          </div>
        ) : null}
        <div className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <LivePostAge createdAt={post.createdAt} initialLabel={post.timeAgo} />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <button
          type="button"
          onClick={() => onOpenProfile(post.handle)}
          className="text-left text-sm font-semibold text-slate-900 hover:text-[var(--brand)]"
        >
          {post.author}
        </button>
        <p className="line-clamp-2 text-xs text-slate-500">
          {post.caption ? (
            <CaptionWithHashtags caption={post.caption} />
          ) : (
            post.handle
          )}
        </p>
        <InterestBadges interests={interestBadges} />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>{post.likes} likes</span>
          <span>{post.comments} comments</span>
          <span>{post.shareCount} shares</span>
        </div>
      </div>
    </article>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<ExploreFilter>("all");
  const [topicFilter, setTopicFilter] = useState<TopicFilter>("all");
  const [topicSavingId, setTopicSavingId] = useState<InterestKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");

  const openProfile = (handle: string) => {
    const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
    router.push(`/profile?user=${cleanHandle}`);
  };

  useEffect(() => {
    const storedViewport = window.localStorage.getItem("motion-viewport");
    if (storedViewport === "desktop" || storedViewport === "tablet" || storedViewport === "mobile") {
      setViewportMode(storedViewport);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("motion-viewport", viewportMode);
  }, [viewportMode]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });

        if (meRes.status === 401) {
          router.replace("/");
          return;
        }

        const mePayload = (await meRes.json()) as { user: User };
        setUser(mePayload.user);

        const discover = await apiGet<{ posts: Post[] }>("/api/posts?scope=discover");
        setPosts(discover.posts);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load explore.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const discover = await apiGet<{ posts: Post[] }>("/api/posts?scope=discover");
        setPosts(discover.posts);
      } catch {
        // Keep the current explore state if a background refresh fails.
      }
    }, 45_000);

    return () => window.clearInterval(interval);
  }, []);

  const visiblePosts = useMemo(() => {
    const basePosts =
      topicFilter === "all"
        ? posts
        : posts.filter((post) => resolvePostInterests(post).includes(topicFilter));

    if (filter === "photos") {
      return sortByNewest(basePosts.filter((post) => post.kind === "Photo"));
    }

    if (filter === "reels") {
      return sortByNewest(basePosts.filter((post) => post.kind === "Reel"));
    }

    return sortByNewest(basePosts);
  }, [filter, posts, topicFilter]);

  const trendingPosts = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = visiblePosts.filter(
      (post) => new Date(post.createdAt).getTime() >= cutoff,
    );
    const base = recent.length > 0 ? recent : visiblePosts;
    return [...base]
      .sort(
        (a, b) =>
          b.likes + b.comments + b.shareCount - (a.likes + a.comments + a.shareCount),
      )
      .slice(0, 6);
  }, [visiblePosts]);

  const popularCreators = useMemo(() => {
    const creators = new Map<
      string,
      { handle: string; name: string; score: number; posts: number; gradient: string }
    >();

    visiblePosts.forEach((post) => {
      const key = post.handle.toLowerCase();
      const entry = creators.get(key) ?? {
        handle: post.handle,
        name: post.author,
        score: 0,
        posts: 0,
        gradient: post.gradient,
      };
      entry.posts += 1;
      entry.score += post.likes + post.comments + post.shareCount;
      creators.set(key, entry);
    });

    return [...creators.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [visiblePosts]);

  const topicSections = useMemo(() => {
    const preferredTopics =
      user?.interests && user.interests.length > 0
        ? INTEREST_OPTIONS.filter((option) => user.interests?.includes(option.id))
        : INTEREST_OPTIONS;

    const rankedTopics = preferredTopics
      .map((interest) => {
        const matchingPosts = visiblePosts.filter((post) =>
          resolvePostInterests(post).includes(interest.id),
        );

        const score = matchingPosts.reduce(
          (sum, post) => sum + post.likes + post.comments + post.shareCount,
          0,
        );

        return {
          interest,
          score,
          posts: sortByNewest(matchingPosts).slice(0, 3),
        };
      })
      .filter((section) => section.posts.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return rankedTopics;
  }, [user?.interests, visiblePosts]);

  const trendingHashtags = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const hashtagMap = new Map<
      string,
      { tag: string; count: number; score: number; latestCreatedAt: string }
    >();

    visiblePosts.forEach((post) => {
      if (new Date(post.createdAt).getTime() < cutoff) {
        return;
      }

      extractHashtags(post.caption).forEach((tag) => {
        const current = hashtagMap.get(tag) ?? {
          tag,
          count: 0,
          score: 0,
          latestCreatedAt: post.createdAt,
        };
        current.count += 1;
        current.score += post.likes + post.comments + post.shareCount;
        if (new Date(post.createdAt).getTime() > new Date(current.latestCreatedAt).getTime()) {
          current.latestCreatedAt = post.createdAt;
        }
        hashtagMap.set(tag, current);
      });
    });

    return [...hashtagMap.values()]
      .sort((a, b) => b.score + b.count * 5 - (a.score + a.count * 5))
      .slice(0, 8);
  }, [visiblePosts]);

  const creatorSpotlights = useMemo(() => {
    const sharedTopics = new Set(user?.interests ?? []);

    return popularCreators
      .map((creator) => {
        const creatorPosts = visiblePosts.filter((post) => post.handle === creator.handle);
        const creatorTopics = Array.from(
          new Set(creatorPosts.flatMap((post) => resolvePostInterests(post))),
        );
        const shared = creatorTopics.filter((topic) => sharedTopics.has(topic));
        const featuredPost = creatorPosts[0] ?? null;

        return {
          ...creator,
          featuredPost,
          creatorTopics,
          shared,
        };
      })
      .slice(0, 3);
  }, [popularCreators, user?.interests, visiblePosts]);

  const becauseYouLiked = useMemo(() => {
    const likedTopics = Array.from(
      new Set(
        visiblePosts.filter((post) => post.liked).flatMap((post) => resolvePostInterests(post)),
      ),
    );
    const fallbackTopics = user?.interests ?? [];
    const targetTopics = likedTopics.length > 0 ? likedTopics : fallbackTopics;

    if (targetTopics.length === 0) {
      return [];
    }

    return visiblePosts
      .filter(
        (post) =>
          !post.liked &&
          resolvePostInterests(post).some((interest) => targetTopics.includes(interest)),
      )
      .sort((a, b) => {
        const aTopicMatches = resolvePostInterests(a).filter((interest) =>
          targetTopics.includes(interest),
        ).length;
        const bTopicMatches = resolvePostInterests(b).filter((interest) =>
          targetTopics.includes(interest),
        ).length;

        if (bTopicMatches !== aTopicMatches) {
          return bTopicMatches - aTopicMatches;
        }

        return b.likes + b.comments + b.shareCount - (a.likes + a.comments + a.shareCount);
      })
      .slice(0, 4);
  }, [user?.interests, visiblePosts]);

  const postTiles = useMemo(
    () =>
      visiblePosts.map((post, index) => {
        const spanSet = post.kind === "Reel" ? REEL_ROW_SPANS : PHOTO_ROW_SPANS;
        const seed =
          post.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) + index;
        const featured = index % 7 === 0;

        return {
          post,
          featured,
          rowSpan: featured ? spanSet[seed % spanSet.length] + 10 : spanSet[seed % spanSet.length],
          colSpan: featured ? 2 : 1,
        };
      }),
    [visiblePosts],
  );

  const toggleSave = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/save`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        saved?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to vault post.");
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, saved: Boolean(payload.saved) } : post,
        ),
      );
    } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "Failed to vault post.");
    }
  };

  const followedTopics = user?.interests ?? [];

  const toggleTopicFollow = async (interest: InterestKey) => {
    if (!user) {
      return;
    }

    const nextInterests = followedTopics.includes(interest)
      ? followedTopics.filter((item) => item !== interest)
      : [...followedTopics, interest];

    setTopicSavingId(interest);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: nextInterests }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        user?: User;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update followed topics.");
      }

      if (payload.user) {
        setUser(payload.user);
      }
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update followed topics.",
      );
    } finally {
      setTopicSavingId(null);
    }
  };

  if (loading) {
    return (
      <main className="motion-shell min-h-screen px-4 py-8">
        <div className="motion-surface mx-auto max-w-6xl p-6">Loading explore...</div>
      </main>
    );
  }

  return (
    <main className="motion-shell min-h-screen px-4 py-6" data-viewport={viewportMode}>
      <div className="motion-viewport">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Feed
          </Link>
          <div className="flex items-center gap-3">
            <ViewportPicker mode={viewportMode} onChange={setViewportMode} />
            {user ? (
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-xs font-bold text-white"
                style={{ background: user.avatarGradient }}
                aria-label="Open profile"
                title="Profile"
              >
                {user.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </button>
            ) : null}
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Explore</p>
          </div>
        </div>

        <section className="motion-surface p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Explore
              </p>
              <h1
                className="mt-2 text-3xl font-semibold text-slate-900"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Fresh explore, separate from feed.
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Explore trending posts and reels without loading down the main feed.
              </p>
            </div>

            <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
              {[
                { id: "all" as const, label: "All" },
                { id: "photos" as const, label: "Posts" },
                { id: "reels" as const, label: "Reels" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    filter === option.id ? "bg-[var(--brand)] text-white" : "text-slate-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {DISCOVERY_TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[2.1fr_1fr]">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Trending Today
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Heat check across Motion
                  </h2>
                </div>
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-slate-500">
                  {trendingPosts.length} items
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {trendingPosts.length > 0 ? (
                  trendingPosts.map((post) => (
                    <TrendingCard key={post.id} post={post} onOpenProfile={openProfile} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-slate-500">
                    No trending posts yet.
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Popular creators
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      Who&apos;s pulling the crowd
                    </h2>
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-slate-500">
                    {popularCreators.length} creators
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {popularCreators.length > 0 ? (
                    popularCreators.map((creator) => (
                      <button
                        key={creator.handle}
                        type="button"
                        onClick={() => openProfile(creator.handle)}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-left transition hover:border-[var(--brand)]"
                      >
                        <span
                          className="grid h-10 w-10 place-items-center rounded-full text-xs font-semibold text-white"
                          style={{ background: creator.gradient }}
                        >
                          {creator.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {creator.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {creator.handle} · {creator.posts} posts
                          </p>
                        </div>
                        <span className="ml-auto rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[11px] text-slate-700">
                          {creator.score} engagement
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No creators yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Categories
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Jump into a vibe
                  </h2>
                </div>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setTopicFilter("all")}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      topicFilter === "all"
                        ? "border-[var(--brand)] bg-[var(--brand)]/8"
                        : "border-[var(--line)] bg-white hover:border-[var(--brand)]"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">All topics</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Show the full explore mix.
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-slate-500">
                      {visiblePosts.length} posts
                    </span>
                  </button>
                  {INTEREST_OPTIONS.map((interest) => {
                    const followed = followedTopics.includes(interest.id);
                    const matchingCount = posts.filter((post) =>
                      resolvePostInterests(post).includes(interest.id),
                    ).length;

                    return (
                      <div
                        key={interest.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition ${
                          topicFilter === interest.id
                            ? "border-[var(--brand)] bg-[var(--brand)]/8"
                            : "border-[var(--line)] bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setTopicFilter(interest.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {interest.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {matchingCount} matching posts and reels
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleTopicFollow(interest.id)}
                          disabled={topicSavingId === interest.id}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            followed
                              ? "border border-[var(--line)] bg-white text-slate-600 hover:border-[var(--brand)]"
                              : "bg-[var(--brand)] text-white"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {topicSavingId === interest.id
                            ? "Saving..."
                            : followed
                              ? "Following"
                              : "Follow"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Topic sections
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Live lanes that react to what people are posting
                  </h2>
                </div>
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-slate-500">
                  {topicSections.length} lanes
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {topicSections.length > 0 ? (
                  topicSections.map((section) => (
                    <div
                      key={section.interest.id}
                      className="rounded-2xl border border-[var(--line)] bg-slate-50/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {section.interest.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {section.posts.length} fresh picks updating with new explore activity
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTopicFilter(section.interest.id)}
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                        >
                          Open lane
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {section.posts.map((post) => (
                          <TrendingCard key={`${section.interest.id}-${post.id}`} post={post} onOpenProfile={openProfile} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-slate-500">
                    Topic lanes will appear once explore has enough tagged posts and reels.
                  </p>
                )}
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Trending hashtags
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  What people are tagging right now
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {trendingHashtags.length > 0 ? (
                    trendingHashtags.map((entry) => (
                      <Link
                        key={entry.tag}
                        href={`/hashtag/${entry.tag}`}
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                      >
                        #{entry.tag} <span className="text-slate-400">· {entry.count}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No hashtags are trending yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Creator spotlights
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Creators you should probably keep an eye on
                </h2>
                <div className="mt-4 space-y-3">
                  {creatorSpotlights.length > 0 ? (
                    creatorSpotlights.map((creator) => (
                      <button
                        key={`spotlight-${creator.handle}`}
                        type="button"
                        onClick={() => openProfile(creator.handle)}
                        className="w-full rounded-2xl border border-[var(--line)] bg-white p-3 text-left transition hover:border-[var(--brand)]"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-11 w-11 place-items-center rounded-full text-xs font-semibold text-white"
                            style={{ background: creator.gradient }}
                          >
                            {creator.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {creator.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {creator.handle}
                              {creator.shared.length > 0
                                ? ` · Matches ${creator.shared
                                    .map((interest) =>
                                      INTEREST_OPTIONS.find((option) => option.id === interest)?.label ?? interest,
                                    )
                                    .join(", ")}`
                                : " · Spotlight creator"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{creator.score} engagement</span>
                          <span>{creator.posts} posts</span>
                          {creator.featuredPost ? <span>{creator.featuredPost.kind}</span> : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Creator spotlights will land here soon.</p>
                  )}
                </div>
              </section>
            </div>
          </div>

          <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Because you liked
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Motion is learning your taste
                </h2>
              </div>
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-slate-500">
                {becauseYouLiked.length} recommendations
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {becauseYouLiked.length > 0 ? (
                becauseYouLiked.map((post) => (
                  <TrendingCard key={`because-${post.id}`} post={post} onOpenProfile={openProfile} />
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-[var(--line)] bg-slate-50 px-4 py-5 text-sm text-slate-500 md:col-span-2 xl:col-span-4">
                  Like a few posts or follow a few topics and Motion will start shaping this lane for you.
                </p>
              )}
            </div>
          </section>

          {error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {postTiles.length > 0 ? (
            <div className="explore-mosaic mt-5">
              {postTiles.map(({ post, featured, rowSpan, colSpan }) => (
                <ExploreTile
                  key={post.id}
                  post={post}
                  featured={featured}
                  rowSpan={rowSpan}
                  colSpan={colSpan}
                  onToggleSave={toggleSave}
                  onOpenProfile={openProfile}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-slate-500">
              Nothing to explore yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
