import { detectInterestsFromText, mergeInterestSets } from "@/lib/interests";
import type {
  ConversationRecord,
  FollowRecord,
  InterestKey,
  MotionDb,
  PostKind,
  PostRecord,
  UserRecord,
} from "@/lib/server/types";

const RECENCY_HALF_LIFE_HOURS = 36;
const MAX_CREATOR_LIKE_AFFINITY = 3;
const MAX_KIND_PREFERENCE_BOOST = 1.4;

type RankContext = {
  db: MotionDb;
  currentUserId: string | null;
  selectedInterest?: InterestKey | null;
};

type RankingCollections = {
  posts: PostRecord[];
  follows: FollowRecord[];
  conversations: Pick<ConversationRecord, "participantIds">[];
  users: UserRecord[];
};

type RankCollectionsContext = {
  collections: RankingCollections;
  currentUserId: string | null;
  selectedInterest?: InterestKey | null;
};

type PersonalizationProfile = {
  followingSet: Set<string>;
  creatorLikeCount: Map<string, number>;
  directContactSet: Set<string>;
  interestSet: Set<InterestKey>;
  reelLikeRatio: number;
  photoLikeRatio: number;
  totalLikes: number;
};

function safeHoursAgo(isoDate: string): number {
  const ageMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, ageMs / 3_600_000);
}

function boundedLog1p(input: number): number {
  return Math.log1p(Math.max(0, input));
}

function deterministicNoise(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }

  return (hash % 10_000) / 10_000;
}

function buildPersonalizationProfile({
  collections,
  currentUserId,
}: RankCollectionsContext): PersonalizationProfile {
  if (!currentUserId) {
    return {
      followingSet: new Set<string>(),
      creatorLikeCount: new Map<string, number>(),
      directContactSet: new Set<string>(),
      interestSet: new Set<InterestKey>(),
      reelLikeRatio: 0.5,
      photoLikeRatio: 0.5,
      totalLikes: 0,
    };
  }

  const followingSet = new Set(
    collections.follows
      .filter((edge) => edge.followerId === currentUserId)
      .map((edge) => edge.followingId),
  );

  const directContactSet = new Set(
    collections.conversations
      .filter((conversation) => conversation.participantIds.includes(currentUserId))
      .flatMap((conversation) =>
        conversation.participantIds.filter((participant) => participant !== currentUserId),
      ),
  );

  const likedPosts = collections.posts.filter((post) => post.likedBy.includes(currentUserId));
  const currentUser = collections.users.find((user) => user.id === currentUserId);
  const creatorLikeCount = new Map<string, number>();
  let reelLikes = 0;
  let photoLikes = 0;

  for (const post of likedPosts) {
    creatorLikeCount.set(post.userId, (creatorLikeCount.get(post.userId) ?? 0) + 1);
    if (post.kind === "Reel") {
      reelLikes += 1;
    } else {
      photoLikes += 1;
    }
  }

  const totalLikes = likedPosts.length;
  const neutralRatio = 0.5;
  const reelLikeRatio = totalLikes > 0 ? reelLikes / totalLikes : neutralRatio;
  const photoLikeRatio = totalLikes > 0 ? photoLikes / totalLikes : neutralRatio;

  return {
    followingSet,
    creatorLikeCount,
    directContactSet,
    interestSet: new Set(currentUser?.interests ?? []),
    reelLikeRatio,
    photoLikeRatio,
    totalLikes,
  };
}

function computeRecencyScore(post: PostRecord): number {
  const ageHours = safeHoursAgo(post.createdAt);
  return Math.exp((-Math.log(2) * ageHours) / RECENCY_HALF_LIFE_HOURS) * 4.2;
}

function computeEngagementScore(post: PostRecord): number {
  const weightedEngagement =
    post.likedBy.length * 1.1 +
    post.commentCount * 1.7 +
    (post.shareCount ?? 0) * 2.4;
  const watchSeconds = (post.watchTimeMs ?? 0) / 1000;
  const watchScore = boundedLog1p(watchSeconds) * 0.9;
  return boundedLog1p(weightedEngagement) * 1.8 + watchScore;
}

function computeKindPreferenceScore({
  postKind,
  profile,
}: {
  postKind: PostKind;
  profile: PersonalizationProfile;
}): number {
  const preferenceRatio = postKind === "Reel" ? profile.reelLikeRatio : profile.photoLikeRatio;
  const centeredPreference = preferenceRatio - 0.5;
  return centeredPreference * MAX_KIND_PREFERENCE_BOOST * 2;
}

