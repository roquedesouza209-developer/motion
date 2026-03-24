"use client";

import type { ReactNode, RefObject } from "react";

import UserAvatar from "@/components/user-avatar";

type CallMode = "voice" | "video";
type CallStatus = "ringing" | "connecting" | "active" | "declined" | "ended" | "missed";
type CallQuality = "auto" | "hd" | "data_saver";
type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unknown";
type CallToast = {
  id: string;
  text: string;
  tone: "join" | "leave";
};

type CallParticipant = {
  userId: string;
  name: string;
  handle: string;
  avatarGradient: string;
  avatarUrl?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing?: boolean;
  recording?: boolean;
  joined: boolean;
};

type CallSession = {
  id: string;
  conversationId: string;
  currentUserId: string;
  mode: CallMode;
  status: CallStatus;
  isInitiator: boolean;
  isIncoming: boolean;
  isGroup: boolean;
  title: string;
  otherUser: {
    id: string;
    name: string;
    handle: string;
    avatarGradient: string;
    avatarUrl?: string;
  };
  participants: CallParticipant[];
};

type ChatCallOverlayProps = {
  session: CallSession | null;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoReady: boolean;
  remoteParticipants: CallParticipant[];
  stageParticipantId?: string | null;
  pinnedParticipantId?: string | null;
  bindRemoteParticipantVideoElement: (userId: string, element: HTMLVideoElement | null) => void;
  remoteVideoReadyByUserId: Record<string, boolean>;
  localVideoReady: boolean;
  localSpeaking: boolean;
  remoteSpeakingByUserId: Record<string, boolean>;
  localNetworkQuality: NetworkQuality;
  remoteNetworkQualityByUserId: Record<string, NetworkQuality>;
  muted: boolean;
  videoEnabled: boolean;
  callRecordingActive: boolean;
  screenSharing: boolean;
  callQuality: CallQuality;
  busy: boolean;
  callError: string | null;
  callToasts: CallToast[];
  statusLabel: string;
  liveDurationLabel?: string | null;
  minimized?: boolean;
  canMinimize?: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onCallQualityChange: (quality: CallQuality) => void;
  onPinParticipant: (participantId: string) => void;
  onUnpinParticipant: () => void;
  onMinimize?: () => void;
  onRestore?: () => void;
};

function CallControl({
  label,
  onClick,
  variant = "default",
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "accept" | "active";
  disabled?: boolean;
  children: ReactNode;
}) {
  const tone =
    variant === "danger"
      ? "bg-rose-500 text-white shadow-[0_18px_40px_-20px_rgba(244,63,94,0.9)]"
      : variant === "accept"
        ? "bg-emerald-500 text-white shadow-[0_18px_40px_-20px_rgba(16,185,129,0.9)]"
        : variant === "active"
          ? "border-white/30 bg-white/15 text-white"
          : "border-white/20 bg-white/10 text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-24 flex-col items-center gap-2 rounded-[28px] border px-4 py-3 text-xs font-semibold backdrop-blur-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
      aria-label={label}
      title={label}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/20">{children}</span>
      <span>{label}</span>
    </button>
  );
}

function MiniControl({
  label,
  onClick,
  variant = "default",
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "active";
  disabled?: boolean;
  children: ReactNode;
}) {
  const tone =
    variant === "danger"
      ? "bg-rose-500 text-white shadow-[0_18px_40px_-20px_rgba(244,63,94,0.75)]"
      : variant === "active"
        ? "border-white/30 bg-white/15 text-white"
        : "border-white/20 bg-white/8 text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`grid h-11 w-11 place-items-center rounded-2xl border transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function formatQualityLabel(quality: CallQuality) {
  if (quality === "data_saver") return "Data Saver";
  if (quality === "auto") return "Auto";
  return "HD";
}

function formatNetworkQualityLabel(quality: NetworkQuality) {
  switch (quality) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return "Checking";
  }
}

