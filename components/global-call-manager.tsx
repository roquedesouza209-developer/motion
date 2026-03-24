"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatCallOverlay from "@/components/home/chat-call-overlay";
import {
  MOTION_CALL_STATE_EVENT,
  MOTION_CALL_SYNC_REQUEST_EVENT,
  MOTION_START_CALL_EVENT,
  type MotionCallStateDetail,
  type MotionStartCallDetail,
} from "@/lib/call-events";
import type { CallMode, CallSessionDto, CallSignalDto } from "@/lib/server/types";

type CallSession = CallSessionDto;
type CallSignal = CallSignalDto;
type CallQuality = "auto" | "hd" | "data_saver";
type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unknown";
type CallToast = {
  id: string;
  text: string;
  tone: "join" | "leave";
};

function areBooleanRecordsEqual(
  left: Record<string, boolean>,
  right: Record<string, boolean>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function areStringRecordsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function rankNetworkQuality(quality: NetworkQuality) {
  switch (quality) {
    case "excellent":
      return 4;
    case "good":
      return 3;
    case "fair":
      return 2;
    case "poor":
      return 1;
    default:
      return 0;
  }
}

function pickWorstNetworkQuality(qualities: NetworkQuality[]) {
  if (qualities.length === 0) {
    return "unknown" as NetworkQuality;
  }

  return qualities.slice(1).reduce<NetworkQuality>(
    (worst, current) =>
      rankNetworkQuality(current) < rankNetworkQuality(worst) ? current : worst,
    qualities[0],
  );
}

async function measurePeerNetworkQuality(
  peer: RTCPeerConnection,
): Promise<NetworkQuality> {
  if (
    peer.connectionState === "failed" ||
    peer.connectionState === "disconnected" ||
    peer.connectionState === "closed"
  ) {
    return "poor";
  }

  if (peer.connectionState === "new") {
    return "unknown";
  }

  if (peer.connectionState === "connecting") {
    return "fair";
  }

  let roundTripTime: number | null = null;
  let jitter: number | null = null;
  let packetsLost: number | null = null;

  try {
    const stats = await peer.getStats();

    stats.forEach((stat) => {
      if (stat.type === "candidate-pair") {
        const report = stat as RTCIceCandidatePairStats;
        if (
          report.state === "succeeded" &&
          typeof report.currentRoundTripTime === "number"
        ) {
          roundTripTime = report.currentRoundTripTime;
        }
      }

      if (stat.type === "remote-inbound-rtp" || stat.type === "inbound-rtp") {
        const report = stat as
          | (RTCInboundRtpStreamStats & {
              kind?: string;
              jitter?: number;
              packetsLost?: number;
            })
          | {
              kind?: string;
              jitter?: number;
              packetsLost?: number;
            };

        if (report.kind !== "video") {
          return;
        }

        if (typeof report.jitter === "number") {
          jitter = report.jitter;
        }

        if (typeof report.packetsLost === "number") {
          packetsLost = report.packetsLost;
        }
      }
    });
  } catch {
    return peer.connectionState === "connected" ? "good" : "fair";
  }

  if (
    (roundTripTime !== null && roundTripTime > 0.45) ||
    (jitter !== null && jitter > 0.12) ||
    (packetsLost !== null && packetsLost > 20)
  ) {
    return "poor";
  }

  if (
    (roundTripTime !== null && roundTripTime > 0.24) ||
    (jitter !== null && jitter > 0.06) ||
    (packetsLost !== null && packetsLost > 8)
  ) {
    return "fair";
  }

  if (
    (roundTripTime !== null && roundTripTime > 0.12) ||
    (jitter !== null && jitter > 0.03) ||
    (packetsLost !== null && packetsLost > 2)
  ) {
    return "good";
  }

  return "excellent";
}

function isRtcSessionDescriptionInit(value: unknown): value is RTCSessionDescriptionInit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as { type?: unknown; sdp?: unknown };
  return (
    (candidate.type === "offer" ||
      candidate.type === "answer" ||
      candidate.type === "pranswer" ||
      candidate.type === "rollback") &&
    (typeof candidate.sdp === "string" || typeof candidate.sdp === "undefined")
  );
}

function isRtcIceCandidateInit(value: unknown): value is RTCIceCandidateInit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as { candidate?: unknown };
  return typeof candidate.candidate === "string";
}

function formatLiveCallDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getVideoConstraints(quality: CallQuality): MediaTrackConstraints {
  if (quality === "data_saver") {
    return {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 15, max: 15 },
      facingMode: "user",
    };
  }

  if (quality === "auto") {
    return {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: "user",
    };
  }

  return {
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: "user",
  };
}

function getMediaElementCaptureStream(element: HTMLMediaElement | null): MediaStream | null {
  if (!element) {
    return null;
  }

  const candidate = element as HTMLMediaElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };

  return candidate.captureStream?.() ?? candidate.mozCaptureStream?.() ?? null;
}