function computeCreatorAffinityScore({
  post,
  profile,
  currentUserId,
}: {
  post: PostRecord;
  profile: PersonalizationProfile;
  currentUserId: string;
}): number {
  if (post.userId === currentUserId) {
    return -3.5;
  }

  let score = 0;

  if (profile.followingSet.has(post.userId)) {
    score += 2.8;
  } else {
    // Encourage discovery of non-followed creators in discover mode.
    score += 1.2;
  }

  if (profile.directContactSet.has(post.userId)) {
    score += 1.3;
  }

  const likeAffinity = Math.min(
    profile.creatorLikeCount.get(post.userId) ?? 0,
    MAX_CREATOR_LIKE_AFFINITY,
  );
  score += likeAffinity * 1.05;

  return score;
}

function computeFreshnessPenalty(post: PostRecord): number {
  const ageHours = safeHoursAgo(post.createdAt);
  if (ageHours <= 6) {
    return 0;
  }

  if (ageHours <= 24) {
    return -0.35;
  }

  if (ageHours <= 72) {
    return -0.8;
  }

  return -1.4;
}

function computeInterestMatchScore({
  post,
  profile,
  usersById,
}: {
  post: PostRecord;
  profile: PersonalizationProfile;
  usersById: Map<string, UserRecord>;
}): number {
  if (profile.interestSet.size === 0) {
    return 0;
  }

  const author = usersById.get(post.userId);
  const matchedInterests = mergeInterestSets(
    author?.interests,
    post.interests,
    detectInterestsFromText(`${post.caption} ${post.location}`),
  ).filter((interest) => profile.interestSet.has(interest));

  if (matchedInterests.length === 0) {
    return 0;
  }

  return 1.8 + (matchedInterests.length - 1) * 0.9;
}

function scoreDiscoverPost({
  post,
  profile,
  currentUserId,
  usersById,
  selectedInterest,
}: {
  post: PostRecord;
  profile: PersonalizationProfile;
  currentUserId: string | null;
  usersById: Map<string, UserRecord>;
  selectedInterest?: InterestKey | null;
}): number {
  const recencyScore = computeRecencyScore(post);
  const engagementScore = computeEngagementScore(post);
  const freshnessPenalty = computeFreshnessPenalty(post);
  const scopeBoost = post.scope === "discover" ? 0.8 : 0;
  const interestMatchScore = computeInterestMatchScore({ post, profile, usersById });
  const selectedInterestMatch =
    selectedInterest &&
    mergeInterestSets(
      usersById.get(post.userId)?.interests,
      post.interests,
      detectInterestsFromText(`${post.caption} ${post.location}`),
    ).includes(selectedInterest)
      ? 3.2
      : 0;
  const noise = deterministicNoise(`${currentUserId ?? "anon"}:${post.id}`) * 0.2;

  if (!currentUserId) {
    return (
      recencyScore +
      engagementScore +
      freshnessPenalty +
      scopeBoost +
      interestMatchScore +
      selectedInterestMatch +
      noise
    );
  }

  const creatorAffinity = computeCreatorAffinityScore({
    post,
    profile,
    currentUserId,
  });
  const kindPreference = computeKindPreferenceScore({
    postKind: post.kind,
    profile,
  });

  const alreadyLikedBoost = post.likedBy.includes(currentUserId) ? 0.5 : 0;
  const coldStartExplorationBoost = profile.totalLikes < 4 ? 0.8 : 0;

  return (
    recencyScore +
    engagementScore +
    creatorAffinity +
    kindPreference +
    interestMatchScore +
    selectedInterestMatch +
    alreadyLikedBoost +
    coldStartExplorationBoost +
    freshnessPenalty +
    scopeBoost +
    noise
  );
}

export function rankDiscoverPostsFromCollections({
  collections,
  currentUserId,
  selectedInterest,
}: RankCollectionsContext): PostRecord[] {
  const usersById = new Map(collections.users.map((user) => [user.id, user]));
  const profile = buildPersonalizationProfile({ collections, currentUserId });
  const ranked = [...collections.posts].map((post) => ({
    post,
    score: scoreDiscoverPost({
      post,
      profile,
      currentUserId,
      usersById,
      selectedInterest,
    }),
  }));

  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return (
      new Date(right.post.createdAt).getTime() -
      new Date(left.post.createdAt).getTime()
    );
  });

  return ranked.map((entry) => entry.post);
}

export function rankDiscoverPosts({
  db,
  currentUserId,
  selectedInterest,
}: RankContext): PostRecord[] {
  return rankDiscoverPostsFromCollections({
    collections: {
      posts: db.posts,
      follows: db.follows,
      conversations: db.conversations,
      users: db.users,
    },
    currentUserId,
    selectedInterest,
  });
}