function MicGlyph({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {muted ? (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 11.8 5" />
          <path d="M19 10a7 7 0 0 1-2.2 5" />
          <path d="M12 19v2" />
          <path d="M4 4l16 16" />
        </>
      ) : (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <path d="M12 17v4" />
        </>
      )}
    </svg>
  );
}

function CameraGlyph({ disabled }: { disabled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {disabled ? (
        <>
          <rect x="3" y="7" width="13" height="10" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
          <path d="M4 4 20 20" />
        </>
      ) : (
        <>
          <rect x="3" y="7" width="13" height="10" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </>
      )}
    </svg>
  );
}

function ParticipantBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "live" | "speaking" | "muted" }) {
  const classes =
    tone === "live"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-50"
      : tone === "speaking"
        ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-50"
        : tone === "muted"
          ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
          : "border-white/10 bg-black/30 text-white/70";

  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${classes}`}>{children}</span>;
}

function NetworkQualityBadge({ quality }: { quality: NetworkQuality }) {
  const classes =
    quality === "excellent"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-50"
      : quality === "good"
        ? "border-sky-300/30 bg-sky-400/10 text-sky-50"
        : quality === "fair"
          ? "border-amber-300/30 bg-amber-400/10 text-amber-50"
          : quality === "poor"
            ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
            : "border-white/10 bg-black/30 text-white/70";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${classes}`}
    >
      <span className="font-bold">Net</span>
      <span>{formatNetworkQualityLabel(quality)}</span>
    </span>
  );
}

