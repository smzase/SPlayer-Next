import {
  matchAudioFingerprint,
  type AudioRecognitionMatch,
} from "@/apis/audio-recognition/netease";
import { generateAudioFingerprint } from "@/services/audioFingerprint";
import { pause } from "@/core/player";
import { useStatusStore } from "@/stores/status";

export type AudioRecognitionPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "matching"
  | "success"
  | "empty"
  | "error";

export type AudioRecognitionFailure =
  | ""
  | "unsupported"
  | "permission"
  | "noAudio"
  | "capture"
  | "fingerprint"
  | "network";

const SAMPLE_RATE = 8_000;
// shazam_v2 按 3 秒帧校验指纹，非 3 秒倍数会稳定返回无匹配。
const ATTEMPT_DURATION_SECONDS = 3;
const MAX_DURATION_SECONDS = 16;
const ATTEMPT_SAMPLES = SAMPLE_RATE * ATTEMPT_DURATION_SECONDS;
const MAX_SAMPLES = SAMPLE_RATE * MAX_DURATION_SECONDS;

/** 带实时歌词时间锚点的听歌识曲候选 */
export interface AudioRecognitionResult extends AudioRecognitionMatch {
  /** 收到识曲结果时，候选歌曲推算到的播放位置（毫秒） */
  positionAtResult: number | null;
  /** 收到结果的本地时间戳，用于继续推进歌词 */
  resultTimestamp: number;
}

