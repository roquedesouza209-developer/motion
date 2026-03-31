import type {
  BlockRecord,
  InterestKey,
  RandomChatQueueRecord,
  RandomChatReportRecord,
  RandomChatSessionRecord,
  UserRecord,
} from "@/lib/server/types";

const ACTIVE_RANDOM_CHAT_STATUSES = new Set(["connecting", "active"]);

function overlapInterests(left?: InterestKey[], right?: InterestKey[]) {
  if (!left || left.length === 0 || !right || right.length === 0) {
    return [] as InterestKey[];
  }

  const rightSet = new Set(right);
  return left.filter((interest) => rightSet.has(interest));
}

function hasReportedPair({
  reports,
  leftUserId,
  rightUserId,
}: {
  reports: RandomChatReportRecord[];
  leftUserId: string;
  rightUserId: string;
}) {
  return reports.some(
    (report) =>
      (report.reporterId === leftUserId && report.reportedUserId === rightUserId) ||
      (report.reporterId === rightUserId && report.reportedUserId === leftUserId),
  );
}

export function getActiveRandomChatSession(
  sessions: RandomChatSessionRecord[],
  userId: string,
) {
  return (
    [...sessions]
      .filter(
        (session) =>
          session.participantIds.includes(userId) &&
          ACTIVE_RANDOM_CHAT_STATUSES.has(session.status) &&
          !session.endedAt,
      )
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )[0] ?? null
  );
}

export function getUserRandomChatQueue(
  queue: RandomChatQueueRecord[],
  userId: string,
) {
  return queue.find((entry) => entry.userId === userId) ?? null;
}

export function getSharedRandomChatInterests({
  currentUser,
  participant,
}: {
  currentUser: UserRecord | null | undefined;
  participant: { interests?: InterestKey[] };
}) {
  return overlapInterests(currentUser?.interests, participant.interests);
}

export function canMatchRandomChatUsers({
  currentUser,
  currentQueue,
  candidateUser,
  candidateQueue,
  blocks,
  reports,
}: {
  currentUser: UserRecord;
  currentQueue: RandomChatQueueRecord;
  candidateUser: UserRecord;
  candidateQueue: RandomChatQueueRecord;
  blocks: BlockRecord[];
  reports: RandomChatReportRecord[];
}) {
  if (currentUser.id === candidateUser.id) {
    return false;
  }

  if (
    blocks.some(
      (entry) =>
        (entry.blockerId === currentUser.id && entry.blockedUserId === candidateUser.id) ||
        (entry.blockerId === candidateUser.id && entry.blockedUserId === currentUser.id),
    )
  ) {
    return false;
  }

  if (
    hasReportedPair({
      reports,
      leftUserId: currentUser.id,
      rightUserId: candidateUser.id,
    })
  ) {
    return false;
  }

  if (
    currentQueue.preferredCountry &&
    candidateQueue.country !== currentQueue.preferredCountry
  ) {
    return false;
  }

  if (
    candidateQueue.preferredCountry &&
    currentQueue.country !== candidateQueue.preferredCountry
  ) {
    return false;
  }

  if (
    currentQueue.preferredInterests.length > 0 &&
    overlapInterests(candidateUser.interests, currentQueue.preferredInterests).length === 0
  ) {
    return false;
  }

  if (
    candidateQueue.preferredInterests.length > 0 &&
    overlapInterests(currentUser.interests, candidateQueue.preferredInterests).length === 0
  ) {
    return false;
  }

  return true;
}
