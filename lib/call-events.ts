import type { CallMode, CallSessionDto } from "@/lib/server/types";

export const MOTION_START_CALL_EVENT = "motion-start-call";
export const MOTION_CALL_STATE_EVENT = "motion-call-state";
export const MOTION_CALL_SYNC_REQUEST_EVENT = "motion-call-sync-request";

export type MotionStartCallDetail = {
  conversationId: string;
  mode: CallMode;
  participantIds?: string[];
};

export type MotionCallStateDetail = {
  session: CallSessionDto | null;
  statusLabel: string;
  busy: boolean;
  error: string | null;
  conversationId?: string | null;
};