/** 听歌识曲状态与系统音频采集生命周期 */
export const useAudioRecognitionStore = defineStore("audioRecognition", () => {
  const phase = ref<AudioRecognitionPhase>("idle");
  const failure = ref<AudioRecognitionFailure>("");
  const error = ref("");
  const elapsedMs = ref(0);
  const results = shallowRef<AudioRecognitionResult[]>([]);
  const isActive = computed(() => ["requesting", "recording", "matching"].includes(phase.value));

  let runToken = 0;
  let stream: MediaStream | undefined;
  let audioContext: AudioContext | undefined;
  let sourceNode: MediaStreamAudioSourceNode | undefined;
  let processorNode: ScriptProcessorNode | undefined;
  let silentGain: GainNode | undefined;
  let elapsedTimer: ReturnType<typeof setInterval> | undefined;

  /** 释放一轮识别持有的媒体对象 */
  const releaseCapture = (): void => {
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = undefined;
    if (processorNode) processorNode.onaudioprocess = null;
    sourceNode?.disconnect();
    processorNode?.disconnect();
    silentGain?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    if (audioContext) void audioContext.close();
    stream = undefined;
    audioContext = undefined;
    sourceNode = undefined;
    processorNode = undefined;
    silentGain = undefined;
  };

  /** 将当前轮次结束为本地错误 */
  const fail = (token: number, kind: AudioRecognitionFailure, reason?: unknown): void => {
    if (token !== runToken) return;
    releaseCapture();
    phase.value = "error";
    failure.value = kind;
    error.value = reason instanceof Error ? reason.message : reason ? String(reason) : "";
  };

  /** 停止当前识别 */
  const stop = (): void => {
    runToken += 1;
    releaseCapture();
    phase.value = "idle";
    failure.value = "";
    error.value = "";
    elapsedMs.value = 0;
  };

  /** 开始一轮最长 16 秒的系统回放识别 */
  const start = async (): Promise<void> => {
    if (isActive.value) return;
    runToken += 1;
    const token = runToken;
    releaseCapture();
    phase.value = "requesting";
    failure.value = "";
    error.value = "";
    elapsedMs.value = 0;
    results.value = [];

    if (window.api.system.platform !== "win32") {
      fail(token, "unsupported");
      return;
    }

    if (useStatusStore().isPlaying) void pause();

    let requestedStream: MediaStream;
    try {
      requestedStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
    } catch (reason) {
      const name = reason instanceof DOMException ? reason.name : "";
      fail(token, name === "NotAllowedError" ? "permission" : "capture", reason);
      return;
    }

    if (token !== runToken) {
      requestedStream.getTracks().forEach((track) => track.stop());
      return;
    }
    requestedStream.getVideoTracks().forEach((track) => track.stop());
    const audioTrack = requestedStream.getAudioTracks()[0];
    if (!audioTrack) {
      requestedStream.getTracks().forEach((track) => track.stop());
      fail(token, "noAudio");
      return;
    }

    stream = new MediaStream([audioTrack]);
    audioTrack.addEventListener(
      "ended",
      () => {
        if (token === runToken && phase.value === "recording") fail(token, "capture");
      },
      { once: true },
    );

    try {
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      await audioContext.resume();
      if (audioContext.sampleRate !== SAMPLE_RATE) {
        fail(token, "capture", `unsupported sample rate: ${audioContext.sampleRate}`);
        return;
      }
      sourceNode = audioContext.createMediaStreamSource(stream);
      processorNode = audioContext.createScriptProcessor(2048, 1, 1);
      silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      sourceNode.connect(processorNode);
      processorNode.connect(silentGain);
      silentGain.connect(audioContext.destination);
    } catch (reason) {
      fail(token, "capture", reason);
      return;
    }

    const sessionId = crypto.randomUUID().replaceAll("-", "");
    const samples = new Float32Array(MAX_SAMPLES);
    let capturedSamples = 0;
    let nextAttemptAt = ATTEMPT_SAMPLES;
    let successfulAttempts = 0;
    let lastMatchError: unknown;
    let processing = Promise.resolve();
    const startedAt = performance.now();

    phase.value = "recording";
    elapsedTimer = setInterval(() => {
      elapsedMs.value = Math.min(MAX_DURATION_SECONDS * 1000, performance.now() - startedAt);
    }, 100);

    const queueAttempt = (attemptSamples: Float32Array, attempt: number): void => {
      processing = processing.then(async () => {
        if (token !== runToken || results.value.length > 0) return;
        try {
          const audioFP = await generateAudioFingerprint(attemptSamples);
          if (token !== runToken) return;
          const matches = await matchAudioFingerprint(
            audioFP,
            attemptSamples.length / SAMPLE_RATE,
            attempt,
            sessionId,
          );
          successfulAttempts += 1;
          if (token !== runToken || matches.length === 0) return;
          const resultTimestamp = Date.now();
          const elapsedFromClipStart = Math.max(0, performance.now() - startedAt);
          results.value = matches.map((match) => ({
            ...match,
            positionAtResult:
              match.startTime === null ? null : match.startTime + elapsedFromClipStart,
            resultTimestamp,
          }));
          phase.value = "success";
          releaseCapture();
        } catch (reason) {
          lastMatchError = reason;
        }
      });
    };

    processorNode.onaudioprocess = (event) => {
      if (token !== runToken || phase.value !== "recording") return;
      const input = event.inputBuffer.getChannelData(0);
      const writable = Math.min(input.length, MAX_SAMPLES - capturedSamples);
      samples.set(input.subarray(0, writable), capturedSamples);
      capturedSamples += writable;
      elapsedMs.value = Math.min(
        MAX_DURATION_SECONDS * 1000,
        (capturedSamples / SAMPLE_RATE) * 1000,
      );

      while (capturedSamples >= nextAttemptAt && nextAttemptAt <= MAX_SAMPLES) {
        const attempt = nextAttemptAt / ATTEMPT_SAMPLES;
        // 后续查询保留前段音频，让较长指纹包含跨段特征并提高弱特征片段的命中率。
        queueAttempt(samples.slice(0, nextAttemptAt), attempt);
        nextAttemptAt += ATTEMPT_SAMPLES;
      }

      if (capturedSamples < MAX_SAMPLES) return;
      phase.value = "matching";
      releaseCapture();
      void processing.then(() => {
        if (token !== runToken || results.value.length > 0) return;
        if (successfulAttempts > 0) {
          phase.value = "empty";
          return;
        }
        const kind = lastMatchError ? "network" : "fingerprint";
        fail(token, kind, lastMatchError);
      });
    };
  };

  return {
    phase,
    failure,
    error,
    elapsedMs,
    results,
    isActive,
    start,
    stop,
  };
});