function CallToastStack({ toasts }: { toasts: CallToast[] }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[125] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_24px_60px_-32px_rgba(2,6,23,0.95)] backdrop-blur-xl ${
            toast.tone === "join"
              ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-50"
              : "border-amber-300/30 bg-amber-400/12 text-amber-50"
          } motion-call-toast`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
function ParticipantVideoTile({
  participant,
  stage = false,
  local = false,
  videoReady,
  speaking,
  muted,
  presenting = false,
  pinned = false,
  networkQuality = "unknown",
  recording = false,
  videoRef,
  bindVideoElement,
  footerLabel,
  onPin,
}: {
  participant: CallParticipant;
  stage?: boolean;
  local?: boolean;
  videoReady: boolean;
  speaking: boolean;
  muted: boolean;
  presenting?: boolean;
  pinned?: boolean;
  networkQuality?: NetworkQuality;
  recording?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  bindVideoElement?: (userId: string, element: HTMLVideoElement | null) => void;
  footerLabel?: string;
  onPin?: () => void;
}) {
  const showVideo = participant.videoEnabled && videoReady;
  const wrapperClass = stage
    ? "relative h-full min-h-[22rem] overflow-hidden rounded-[36px] border border-white/12 bg-black/25 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)]"
    : "relative aspect-[4/5] overflow-hidden rounded-[30px] border border-white/10 bg-black/25";

  return (
    <div
      className={`${wrapperClass} ${speaking ? "ring-2 ring-cyan-300/45 shadow-[0_0_0_1px_rgba(103,232,249,0.25)]" : ""} ${onPin ? "cursor-pointer transition hover:scale-[1.01]" : ""}`}
      onClick={onPin}
      role={onPin ? "button" : undefined}
      tabIndex={onPin ? 0 : undefined}
      onKeyDown={
        onPin
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPin();
              }
            }
          : undefined
      }
    >
      {showVideo ? (
        videoRef ? (
          <video ref={videoRef} autoPlay playsInline muted={local} className="h-full w-full object-cover" />
        ) : bindVideoElement ? (
          <video ref={(element) => bindVideoElement(participant.userId, element)} autoPlay playsInline className="h-full w-full object-cover" />
        ) : null
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_35%),linear-gradient(180deg,_rgba(15,23,42,0.88),_rgba(2,6,23,0.98))]">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-[-1.5rem] rounded-full border border-white/8" />
            <UserAvatar
              name={participant.name}
              avatarGradient={participant.avatarGradient}
              avatarUrl={participant.avatarUrl}
              className={stage ? "h-28 w-28" : "h-18 w-18"}
              textClassName={stage ? "text-3xl font-semibold text-white" : "text-xl font-semibold text-white"}
              sizes={stage ? "112px" : "72px"}
            />
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {presenting ? <ParticipantBadge tone="live">Presenting</ParticipantBadge> : null}
          {pinned ? <ParticipantBadge>Pinned</ParticipantBadge> : null}
          {recording ? <ParticipantBadge tone="live">REC</ParticipantBadge> : null}
          {speaking ? <ParticipantBadge tone="speaking">Speaking</ParticipantBadge> : null}
        </div>
        <div className="flex items-center gap-2">
          <NetworkQualityBadge quality={networkQuality} />
          {muted ? (
            <ParticipantBadge tone="muted">
              <MicGlyph muted />
              <span>Muted</span>
            </ParticipantBadge>
          ) : null}
          {!participant.videoEnabled && !presenting ? (
            <ParticipantBadge>
              <CameraGlyph disabled />
              <span>Camera off</span>
            </ParticipantBadge>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {participant.name}
              {local ? " (You)" : ""}
            </p>
            <p className="mt-1 text-[11px] text-white/70">
              {footerLabel ??
                (presenting
                  ? "Sharing screen"
                  : participant.videoEnabled
                    ? videoReady
                      ? "Video live"
                      : "Connecting video"
                    : muted
                      ? "Muted"
                      : "Audio only")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-semibold text-white/75 backdrop-blur-xl">
            {participant.joined ? "Joined" : "Connecting"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatCallOverlay({
  session,
  localVideoRef,
  remoteVideoRef,
  remoteVideoReady,
  remoteParticipants,
  stageParticipantId = null,
  pinnedParticipantId = null,
  bindRemoteParticipantVideoElement,
  remoteVideoReadyByUserId,
  localVideoReady,
  localSpeaking,
  remoteSpeakingByUserId,
  localNetworkQuality,
  remoteNetworkQualityByUserId,
  muted,
  videoEnabled,
  callRecordingActive,
  screenSharing,
  callQuality,
  busy,
  callError,
  callToasts,
  statusLabel,
  liveDurationLabel,
  minimized = false,
  canMinimize = false,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onCallQualityChange,
  onPinParticipant,
  onUnpinParticipant,
  onMinimize,
  onRestore,
}: ChatCallOverlayProps) {
  if (!session) {
    return null;
  }

  const localParticipant = session.participants.find((participant) => participant.userId === session.currentUserId) ?? null;
  const remoteParticipant =
    remoteParticipants.find((participant) => participant.userId === stageParticipantId) ??
    remoteParticipants.find((participant) => participant.userId === session.otherUser.id) ??
    remoteParticipants[0] ??
    null;
  const showIncomingActions = session.isIncoming && session.status === "ringing";
  const showVideoStage = session.mode === "video";
  const showMinimizedBar = minimized && !showIncomingActions;
  const presenterMode = showVideoStage && (screenSharing || Boolean(remoteParticipant?.screenSharing));
  const pinnedParticipant =
    session.participants.find((participant) => participant.userId === pinnedParticipantId) ??
    null;
  const anyRecording = session.participants.some((participant) => participant.recording);
  const spotlightMode =
    Boolean(session.isGroup && showVideoStage && !presenterMode && pinnedParticipant);
  const showingLocalStage = presenterMode && screenSharing;
  const stageLabel = showingLocalStage
    ? "Your screen is live"
    : remoteParticipant?.screenSharing
      ? `${remoteParticipant.name} is sharing their screen`
      : session.isGroup
        ? `${remoteParticipants.length + 1} people in the call`
        : session.otherUser.name;
  const groupGridTiles = [...(localParticipant ? [localParticipant] : []), ...remoteParticipants];
  const groupGridClass =
    groupGridTiles.length <= 2
      ? "grid-cols-1 md:grid-cols-2"
      : groupGridTiles.length <= 4
        ? "grid-cols-2"
        : "grid-cols-2 xl:grid-cols-3";
  const presenterThumbnails = [
    ...(showingLocalStage ? [] : localParticipant ? [localParticipant] : []),
    ...remoteParticipants.filter((participant) => (showingLocalStage ? true : participant.userId !== remoteParticipant?.userId)),
  ];
  const spotlightThumbnails = pinnedParticipant
    ? session.participants.filter((participant) => participant.userId !== pinnedParticipant.userId)
    : [];

  if (showMinimizedBar) {
    return (
      <>
        <CallToastStack toasts={callToasts} />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[118]">
          <video ref={remoteVideoRef} autoPlay playsInline className="pointer-events-none h-0 w-0 opacity-0" />
          <video ref={localVideoRef} autoPlay playsInline muted className="pointer-events-none h-0 w-0 opacity-0" />
        </div>
        <div className="fixed bottom-5 right-5 z-[120] w-[min(24rem,calc(100vw-1.5rem))] rounded-[28px] border border-white/12 bg-[#091321]/92 p-4 text-white shadow-[0_30px_80px_-32px_rgba(2,6,23,0.95)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <UserAvatar name={session.otherUser.name} avatarGradient={session.otherUser.avatarGradient} avatarUrl={session.otherUser.avatarUrl} className="h-14 w-14" textClassName="text-lg font-semibold text-white" sizes="56px" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-white">{session.isGroup ? session.title : session.otherUser.name}</p>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">Live</span>
                {anyRecording ? <span className="rounded-full border border-rose-300/30 bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-100">REC</span> : null}
                {session.isGroup ? <span className="rounded-full border border-white/15 bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">{remoteParticipants.length + 1} people</span> : null}
              </div>
              <p className="mt-1 text-xs text-white/70">{statusLabel}</p>
              {liveDurationLabel ? <p className="mt-1 text-[11px] font-semibold text-cyan-100">{liveDurationLabel}</p> : null}
            </div>
            <button type="button" onClick={onRestore} className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/6 text-white transition hover:scale-[1.03]" aria-label="Restore call" title="Restore call">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14 14 6" />
                <path d="M8 6h6v6" />
              </svg>
            </button>
          </div>

          {callError ? <p className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">{callError}</p> : null}

          <div className="mt-4 flex items-center justify-between gap-2">
            <MiniControl label={muted ? "Unmute" : "Mute"} onClick={onToggleMute} variant={muted ? "active" : "default"} disabled={busy}>
              <MicGlyph muted={muted} />
            </MiniControl>
            {showVideoStage ? (
              <MiniControl label={videoEnabled ? "Video on" : "Video off"} onClick={onToggleVideo} variant={videoEnabled ? "default" : "active"} disabled={busy}>
                <CameraGlyph disabled={!videoEnabled} />
              </MiniControl>
            ) : null}
            <MiniControl label="End" onClick={onEnd} variant="danger" disabled={busy}>
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15.5c3.4-3 12.6-3 16 0" />
                <path d="M8 13.5 6.5 18" />
                <path d="m16 13.5 1.5 4.5" />
              </svg>
            </MiniControl>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#070b14] text-white">
      <CallToastStack toasts={callToasts} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.22),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(180deg,_rgba(7,11,20,0.94),_rgba(3,7,18,1))]" />

      <div className="absolute inset-0 flex flex-col p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/55">
              {session.mode === "video" ? (session.isGroup ? "Group Video Call" : "Video Call") : session.isGroup ? "Group Voice Call" : "Voice Call"}
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">{session.isGroup ? session.title : session.otherUser.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
              <p>{statusLabel}</p>
              {anyRecording ? (
                <span className="rounded-full border border-rose-300/30 bg-rose-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-100">
                  Recording
                </span>
              ) : null}
            </div>
            {session.isGroup ? <p className="mt-2 text-xs text-white/55">{remoteParticipants.length + 1} participants in this call</p> : null}
            {callError ? <p className="mt-3 inline-flex rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-100">{callError}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            {showVideoStage ? <div className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100 backdrop-blur-xl">{screenSharing ? "Screen share" : `${formatQualityLabel(callQuality)} video`}</div> : null}
            {spotlightMode ? (
              <button
                type="button"
                onClick={onUnpinParticipant}
                className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl transition hover:bg-white/10"
              >
                Unpin
              </button>
            ) : null}
            {canMinimize ? (
              <button type="button" onClick={onMinimize} className="grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/6 text-white/80 transition hover:scale-[1.03] hover:text-white" aria-label="Minimize call" title="Minimize call">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10h12" />
                </svg>
              </button>
            ) : null}
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur-xl">{liveDurationLabel ?? (remoteParticipant?.joined ? "Connected" : "Ringing")}</div>
          </div>
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
          {showVideoStage ? (
            presenterMode ? (
              <>
                <div className="min-h-0 flex-1">
                  {showingLocalStage && localParticipant ? (
                    <ParticipantVideoTile
                      participant={{ ...localParticipant, videoEnabled: true }}
                      local
                      stage
                      videoReady={localVideoReady}
                      speaking={localSpeaking}
                      muted={muted}
                      presenting
                      recording={Boolean(localParticipant.recording)}
                      networkQuality={localNetworkQuality}
                      videoRef={localVideoRef}
                      footerLabel="Your screen is live"
                    />
                  ) : remoteParticipant ? (
                    <ParticipantVideoTile
                      participant={remoteParticipant}
                      stage
                      videoReady={remoteVideoReady}
                      speaking={Boolean(remoteSpeakingByUserId[remoteParticipant.userId])}
                      muted={!remoteParticipant.audioEnabled}
                      presenting
                      recording={Boolean(remoteParticipant.recording)}
                      networkQuality={
                        remoteNetworkQualityByUserId[remoteParticipant.userId] ?? "unknown"
                      }
                      videoRef={remoteVideoRef}
                      footerLabel={stageLabel}
                    />
                  ) : null}
                </div>

                {presenterThumbnails.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Thumbnails</p>
                      <p className="text-xs text-white/55">Everyone stays visible while the presenter is full screen.</p>
                    </div>
                    <div className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1">
                      {presenterThumbnails.map((participant) => {
                        const isLocal = participant.userId === session.currentUserId;
                        return (
                          <ParticipantVideoTile
                            key={participant.userId}
                            participant={participant}
                            local={isLocal}
                            videoReady={isLocal ? localVideoReady && videoEnabled : Boolean(remoteVideoReadyByUserId[participant.userId])}
                            speaking={isLocal ? localSpeaking : Boolean(remoteSpeakingByUserId[participant.userId])}
                            muted={isLocal ? muted : !participant.audioEnabled}
                            presenting={Boolean(participant.screenSharing)}
                            recording={Boolean(participant.recording)}
                            networkQuality={
                              isLocal
                                ? localNetworkQuality
                                : remoteNetworkQualityByUserId[participant.userId] ?? "unknown"
                            }
                            videoRef={isLocal ? localVideoRef : undefined}
                            bindVideoElement={isLocal ? undefined : bindRemoteParticipantVideoElement}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : spotlightMode && pinnedParticipant ? (
              <>
                <div className="min-h-0 flex-1">
                  <ParticipantVideoTile
                    participant={pinnedParticipant}
                    local={pinnedParticipant.userId === session.currentUserId}
                    stage
                    videoReady={
                      pinnedParticipant.userId === session.currentUserId
                        ? localVideoReady && videoEnabled
                        : pinnedParticipant.userId === stageParticipantId
                          ? remoteVideoReady
                          : Boolean(remoteVideoReadyByUserId[pinnedParticipant.userId])
                    }
                    speaking={
                      pinnedParticipant.userId === session.currentUserId
                        ? localSpeaking
                        : Boolean(remoteSpeakingByUserId[pinnedParticipant.userId])
                    }
                      muted={
                        pinnedParticipant.userId === session.currentUserId
                          ? muted
                          : !pinnedParticipant.audioEnabled
                      }
                      pinned
                      recording={Boolean(pinnedParticipant.recording)}
                      networkQuality={
                      pinnedParticipant.userId === session.currentUserId
                        ? localNetworkQuality
                        : remoteNetworkQualityByUserId[pinnedParticipant.userId] ?? "unknown"
                    }
                    videoRef={
                      pinnedParticipant.userId === session.currentUserId
                        ? localVideoRef
                        : pinnedParticipant.userId === stageParticipantId
                          ? remoteVideoRef
                          : undefined
                    }
                    bindVideoElement={
                      pinnedParticipant.userId === session.currentUserId ||
                      pinnedParticipant.userId === stageParticipantId
                        ? undefined
                        : bindRemoteParticipantVideoElement
                    }
                    footerLabel="Pinned view"
                  />
                </div>

                {spotlightThumbnails.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Pinned participant</p>
                      <p className="text-xs text-white/55">Tap any thumbnail to move them into the spotlight.</p>
                    </div>
                    <div className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1">
                      {spotlightThumbnails.map((participant) => {
                        const isLocal = participant.userId === session.currentUserId;
                        return (
                          <ParticipantVideoTile
                            key={participant.userId}
                            participant={participant}
                            local={isLocal}
                            videoReady={
                              isLocal
                                ? localVideoReady && videoEnabled
                                : Boolean(remoteVideoReadyByUserId[participant.userId])
                            }
                            speaking={
                              isLocal
                                ? localSpeaking
                                : Boolean(remoteSpeakingByUserId[participant.userId])
                            }
                            muted={isLocal ? muted : !participant.audioEnabled}
                            pinned={participant.userId === pinnedParticipant.userId}
                            recording={Boolean(participant.recording)}
                            networkQuality={
                              isLocal
                                ? localNetworkQuality
                                : remoteNetworkQualityByUserId[participant.userId] ?? "unknown"
                            }
                            videoRef={isLocal ? localVideoRef : undefined}
                            bindVideoElement={isLocal ? undefined : bindRemoteParticipantVideoElement}
                            onPin={() => onPinParticipant(participant.userId)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : session.isGroup ? (
              <div className={`grid min-h-0 flex-1 gap-4 ${groupGridClass}`}>
                {groupGridTiles.map((participant) => {
                  const isLocal = participant.userId === session.currentUserId;
                  return (
                    <ParticipantVideoTile
                      key={participant.userId}
                      participant={participant}
                      local={isLocal}
                      videoReady={isLocal ? localVideoReady && videoEnabled : Boolean(remoteVideoReadyByUserId[participant.userId])}
                      speaking={isLocal ? localSpeaking : Boolean(remoteSpeakingByUserId[participant.userId])}
                      muted={isLocal ? muted : !participant.audioEnabled}
                      presenting={Boolean(participant.screenSharing)}
                      recording={Boolean(participant.recording)}
                      networkQuality={
                        isLocal
                          ? localNetworkQuality
                          : remoteNetworkQualityByUserId[participant.userId] ?? "unknown"
                      }
                      videoRef={isLocal ? localVideoRef : undefined}
                      bindVideoElement={isLocal ? undefined : bindRemoteParticipantVideoElement}
                      onPin={() => onPinParticipant(participant.userId)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[36px] border border-white/12 bg-black/25 shadow-[0_35px_90px_-45px_rgba(0,0,0,0.95)]">
                {remoteVideoReady ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="relative flex h-[22rem] w-[22rem] items-center justify-center rounded-full bg-white/5">
                      <div className="absolute inset-0 animate-pulse rounded-full border border-white/10" />
                      <div className="absolute inset-8 rounded-full border border-cyan-300/20" />
                      <UserAvatar
                        name={remoteParticipant?.name ?? session.otherUser.name}
                        avatarGradient={remoteParticipant?.avatarGradient ?? session.otherUser.avatarGradient}
                        avatarUrl={remoteParticipant?.avatarUrl ?? session.otherUser.avatarUrl}
                        className="h-36 w-36 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.9)]"
                        textClassName="text-4xl font-semibold text-white"
                        sizes="144px"
                      />
                    </div>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {Boolean(remoteParticipant && remoteSpeakingByUserId[remoteParticipant.userId]) ? <ParticipantBadge tone="speaking">Speaking</ParticipantBadge> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {remoteParticipant ? (
                      <NetworkQualityBadge
                        quality={
                          remoteNetworkQualityByUserId[remoteParticipant.userId] ?? "unknown"
                        }
                      />
                    ) : null}
                    {!remoteParticipant?.audioEnabled ? (
                      <ParticipantBadge tone="muted">
                        <MicGlyph muted />
                        <span>Muted</span>
                      </ParticipantBadge>
                    ) : null}
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-4 right-4 h-40 w-28 overflow-hidden rounded-[28px] border border-white/15 bg-black/30 shadow-[0_25px_70px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:h-52 sm:w-36">
                  {localVideoReady && videoEnabled ? (
                    <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5 text-xs font-semibold text-white/60">Camera off</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-[11px] font-semibold text-white">
                    <span>You</span>
                    {localSpeaking ? <span className="text-cyan-200">Speaking</span> : null}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="relative flex h-[22rem] w-[22rem] items-center justify-center rounded-full bg-white/5">
                <div className="absolute inset-0 animate-pulse rounded-full border border-white/10" />
                <div className="absolute inset-8 rounded-full border border-cyan-300/20" />
                <UserAvatar
                  name={remoteParticipant?.name ?? session.otherUser.name}
                  avatarGradient={remoteParticipant?.avatarGradient ?? session.otherUser.avatarGradient}
                  avatarUrl={remoteParticipant?.avatarUrl ?? session.otherUser.avatarUrl}
                  className="h-36 w-36 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.9)]"
                  textClassName="text-4xl font-semibold text-white"
                  sizes="144px"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-center gap-3">
          {showVideoStage ? (
            <div className="mb-2 flex w-full flex-wrap justify-center gap-2">
              {[
                { id: "auto", label: "Auto" },
                { id: "hd", label: "HD" },
                { id: "data_saver", label: "Data Saver" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onCallQualityChange(option.id as CallQuality)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl transition ${callQuality === option.id ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          {showIncomingActions ? (
            <>
              <CallControl label="Decline" onClick={onDecline} variant="danger" disabled={busy}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15.5c3.4-3 12.6-3 16 0" />
                  <path d="M8 13.5 6.5 18" />
                  <path d="m16 13.5 1.5 4.5" />
                </svg>
              </CallControl>
              <CallControl label="Accept" onClick={onAnswer} variant="accept" disabled={busy}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15.5c3.4-3 12.6-3 16 0" />
                  <path d="M8 13.5 6.5 18" />
                  <path d="m16 13.5 1.5 4.5" />
                </svg>
              </CallControl>
            </>
          ) : (
            <>
              <CallControl label={muted ? "Unmute" : "Mute"} onClick={onToggleMute} variant={muted ? "active" : "default"} disabled={busy}>
                <MicGlyph muted={muted} />
              </CallControl>

              {showVideoStage ? (
                <CallControl label={videoEnabled ? "Video on" : "Video off"} onClick={onToggleVideo} variant={videoEnabled ? "default" : "active"} disabled={busy}>
                  <CameraGlyph disabled={!videoEnabled} />
                </CallControl>
              ) : null}

              {showVideoStage ? (
                <CallControl label={screenSharing ? "Stop share" : "Share screen"} onClick={onToggleScreenShare} variant={screenSharing ? "active" : "default"} disabled={busy}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="12" rx="2.5" />
                    <path d="M8 20h8" />
                    <path d="M12 16v4" />
                    <path d="m9 8 3-3 3 3" />
                    <path d="M12 5v7" />
                  </svg>
                </CallControl>
              ) : null}

              <CallControl
                label={callRecordingActive ? "Stop recording" : "Record"}
                onClick={onToggleRecording}
                variant={callRecordingActive ? "active" : "default"}
                disabled={busy}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </CallControl>

              <CallControl label="End" onClick={onEnd} variant="danger" disabled={busy}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15.5c3.4-3 12.6-3 16 0" />
                  <path d="M8 13.5 6.5 18" />
                  <path d="m16 13.5 1.5 4.5" />
                </svg>
              </CallControl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