function getPreferredRecordingMimeType(hasVideo: boolean) {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = hasVideo
    ? [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ]
    : ["audio/webm;codecs=opus", "audio/webm"];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
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

export default function GlobalCallManager() {
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [callStartingMode, setCallStartingMode] = useState<CallMode | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [callMuted, setCallMuted] = useState(false);
  const [callVideoEnabled, setCallVideoEnabled] = useState(false);
  const [localCallVideoReady, setLocalCallVideoReady] = useState(false);
  const [remoteCallVideoReady, setRemoteCallVideoReady] = useState(false);
  const [callConnectionState, setCallConnectionState] = useState("new");
  const [callDurationTick, setCallDurationTick] = useState(() => Date.now());
  const [screenSharing, setScreenSharing] = useState(false);
  const [callQuality, setCallQuality] = useState<CallQuality>("hd");
  const [remoteStreamsVersion, setRemoteStreamsVersion] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeakingByUserId, setRemoteSpeakingByUserId] = useState<Record<string, boolean>>(
    {},
  );
  const [callRecordingActive, setCallRecordingActive] = useState(false);
  const [callRecordingBusy, setCallRecordingBusy] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [callToasts, setCallToasts] = useState<CallToast[]>([]);
  const [remoteNetworkQualityByUserId, setRemoteNetworkQualityByUserId] = useState<
    Record<string, NetworkQuality>
  >({});
  const [localNetworkQuality, setLocalNetworkQuality] = useState<NetworkQuality>("unknown");

  const callPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localCallStreamRef = useRef<MediaStream | null>(null);
  const remoteCallStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteParticipantVideoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const currentCallIdRef = useRef<string | null>(null);
  const previousCallIdRef = useRef<string | null>(null);
  const currentCallRef = useRef<CallSession | null>(null);
  const processedCallSignalIdsRef = useRef<string[]>([]);
  const pendingRemoteIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const peerStatesRef = useRef<Map<string, string>>(new Map());
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCleanupRef = useRef<(() => void) | null>(null);
  const publishedCallStateRef = useRef<{
    id: string | null;
    status: CallSession["status"] | null;
    conversationId: string | null;
  }>({
    id: null,
    status: null,
    conversationId: null,
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneTimerRef = useRef<number | null>(null);
  const ringbackTimerRef = useRef<number | null>(null);
  const callToastTimersRef = useRef<Map<string, number>>(new Map());
  const previousParticipantStateRef = useRef<
    Map<string, { joined: boolean; name: string }>
  >(new Map());
  const previousParticipantCallIdRef = useRef<string | null>(null);

  const attachVideoElementStream = useCallback(
    (
      element: HTMLVideoElement | null,
      stream: MediaStream | null,
      { muted = false }: { muted?: boolean } = {},
    ) => {
      if (!element) {
        return;
      }

      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }

      element.muted = muted;

      if (stream) {
        void element.play().catch(() => undefined);
      }
    },
    [],
  );

  const attachLocalCallPreview = useCallback(
    (stream: MediaStream | null) => {
      attachVideoElementStream(localCallVideoRef.current, stream, { muted: true });
    },
    [attachVideoElementStream],
  );

  const attachRemoteCallPreview = useCallback(
    (stream: MediaStream | null) => {
      attachVideoElementStream(remoteCallVideoRef.current, stream);
    },
    [attachVideoElementStream],
  );

  const syncBoundRemoteParticipantVideo = useCallback(
    (userId: string) => {
      attachVideoElementStream(
        remoteParticipantVideoElementsRef.current.get(userId) ?? null,
        remoteCallStreamsRef.current.get(userId) ?? null,
      );
    },
    [attachVideoElementStream],
  );

  const bindRemoteParticipantVideoElement = useCallback(
    (userId: string, element: HTMLVideoElement | null) => {
      if (!element) {
        const currentElement = remoteParticipantVideoElementsRef.current.get(userId);

        if (currentElement) {
          currentElement.srcObject = null;
        }

        remoteParticipantVideoElementsRef.current.delete(userId);
        return;
      }

      remoteParticipantVideoElementsRef.current.set(userId, element);
      syncBoundRemoteParticipantVideo(userId);
    },
    [syncBoundRemoteParticipantVideo],
  );

  const getMyUserId = useCallback((session: CallSession | null) => session?.currentUserId ?? null, []);

  const clearCallToasts = useCallback(() => {
    callToastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    callToastTimersRef.current.clear();
    setCallToasts([]);
  }, []);

  const enqueueCallToast = useCallback(
    (text: string, tone: CallToast["tone"]) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setCallToasts((current) => [...current.slice(-2), { id, text, tone }]);

      const timer = window.setTimeout(() => {
        setCallToasts((current) => current.filter((toast) => toast.id !== id));
        callToastTimersRef.current.delete(id);
      }, 3200);

      callToastTimersRef.current.set(id, timer);
    },
    [],
  );

  const getRemoteParticipants = useCallback(
    (session: CallSession | null) =>
      session
        ? session.participants.filter((participant) => participant.userId !== session.currentUserId)
        : [],
    [],
  );

  const getStageParticipantId = useCallback(
    (session: CallSession | null) => {
      const remoteParticipants = getRemoteParticipants(session);
      const remoteIds = new Set(remoteParticipants.map((participant) => participant.userId));

      if (pinnedParticipantId && remoteIds.has(pinnedParticipantId)) {
        return pinnedParticipantId;
      }

      return (
        remoteParticipants.find((participant) => participant.screenSharing)?.userId ??
        remoteParticipants.find((participant) => participant.joined)?.userId ??
        remoteParticipants[0]?.userId ??
        null
      );
    },
    [getRemoteParticipants, pinnedParticipantId],
  );

  const downloadRecordingBlob = useCallback((blob: Blob, mimeType: string) => {
    const extension = mimeType.startsWith("audio/") ? "webm" : "webm";
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `motion-call-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }, []);

  const ensureAudioContextForRecording = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return audioContextRef.current;
      }
    }

    return audioContextRef.current;
  }, []);
  const buildCallRecordingStream = useCallback(async () => {
    const cleanupFns: Array<() => void> = [];
    const recordingStream = new MediaStream();
    let hasVideoTrack = false;

    if (currentCallRef.current?.mode === "video") {
      const useLocalStage =
        Boolean(screenShareStreamRef.current) ||
        pinnedParticipantId === currentCallRef.current.currentUserId;
      const stageElement = useLocalStage ? localCallVideoRef.current : remoteCallVideoRef.current;
      const stageStream = getMediaElementCaptureStream(stageElement);
      const stageTrack =
        stageStream?.getVideoTracks()[0]?.clone() ??
        (useLocalStage
          ? (screenShareStreamRef.current?.getVideoTracks()[0] ??
            localCallStreamRef.current?.getVideoTracks()[0])
          : undefined)?.clone();

      if (stageTrack) {
        recordingStream.addTrack(stageTrack);
        hasVideoTrack = true;
      }
    }

    const audioSources: MediaStream[] = [];

    if (localCallStreamRef.current?.getAudioTracks().some((track) => track.enabled)) {
      audioSources.push(localCallStreamRef.current);
    }

    remoteCallStreamsRef.current.forEach((stream) => {
      if (stream.getAudioTracks().length > 0) {
        audioSources.push(stream);
      }
    });

    if (audioSources.length > 0) {
      const audioContext = await ensureAudioContextForRecording();

      if (audioContext) {
        const destination = audioContext.createMediaStreamDestination();
        cleanupFns.push(() => {
          try {
            destination.disconnect();
          } catch {
            // Ignore destination cleanup issues.
          }
        });

        audioSources.forEach((stream) => {
          try {
            const source = audioContext.createMediaStreamSource(stream);
            const gain = audioContext.createGain();
            gain.gain.value = 1;
            source.connect(gain);
            gain.connect(destination);
            cleanupFns.push(() => {
              try {
                source.disconnect();
              } catch {
                // Ignore source cleanup issues.
              }

              try {
                gain.disconnect();
              } catch {
                // Ignore gain cleanup issues.
              }
            });
          } catch {
            // Ignore unsupported audio sources.
          }
        });

        destination.stream.getAudioTracks().forEach((track) => {
          recordingStream.addTrack(track);
        });
      } else {
        audioSources[0]?.getAudioTracks().forEach((track) => {
          recordingStream.addTrack(track.clone());
        });
      }
    }

    if (recordingStream.getTracks().length === 0) {
      throw new Error("Nothing is available to record yet.");
    }

    return {
      stream: recordingStream,
      hasVideoTrack,
      cleanup: () => {
        cleanupFns.forEach((cleanup) => cleanup());
        recordingStream.getTracks().forEach((track) => track.stop());
      },
    };
  }, [ensureAudioContextForRecording, pinnedParticipantId]);

  const syncRemotePreview = useCallback(
    (session: CallSession | null) => {
      const stageParticipantId = getStageParticipantId(session);
      const stageStream = stageParticipantId
        ? remoteCallStreamsRef.current.get(stageParticipantId) ?? null
        : null;

      attachRemoteCallPreview(stageStream);
      setRemoteCallVideoReady((stageStream?.getVideoTracks().length ?? 0) > 0);
    },
    [attachRemoteCallPreview, getStageParticipantId],
  );

  const stopToneLoops = useCallback(() => {
    if (ringtoneTimerRef.current !== null) {
      window.clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }

    if (ringbackTimerRef.current !== null) {
      window.clearInterval(ringbackTimerRef.current);
      ringbackTimerRef.current = null;
    }
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return audioContextRef.current;
      }
    }

    return audioContextRef.current;
  }, []);

  const playToneBurst = useCallback(
    async (frequencies: number[], durationMs: number, gapMs: number, gainValue: number) => {
      const audioContext = await ensureAudioContextForRecording();

      if (!audioContext) {
        return;
      }

      const now = audioContext.currentTime + 0.02;
      const durationSeconds = durationMs / 1000;
      const gapSeconds = gapMs / 1000;

      frequencies.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const startAt = now + index * (durationSeconds + gapSeconds);
        const stopAt = startAt + durationSeconds;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(startAt);
        oscillator.stop(stopAt + 0.04);
      });
    },
    [ensureAudioContextForRecording],
  );

  const startIncomingRingtone = useCallback(() => {
    if (ringtoneTimerRef.current !== null) {
      return;
    }

    stopToneLoops();
    void playToneBurst([784, 659, 784], 180, 90, 0.035);
    ringtoneTimerRef.current = window.setInterval(() => {
      void playToneBurst([784, 659, 784], 180, 90, 0.035);
    }, 2400);
  }, [playToneBurst, stopToneLoops]);

  const startOutgoingRingback = useCallback(() => {
    if (ringbackTimerRef.current !== null) {
      return;
    }

    stopToneLoops();
    void playToneBurst([440, 554], 260, 180, 0.03);
    ringbackTimerRef.current = window.setInterval(() => {
      void playToneBurst([440, 554], 260, 180, 0.03);
    }, 2800);
  }, [playToneBurst, stopToneLoops]);

  const teardownCallConnection = useCallback(() => {
    stopToneLoops();
    clearCallToasts();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    callPeersRef.current.forEach((peer) => {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    });
    callPeersRef.current.clear();
    peerStatesRef.current.clear();

    if (localCallStreamRef.current) {
      localCallStreamRef.current.getTracks().forEach((track) => track.stop());
      localCallStreamRef.current = null;
    }

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;
    }

    remoteCallStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    remoteCallStreamsRef.current.clear();
    remoteParticipantVideoElementsRef.current.forEach((element) => {
      element.srcObject = null;
    });
    remoteParticipantVideoElementsRef.current.clear();

    currentCallIdRef.current = null;
    processedCallSignalIdsRef.current = [];
    pendingRemoteIceRef.current = new Map();
    attachLocalCallPreview(null);
    attachRemoteCallPreview(null);
    setLocalCallVideoReady(false);
    setRemoteCallVideoReady(false);
    setCallMuted(false);
    setCallVideoEnabled(false);
    setScreenSharing(false);
    setCallRecordingActive(false);
    setCallRecordingBusy(false);
    setLocalSpeaking(false);
    setRemoteSpeakingByUserId({});
    setPinnedParticipantId(null);
    setRemoteNetworkQualityByUserId({});
    setLocalNetworkQuality("unknown");
    setRemoteStreamsVersion((current) => current + 1);
    setCallConnectionState("new");
    previousParticipantStateRef.current = new Map();
    previousParticipantCallIdRef.current = null;
  }, [attachLocalCallPreview, attachRemoteCallPreview, clearCallToasts, stopToneLoops]);

  const postCallAction = useCallback(
    async (conversationId: string, body: Record<string, unknown>) =>
      req<{ session: CallSession }>(`/api/messages/${conversationId}/call`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    [],
  );

  const fetchCurrentCall = useCallback(async () => {
    try {
      const payload = await req<{ session: CallSession | null }>("/api/calls/current");
      const nextSession = payload.session ?? null;
      const previousCallId = previousCallIdRef.current;

      if (!nextSession && previousCallId) {
        teardownCallConnection();
        setCallBusy(false);
        setCallStartingMode(null);
        setCallError(null);
      }

      if (nextSession && nextSession.id !== previousCallId) {
        processedCallSignalIdsRef.current = [];
        pendingRemoteIceRef.current = new Map();
        setCallError(null);
      }

      previousCallIdRef.current = nextSession?.id ?? null;
      setCurrentCall(nextSession);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Could not refresh call state.";

      if (message === "Unauthorized") {
        previousCallIdRef.current = null;
        setCurrentCall(null);
        setCallBusy(false);
        setCallStartingMode(null);
        setCallError(null);
        teardownCallConnection();
      }
    }
  }, [teardownCallConnection]);

  const ensureLocalCallStream = useCallback(
    async (mode: CallMode) => {
      const existing = localCallStreamRef.current;

      if (existing) {
        const hasVideo = existing.getVideoTracks().length > 0;

        if (mode === "voice" || hasVideo) {
          setLocalCallVideoReady(hasVideo);
          setCallVideoEnabled(hasVideo);
          setCallMuted(existing.getAudioTracks().every((track) => !track.enabled));
          attachLocalCallPreview(existing);
          return existing;
        }

        existing.getTracks().forEach((track) => track.stop());
        localCallStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          mode === "video"
            ? getVideoConstraints(callQuality)
            : false,
      });

      stream.getAudioTracks().forEach((track) => {
        track.contentHint = "speech";
      });

      stream.getVideoTracks().forEach((track) => {
        track.contentHint = mode === "video" ? "motion" : "";
      });

      localCallStreamRef.current = stream;
      attachLocalCallPreview(stream);
      const hasVideo = stream.getVideoTracks().length > 0;
      setLocalCallVideoReady(hasVideo);
      setCallVideoEnabled(hasVideo);
      setCallMuted(false);
      return stream;
    },
    [attachLocalCallPreview, callQuality],
  );

  const updateOverallConnectionState = useCallback(() => {
    const states = [...peerStatesRef.current.values()];

    if (states.some((state) => state === "failed")) {
      setCallConnectionState("failed");
      return;
    }

    if (states.some((state) => state === "connected")) {
      setCallConnectionState("connected");
      return;
    }

    if (states.some((state) => state === "connecting")) {
      setCallConnectionState("connecting");
      return;
    }

    if (states.some((state) => state === "new")) {
      setCallConnectionState("new");
      return;
    }

    setCallConnectionState(states[0] ?? "new");
  }, []);

  const replaceOutgoingVideoTrack = useCallback(async (nextTrack: MediaStreamTrack | null) => {
    const peers = [...callPeersRef.current.values()];

    await Promise.all(
      peers.map(async (peer) => {
        const sender = peer.getSenders().find((candidate) => candidate.track?.kind === "video");

        if (!sender) {
          return;
        }

        await sender.replaceTrack(nextTrack);
      }),
    );
  }, []);

  const flushPendingRemoteIce = useCallback(async (remoteUserId: string) => {
    const peer = callPeersRef.current.get(remoteUserId);
    const pending = pendingRemoteIceRef.current.get(remoteUserId) ?? [];

    if (!peer?.remoteDescription || pending.length === 0) {
      return;
    }

    pendingRemoteIceRef.current.delete(remoteUserId);

    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore invalid remote ICE candidates.
      }
    }
  }, []);

  const ensureCallPeerConnection = useCallback(
    async (session: CallSession, remoteUserId: string) => {
      if (currentCallIdRef.current && currentCallIdRef.current !== session.id) {
        teardownCallConnection();
      }

      currentCallIdRef.current = session.id;

      const existing = callPeersRef.current.get(remoteUserId);

      if (existing) {
        return existing;
      }

      const stream = await ensureLocalCallStream(session.mode);
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      callPeersRef.current.set(remoteUserId, peer);
      peerStatesRef.current.set(remoteUserId, peer.connectionState);
      updateOverallConnectionState();

      peer.ontrack = (event) => {
        const incomingStream =
          event.streams[0] ??
          remoteCallStreamsRef.current.get(remoteUserId) ??
          new MediaStream();

        if (!event.streams[0]) {
          incomingStream.addTrack(event.track);
        }

        remoteCallStreamsRef.current.set(remoteUserId, incomingStream);
        syncBoundRemoteParticipantVideo(remoteUserId);
        setRemoteStreamsVersion((current) => current + 1);
        syncRemotePreview(currentCallRef.current);
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        void postCallAction(session.conversationId, {
          action: "signal",
          callId: session.id,
          signalType: "ice",
          payload: event.candidate.toJSON(),
          toUserId: remoteUserId,
        })
          .then((payload) => setCurrentCall(payload.session))
          .catch(() => undefined);
      };

      peer.onconnectionstatechange = () => {
        peerStatesRef.current.set(remoteUserId, peer.connectionState);
        updateOverallConnectionState();

        if (peer.connectionState === "failed") {
          setCallError("Call connection failed. Try again.");
        }
      };

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      return peer;
    },
    [
      ensureLocalCallStream,
      postCallAction,
      syncBoundRemoteParticipantVideo,
      syncRemotePreview,
      teardownCallConnection,
      updateOverallConnectionState,
    ],
  );

  const processCallSignal = useCallback(
    async (session: CallSession, signal: CallSignal) => {
      const myUserId = getMyUserId(session);

      if (!myUserId || signal.toUserId !== myUserId) {
        return;
      }

      if (processedCallSignalIdsRef.current.includes(signal.id)) {
        return;
      }

      const remoteUserId = signal.fromUserId;

      try {
        if (signal.type === "offer") {
          if (!isRtcSessionDescriptionInit(signal.payload)) {
            processedCallSignalIdsRef.current = [
              ...processedCallSignalIdsRef.current,
              signal.id,
            ];
            return;
          }

          const peer = await ensureCallPeerConnection(session, remoteUserId);
          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
          await flushPendingRemoteIce(remoteUserId);

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          const payload = await postCallAction(session.conversationId, {
            action: "signal",
            callId: session.id,
            signalType: "answer",
            payload: peer.localDescription
              ? {
                  type: peer.localDescription.type,
                  sdp: peer.localDescription.sdp ?? undefined,
                }
              : answer,
            toUserId: remoteUserId,
          });

          setCurrentCall(payload.session);
        } else if (signal.type === "answer") {
          if (!isRtcSessionDescriptionInit(signal.payload)) {
            return;
          }

          const peer = callPeersRef.current.get(remoteUserId);

          if (!peer || currentCallIdRef.current !== session.id) {
            return;
          }

          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload));
          await flushPendingRemoteIce(remoteUserId);
        } else if (signal.type === "ice") {
          if (!isRtcIceCandidateInit(signal.payload)) {
            return;
          }

          const peer = callPeersRef.current.get(remoteUserId);

          if (!peer || currentCallIdRef.current !== session.id) {
            return;
          }

          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(signal.payload));
          } else {
            const pending = pendingRemoteIceRef.current.get(remoteUserId) ?? [];
            pendingRemoteIceRef.current.set(remoteUserId, [...pending, signal.payload]);
          }
        }

        processedCallSignalIdsRef.current = [...processedCallSignalIdsRef.current, signal.id];
      } catch (processingError) {
        setCallError(
          processingError instanceof Error
            ? processingError.message
            : "Could not process call signal.",
        );
      }
    },
    [ensureCallPeerConnection, flushPendingRemoteIce, getMyUserId, postCallAction],
  );

  const sendOffersToRemoteParticipants = useCallback(
    async (session: CallSession, remoteUserIds: string[]) => {
      for (const remoteUserId of remoteUserIds) {
        const peer = await ensureCallPeerConnection(session, remoteUserId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        const payload = await postCallAction(session.conversationId, {
          action: "signal",
          callId: session.id,
          signalType: "offer",
          payload: peer.localDescription
            ? {
                type: peer.localDescription.type,
                sdp: peer.localDescription.sdp ?? undefined,
              }
            : offer,
          toUserId: remoteUserId,
        });

        setCurrentCall(payload.session);
      }
    },
    [ensureCallPeerConnection, postCallAction],
  );

  const startCall = useCallback(
    async (conversationId: string, mode: CallMode, participantIds: string[] = []) => {
      if (!conversationId || currentCall) {
        return;
      }

      setCallStartingMode(mode);
      setCallBusy(true);
      setCallError(null);

      try {
        const payload = await postCallAction(conversationId, {
          action: "start",
          mode,
          participantIds,
        });

        setCurrentCall(payload.session);
        const remoteUserIds = payload.session.participants
          .filter((participant) => participant.userId !== payload.session.currentUserId)
          .map((participant) => participant.userId);

        await sendOffersToRemoteParticipants(payload.session, remoteUserIds);
        previousCallIdRef.current = payload.session.id;
      } catch (callStartError) {
        teardownCallConnection();
        setCallError(
          callStartError instanceof Error
            ? callStartError.message
            : "Could not start the call.",
        );
      } finally {
        setCallStartingMode(null);
        setCallBusy(false);
      }
    },
    [currentCall, postCallAction, sendOffersToRemoteParticipants, teardownCallConnection],
  );

  const answerCurrentCall = useCallback(async () => {
    if (!currentCall) {
      return;
    }

    setCallBusy(true);
    setCallError(null);

    try {
      const myUserId = getMyUserId(currentCall);
      const payload = await postCallAction(currentCall.conversationId, {
        action: "accept",
        callId: currentCall.id,
      });

      setCurrentCall(payload.session);
      previousCallIdRef.current = payload.session.id;

      for (const signal of payload.session.signals.filter(
        (candidate) => candidate.toUserId === myUserId,
      )) {
        await processCallSignal(payload.session, signal);
      }
    } catch (answerError) {
      setCallError(
        answerError instanceof Error ? answerError.message : "Could not answer the call.",
      );
    } finally {
      setCallBusy(false);
    }
  }, [currentCall, getMyUserId, postCallAction, processCallSignal]);

  const declineCurrentCall = useCallback(async () => {
    if (!currentCall) {
      return;
    }

    setCallBusy(true);
    setCallError(null);

    try {
      await postCallAction(currentCall.conversationId, {
        action: "decline",
        callId: currentCall.id,
      });
      setCurrentCall(null);
      previousCallIdRef.current = null;
      teardownCallConnection();
    } catch (declineError) {
      setCallError(
        declineError instanceof Error
          ? declineError.message
          : "Could not decline the call.",
      );
    } finally {
      setCallBusy(false);
    }
  }, [currentCall, postCallAction, teardownCallConnection]);

  const endCurrentCall = useCallback(async () => {
    if (!currentCall) {
      return;
    }

    setCallBusy(true);
    setCallError(null);

    try {
      await postCallAction(currentCall.conversationId, {
        action: "end",
        callId: currentCall.id,
      });
      setCurrentCall(null);
      previousCallIdRef.current = null;
      teardownCallConnection();
    } catch (endError) {
      setCallError(
        endError instanceof Error ? endError.message : "Could not end the call.",
      );
    } finally {
      setCallBusy(false);
    }
  }, [currentCall, postCallAction, teardownCallConnection]);

  const toggleCallMute = useCallback(async () => {
    if (!currentCall || !localCallStreamRef.current) {
      return;
    }

    const nextMuted = !callMuted;
    localCallStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setCallMuted(nextMuted);

    try {
      const payload = await postCallAction(currentCall.conversationId, {
        action: "media",
        callId: currentCall.id,
        audioEnabled: !nextMuted,
      });
      setCurrentCall(payload.session);
    } catch {
      // Ignore transient media sync errors.
    }
  }, [callMuted, currentCall, postCallAction]);

  const stopScreenShare = useCallback(
    async ({ syncRemote = true }: { syncRemote?: boolean } = {}) => {
      if (!screenShareStreamRef.current) {
        return;
      }

      screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;

      const cameraTrack = localCallStreamRef.current?.getVideoTracks()[0] ?? null;
      await replaceOutgoingVideoTrack(cameraTrack);
      attachLocalCallPreview(localCallStreamRef.current);
      setScreenSharing(false);
      setLocalCallVideoReady(Boolean(cameraTrack?.enabled));

      if (syncRemote && currentCall) {
        try {
          const payload = await postCallAction(currentCall.conversationId, {
            action: "media",
            callId: currentCall.id,
            screenSharing: false,
          });
          setCurrentCall(payload.session);
        } catch {
          // Ignore transient media sync errors.
        }
      }
    },
    [attachLocalCallPreview, currentCall, postCallAction, replaceOutgoingVideoTrack],
  );

  const startScreenShare = useCallback(async () => {
    if (!currentCall || currentCall.mode !== "video" || !localCallStreamRef.current) {
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];

      if (!screenTrack) {
        displayStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenTrack.contentHint = "detail";
      screenTrack.onended = () => {
        void stopScreenShare();
      };
      screenShareStreamRef.current = displayStream;
      await replaceOutgoingVideoTrack(screenTrack);
      attachLocalCallPreview(displayStream);
      setScreenSharing(true);
      setCallVideoEnabled(true);
      setLocalCallVideoReady(true);

      try {
        const payload = await postCallAction(currentCall.conversationId, {
          action: "media",
          callId: currentCall.id,
          videoEnabled: true,
          screenSharing: true,
        });
        setCurrentCall(payload.session);
      } catch {
        // Ignore transient media sync errors.
      }
    } catch (screenShareError) {
      if (screenShareError instanceof DOMException && screenShareError.name === "NotAllowedError") {
        setCallError("Screen sharing was cancelled.");
        return;
      }

      setCallError(
        screenShareError instanceof Error
          ? screenShareError.message
          : "Could not start screen sharing.",
      );
    }
  }, [attachLocalCallPreview, currentCall, postCallAction, replaceOutgoingVideoTrack, stopScreenShare]);

  const toggleCallVideo = useCallback(async () => {
    if (!currentCall || currentCall.mode !== "video" || !localCallStreamRef.current) {
      return;
    }

    const videoTrack = localCallStreamRef.current.getVideoTracks()[0];

    if (!videoTrack) {
      return;
    }

    const nextVideoEnabled = !callVideoEnabled;

    if (!nextVideoEnabled && screenSharing) {
      await stopScreenShare({ syncRemote: false });
    }

    videoTrack.enabled = nextVideoEnabled;
    setCallVideoEnabled(nextVideoEnabled);
    setLocalCallVideoReady(nextVideoEnabled);

    if (nextVideoEnabled && !screenSharing) {
      attachLocalCallPreview(localCallStreamRef.current);
    }

    try {
      const payload = await postCallAction(currentCall.conversationId, {
        action: "media",
        callId: currentCall.id,
        videoEnabled: nextVideoEnabled,
        screenSharing: nextVideoEnabled ? false : false,
      });
      setCurrentCall(payload.session);
    } catch {
      // Ignore transient media sync errors.
    }
  }, [
    attachLocalCallPreview,
    callVideoEnabled,
    currentCall,
    postCallAction,
    screenSharing,
    stopScreenShare,
  ]);

  const changeCallQuality = useCallback(
    async (nextQuality: CallQuality) => {
      setCallQuality(nextQuality);

      if (screenSharing || !localCallStreamRef.current || currentCall?.mode !== "video") {
        return;
      }

      const videoTrack = localCallStreamRef.current.getVideoTracks()[0];

      if (!videoTrack) {
        return;
      }

      try {
        await videoTrack.applyConstraints(getVideoConstraints(nextQuality));
      } catch {
        // Ignore device constraint failures and keep current media running.
      }
    },
    [currentCall?.mode, screenSharing],
  );

  const stopCallRecording = useCallback(
    async ({ syncRemote = true }: { syncRemote?: boolean } = {}) => {
      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else if (recordingCleanupRef.current) {
        recordingCleanupRef.current();
        recordingCleanupRef.current = null;
      }

      mediaRecorderRef.current = null;
      setCallRecordingActive(false);

      if (syncRemote && currentCall) {
        try {
          const payload = await postCallAction(currentCall.conversationId, {
            action: "media",
            callId: currentCall.id,
            recording: false,
          });
          setCurrentCall(payload.session);
        } catch {
          // Ignore transient recording sync errors.
        }
      }
    },
    [currentCall, postCallAction],
  );

  const startCallRecording = useCallback(async () => {
    if (!currentCall) {
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setCallError("Call recording is not supported in this browser.");
      return;
    }

    setCallRecordingBusy(true);
    setCallError(null);

    try {
      const { stream, hasVideoTrack, cleanup } = await buildCallRecordingStream();
      const mimeType = getPreferredRecordingMimeType(hasVideoTrack);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recordingCleanupRef.current = cleanup;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: mimeType || recorder.mimeType || (hasVideoTrack ? "video/webm" : "audio/webm"),
        });

        recordingChunksRef.current = [];

        if (blob.size > 0) {
          downloadRecordingBlob(
            blob,
            mimeType || recorder.mimeType || (hasVideoTrack ? "video/webm" : "audio/webm"),
          );
        }

        recordingCleanupRef.current?.();
        recordingCleanupRef.current = null;
        mediaRecorderRef.current = null;
      };

      recorder.start(1_000);
      setCallRecordingActive(true);

      try {
        const payload = await postCallAction(currentCall.conversationId, {
          action: "media",
          callId: currentCall.id,
          recording: true,
        });
        setCurrentCall(payload.session);
      } catch {
        // Ignore transient recording sync errors.
      }
    } catch (recordingError) {
      recordingCleanupRef.current?.();
      recordingCleanupRef.current = null;
      mediaRecorderRef.current = null;
      setCallRecordingActive(false);
      setCallError(
        recordingError instanceof Error
          ? recordingError.message
          : "Could not start call recording.",
      );
    } finally {
      setCallRecordingBusy(false);
    }
  }, [buildCallRecordingStream, currentCall, downloadRecordingBlob, postCallAction]);

  const currentCallStatusLabel = useMemo(() => {
    if (!currentCall) {
      return "";
    }

    if (currentCall.status === "ringing") {
      return currentCall.isIncoming ? "Incoming call" : "Calling...";
    }

    if (currentCall.status === "connecting") {
      return "Connecting...";
    }

    if (currentCall.status === "active") {
      const recordingNow = currentCall.participants.some((participant) => participant.recording);
      return callConnectionState === "connected"
        ? `Connected${screenSharing ? " \u2022 Sharing screen" : ""}${
            callQuality === "data_saver"
              ? " \u2022 Data Saver"
              : callQuality === "auto"
                ? " \u2022 Auto"
                : " \u2022 HD"
          }${recordingNow ? " \u2022 Recording" : ""}`
        : "Connecting media...";
    }

    return currentCall.status;
  }, [callConnectionState, callQuality, currentCall, screenSharing]);
  const liveDurationLabel = useMemo(() => {
    if (currentCall?.status !== "active" || !currentCall.answeredAt) {
      return null;
    }

    const startedAt = new Date(currentCall.answeredAt).getTime();

    if (Number.isNaN(startedAt)) {
      return null;
    }

    return formatLiveCallDuration(Math.max(0, callDurationTick - startedAt));
  }, [callDurationTick, currentCall]);
  const canMinimize =
    Boolean(currentCall) &&
    !(currentCall?.isIncoming && currentCall.status === "ringing");

  useEffect(() => {
    if (!currentCall) {
      setCallMinimized(false);
      return;
    }

    if (currentCall.isIncoming && currentCall.status === "ringing") {
      setCallMinimized(false);
    }
  }, [currentCall]);

  useEffect(() => {
    if (currentCall?.status !== "active" || !currentCall.answeredAt) {
      return;
    }

    setCallDurationTick(Date.now());
    const interval = window.setInterval(() => {
      setCallDurationTick(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentCall?.answeredAt, currentCall?.status]);

  useEffect(() => {
    const unlockAudio = () => {
      void ensureAudioContext();
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, [ensureAudioContext]);

  useEffect(() => {
    void fetchCurrentCall();
    const interval = window.setInterval(() => {
      void fetchCurrentCall();
    }, 1800);

    return () => window.clearInterval(interval);
  }, [fetchCurrentCall]);

  useEffect(() => {
    if (!currentCall) {
      currentCallRef.current = null;
      return;
    }

    currentCallRef.current = currentCall;

    if (currentCall.id !== currentCallIdRef.current) {
      processedCallSignalIdsRef.current = [];
      pendingRemoteIceRef.current = new Map();
    }

    const myUserId = getMyUserId(currentCall);
    const me = currentCall.participants.find((participant) => participant.userId === myUserId);

    if (me) {
      setCallMuted(!me.audioEnabled);
      setCallVideoEnabled(currentCall.mode === "video" ? me.videoEnabled : false);
      setScreenSharing(Boolean(me.screenSharing));
      setCallRecordingActive(Boolean(me.recording));
    }

    syncRemotePreview(currentCall);

    currentCall.signals
      .filter((signal) => signal.toUserId === myUserId)
      .forEach((signal) => {
        void processCallSignal(currentCall, signal);
      });
  }, [currentCall, getMyUserId, processCallSignal, syncRemotePreview]);

  useEffect(() => {
    attachLocalCallPreview(screenShareStreamRef.current ?? localCallStreamRef.current);
  }, [attachLocalCallPreview, callMinimized, currentCall?.id, localCallVideoReady, screenSharing]);

  useEffect(() => {
    syncRemotePreview(currentCall);
  }, [callMinimized, currentCall, remoteStreamsVersion, syncRemotePreview]);

  useEffect(() => {
    if (!currentCall || currentCall.status !== "ringing") {
      stopToneLoops();
      return;
    }

    if (currentCall.isIncoming) {
      startIncomingRingtone();
      return;
    }

    startOutgoingRingback();
  }, [currentCall, startIncomingRingtone, startOutgoingRingback, stopToneLoops]);

  useEffect(() => {
    if (currentCall?.status === "active" || currentCall?.status === "connecting") {
      stopToneLoops();
    }
  }, [currentCall?.status, stopToneLoops]);

  useEffect(() => {
    const previous = publishedCallStateRef.current;
    const nextId = currentCall?.id ?? null;
    const nextStatus = currentCall?.status ?? null;
    const nextConversationId = currentCall?.conversationId ?? null;
    const changedConversationId =
      previous.id !== nextId || previous.status !== nextStatus
        ? nextConversationId ?? previous.conversationId
        : null;

    const detail: MotionCallStateDetail = {
      session: currentCall,
      statusLabel: currentCallStatusLabel,
      busy: Boolean(callStartingMode) || callBusy || Boolean(currentCall),
      error: callError,
      conversationId: changedConversationId,
    };

    window.dispatchEvent(
      new CustomEvent<MotionCallStateDetail>(MOTION_CALL_STATE_EVENT, { detail }),
    );

    publishedCallStateRef.current = {
      id: nextId,
      status: nextStatus,
      conversationId: nextConversationId ?? previous.conversationId ?? null,
    };
  }, [callBusy, callError, callStartingMode, currentCall, currentCallStatusLabel]);

  useEffect(() => {
    const handleStartCall = (event: Event) => {
      const detail = (event as CustomEvent<MotionStartCallDetail>).detail;

      if (
        !detail ||
        typeof detail.conversationId !== "string" ||
        (detail.mode !== "voice" && detail.mode !== "video")
      ) {
        return;
      }

      void startCall(
        detail.conversationId,
        detail.mode,
        Array.isArray(detail.participantIds) ? detail.participantIds : [],
      );
    };

    const handleSyncRequest = () => {
      const detail: MotionCallStateDetail = {
        session: currentCall,
        statusLabel: currentCallStatusLabel,
        busy: Boolean(callStartingMode) || callBusy || Boolean(currentCall),
        error: callError,
      };

      window.dispatchEvent(
        new CustomEvent<MotionCallStateDetail>(MOTION_CALL_STATE_EVENT, { detail }),
      );
    };

    window.addEventListener(MOTION_START_CALL_EVENT, handleStartCall as EventListener);
    window.addEventListener(
      MOTION_CALL_SYNC_REQUEST_EVENT,
      handleSyncRequest as EventListener,
    );

    return () => {
      window.removeEventListener(MOTION_START_CALL_EVENT, handleStartCall as EventListener);
      window.removeEventListener(
        MOTION_CALL_SYNC_REQUEST_EVENT,
        handleSyncRequest as EventListener,
      );
    };
  }, [callBusy, callError, callStartingMode, currentCall, currentCallStatusLabel, startCall]);

  useEffect(() => {
    return () => {
      stopToneLoops();
      teardownCallConnection();

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, [stopToneLoops, teardownCallConnection]);

  const remoteParticipants = useMemo(
    () => getRemoteParticipants(currentCall),
    [currentCall, getRemoteParticipants],
  );
  const allParticipantIds = useMemo(
    () => new Set(currentCall?.participants.map((participant) => participant.userId) ?? []),
    [currentCall],
  );
  const stageParticipantId = useMemo(
    () => getStageParticipantId(currentCall),
    [currentCall, getStageParticipantId],
  );
  const remoteVideoReadyByUserId: Record<string, boolean> = {};

  remoteParticipants.forEach((participant) => {
    remoteVideoReadyByUserId[participant.userId] =
      (remoteCallStreamsRef.current.get(participant.userId)?.getVideoTracks().length ?? 0) > 0;
  });

  useEffect(() => {
    remoteParticipants.forEach((participant) => {
      syncBoundRemoteParticipantVideo(participant.userId);
    });
  }, [remoteParticipants, remoteStreamsVersion, syncBoundRemoteParticipantVideo]);

  useEffect(() => {
    if (!pinnedParticipantId) {
      return;
    }

    if (!allParticipantIds.has(pinnedParticipantId)) {
      setPinnedParticipantId(null);
    }
  }, [allParticipantIds, pinnedParticipantId]);

  useEffect(() => {
    if (!currentCall?.isGroup) {
      previousParticipantStateRef.current = new Map();
      previousParticipantCallIdRef.current = currentCall?.id ?? null;
      return;
    }

    const nextState = new Map(
      currentCall.participants
        .filter((participant) => participant.userId !== currentCall.currentUserId)
        .map((participant) => [
          participant.userId,
          { joined: participant.joined, name: participant.name },
        ]),
    );

    if (previousParticipantCallIdRef.current !== currentCall.id) {
      previousParticipantStateRef.current = nextState;
      previousParticipantCallIdRef.current = currentCall.id;
      return;
    }

    const previousState = previousParticipantStateRef.current;

    nextState.forEach((participantState, userId) => {
      const previousParticipantState = previousState.get(userId);

      if (!previousParticipantState) {
        if (participantState.joined) {
          enqueueCallToast(`${participantState.name} joined the call`, "join");
        }
        return;
      }

      if (!previousParticipantState.joined && participantState.joined) {
        enqueueCallToast(`${participantState.name} joined the call`, "join");
      }

      if (previousParticipantState.joined && !participantState.joined) {
        enqueueCallToast(`${participantState.name} left the call`, "leave");
      }
    });

    previousState.forEach((participantState, userId) => {
      if (participantState.joined && !nextState.has(userId)) {
        enqueueCallToast(`${participantState.name} left the call`, "leave");
      }
    });

    previousParticipantStateRef.current = nextState;
  }, [currentCall, enqueueCallToast]);

  useEffect(() => {
    if (!currentCall || currentCall.status !== "active") {
      setLocalSpeaking(false);
      setRemoteSpeakingByUserId({});
      return;
    }

    let cancelled = false;
    let sampleTimer: number | null = null;
    const disconnectors: Array<() => void> = [];

    const setupMeters = async () => {
      const audioContext = await ensureAudioContextForRecording();

      if (!audioContext || cancelled) {
        return;
      }

      type Meter = {
        id: string;
        analyser: AnalyserNode;
        data: Uint8Array<ArrayBuffer>;
        enabled: () => boolean;
        local: boolean;
      };

      const meters: Meter[] = [];
      const registerMeter = (
        id: string,
        stream: MediaStream | null,
        enabled: () => boolean,
        local: boolean,
      ) => {
        if (!stream || stream.getAudioTracks().length === 0) {
          return;
        }

        try {
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;
          source.connect(analyser);
          meters.push({
            id,
            analyser,
            data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
            enabled,
            local,
          });
          disconnectors.push(() => {
            try {
              source.disconnect();
            } catch {
              // Ignore teardown issues.
            }

            try {
              analyser.disconnect();
            } catch {
              // Ignore teardown issues.
            }
          });
        } catch {
          // Ignore analyser setup failures for unsupported tracks.
        }
      };

      registerMeter(
        "__local__",
        localCallStreamRef.current,
        () =>
          !callMuted &&
          Boolean(localCallStreamRef.current?.getAudioTracks().some((track) => track.enabled)),
        true,
      );

      remoteCallStreamsRef.current.forEach((stream, userId) => {
        registerMeter(
          userId,
          stream,
          () =>
            Boolean(
              currentCallRef.current?.participants.find((participant) => participant.userId === userId)
                ?.audioEnabled,
            ),
          false,
        );
      });

      const readSpeakingLevel = (meter: Meter) => {
        meter.analyser.getByteTimeDomainData(meter.data);

        let sum = 0;

        for (let index = 0; index < meter.data.length; index += 1) {
          const normalized = (meter.data[index] - 128) / 128;
          sum += normalized * normalized;
        }

        return Math.sqrt(sum / meter.data.length);
      };

      const sampleMeters = () => {
        if (cancelled) {
          return;
        }

        let nextLocalSpeaking = false;
        const nextRemoteSpeaking: Record<string, boolean> = {};

        meters.forEach((meter) => {
          const speaking = meter.enabled() && readSpeakingLevel(meter) > 0.035;

          if (meter.local) {
            nextLocalSpeaking = speaking;
            return;
          }

          nextRemoteSpeaking[meter.id] = speaking;
        });

        setLocalSpeaking((current) =>
          current === nextLocalSpeaking ? current : nextLocalSpeaking,
        );
        setRemoteSpeakingByUserId((current) =>
          areBooleanRecordsEqual(current, nextRemoteSpeaking) ? current : nextRemoteSpeaking,
        );
      };

      sampleMeters();
      sampleTimer = window.setInterval(sampleMeters, 180);
    };

    void setupMeters();

    return () => {
      cancelled = true;

      if (sampleTimer !== null) {
        window.clearInterval(sampleTimer);
      }

      disconnectors.forEach((disconnect) => disconnect());
      setLocalSpeaking(false);
      setRemoteSpeakingByUserId({});
    };
  }, [callMuted, currentCall, ensureAudioContextForRecording, remoteStreamsVersion]);

  useEffect(() => {
    if (!currentCall || currentCall.status !== "active") {
      setRemoteNetworkQualityByUserId({});
      setLocalNetworkQuality("unknown");
      return;
    }

    let cancelled = false;
    let pollTimer: number | null = null;

    const syncPeerQualities = async () => {
      const qualityEntries = await Promise.all(
        [...callPeersRef.current.entries()].map(async ([userId, peer]) => [
          userId,
          await measurePeerNetworkQuality(peer),
        ] as const),
      );

      if (cancelled) {
        return;
      }

      const nextRemoteQualityByUserId = Object.fromEntries(qualityEntries) as Record<
        string,
        NetworkQuality
      >;

      setRemoteNetworkQualityByUserId((current) =>
        areStringRecordsEqual(
          current,
          nextRemoteQualityByUserId,
        )
          ? current
          : nextRemoteQualityByUserId,
      );

      const knownQualities = qualityEntries.map(([, quality]) => quality);

      setLocalNetworkQuality(
        knownQualities.length > 0
          ? pickWorstNetworkQuality(knownQualities)
          : callConnectionState === "connected"
            ? "good"
            : callConnectionState === "connecting"
              ? "fair"
              : "unknown",
      );
    };

    void syncPeerQualities();
    pollTimer = window.setInterval(() => {
      void syncPeerQualities();
    }, 2400);

    return () => {
      cancelled = true;

      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
    };
  }, [callConnectionState, currentCall, remoteStreamsVersion]);

  return (
    <ChatCallOverlay
      session={currentCall}
      localVideoRef={localCallVideoRef}
      remoteVideoRef={remoteCallVideoRef}
      remoteVideoReady={remoteCallVideoReady}
      remoteParticipants={remoteParticipants}
      stageParticipantId={stageParticipantId}
      pinnedParticipantId={pinnedParticipantId}
      bindRemoteParticipantVideoElement={bindRemoteParticipantVideoElement}
      remoteVideoReadyByUserId={remoteVideoReadyByUserId}
      localVideoReady={localCallVideoReady}
      localSpeaking={localSpeaking}
      remoteSpeakingByUserId={remoteSpeakingByUserId}
      localNetworkQuality={localNetworkQuality}
      remoteNetworkQualityByUserId={remoteNetworkQualityByUserId}
      muted={callMuted}
      videoEnabled={callVideoEnabled}
      callRecordingActive={callRecordingActive}
      screenSharing={screenSharing}
      callQuality={callQuality}
      busy={Boolean(callStartingMode) || callBusy || callRecordingBusy}
      callError={callError}
      callToasts={callToasts}
      statusLabel={currentCallStatusLabel}
      liveDurationLabel={liveDurationLabel}
      minimized={callMinimized}
      canMinimize={canMinimize}
      onAnswer={() => {
        void answerCurrentCall();
      }}
      onDecline={() => {
        void declineCurrentCall();
      }}
      onEnd={() => {
        void endCurrentCall();
      }}
      onToggleMute={() => {
        void toggleCallMute();
      }}
      onToggleVideo={() => {
        void toggleCallVideo();
      }}
      onToggleScreenShare={() => {
        if (screenSharing) {
          void stopScreenShare();
          return;
        }

        void startScreenShare();
      }}
      onToggleRecording={() => {
        if (callRecordingActive) {
          void stopCallRecording();
          return;
        }

        void startCallRecording();
      }}
      onCallQualityChange={(quality) => {
        void changeCallQuality(quality);
      }}
      onPinParticipant={(participantId) => {
        setPinnedParticipantId(participantId);
      }}
      onUnpinParticipant={() => {
        setPinnedParticipantId(null);
      }}
      onMinimize={() => {
        setCallMinimized(true);
      }}
      onRestore={() => {
        setCallMinimized(false);
      }}
    />
  );
}
